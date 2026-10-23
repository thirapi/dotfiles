#!/usr/bin/env bash
# Reload the GNOME Shell theme without logging out.
# Flips user-theme between two names that point at the same theme folder;
# never sets an empty name (that puts the User Themes extension in ERROR).
set -euo pipefail
T=~/.local/share/themes
[[ -e $T/Mocha-Mac-reload ]] || ln -s Mocha-Mac "$T/Mocha-Mac-reload"
K=/org/gnome/shell/extensions/user-theme/name
if [[ $(dconf read $K) == "'Mocha-Mac'" ]]; then
  dconf write $K "'Mocha-Mac-reload'"
else
  dconf write $K "'Mocha-Mac'"
fi
echo "shell theme now: $(dconf read $K)"
