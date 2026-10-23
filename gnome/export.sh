#!/usr/bin/env bash
# Dump GNOME look & feel (dconf) into gnome/dconf/*.ini
set -euo pipefail
cd "$(dirname "$0")/dconf"
declare -A P=(
  [interface]=/org/gnome/desktop/interface/
  [background]=/org/gnome/desktop/background/
  [screensaver]=/org/gnome/desktop/screensaver/
  [wm-preferences]=/org/gnome/desktop/wm/preferences/
  [wm-keybindings]=/org/gnome/desktop/wm/keybindings/
  [media-keys]=/org/gnome/settings-daemon/plugins/media-keys/
  [mutter]=/org/gnome/mutter/
  [shell]=/org/gnome/shell/
)
# volatile/private keys (play history, app grid order, run-dialog history) stay out of git
SKIP='^(playback-history|app-picker-layout|command-history|css-updated|css-last-update)='
for name in "${!P[@]}"; do dconf dump "${P[$name]}" | { grep -Ev "$SKIP" || true; } > "$name.ini"; done
# extensions installed in ~/.local (re-install from extensions.gnome.org on a new machine)
ls -1 ~/.local/share/gnome-shell/extensions > ../extensions.txt
echo "exported to $(pwd)"
