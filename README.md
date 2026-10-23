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
| gtk        | `.config/gtk-{3,4}.0/settings.ini`                        |
| wallpapers | `.local/share/backgrounds`                                |
| gnome      | *not stowed* — dconf dumps + extension list               |

## Install

```sh
sudo apt install stow git zsh kitty fastfetch
git clone <repo> ~/dotfiles && cd ~/dotfiles
stow -t ~ zsh tmux git kitty wezterm fastfetch gtk wallpapers
./gnome/import.sh          # look & feel, extension settings, keybindings
```

Extensions listed in `gnome/extensions.txt` must be installed from extensions.gnome.org first.

## Not tracked (install manually)

- Themes → `~/.local/share/themes` (Catppuccin GTK, Flat-Remix GTK)
- Icons/cursors → `~/.local/share/icons` (Bibata-Modern-Ice)
- Fonts → `~/.local/share/fonts` (FantasqueSansM / JetBrainsMono Nerd, VictorMono)
- Secrets/env → `~/.zshrc.local` (sourced by `.zshrc`)

## Workflow

After tweaking GNOME: `./gnome/export.sh && git diff` then commit.
