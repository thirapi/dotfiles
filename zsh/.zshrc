# fastfetch. Will be disabled if above colorscript was chosen to install
# terminal size check for fastfetch
if [[ $(tput cols) -ge 110 && $(tput lines) -ge 20 ]]; then
  fastfetch \
    -c $HOME/.config/fastfetch/config-compact.jsonc \
    --logo "$HOME/.config/ascii-art/thirafi.txt" \
    --logo-type file
elif [[ $(tput cols) -ge 60 ]]; then
  # Small terminal, show only info without logo
  fastfetch -c $HOME/.config/fastfetch/config-compact.jsonc --logo none
fi

# Enable Powerlevel10k instant prompt. Should stay close to the top of ~/.zshrc.
# Initialization code that may require console input (password prompts, [y/n]
# confirmations, etc.) must go above this block; everything else may go below.
if [[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]]; then
  source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"
fi

# If you come from bash you might have to change your $PATH.
# export PATH=$HOME/bin:/usr/local/bin:$PATH

export ZSH="$HOME/.oh-my-zsh"

ZSH_THEME="powerlevel10k/powerlevel10k"

plugins=( 
    git
    zsh-autosuggestions
    zsh-syntax-highlighting
    web-search
)

source $ZSH/oh-my-zsh.sh


# Display Pokemon-colorscripts
# Project page: https://gitlab.com/phoneybadger/pokemon-colorscripts#on-other-distros-and-macos
#pokemon-colorscripts --no-title -s -r #without fastfetch
#pokemon-colorscripts --no-title -s -r | fastfetch -c $HOME/.config/fastfetch/config-pokemon.jsonc --logo-type file-raw --logo-height 10 --logo-width 5 --logo -

#(lolcat ~/.config/ascii-art/thirafi.txt; echo; fastfetch -c ~/.config/fastfetch/config-compact.jsonc --logo-type none)


# Set-up icons for files/directories in terminal using lsd
alias ls='lsd'
alias l='ls -l'
alias la='ls -a'
alias lla='ls -la'
alias lt='ls --tree'

alias lzd='lazydocker'
export PATH=$PATH:$(go env GOPATH)/bin

export PATH="$HOME/.npm-global/bin:$PATH"

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

# The next line updates PATH for the Google Cloud SDK.
if [ -f '/home/thirafi/google-cloud-sdk/path.zsh.inc' ]; then . '/home/thirafi/google-cloud-sdk/path.zsh.inc'; fi

# The next line enables shell command completion for gcloud.
if [ -f '/home/thirafi/google-cloud-sdk/completion.zsh.inc' ]; then . '/home/thirafi/google-cloud-sdk/completion.zsh.inc'; fi


export JAVA_HOME=/usr/lib/jvm/java-1.21.0-openjdk-amd64
export ANDROID_HOME=$HOME/Android/Sdk

export PATH=$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH



# Added by Antigravity CLI installer
export PATH="/home/thirafi/.local/bin:$PATH"
export PATH="/home/thirafi/.local/bin:$PATH"
export PATH="$HOME/.railway/bin:$PATH"
export PATH="$HOME/.npm-global/bin:$PATH"

# opencode
export PATH=/home/thirafi/.opencode/bin:$PATH

# Sound on opencode completion
complete_opencode() {
    aplay /usr/share/sounds/sound-icons/prompt.wav &>/dev/null &
}

# Prevent screen sleep during opencode sessions
prevent_sleep() {
    xset s off
    xset -dpms
}

# Restore screen settings after opencode
restore_sleep() {
    xset s on
    xset +dpms
}

# Wrapper for opencode with sound and sleep prevention
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
export PATH="/home/thirafi/.config/herd-lite/bin:$PATH"
export PHP_INI_SCAN_DIR="/home/thirafi/.config/herd-lite/bin:$PHP_INI_SCAN_DIR"
