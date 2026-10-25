/*
 * Mac Top Bar — macOS menu bar behaviour for the Mocha-Mac island top bar:
 *   fullscreenPeek.js  push the pointer against the top edge to reveal the bar
 *                      over a fullscreen window
 *   solidBar.js        islands merge into one solid bar while a window is
 *                      maximized (styled by #panel.solid in the shell theme)
 *   island.js          the clock island grows to show media, volume /
 *                      brightness levels and battery notes
 */

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {FullscreenPeek} from './fullscreenPeek.js';
import {Island} from './island.js';
import {SolidBar} from './solidBar.js';

export default class MacTopBarExtension extends Extension {
    enable() {
        this._parts = [new FullscreenPeek(), new SolidBar(), new Island()];
        this._parts.forEach(part => part.enable());
    }

    disable() {
        this._parts.forEach(part => part.disable());
        this._parts = null;
    }
}
