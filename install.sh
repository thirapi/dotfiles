#!/usr/bin/env bash
# install.sh — set up this rice on a Debian (sid/testing) + GNOME 50 machine.
#
#   ./install.sh                 run every step
#   ./install.sh fonts icons     run only these steps
#   ./install.sh --no-apt        everything except the steps that need sudo
#   ./install.sh --list          list the steps
#
# Safe to re-run: each step checks before it acts. Files that a symlink would
# replace are moved to ~/.dotfiles-backup/<time>/, never deleted. Downloads
# are pinned to fixed releases (no GitHub API, which rate-limits).
# Log out and back in afterwards: GNOME only loads new extensions at login.

set -euo pipefail

DOTFILES=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
DATA=${XDG_DATA_HOME:-$HOME/.local/share}
USER=${USER:-$(id -un)}
BACKUP="$HOME/.dotfiles-backup/$(date +%Y%m%d-%H%M%S)"
STEPS=(apt shell fonts gtk cursor icons stow extensions dconf)
SUDO_STEPS=(apt)

# Pinned downloads
NERD_FONTS=https://github.com/ryanoasis/nerd-fonts/releases/download/v3.4.0
ADW_GTK3=https://github.com/lassekongo83/adw-gtk3/releases/download/v6.5/adw-gtk3v6.5.tar.xz
BIBATA=https://github.com/ful1e5/Bibata_Cursor/releases/download/v2.0.7/Bibata-Modern-Ice.tar.xz
# Colloid at the commit whose install.sh was reviewed (local writes only)
COLLOID=https://github.com/vinceliuice/Colloid-icon-theme/archive/ceac660.tar.gz

APT_PACKAGES=(
  stow git curl ca-certificates gpg xz-utils unzip fontconfig python3
  zsh tmux kitty fastfetch lsd
  dconf-cli gtk-update-icon-cache
)

# ───── helpers ─────

