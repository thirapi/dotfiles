/*
 * Mocha Lockscreen — the lock screen in the Mocha-Mac shell theme.
 *
 * Shell themes are loaded by the User Themes extension, which only runs in
 * the user session, so the lock screen falls back to the stock theme. This
 * extension runs only on the lock screen and does one thing: load the
 * Mocha-Mac stylesheet while locked. On a session mode change the shell
 * disables extensions that no longer apply before enabling the ones that do,
 * so on unlock this hands back the previous stylesheet first and User Themes
 * then loads its own. It touches no input, prompt or authentication code.
 */

import GLib from 'gi://GLib';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const THEME = 'Mocha-Mac';

export default class MochaLockscreenExtension extends Extension {
    enable() {
        const path = GLib.build_filenamev([
            GLib.get_user_data_dir(), 'themes', THEME, 'gnome-shell', 'gnome-shell.css',
        ]);
        if (!GLib.file_test(path, GLib.FileTest.EXISTS))
            return;

        this._previous = Main.getThemeStylesheet()?.get_path() ?? null;
        Main.setThemeStylesheet(path);
        Main.loadTheme();
        this._applied = true;
    }

    disable() {
        if (!this._applied)
            return;

        Main.setThemeStylesheet(this._previous);
        Main.loadTheme();
        this._applied = false;
        this._previous = null;
    }
}
