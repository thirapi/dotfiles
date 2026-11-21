/*
 * Fill on open: a new app window opens filling its monitor's work area with
 * the 6px gap all round, the way Forge laid out a single window, but it stays
 * an ordinary window (not maximized): it can be dragged, resized and snapped
 * like any other. Dialogs, non-resizable windows and the apps below (small
 * tools that are meant to float) keep their own size.
 */

import GLib from 'gi://GLib';
import Meta from 'gi://Meta';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const GAP = 6;
// Let the client finish its own first resize before we place it.
const SETTLE_DELAY = 150;

// Windows that keep their own size, by WM class and optionally by title:
// a title matches when it contains the text, or, written '!text', when it
// doesn't (so '!Mozilla Firefox' means Firefox's small extra windows).
// Carried over from the Forge float rules.
const KEEP_SIZE = [
    {wmClass: 'org.gnome.Calculator'},
    {wmClass: 'org.gnome.Settings'},
    {wmClass: 'org.gnome.Extensions'},
    {wmClass: 'org.gnome.Shell.Extensions'},
    {wmClass: 'org.gnome.Nautilus'},
    {wmClass: 'Code'},
    {wmClass: 'brave-browser', title: 'Picture in picture'},
    {wmClass: 'gnome-terminal-preferences'},
    {wmClass: 'gnome-terminal-server', title: 'Preferences'},
    {wmClass: 'zoom'},
    {wmClass: 'Gnome-initial-setup'},
    {wmClass: 'Conky'},
    {wmClass: 'jetbrains-toolbox'},
    {wmClass: 'jetbrains-', title: 'splash'},
    {wmClass: 'firefox', title: '!Mozilla Firefox'},
    {wmClass: 'org.mozilla.firefox', title: '!Mozilla Firefox'},
    {wmClass: 'thunderbird', title: '!Mozilla Thunderbird'},
    {wmClass: 'org.mozilla.Thunderbird', title: '!Mozilla Thunderbird'},
];

function keepsSize(win) {
    const wmClass = win.get_wm_class() ?? '';
    const title = win.get_title() ?? '';
    return KEEP_SIZE.some(rule => {
        if (!wmClass.startsWith(rule.wmClass))
            return false;
        if (!rule.title)
            return true;
        return rule.title.startsWith('!')
            ? !title.includes(rule.title.slice(1))
            : title.includes(rule.title);
    });
}

export class FillOnOpen {
    enable() {
        this._pending = new Map(); // window -> timeout id
        global.display.connectObject(
            'window-created', (_display, win) => this._onWindowCreated(win), this);
    }

    disable() {
        global.display.disconnectObject(this);
        for (const [win, id] of this._pending) {
            GLib.source_remove(id);
            win.get_compositor_private()?.disconnectObject(this);
        }
        this._pending.clear();
    }

    _onWindowCreated(win) {
        if (win.get_window_type() !== Meta.WindowType.NORMAL ||
            win.get_transient_for() || win.is_skip_taskbar())
            return;

        const actor = win.get_compositor_private();
        if (!actor)
            return;

        // Decide once the window is on screen with its title and size known.
        actor.connectObject('first-frame', () => {
            actor.disconnectObject(this);
            const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, SETTLE_DELAY, () => {
                this._pending.delete(win);
                this._fill(win);
                return GLib.SOURCE_REMOVE;
            });
            this._pending.set(win, id);
        }, this);
    }

    _fill(win) {
        if (!win.get_compositor_private() || !win.allows_resize() || keepsSize(win) ||
            win.minimized || win.fullscreen ||
            win.maximizedHorizontally || win.maximizedVertically)
            return;

        const area = Main.layoutManager.getWorkAreaForMonitor(win.get_monitor());
        win.move_resize_frame(true,
            area.x + GAP, area.y + GAP,
            area.width - 2 * GAP, area.height - 2 * GAP);
    }
}
