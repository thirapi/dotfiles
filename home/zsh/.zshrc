# fastfetch greeting, sized to the terminal (output must come before the
# p10k instant prompt below)
if (( $+commands[fastfetch] )); then
  if [[ $(tput cols) -ge 110 && $(tput lines) -ge 20 ]]; then
    fastfetch \
      -c $HOME/.config/fastfetch/config-compact.jsonc \
      --logo "$HOME/.config/ascii-art/thirafi.txt" \
      --logo-type file
  elif [[ $(tput cols) -ge 60 ]]; then
    # Small terminal, show only info without logo
    fastfetch -c $HOME/.config/fastfetch/config-compact.jsonc --logo none
  fi
fi

# Enable Powerlevel10k instant prompt. Should stay close to the top of ~/.zshrc.
# Initialization code that may require console input (password prompts, [y/n]
# confirmations, etc.) must go above this block; everything else may go below.
if [[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]]; then
  source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"
fi

export ZSH="$HOME/.oh-my-zsh"
ZSH_THEME="powerlevel10k/powerlevel10k"
plugins=(
    git
    zsh-autosuggestions
    zsh-syntax-highlighting
    web-search
)
source $ZSH/oh-my-zsh.sh

# Pokemon-colorscripts, kept for when fastfetch above is swapped out
# (https://gitlab.com/phoneybadger/pokemon-colorscripts)
#pokemon-colorscripts --no-title -s -r | fastfetch -c $HOME/.config/fastfetch/config-pokemon.jsonc --logo-type file-raw --logo-height 10 --logo-width 5 --logo -

# ───── aliases ─────
if (( $+commands[lsd] )); then
  alias ls='lsd'
  alias lt='ls --tree'
fi
alias l='ls -l'
alias la='ls -a'
alias lla='ls -la'
alias lzd='lazydocker'

# ───── PATH ─────
# Each tool is added only when it is installed, so this file works unchanged
# on a fresh machine. `typeset -U` keeps PATH free of duplicates.
typeset -U path
path=("$HOME/.local/bin" "$HOME/.npm-global/bin" $path)
[[ -d $HOME/.railway/bin ]] && path=("$HOME/.railway/bin" $path)
[[ -d $HOME/.opencode/bin ]] && path=("$HOME/.opencode/bin" $path)
(( $+commands[go] )) && path+=("$(go env GOPATH)/bin")

if [[ -d /usr/lib/jvm/java-1.21.0-openjdk-amd64 ]]; then
  export JAVA_HOME=/usr/lib/jvm/java-1.21.0-openjdk-amd64
  path=("$JAVA_HOME/bin" $path)
fi
if [[ -d $HOME/Android/Sdk ]]; then
  export ANDROID_HOME=$HOME/Android/Sdk
  path=("$ANDROID_HOME/platform-tools" "$ANDROID_HOME/cmdline-tools/latest/bin" $path)
fi
if [[ -d $HOME/.config/herd-lite/bin ]]; then
  path=("$HOME/.config/herd-lite/bin" $path)
  export PHP_INI_SCAN_DIR="$HOME/.config/herd-lite/bin:$PHP_INI_SCAN_DIR"
fi

# nvm
export NVM_DIR="$HOME/.nvm"
[[ -s "$NVM_DIR/nvm.sh" ]] && source "$NVM_DIR/nvm.sh"
[[ -s "$NVM_DIR/bash_completion" ]] && source "$NVM_DIR/bash_completion"

# Google Cloud SDK
[[ -f $HOME/google-cloud-sdk/path.zsh.inc ]] && source $HOME/google-cloud-sdk/path.zsh.inc
[[ -f $HOME/google-cloud-sdk/completion.zsh.inc ]] && source $HOME/google-cloud-sdk/completion.zsh.inc

# ───── opencode: chime when it finishes, keep the screen awake meanwhile ─────
complete_opencode() {
    aplay /usr/share/sounds/sound-icons/prompt.wav &>/dev/null &
}

prevent_sleep() {
    xset s off
    xset -dpms
}

restore_sleep() {
    xset s on
    xset +dpms
}

ocode() {
    prevent_sleep
    trap complete_opencode EXIT
    command opencode "$@"
    restore_sleep
}

# Machine-local env & secrets (untracked)
[[ ! -f ~/.zshrc.local ]] || source ~/.zshrc.local

# To customize prompt, run `p10k configure` or edit ~/.p10k.zsh.
[[ ! -f ~/.p10k.zsh ]] || source ~/.p10k.zsh
