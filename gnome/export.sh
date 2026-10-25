#!/usr/bin/env bash
# Dump GNOME look & feel (dconf) into gnome/dconf/*.ini.
# Paths under $HOME are stored as @HOME@ so the dumps work for any user;
# import.sh puts the real home back.
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
# volatile/private keys (play history, app grid order, run-dialog history) stay
# out of git; Forge's css-last-update is set by install.sh from the installed
# Forge instead (a stale value makes Forge overwrite our stylesheet)
SKIP='^(playback-history|app-picker-layout|command-history|css-updated|css-last-update)='
for name in "${!P[@]}"; do
  dconf dump "${P[$name]}" | { grep -Ev "$SKIP" || true; } | sed "s|$HOME|@HOME@|g" > "$name.ini"
done
# reload-shell-theme.sh may leave the alias name active; store the real one
sed -i "s/^name='Mocha-Mac-reload'/name='Mocha-Mac'/" shell.ini
echo "exported to $(pwd)"
