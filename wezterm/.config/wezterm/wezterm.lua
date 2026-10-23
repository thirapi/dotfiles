local wezterm = require 'wezterm'
local config = wezterm.config_builder()

-- 1. Warna & Tampilan
config.color_scheme = 'Tokyo Night' -- Tema populer yang cocok dengan prompt Oh My Zsh
config.window_background_opacity = 0.85

-- Adjust kecerahan/saturasi jika ingin efek murni transparan (opsional)
config.text_background_opacity = 1.0

-- 2. Font & Typo
-- Pastikan kamu sudah menginstal JetBrains Mono Nerd Font
config.font = wezterm.font('JetBrains Mono Nerd Font', { weight = 'Regular' })
config.font_size = 10.5

-- 3. Jendela & Padding
config.window_padding = {
  left = 12,
  right = 12,
  top = 10,
  bottom = 10,
}
config.window_decorations = "RESIZE" -- Menghilangkan titlebar agar lebih sleek

-- 4. Tab Bar Minimalis
config.use_fancy_tab_bar = false
config.hide_tab_bar_if_only_one_tab = true -- Sembunyikan tab bar jika hanya ada 1 tab
config.tab_max_width = 25

-- 5. Kursor & Performa
config.default_cursor_style = 'BlinkingBar'
config.cursor_blink_rate = 800
config.scrollback_lines = 10000

-- 6. Keybindings Umum (Split Pane & Tab)
config.keys = {
  -- Split Window
  { key = 'd', mods = 'CTRL|SHIFT', action = wezterm.action.SplitHorizontal { domain = 'CurrentPaneDomain' } },
  { key = 'd', mods = 'CTRL|ALT',   action = wezterm.action.SplitVertical { domain = 'CurrentPaneDomain' } },
  { key = 'w', mods = 'CTRL|SHIFT', action = wezterm.action.CloseCurrentPane { confirm = true } },
  
  -- Navigasi Pane
  { key = 'LeftArrow',  mods = 'CTRL|SHIFT', action = wezterm.action.ActivatePaneDirection 'Left' },
  { key = 'RightArrow', mods = 'CTRL|SHIFT', action = wezterm.action.ActivatePaneDirection 'Right' },
  { key = 'UpArrow',    mods = 'CTRL|SHIFT', action = wezterm.action.ActivatePaneDirection 'Up' },
  { key = 'DownArrow',  mods = 'CTRL|SHIFT', action = wezterm.action.ActivatePaneDirection 'Down' },
}

return config
