/*
 * Solid bar: while a window on the active workspace of the primary monitor is
 * maximized, fullscreen or otherwise reaches up to the panel, #panel gets the
 * `solid` style class. The theme then draws one full-width bar in the header
 * bar colour instead of three floating islands, so the bar and the window read
 * as one surface, like the macOS menu bar over a zoomed window. The panel keeps
 * its height, so the work area (and every window) stays where it is.
 *
 * Forge tiles with a gap below the panel, so tiled windows keep the islands.
 */

import GLib from 'gi://GLib';
import Meta from 'gi://Meta';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const STYLE_CLASS = 'solid';

export class SolidBar {
    enable() {
        this._laterId = 0;

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
        if (this._laterId) {
            global.compositor.get_laters().remove(this._laterId);
            this._laterId = 0;
        }

        for (const actor of global.get_window_actors()) {
            actor.disconnectObject(this);
            actor.meta_window?.disconnectObject(this);
        }
        global.window_group.disconnectObject(this);
        global.workspace_manager.disconnectObject(this);
        global.display.disconnectObject(this);
        Main.overview.disconnectObject(this);

        Main.panel.remove_style_class_name(STYLE_CLASS);
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
        if (this._laterId)
            return;

        this._laterId = global.compositor.get_laters().add(Meta.LaterType.BEFORE_REDRAW, () => {
            this._laterId = 0;
            this._update();
            return GLib.SOURCE_REMOVE;
        });
    }

    _update() {
        // The overview shows the islands over its own backdrop.
        const solid = !Main.overview.visible && !Main.overview.animationInProgress &&
            this._windowReachesPanel();

        if (solid)
            Main.panel.add_style_class_name(STYLE_CLASS);
        else
            Main.panel.remove_style_class_name(STYLE_CLASS);
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
