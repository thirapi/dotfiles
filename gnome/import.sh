#!/usr/bin/env bash
# Load gnome/dconf/*.ini back into dconf (overwrites those keys)
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
  [[ -f "$name.ini" ]] && dconf load "${P[$name]}" < "$name.ini"
done
echo "imported; log out/in if the shell looks off"
