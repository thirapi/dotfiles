# dotfiles — Debian sid + GNOME 51 (Wayland)

Catppuccin Mocha with an ember accent (`#e9684e`, sampled from the wallpaper),
an island top bar with a small dynamic island, and Tiling Shell tiling.

## Install

On a Debian (sid/testing) machine with GNOME 50 or 51:

```sh
sudo apt install git gh && gh auth login   # the repo is private
gh repo clone thirapi/dotfiles ~/dotfiles
~/dotfiles/install.sh
```

Then log out and back in (GNOME only loads new extensions at login).

`install.sh` is safe to re-run: each step checks before it acts, and a file
that a symlink would replace is moved to `~/.dotfiles-backup/<time>/`, never
deleted. Downloads are pinned to fixed releases. Run single steps with
`./install.sh fonts icons`, skip the sudo step with `--no-apt`, list steps
with `--list`.

| step       | what it does |
|------------|--------------|
| apt        | stow, zsh, tmux, kitty, fastfetch, lsd, dconf-cli, …; WezTerm from its own apt repo; login shell → zsh |
| shell      | oh-my-zsh, zsh-autosuggestions, zsh-syntax-highlighting, powerlevel10k |
| fonts      | JetBrainsMono and FantasqueSansMono Nerd Fonts |
| gtk        | adw-gtk3 (GTK3 apps follow libadwaita) |
| cursor     | Bibata-Modern-Ice |
| icons      | Colloid Orange Catppuccin, then `scripts/build-icon-overrides.py` |
| stow       | links every package in `home/` into `$HOME` |
| extensions | the enabled extensions from `gnome/dconf/shell.ini`, from extensions.gnome.org |
| dconf      | `gnome/import.sh` (includes Tiling Shell's gaps and keybindings) |

## Layout

```
install.sh          one-shot setup (above)
home/<package>/     stow packages, each mirroring $HOME
gnome/dconf/        GNOME settings dumps ($HOME stored as @HOME@)
gnome/*.sh          export / import settings, reload the shell theme
scripts/            build-icon-overrides.py
```

| package          | provides |
|------------------|----------|
| zsh              | `.zshrc` (machine-specific tools load only when installed), `.p10k.zsh` (Mocha colours) |
| tmux             | `.tmux.conf` (Mocha theme, ember session pill, truecolor) |
| git              | `.gitconfig`, `.config/git/ignore` |
| kitty            | `.config/kitty` (Catppuccin Mocha) |
| wezterm          | `.config/wezterm` (Mocha + ember; runs on XWayland, see below) |
| fastfetch        | `.config/fastfetch`, `.config/ascii-art` |
| gtk              | `.config/gtk-{3,4}.0`: shared Mocha palette in `colors.css`, traffic-light window buttons |
| shell-theme      | `.local/share/themes/Mocha-Mac` (GNOME Shell theme) |
| shell-extensions | `mac-top-bar@thirapi` (fullscreen peek, solid bar when maximized, dynamic island, new windows open filling the screen without being maximized) and `mocha-lockscreen@thirapi` (theme on the lock screen) |
| icons            | `.local/share/icons/Mocha-Icons` (see below) |
| wallpapers       | `.local/share/backgrounds`, including the current one |

## Day to day

- After changing GNOME settings: `gnome/export.sh`, check `git diff`, commit.
- After editing the shell theme CSS: `gnome/reload-shell-theme.sh` (no logout).
- After a Colloid or GNOME app update: `scripts/build-icon-overrides.py`.
- Machine-local environment and secrets go in `~/.zshrc.local` (never committed).

## Things worth knowing

- **Tiling:** Tiling Shell (Forge v89 crashes GNOME 51). Its gaps match the
  6px grid; focus is Super+Alt+H/J/K/L because Super+L locks and Super+H
  minimizes.
- **Mocha-Icons** layers Adwaita's symbolic icons (they match the shell's
  weight) and GNOME's own art for apps Colloid draws as Apple look-alikes over
  Colloid Orange Catppuccin Dark.
- **Lock screen:** User Themes doesn't run there, so `mocha-lockscreen@thirapi`
  loads the theme while locked.
- **WezTerm** (Debian/fury 20240203) reports a wrong window geometry on
  Wayland, which squares its corners, so it runs on XWayland with no
  decorations.
- **Shell extensions** are loaded at login on Wayland: log out and in after
  installing or changing one.
