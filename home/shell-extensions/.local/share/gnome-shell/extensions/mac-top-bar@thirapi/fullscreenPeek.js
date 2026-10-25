/*
 * Fullscreen peek: the macOS full-screen menu bar for GNOME's top bar.
 *
 * GNOME already hides the panel while the primary monitor has a fullscreen
 * window: LayoutManager tracks panelBox with trackFullscreen. Pushing the
 * pointer against the top edge clears that flag for a moment, so the panel
 * slides down over the fullscreen window; it slides back up once the pointer
 * leaves it and no panel menu is open. Struts never change (the layout
 * manager keeps the panel's strut even while it is hidden), so nothing else
 * moves. The slide moves Main.panel inside panelBox, never panelBox itself:
 * struts are computed from panelBox's on-screen position, so translating it
 * would drop the strut and make other maximized windows jump. Outside
 * fullscreen this does nothing.
 */

import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import * as Layout from 'resource:///org/gnome/shell/ui/layout.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PointerWatcher from 'resource:///org/gnome/shell/ui/pointerWatcher.js';

// Same push distance and window as the shell's own hot corner.
const PRESSURE_THRESHOLD = 100;
const PRESSURE_TIMEOUT = 1000;
const ANIMATION_TIME = 200;
const POINTER_INTERVAL = 100;
// How far below the panel the pointer may wander before it slides away.
const LEAVE_MARGIN = 12;

export class FullscreenPeek {
    enable() {
        this._layout = Main.layoutManager;
        this._panelBox = this._layout.panelBox;
        this._peeking = false;

        this._pressure = new Layout.PressureBarrier(
            PRESSURE_THRESHOLD, PRESSURE_TIMEOUT, Shell.ActionMode.NORMAL);
        this._pressure.connect('trigger', () => this._peek());

        this._layout.connectObject(
            'monitors-changed', () => this._updateBarrier(), this);
        global.display.connectObject('in-fullscreen-changed', () => {
            if (!this._layout.primaryMonitor?.inFullscreen)
                this._unpeek(false);
        }, this);

        this._updateBarrier();
    }

    disable() {
        // Runs a pending slide-up's cleanup now, before the references go.
        Main.panel.remove_all_transitions();
        this._unpeek(false);

        this._layout.disconnectObject(this);
        global.display.disconnectObject(this);
        this._destroyBarrier();
        this._pressure.destroy();

        this._pressure = null;
        this._panelBox = null;
        this._layout = null;
    }

    _updateBarrier() {
        this._destroyBarrier();

        const monitor = this._layout.primaryMonitor;
        if (!monitor)
            return;

        this._barrier = new Meta.Barrier({
            backend: global.backend,
            x1: monitor.x, x2: monitor.x + monitor.width,
            y1: monitor.y, y2: monitor.y,
            directions: Meta.BarrierDirection.POSITIVE_Y,
        });
        this._pressure.addBarrier(this._barrier);
    }

    _destroyBarrier() {
        if (!this._barrier)
            return;

        this._pressure.removeBarrier(this._barrier);
        this._barrier.destroy();
        this._barrier = null;
    }

    // The layout manager's record for panelBox; trackFullscreen lives there.
    _panelData() {
        return this._layout._trackedActors.find(a => a.actor === this._panelBox);
    }

    _peek() {
        if (this._peeking || Main.overview.visible ||
            !this._layout.primaryMonitor?.inFullscreen)
            return;

        const data = this._panelData();
        if (!data)
            return;

        // Finishes an unfinished slide-up first, so the state starts clean.
        Main.panel.remove_all_transitions();

        this._peeking = true;
        data.trackFullscreen = false;
        // A fullscreen window may be unredirected, which would paint over the panel.
        global.compositor.disable_unredirect();

        Main.panel.translation_y = -this._panelBox.height;
        this._panelBox.show();
        Main.panel.ease({
            translation_y: 0,
            duration: ANIMATION_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });

        this._watch = PointerWatcher.getPointerWatcher().addWatch(
            POINTER_INTERVAL, (_x, y) => this._onPointerMoved(y));
    }

    _onPointerMoved(y) {
        const [, panelY] = this._panelBox.get_transformed_position();
        if (y <= panelY + this._panelBox.height + LEAVE_MARGIN)
            return;
        if (Main.panel.menuManager.activeMenu)
            return;

        this._unpeek(true);
    }

    _unpeek(animate) {
        if (!this._peeking)
            return;

        this._peeking = false;
        this._watch?.remove();
        this._watch = null;

        const finish = () => {
            Main.panel.translation_y = 0;
            const data = this._panelData();
            if (data)
                data.trackFullscreen = true;
            // Hides the panel again if the monitor is still fullscreen.
            this._layout._updateVisibility();
            global.compositor.enable_unredirect();
        };

        Main.panel.remove_all_transitions();
        if (!animate) {
            finish();
            return;
        }

        Main.panel.ease({
            translation_y: -this._panelBox.height,
            duration: ANIMATION_TIME,
            mode: Clutter.AnimationMode.EASE_IN_QUAD,
            onStopped: finish,
        });
    }
}
