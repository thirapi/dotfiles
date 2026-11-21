/*
 * Solid bar: while a window on the active workspace of the primary monitor is
 * maximized, fullscreen or otherwise reaches up to the panel, #panel gets the
 * `solid` style class. The theme then draws one full-width bar in the header
 * bar colour instead of three floating islands, so the bar and the window read
 * as one surface, like the macOS menu bar over a zoomed window. The panel keeps
 * its height, so the work area (and every window) stays where it is.
 *
 * Forge tiles with a gap below the panel, so tiled windows keep the islands.
 *
 * Maximized windows are square (Rounded Window Corners leaves them so), and
 * two small corner pieces in the bar colour sit on their top corners: the
 * window reads as rounded at the top and tucked under the bar, like a zoomed
 * macOS window, while its bottom stays flush with the screen edge. They only
 * show while that window is the topmost one, so they never cover another.
 */

import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const STYLE_CLASS = 'solid';
// Window corner radius (libadwaita / Rounded Window Corners) and the bar
// colour of #panel.solid in the shell theme (mantle, #181825).
const CORNER_RADIUS = 15;
const BAR_COLOR = [0x18 / 255, 0x18 / 255, 0x25 / 255];

export class SolidBar {
    enable() {
        this._laterId = 0;
        this._panelGone = false;
        this._corners = [this._makeCorner(false), this._makeCorner(true)];

        // On logout the shell tears the panel down without disabling
        // extensions first, while closing windows still queue updates; stop
        // as soon as the panel goes.
        for (const actor of [Main.panel, Main.layoutManager.panelBox]) {
            actor.connectObject('destroy', () => {
                this._panelGone = true;
                this._removeLater();
            }, this);
        }

        for (const actor of global.get_window_actors())
            this._trackActor(actor);

        global.window_group.connectObject(
            'child-added', (_group, actor) => {
                if (actor instanceof Meta.WindowActor)
                    this._trackActor(actor);
                this._queueUpdate();
            },
            'child-removed', (_group, actor) => {
                actor.disconnectObject(this);
                actor.meta_window?.disconnectObject(this);
                this._queueUpdate();
            }, this);
        global.workspace_manager.connectObject(
            'active-workspace-changed', () => this._queueUpdate(), this);
        global.display.connectObject(
            'restacked', () => this._queueUpdate(),
            'in-fullscreen-changed', () => this._queueUpdate(), this);
        Main.overview.connectObject(
            'showing', () => this._queueUpdate(),
            'hidden', () => this._queueUpdate(), this);

        this._update();
    }

    disable() {
        this._removeLater();
        if (!this._panelGone) {
            Main.panel.disconnectObject(this);
            Main.layoutManager.panelBox.disconnectObject(this);
        }

        for (const actor of global.get_window_actors()) {
            actor.disconnectObject(this);
            actor.meta_window?.disconnectObject(this);
        }
        global.window_group.disconnectObject(this);
        global.workspace_manager.disconnectObject(this);
        global.display.disconnectObject(this);
        Main.overview.disconnectObject(this);

        for (const corner of this._corners) {
            Main.layoutManager.removeChrome(corner);
            corner.destroy();
        }
        this._corners = null;

        if (!this._panelGone)
            Main.panel.remove_style_class_name(STYLE_CLASS);
    }

    // A square in the bar colour with a quarter circle cut out, so the
    // window shows through as a rounded corner. It isn't reactive, so clicks
    // go to the window underneath.
    _makeCorner(right) {
        const corner = new St.DrawingArea({
            width: CORNER_RADIUS,
            height: CORNER_RADIUS,
            visible: false,
        });
        corner.connect('repaint', area => {
            const cr = area.get_context();
            const [width] = area.get_surface_size();
            const r = CORNER_RADIUS;
            cr.scale(width / r, width / r);
            cr.setSourceRGB(...BAR_COLOR);
            if (right) {
                cr.moveTo(r, 0);
                cr.lineTo(0, 0);
                cr.arc(0, r, r, -Math.PI / 2, 0);
            } else {
                cr.moveTo(0, 0);
                cr.lineTo(r, 0);
                cr.arcNegative(r, r, r, -Math.PI / 2, -Math.PI);
            }
            cr.closePath();
            cr.fill();
            cr.$dispose();
        });
        Main.layoutManager.addChrome(corner);
        return corner;
    }

    // The window's own state signals are the reliable ones: during the
    // maximize animation the actor's allocation may settle without a notify.
    _trackActor(actor) {
        const update = () => this._queueUpdate();
        actor.connectObject(
            'notify::allocation', update,
            'notify::visible', update, this);
        actor.meta_window?.connectObject(
            'notify::maximized-vertically', update,
            'notify::fullscreen', update,
            'notify::minimized', update,
            'position-changed', update,
            'size-changed', update,
            'workspace-changed', update, this);
    }

    // Allocation changes arrive every frame during a drag; check once per
    // frame. A low-priority idle can starve while the compositor animates
    // (a maximize, say), so run just before the next redraw instead.
    _queueUpdate() {
        if (this._laterId || this._panelGone)
            return;

        this._laterId = global.compositor.get_laters().add(Meta.LaterType.BEFORE_REDRAW, () => {
            this._laterId = 0;
            this._update();
            return GLib.SOURCE_REMOVE;
        });
    }

    _removeLater() {
        if (this._laterId) {
            global.compositor.get_laters().remove(this._laterId);
            this._laterId = 0;
        }
    }

    _update() {
        if (this._panelGone)
            return;

        // The overview shows the islands over its own backdrop.
        const solid = !Main.overview.visible && !Main.overview.animationInProgress &&
            this._windowReachesPanel();

        if (solid)
            Main.panel.add_style_class_name(STYLE_CLASS);
        else
            Main.panel.remove_style_class_name(STYLE_CLASS);

        const rect = solid ? this._topmostMaximized()?.get_frame_rect() : null;
        this._corners.forEach((corner, i) => {
            if (!rect) {
                corner.hide();
                return;
            }
            corner.set_position(i ? rect.x + rect.width - CORNER_RADIUS : rect.x, rect.y);
            corner.show();
        });
    }

    // The maximized window, when it is the topmost window on the primary
    // monitor's active workspace (nothing else could be under the corners).
    _topmostMaximized() {
        const monitor = Main.layoutManager.primaryMonitor;
        if (!monitor)
            return null;

        const workspace = global.workspace_manager.get_active_workspace();
        const windows = global.display.sort_windows_by_stacking(
            workspace.list_windows().filter(win =>
                win.get_monitor() === monitor.index &&
                !win.minimized &&
                win.showing_on_its_workspace()));
        const top = windows.at(-1);
        return top && top.maximizedVertically && top.maximizedHorizontally &&
            !top.fullscreen ? top : null;
    }

    _windowReachesPanel() {
        const monitor = Main.layoutManager.primaryMonitor;
        if (!monitor)
            return false;

        const panelBottom = monitor.y + Main.layoutManager.panelBox.height;
        const workspace = global.workspace_manager.get_active_workspace();

        return workspace.list_windows().some(win =>
            win.get_monitor() === monitor.index &&
            win.get_window_type() === Meta.WindowType.NORMAL &&
            !win.minimized &&
            win.showing_on_its_workspace() &&
            (win.maximizedVertically || win.fullscreen ||
             win.get_frame_rect().y <= panelBottom));
    }
}
