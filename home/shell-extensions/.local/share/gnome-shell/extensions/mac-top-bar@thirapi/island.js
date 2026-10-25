/*
 * Island: the clock island grows a "stage" on its right that shows live
 * activity and animates its width in and out, like a dynamic island:
 *   media    the current MPRIS player: cover, title, a small visualizer;
 *            hover swaps the visualizer for previous / play-pause / next;
 *            a title too long for its slot scrolls as a marquee
 *   osd      volume and brightness levels, instead of the centre-screen OSD
 *   battery  a short note when the charger is plugged in or the battery
 *            drops to the low threshold
 *   record   a pulsing dot and the elapsed time while the screen is being
 *            recorded; clicking it stops the recording. It replaces the
 *            shell's own recording indicator and outranks media.
 * OSD and battery are transient and take the stage for a moment; media
 * comes back afterwards. A paused player lingers for a minute, then the
 * stage folds away until something plays again.
 *
 * Styled by the .island-* rules in the Mocha-Mac shell theme.
 */

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

import * as BarLevel from 'resource:///org/gnome/shell/ui/barLevel.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Mpris from 'resource:///org/gnome/shell/ui/mpris.js';

const RESIZE_TIME = 250;
const OSD_TIME = 1500;
const BATTERY_TIME = 2500;
const PAUSED_LINGER_SECONDS = 60;
const VISUALIZER_INTERVAL = 160;
const VISUALIZER_BARS = 3;
const VISUALIZER_MIN = 4;
const VISUALIZER_MAX = 14;
const LOW_BATTERY = 20;
const RECORD_PULSE_TIME = 500;
const TITLE_MAX_WIDTH = 180;
const MARQUEE_SPEED = 30; // px per second
const MARQUEE_PAUSE = 2000;
const MARQUEE_GAP = '     ';

// org.freedesktop.UPower.Device State values
const UPOWER_CHARGING = 1;
const UPOWER_DISCHARGING = 2;

export class Island {
    enable() {
        this._transient = null;
        this._transientId = 0;
        this._lingerId = 0;
        this._visualizerId = 0;
        this._marqueeId = 0;
        this._recordId = 0;
        this._recordStart = 0;
        this._marqueeRunning = false;
        this._titleText = null;
        this._targetWidth = 0;
        this._player = null;
        this._mediaVisible = false;
        this._players = new Set();
        this._cancellable = new Gio.Cancellable();

        // A fixed layout keeps every view at its natural width while the
        // stage's own width animates and clips it.
        this._stage = new St.Widget({
            style_class: 'island-stage',
            clip_to_allocation: true,
            y_expand: true,
            visible: false,
            width: 0,
        });
        Main.panel._centerBox.add_child(this._stage);

        this._views = {
            media: this._buildMedia(),
            osd: this._buildOsd(),
            battery: this._buildBattery(),
            record: this._buildRecord(),
        };
        for (const view of Object.values(this._views)) {
            // A view shown from the folded state may first measure before its
            // style is applied (narrower than it ends up); follow its real
            // width so the stage never clips it.
            view.connect('notify::width', () => {
                if (view.visible && this._targetWidth > 0)
                    this._update();
            });
            view.hide();
            view.add_constraint(new Clutter.AlignConstraint({
                source: this._stage,
                align_axis: Clutter.AlignAxis.Y_AXIS,
                factor: 0.5,
            }));
            this._stage.add_child(view);
        }

        this._watchMedia();
        this._patchOsd();
        this._watchBattery();
        this._watchRecording();
        this._update();
    }

    disable() {
        this._stopMarquee();
        this._cancellable.cancel();
        for (const id of [this._transientId, this._lingerId, this._visualizerId, this._marqueeId,
            this._recordId]) {
            if (id)
                GLib.source_remove(id);
        }

        this._restoreOsd();
        this._unwatchRecording();
        this._recordDot.remove_all_transitions();

        this._battery?.disconnectObject(this);
        this._battery = null;

        for (const player of this._players)
            player.disconnectObject(this);
        this._players.clear();
        this._source.disconnectObject(this);
        this._source = null;
        this._player = null;

        this._stage.destroy();
        this._stage = null;
        this._views = null;
    }

