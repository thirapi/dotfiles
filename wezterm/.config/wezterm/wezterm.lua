local wezterm = require 'wezterm'
local config = wezterm.config_builder()

-- Palet sama dengan seluruh rice: Catppuccin Mocha + accent ember dari wallpaper.
local mocha = {
  crust = '#11111b',
  mantle = '#181825',
  base = '#1e1e2e',
  surface0 = '#313244',
  overlay0 = '#6c7086',
  subtext0 = '#a6adc8',
  text = '#cdd6f4',
  ember = '#e9684e',
}

-- 1. Warna & Tampilan
config.color_scheme = 'Catppuccin Mocha'
config.colors = {
  cursor_bg = mocha.ember,
  cursor_border = mocha.ember,
  cursor_fg = mocha.base,
  selection_bg = 'rgba(233, 104, 78, 0.35)',
  selection_fg = 'none',
  split = mocha.surface0,
  tab_bar = {
    background = mocha.mantle,
  },
}
-- Tanpa blur (Blur my Shell untuk aplikasi sengaja dimatikan), jadi cukup
-- sedikit transparan: wallpaper yang terang tidak membuat teks pudar.
config.window_background_opacity = 0.95
config.text_background_opacity = 1.0

-- Pane yang tidak aktif sedikit redup, supaya jelas di mana kursor berada.
config.inactive_pane_hsb = {
  saturation = 0.9,
  brightness = 0.7,
}

-- 2. Font & Typo
-- Pastikan kamu sudah menginstal JetBrains Mono Nerd Font
config.font = wezterm.font('JetBrains Mono Nerd Font', { weight = 'Regular' })
config.font_size = 10.5

-- 3. Jendela & Padding (grid 6px, sama dengan celah Forge)
config.window_padding = {
  left = 12,
  right = 12,
  top = 12,
  bottom = 12,
}
-- WezTerm 20240203 melaporkan geometri jendela yang salah di Wayland, sehingga
-- Rounded Window Corners memasang sudut di luar area jendela (terlihat kotak).
-- Lewat XWayland geometrinya benar; aman karena skala layar 1.0.
config.enable_wayland = false
-- Tanpa titlebar. Di X11, "RESIZE" tetap meminta bingkai dan GNOME lalu
-- menggambar titlebar penuh; "NONE" benar-benar tanpa bingkai. Ukuran diatur
-- Forge, atau Super + klik tengah lalu geser untuk jendela mengambang.
config.window_decorations = "NONE"
config.window_close_confirmation = 'NeverPrompt'

-- 4. Tab Bar: tab aktif berupa pill ember, senada dengan island jam di top bar
config.use_fancy_tab_bar = false
config.hide_tab_bar_if_only_one_tab = true -- Sembunyikan tab bar jika hanya ada 1 tab
config.tab_max_width = 25
config.show_new_tab_button_in_tab_bar = false

wezterm.on('format-tab-title', function(tab, _tabs, _panes, _config, _hover, max_width)
  local title = tab.tab_title
  if not title or #title == 0 then
    title = tab.active_pane.title
  end
  title = wezterm.truncate_right(' ' .. (tab.tab_index + 1) .. '  ' .. title .. ' ', max_width - 2)

  if tab.is_active then
    return {
      { Background = { Color = mocha.mantle } },
      { Foreground = { Color = mocha.ember } },
      { Text = wezterm.nerdfonts.ple_left_half_circle_thick },
      { Background = { Color = mocha.ember } },
      { Foreground = { Color = mocha.base } },
      { Attribute = { Intensity = 'Bold' } },
      { Text = title },
      { Background = { Color = mocha.mantle } },
      { Foreground = { Color = mocha.ember } },
      { Text = wezterm.nerdfonts.ple_right_half_circle_thick },
    }
  end
  return {
    { Background = { Color = mocha.mantle } },
    { Foreground = { Color = mocha.subtext0 } },
    { Text = ' ' .. title .. ' ' },
  }
end)

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