say()  { printf '\033[1;38;2;233;104;78m==>\033[0m \033[1m%s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
die()  { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

fetch() { curl -fsSL --retry 3 -o "$2" "$1"; }

# git clone, or leave an existing checkout alone
clone() {
  local url=$1 dest=$2
  if [[ -d $dest/.git || -d $dest && -n $(ls -A "$dest") ]]; then
    info "have $(basename "$dest")"
  else
    git clone -q --depth 1 "$url" "$dest"
    info "cloned $(basename "$dest")"
  fi
}

backup() {
  local target=$1
  mkdir -p "$BACKUP/$(dirname "${target#"$HOME"/}")"
  mv "$target" "$BACKUP/${target#"$HOME"/}"
  info "backed up ~/${target#"$HOME"/}"
}

shell_major() { gnome-shell --version 2>/dev/null | grep -oE '[0-9]+' | head -1; }

# ───── steps ─────

step_apt() {
  local missing=()
  for p in "${APT_PACKAGES[@]}"; do
    dpkg-query -W -f='${Status}' "$p" 2>/dev/null | grep -q 'install ok installed' || missing+=("$p")
  done

  # WezTerm comes from its own apt repository (the Debian archive has none).
  if ! dpkg-query -W -f='${Status}' wezterm 2>/dev/null | grep -q 'install ok installed'; then
    if [[ ! -f /etc/apt/sources.list.d/wezterm.list ]]; then
      info "adding the WezTerm apt repository"
      curl -fsSL https://apt.fury.io/wez/gpg.key | sudo gpg --yes --dearmor -o /usr/share/keyrings/wezterm-fury.gpg
      echo 'deb [signed-by=/usr/share/keyrings/wezterm-fury.gpg] https://apt.fury.io/wez/ * *' |
        sudo tee /etc/apt/sources.list.d/wezterm.list >/dev/null
    fi
    missing+=(wezterm)
  fi

  if ((${#missing[@]})); then
    info "installing: ${missing[*]}"
    sudo apt-get update -qq
    sudo apt-get install -y -qq "${missing[@]}"
  else
    info "all packages present"
  fi

  if [[ $(getent passwd "$USER" | cut -d: -f7) != */zsh ]]; then
    sudo chsh -s "$(command -v zsh)" "$USER"
    info "login shell is now zsh"
  fi
}

step_shell() {
  clone https://github.com/ohmyzsh/ohmyzsh.git "$HOME/.oh-my-zsh"
  local custom="$HOME/.oh-my-zsh/custom"
  clone https://github.com/zsh-users/zsh-autosuggestions.git "$custom/plugins/zsh-autosuggestions"
  clone https://github.com/zsh-users/zsh-syntax-highlighting.git "$custom/plugins/zsh-syntax-highlighting"
  clone https://github.com/romkatv/powerlevel10k.git "$custom/themes/powerlevel10k"
}

step_fonts() {
  # name in the Nerd Fonts release -> directory under ~/.local/share/fonts
  local -A fonts=([JetBrainsMono]=JetBrainsMonoNerd [FantasqueSansMono]=FantasqueSansMono)
  local changed=0
  for font in "${!fonts[@]}"; do
    local dir="$DATA/fonts/${fonts[$font]}"
    if compgen -G "$dir/*.ttf" >/dev/null; then
      info "have $font"
      continue
    fi
    fetch "$NERD_FONTS/$font.tar.xz" "$TMP/$font.tar.xz"
    mkdir -p "$dir"
    tar -xJf "$TMP/$font.tar.xz" -C "$dir"
    info "installed $font Nerd Font"
    changed=1
  done
  ((changed)) && fc-cache -f >/dev/null
  return 0
}

step_gtk() {
  if [[ -d $DATA/themes/adw-gtk3-dark ]]; then
    info "have adw-gtk3"
    return
  fi
  fetch "$ADW_GTK3" "$TMP/adw-gtk3.tar.xz"
  mkdir -p "$DATA/themes"
  tar -xJf "$TMP/adw-gtk3.tar.xz" -C "$DATA/themes"
  info "installed adw-gtk3"
}

step_cursor() {
  if [[ -d $DATA/icons/Bibata-Modern-Ice ]]; then
    info "have Bibata-Modern-Ice"
    return
  fi
  fetch "$BIBATA" "$TMP/bibata.tar.xz"
  mkdir -p "$DATA/icons"
  tar -xJf "$TMP/bibata.tar.xz" -C "$DATA/icons"
  info "installed Bibata-Modern-Ice"
}

step_icons() {
  if [[ -d $DATA/icons/Colloid-Orange-Catppuccin-Dark ]]; then
    info "have Colloid Orange Catppuccin"
  else
    fetch "$COLLOID" "$TMP/colloid.tar.gz"
    mkdir -p "$TMP/colloid"
    tar -xzf "$TMP/colloid.tar.gz" -C "$TMP/colloid" --strip-components=1
    bash "$TMP/colloid/install.sh" -d "$DATA/icons" -s catppuccin -t orange >/dev/null
    info "installed Colloid Orange Catppuccin"
  fi
  # GNOME's own art for the apps Colloid draws as Apple look-alikes
  python3 "$DOTFILES/scripts/build-icon-overrides.py" >/dev/null
  info "built Mocha-Icons app overrides"
}

# Is $1 (a path in $HOME) already provided by this repo? Either a folder on
# its way is one of our links, or it is itself a link into the repo.
ours() {
  local target=$1 parent link
  parent=$(readlink -f "$(dirname "$target")")
  [[ $parent == "$DOTFILES"/home/* ]] && return 0
  [[ -L $target ]] || return 1
  link=$(readlink "$target")
  [[ $link == /* ]] || link="$(dirname "$target")/$link"
  [[ $(realpath -sm "$link") == "$DOTFILES"/home/* ]]
}

step_stow() {
  local packages=()
  for dir in "$DOTFILES"/home/*/; do packages+=("$(basename "$dir")"); done

  # Folders other software also writes into must be real folders. Otherwise
  # stow would link the whole folder into the repo, and extensions, themes
  # or icons installed later would land inside the repo.
  mkdir -p "$HOME/.config" "$DATA/gnome-shell/extensions" "$DATA/themes" "$DATA/icons" "$DATA/fonts"

  # Anything in the way that isn't already ours goes to the backup folder;
  # stow then links into place (re-linking what it owns).
  local pkg rel target
  for pkg in "${packages[@]}"; do
    while IFS= read -r -d '' rel; do
      rel=${rel#"$DOTFILES/home/$pkg/"}
      target="$HOME/$rel"
      [[ -e $target || -L $target ]] || continue
      ours "$target" && continue
      backup "$target"
    done < <(find "$DOTFILES/home/$pkg" \( -type f -o -type l \) -print0)
  done

  stow --restow -d "$DOTFILES/home" -t "$HOME" "${packages[@]}"
  info "linked: ${packages[*]}"
}

step_extensions() {
  local version
  version=$(shell_major) || true
  [[ -n $version ]] || die "gnome-shell not found; install GNOME first"

  local enabled
  enabled=$(python3 - "$DOTFILES/gnome/dconf/shell.ini" <<'EOF'
import ast, re, sys
for line in open(sys.argv[1]):
    m = re.match(r"enabled-extensions=(\[.*\])", line)
    if m:
        print("\n".join(ast.literal_eval(m.group(1))))
        break
EOF
)

  local uuid
  while IFS= read -r uuid; do
    [[ -n $uuid ]] || continue
    if [[ -d $DOTFILES/home/shell-extensions/.local/share/gnome-shell/extensions/$uuid ]]; then
      info "$uuid (ours, linked by stow)"
      continue
    fi
    if [[ -d $DATA/gnome-shell/extensions/$uuid || -d /usr/share/gnome-shell/extensions/$uuid ]]; then
      info "have $uuid"
      continue
    fi
    local url
    url=$(curl -fsSL "https://extensions.gnome.org/extension-info/?uuid=$uuid&shell_version=$version" |
      python3 -c 'import json, sys; print(json.load(sys.stdin)["download_url"])') ||
      { info "SKIPPED $uuid: no release for GNOME $version on extensions.gnome.org"; continue; }
    fetch "https://extensions.gnome.org$url" "$TMP/$uuid.zip"
    gnome-extensions install --force "$TMP/$uuid.zip"
    info "installed $uuid"
  done <<<"$enabled"
}

step_dconf() {
  bash "$DOTFILES/gnome/import.sh" >/dev/null
  info "imported GNOME settings"

  # Forge rewrites its stylesheet with the stock one whenever css-last-update
  # differs from the css tag of the installed Forge; match it so ours stays.
  local forge="$DATA/gnome-shell/extensions/forge@jmmaranan.com/lib/shared/theme.js"
  if [[ -f $forge ]]; then
    local tag
    tag=$(grep -oP 'this\.cssTag = \K[0-9]+' "$forge" || true)
    if [[ -n $tag ]]; then
      dconf write /org/gnome/shell/extensions/forge/css-last-update "uint32 $tag"
      info "Forge css tag set to $tag"
    fi
  fi
}

# ───── main ─────

main() {
  local no_apt=0 chosen=()
  for arg in "$@"; do
    case $arg in
      --no-apt) no_apt=1 ;;
      --list) printf '%s\n' "${STEPS[@]}"; exit 0 ;;
      -h|--help) sed -n '2,13p' "$0"; exit 0 ;;
      -*) die "unknown option $arg" ;;
      *) [[ " ${STEPS[*]} " == *" $arg "* ]] || die "unknown step $arg (see --list)"
         chosen+=("$arg") ;;
    esac
  done
  ((${#chosen[@]})) || chosen=("${STEPS[@]}")
  ((EUID != 0)) || die "run as your user, not root (sudo is used where needed)"

  local step
  for step in "${chosen[@]}"; do
    if ((no_apt)) && [[ " ${SUDO_STEPS[*]} " == *" $step "* ]]; then
      say "$step (skipped: --no-apt)"
      continue
    fi
    say "$step"
    "step_$step"
  done

  [[ -d $BACKUP ]] && say "replaced files were saved in $BACKUP"
  say "done — log out and back in to load the GNOME extensions and theme"
}

main "$@"