    // ───── stage ─────

    _update() {
        const name = this._transient ?? (this._recordStart ? 'record'
            : this._mediaVisible && this._player ? 'media' : null);
        const view = name ? this._views[name] : null;

        // While folding away, the old view stays visible under the clip.
        if (view) {
            for (const v of Object.values(this._views))
                v.visible = v === view;
        }
        this._syncVisualizer();
        this._syncMarquee();

        const target = view ? Math.ceil(view.get_preferred_width(-1)[1]) : 0;
        if (target === this._targetWidth)
            return;
        this._targetWidth = target;

        if (target > 0)
            this._stage.show();
        this._stage.ease({
            width: target,
            duration: RESIZE_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                if (this._stage && this._targetWidth === 0) {
                    this._stage.hide();
                    Object.values(this._views).forEach(v => v.hide());
                    this._syncVisualizer();
                    this._syncMarquee();
                }
            },
        });
    }

    _setTransient(name, timeout) {
        if (this._transientId)
            GLib.source_remove(this._transientId);

        this._transient = name;
        this._transientId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, timeout, () => {
            this._transientId = 0;
            this._transient = null;
            this._update();
            return GLib.SOURCE_REMOVE;
        });
        this._update();
    }

    // ───── media ─────

    _buildMedia() {
        const box = new St.BoxLayout({
            style_class: 'island-view island-media',
            reactive: true,
            track_hover: true,
        });

        this._cover = new St.Icon({
            style_class: 'island-cover',
            fallback_icon_name: 'audio-x-generic-symbolic',
        });
        // The label keeps its natural width inside a clipping slot at most
        // TITLE_MAX_WIDTH wide; a longer title slides through the slot.
        this._title = new St.Label({style_class: 'island-title'});
        this._title.connect('style-changed', () => this._layoutTitle());
        this._titleSlot = new St.Widget({
            clip_to_allocation: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._titleSlot.add_child(this._title);

        const source = new St.BoxLayout({style_class: 'island-media-source'});
        source.add_child(this._cover);
        source.add_child(this._titleSlot);
        const sourceButton = new St.Button({child: source, y_align: Clutter.ActorAlign.CENTER});
        sourceButton.connect('clicked', () => this._player?.raise());
        box.add_child(sourceButton);

        this._visualizer = new St.BoxLayout({
            style_class: 'island-visualizer',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._bars = [];
        for (let i = 0; i < VISUALIZER_BARS; i++) {
            const bar = new St.Widget({
                style_class: 'island-visualizer-bar',
                y_align: Clutter.ActorAlign.CENTER,
                height: VISUALIZER_MIN,
            });
            this._bars.push(bar);
            this._visualizer.add_child(bar);
        }
        box.add_child(this._visualizer);

        this._controls = new St.BoxLayout({
            style_class: 'island-controls',
            y_align: Clutter.ActorAlign.CENTER,
            visible: false,
        });
        const control = (icon, action) => {
            const button = new St.Button({
                style_class: 'island-control',
                child: new St.Icon({icon_name: icon}),
            });
            button.connect('clicked', () => action(this._player));
            this._controls.add_child(button);
            return button;
        };
        this._prevButton = control('media-skip-backward-symbolic', p => p?.previous());
        this._playButton = control('media-playback-start-symbolic', p => p?.playPause());
        this._nextButton = control('media-skip-forward-symbolic', p => p?.next());
        box.add_child(this._controls);

        box.connect('notify::hover', () => {
            this._syncMediaExtras();
            this._update();
        });

        return box;
    }

    // The shell's own media source (the one behind the calendar's media
    // player) when it can be reached; otherwise one of our own.
    _watchMedia() {
        this._source = Main.panel.statusArea.dateMenu?._messageList?._messageView?._mediaSource ??
            new Mpris.MprisSource();

        this._source.connectObject(
            'player-added', (_source, player) => this._trackPlayer(player),
            'player-removed', (_source, player) => this._untrackPlayer(player), this);
        this._source.players.forEach(player => this._trackPlayer(player));
    }

    _trackPlayer(player) {
        if (this._players.has(player))
            return;
        this._players.add(player);
        player.connectObject('changed', () => this._onPlayersChanged(), this);
        this._onPlayersChanged();
    }

    _untrackPlayer(player) {
        player.disconnectObject(this);
        this._players.delete(player);
        this._onPlayersChanged();
    }

    _onPlayersChanged() {
        const players = this._source.players;
        const playing = players.find(p => p.status === 'Playing');
        const current = players.includes(this._player) ? this._player : null;
        this._player = playing ?? current ?? players.find(p => p.status === 'Paused') ?? null;

        const status = this._player?.status;
        if (status === 'Playing') {
            this._stopLinger();
            this._mediaVisible = true;
        } else if (status === 'Paused' && this._mediaVisible) {
            // A paused player stays a while, then folds away.
            this._lingerId ||= GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, PAUSED_LINGER_SECONDS, () => {
                this._lingerId = 0;
                this._mediaVisible = false;
                this._update();
                return GLib.SOURCE_REMOVE;
            });
        } else if (status !== 'Paused') {
            this._stopLinger();
            this._mediaVisible = false;
        }

        this._syncMedia();
        this._update();
    }

    // Hover shows the controls; otherwise the visualizer, but only while
    // something plays (paused, its three flat bars read as a "⋯" menu).
    _syncMediaExtras() {
        const hover = this._views.media.hover;
        this._controls.visible = hover;
        this._visualizer.visible = !hover && this._player?.status === 'Playing';
    }

    _stopLinger() {
        if (this._lingerId) {
            GLib.source_remove(this._lingerId);
            this._lingerId = 0;
        }
    }

    _syncMedia() {
        const player = this._player;
        if (!player)
            return;

        this._setTitle(player.trackTitle || player.app?.get_name() || '');
        const url = player.trackCoverUrl;
        this._cover.gicon = url ? new Gio.FileIcon({file: Gio.File.new_for_uri(url)}) : null;

        const playing = player.status === 'Playing';
        this._playButton.child.icon_name = playing
            ? 'media-playback-pause-symbolic' : 'media-playback-start-symbolic';
        this._prevButton.reactive = player.canGoPrevious;
        this._nextButton.reactive = player.canGoNext;
        this._syncMediaExtras();
    }

    _setTitle(text) {
        if (text === this._titleText)
            return;
        this._titleText = text;
        this._layoutTitle();
    }

    // Size the slot to the title, and for a title that overflows it, lay the
    // text out twice so the scroll can wrap around without a jump.
    _layoutTitle() {
        const text = this._titleText ?? '';
        this._stopMarquee();

        this._title.text = text;
        const natural = this._title.get_preferred_width(-1)[1];
        this._titleSlot.width = Math.ceil(Math.min(natural, TITLE_MAX_WIDTH));

        this._marqueeDistance = 0;
        if (natural > TITLE_MAX_WIDTH) {
            this._title.text = `${text}${MARQUEE_GAP}${text}`;
            this._marqueeDistance = this._title.get_preferred_width(-1)[1] - natural;
        }
        this._syncMarquee();
    }

    _syncMarquee() {
        const run = this._marqueeDistance > 0 && this._stage.visible &&
            this._views.media.visible;

        if (run && !this._marqueeRunning) {
            this._marqueeRunning = true;
            this._queueMarquee();
        } else if (!run && this._marqueeRunning) {
            this._stopMarquee();
        }
    }

    // Rest at the start, slide one title-plus-gap to the left (where the
    // second copy lines up with the first), snap back, rest again.
    _queueMarquee() {
        this._marqueeId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, MARQUEE_PAUSE, () => {
            this._marqueeId = 0;
            this._title.ease({
                translation_x: -this._marqueeDistance,
                duration: this._marqueeDistance / MARQUEE_SPEED * 1000,
                mode: Clutter.AnimationMode.LINEAR,
                onStopped: finished => {
                    this._title.translation_x = 0;
                    if (finished && this._marqueeRunning)
                        this._queueMarquee();
                },
            });
            return GLib.SOURCE_REMOVE;
        });
    }

    _stopMarquee() {
        this._marqueeRunning = false;
        if (this._marqueeId) {
            GLib.source_remove(this._marqueeId);
            this._marqueeId = 0;
        }
        this._title.remove_all_transitions();
        this._title.translation_x = 0;
    }

    // Decorative bars, not a real spectrum: they bounce while something plays.
    _syncVisualizer() {
        const run = this._views.media.visible && this._visualizer.visible &&
            this._player?.status === 'Playing';

        if (run && !this._visualizerId) {
            this._visualizerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, VISUALIZER_INTERVAL, () => {
                for (const bar of this._bars) {
                    bar.ease({
                        height: VISUALIZER_MIN + Math.random() * (VISUALIZER_MAX - VISUALIZER_MIN),
                        duration: VISUALIZER_INTERVAL,
                        mode: Clutter.AnimationMode.EASE_IN_OUT_QUAD,
                    });
                }
                return GLib.SOURCE_CONTINUE;
            });
        } else if (!run && this._visualizerId) {
            GLib.source_remove(this._visualizerId);
            this._visualizerId = 0;
            this._bars.forEach(bar => bar.ease({height: VISUALIZER_MIN, duration: VISUALIZER_INTERVAL}));
        }
    }

    // ───── screen recording ─────

    _buildRecord() {
        const box = new St.BoxLayout({style_class: 'island-view island-record'});
        this._recordDot = new St.Widget({
            style_class: 'island-record-dot',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._recordLabel = new St.Label({
            style_class: 'island-record-label',
            y_align: Clutter.ActorAlign.CENTER,
        });
        box.add_child(this._recordDot);
        box.add_child(this._recordLabel);

        const button = new St.Button({
            child: box,
            accessible_name: 'Stop Screencast',
            y_align: Clutter.ActorAlign.CENTER,
        });
        button.connect('clicked', () => Main.screenshotUI.stopScreencast());
        return button;
    }

    // The island takes over from the shell's own indicator; hiding its
    // container leaves the indicator's show/hide logic untouched.
    _watchRecording() {
        this._stockRecording = Main.panel.statusArea.screenRecording?.container ?? null;
        this._stockRecording?.hide();

        Main.screenshotUI.connectObject('notify::screencast-in-progress',
            () => this._syncRecording(), this);
        this._syncRecording();
    }

    _unwatchRecording() {
        Main.screenshotUI.disconnectObject(this);
        this._stockRecording?.show();
        this._stockRecording = null;
    }

    _syncRecording() {
        const recording = Main.screenshotUI.screencast_in_progress;

        if (recording && !this._recordStart) {
            this._recordStart = GLib.get_monotonic_time();
            this._recordTick(true);
            this._recordId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
                this._recordTick(false);
                return GLib.SOURCE_CONTINUE;
            });
        } else if (!recording && this._recordStart) {
            this._recordStart = 0;
            GLib.source_remove(this._recordId);
            this._recordId = 0;
            this._recordDot.remove_all_transitions();
            this._recordDot.opacity = 255;
        }
        this._update();
    }

    // Once a second: the elapsed time, and the dot fades out and back in.
    _recordTick(first) {
        const seconds = Math.floor((GLib.get_monotonic_time() - this._recordStart) / 1e6);
        this._recordLabel.text = `${Math.floor(seconds / 60)}:${`${seconds % 60}`.padStart(2, '0')}`;
        if (first)
            return;

        this._recordDot.ease({
            opacity: 70,
            duration: RECORD_PULSE_TIME,
            mode: Clutter.AnimationMode.EASE_IN_OUT_QUAD,
            onComplete: () => this._recordDot?.ease({
                opacity: 255,
                duration: RECORD_PULSE_TIME,
                mode: Clutter.AnimationMode.EASE_IN_OUT_QUAD,
            }),
        });
    }

    // ───── OSD ─────

    _buildOsd() {
        const box = new St.BoxLayout({style_class: 'island-view island-osd'});
        this._osdIcon = new St.Icon({style_class: 'island-osd-icon', y_align: Clutter.ActorAlign.CENTER});
        this._osdLevel = new BarLevel.BarLevel({
            style_class: 'island-level',
            y_align: Clutter.ActorAlign.CENTER,
            value: 0,
        });
        this._osdLabel = new St.Label({style_class: 'island-osd-label', y_align: Clutter.ActorAlign.CENTER});
        box.add_child(this._osdIcon);
        box.add_child(this._osdLevel);
        box.add_child(this._osdLabel);
        return box;
    }

    // Every volume / brightness OSD goes through _showOsdWindow. Levels for
    // the primary monitor land in the island; OSDs without a level (keyboard
    // layout, …) and other monitors keep the stock window. Volume keys come
    // with the output device's name as label, which the island leaves out.
    _patchOsd() {
        const manager = Main.osdWindowManager;
        const original = manager._showOsdWindow;
        manager._showOsdWindow = (monitorIndex, icon, label, level, maxLevel) => {
            if (monitorIndex !== Main.layoutManager.primaryIndex || level == null) {
                original.call(manager, monitorIndex, icon, label, level, maxLevel);
                return;
            }
            this._showLevel(icon, level, maxLevel);
        };
    }

    _restoreOsd() {
        // The patch is an own property; removing it exposes the class method.
        delete Main.osdWindowManager._showOsdWindow;
    }

    _showLevel(icon, level, maxLevel) {
        this._osdIcon.gicon = icon;
        this._osdLevel.maximum_value = maxLevel > 0 ? maxLevel : 1;
        if (this._transient === 'osd') {
            this._osdLevel.ease_property('value', level, {
                duration: 100,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });
        } else {
            this._osdLevel.value = level;
        }
        this._osdLabel.text = `${Math.round(level * 100)}`;
        this._setTransient('osd', OSD_TIME);
    }

    // ───── battery ─────

    _buildBattery() {
        const box = new St.BoxLayout({style_class: 'island-view island-battery'});
        this._batteryIcon = new St.Icon({style_class: 'island-battery-icon', y_align: Clutter.ActorAlign.CENTER});
        this._batteryLabel = new St.Label({style_class: 'island-battery-label', y_align: Clutter.ActorAlign.CENTER});
        box.add_child(this._batteryIcon);
        box.add_child(this._batteryLabel);
        return box;
    }

    _watchBattery() {
        Gio.DBusProxy.new_for_bus(
            Gio.BusType.SYSTEM, Gio.DBusProxyFlags.NONE, null,
            'org.freedesktop.UPower',
            '/org/freedesktop/UPower/devices/DisplayDevice',
            'org.freedesktop.UPower.Device',
            this._cancellable,
            (_object, result) => {
                try {
                    this._battery = Gio.DBusProxy.new_for_bus_finish(result);
                } catch (e) {
                    if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                        logError(e, 'mac-top-bar: UPower');
                    return;
                }
                this._lastState = this._batteryProp('State');
                this._lastPercent = this._batteryProp('Percentage');
                this._battery.connectObject(
                    'g-properties-changed', () => this._onBatteryChanged(), this);
            });
    }

    _batteryProp(name) {
        return this._battery?.get_cached_property(name)?.unpack() ?? null;
    }

    _onBatteryChanged() {
        if (!this._batteryProp('IsPresent'))
            return;

        const state = this._batteryProp('State');
        const percent = this._batteryProp('Percentage');

        const plugged = state === UPOWER_CHARGING && this._lastState !== UPOWER_CHARGING;
        const low = state === UPOWER_DISCHARGING &&
            percent <= LOW_BATTERY && this._lastPercent > LOW_BATTERY;

        this._lastState = state;
        this._lastPercent = percent;

        if (plugged || low)
            this._showBattery(percent, low);
    }

    _showBattery(percent, low) {
        this._batteryIcon.gicon = new Gio.ThemedIcon({
            name: this._batteryProp('IconName') ||
                (low ? 'battery-caution-symbolic' : 'battery-good-charging-symbolic'),
        });
        this._batteryLabel.text = `${Math.round(percent)}%`;
        this._views.battery.remove_style_class_name(low ? 'charging' : 'low');
        this._views.battery.add_style_class_name(low ? 'low' : 'charging');
        this._setTransient('battery', BATTERY_TIME);
    }
}
