# dotfiles — Debian sid + GNOME (Wayland)

Managed with [GNU Stow](https://www.gnu.org/software/stow/). Each top-level folder is a package mirroring `$HOME`.

| package    | links                                                     |
|------------|-----------------------------------------------------------|
| zsh        | `.zshrc`, `.p10k.zsh` (oh-my-zsh + powerlevel10k)         |
| tmux       | `.tmux.conf`                                              |
| git        | `.gitconfig`, `.config/git/ignore`                        |
| kitty      | `.config/kitty`                                           |
| wezterm    | `.config/wezterm`                                         |
| fastfetch  | `.config/fastfetch`, `.config/ascii-art`                  |
| gtk        | `.config/gtk-{3,4}.0/{settings.ini,gtk.css}`, `.config/gtk-4.0/colors.css` (Mocha palette shared by both, macOS traffic-light buttons) |
| shell-theme| `.local/share/themes/Mocha-Mac` (GNOME Shell theme)   |
| wallpapers | `.local/share/backgrounds`                                |
| shell-extensions | `.local/share/gnome-shell/extensions/mac-top-bar@thirapi` (top bar slides down over fullscreen windows when the pointer pushes the top edge; islands merge into a solid bar while a window is maximized) |
| forge      | `.config/forge` (Forge tiling: float rules + Mocha/ember stylesheet). Keep `stylesheet.css` free of `/* */` comments: Forge parses it itself and crashes on them. A Forge update may overwrite it (a `.bak` is kept); restore from git. |
| gnome      | *not stowed* — dconf dumps + extension list               |

## Install

```sh
sudo apt install stow git zsh kitty fastfetch
git clone <repo> ~/dotfiles && cd ~/dotfiles
stow -t ~ zsh tmux git kitty wezterm fastfetch gtk wallpapers shell-theme shell-extensions forge
./gnome/import.sh          # look & feel, extension settings, keybindings
```

Extensions listed in `gnome/extensions.txt` must be installed from extensions.gnome.org first.

## Not tracked (install manually)

- GTK3 theme → `~/.local/share/themes/adw-gtk3{,-dark}` (github.com/lassekongo83/adw-gtk3 release)
- Icons/cursors → `~/.local/share/icons` (Bibata-Modern-Ice)
- Fonts → `~/.local/share/fonts` (FantasqueSansM / JetBrainsMono Nerd, VictorMono)
- Secrets/env → `~/.zshrc.local` (sourced by `.zshrc`)

## Workflow

After tweaking GNOME: `./gnome/export.sh && git diff` then commit.
After editing the shell theme CSS: `./gnome/reload-shell-theme.sh` (no logout needed).
