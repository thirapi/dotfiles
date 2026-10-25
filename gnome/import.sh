#!/usr/bin/env bash
# Load gnome/dconf/*.ini back into dconf (overwrites those keys), turning the
# @HOME@ placeholder from export.sh back into this user's home.
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
for name in "${!P[@]}"; do
  [[ -f "$name.ini" ]] && sed "s|@HOME@|$HOME|g" "$name.ini" | dconf load "${P[$name]}"
done
echo "imported; log out/in if the shell looks off"
