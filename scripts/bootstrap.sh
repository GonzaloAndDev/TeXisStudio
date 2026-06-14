#!/usr/bin/env bash
# Bootstrap multiplataforma para Linux/macOS.
# Prepara dependencias base y opcionalmente corre la app o genera instalador.
#
# Uso:
#   bash scripts/bootstrap.sh
#   bash scripts/bootstrap.sh run
#   bash scripts/bootstrap.sh installer

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
APP_DIR="$ROOT/texis-app"
ACTION="${1:-}"
OS="$(uname -s)"

command_exists() {
    command -v "$1" &>/dev/null
}

version_major() {
    "$1" --version 2>/dev/null | grep -Eo '[0-9]+' | head -1
}

print_header() {
    echo ""
    echo "  TeXisStudio - bootstrap"
    echo "  ======================="
    echo "  Root : $ROOT"
    echo "  OS   : $OS"
    echo ""
}

ensure_node() {
    if command_exists node && command_exists npm; then
        local node_major
        node_major="$(version_major node)"
        if [[ -n "$node_major" && "$node_major" -ge 20 ]]; then
            echo "  OK Node.js: $(node --version)"
            echo "  OK npm    : $(npm --version)"
            return
        fi
    fi

    echo "  Instalando Node.js 20+..."

    case "$OS" in
        Linux)
            if command_exists apt-get; then
                sudo apt-get update
                sudo apt-get install -y ca-certificates curl gnupg
                curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
                sudo apt-get install -y nodejs
            elif command_exists dnf; then
                sudo dnf install -y nodejs npm
            elif command_exists pacman; then
                sudo pacman -S --needed --noconfirm nodejs npm
            else
                echo "  ERROR: no reconozco tu gestor de paquetes."
                echo "  Instala Node.js 20+ desde https://nodejs.org/ y vuelve a ejecutar."
                exit 1
            fi
            ;;
        Darwin)
            if ! command_exists brew; then
                echo "  ERROR: falta Homebrew para instalar Node automaticamente."
                echo "  Instala Homebrew desde https://brew.sh/ o Node.js 20+ desde https://nodejs.org/"
                exit 1
            fi
            brew install node
            ;;
        *)
            echo "  ERROR: sistema no soportado por este script: $OS"
            exit 1
            ;;
    esac

    local node_major
    node_major="$(version_major node)"
    if [[ -z "$node_major" || "$node_major" -lt 20 ]]; then
        echo "  ERROR: Node.js 20+ sigue sin estar disponible. Detectado: $(node --version 2>/dev/null || echo none)"
        exit 1
    fi
}

ensure_rust() {
    if command_exists cargo && command_exists rustc; then
        echo "  OK Rust: $(rustc --version)"
        return
    fi

    echo "  Instalando Rust stable..."
    if ! command_exists curl; then
        if [[ "$OS" == "Linux" ]] && command_exists apt-get; then
            sudo apt-get update
            sudo apt-get install -y curl
        else
            echo "  ERROR: falta curl para instalar Rust."
            exit 1
        fi
    fi

    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    # shellcheck disable=SC1091
    source "$HOME/.cargo/env"
    echo "  OK Rust: $(rustc --version)"
}

ensure_linux_deps() {
    echo ""
    echo "  Dependencias nativas Linux..."

    if linux_deps_ready; then
        echo "  OK dependencias nativas Linux"
        return
    fi

    if command_exists apt-get; then
        sudo apt-get update
        sudo apt-get install -y \
            build-essential \
            curl \
            pkg-config \
            libssl-dev \
            libwebkit2gtk-4.1-dev \
            libgtk-3-dev \
            libayatana-appindicator3-dev \
            librsvg2-dev \
            patchelf \
            libfuse2 \
            rpm
    elif command_exists dnf; then
        sudo dnf install -y \
            gcc \
            gcc-c++ \
            curl \
            pkgconf-pkg-config \
            openssl-devel \
            webkit2gtk4.1-devel \
            gtk3-devel \
            libappindicator-gtk3-devel \
            librsvg2-devel \
            patchelf \
            fuse-libs \
            rpm-build
    elif command_exists pacman; then
        sudo pacman -S --needed --noconfirm \
            base-devel \
            curl \
            pkgconf \
            openssl \
            webkit2gtk-4.1 \
            gtk3 \
            libappindicator-gtk3 \
            librsvg \
            patchelf \
            fuse2
    else
        echo "  WARNING: gestor de paquetes no reconocido; omito dependencias nativas."
    fi
}

linux_deps_ready() {
    command_exists gcc &&
        command_exists pkg-config &&
        pkg-config --exists webkit2gtk-4.1 gtk+-3.0 librsvg-2.0 &&
        {
            ! wants_installer ||
                {
                    command_exists patchelf &&
                        command_exists rpm
                }
        }
}

wants_installer() {
    case "$ACTION" in
        installer|build|compiler|package|dist) return 0 ;;
        *) return 1 ;;
    esac
}

ensure_macos_deps() {
    echo ""
    echo "  Dependencias nativas macOS..."

    if ! xcode-select -p &>/dev/null; then
        echo "  Se abrirá el instalador de Xcode Command Line Tools."
        xcode-select --install || true
        echo "  Cuando termine la instalacion, vuelve a ejecutar este comando."
        exit 1
    fi

}

ensure_macos_targets() {
    if rustup target list --installed | grep -qx "aarch64-apple-darwin" &&
        rustup target list --installed | grep -qx "x86_64-apple-darwin"; then
        echo "  OK Rust targets macOS universal"
        return
    fi

    rustup target add aarch64-apple-darwin x86_64-apple-darwin
}

install_npm_deps() {
    echo ""
    if npm_deps_ready; then
        echo "  OK dependencias npm"
        return
    fi

    echo "  Instalando dependencias npm..."
    cd "$APP_DIR"
    npm ci
}

npm_deps_ready() {
    [[ -d "$APP_DIR/node_modules" ]] &&
        [[ -f "$APP_DIR/node_modules/.package-lock.json" ]] &&
        [[ ! "$APP_DIR/package-lock.json" -nt "$APP_DIR/node_modules/.package-lock.json" ]]
}

run_action() {
    case "$ACTION" in
        "")
            echo ""
            echo "  Equipo listo."
            echo "  Siguiente:"
            echo "    node scripts/texis.mjs run"
            echo "    node scripts/texis.mjs installer"
            ;;
        run|dev|start|app)
            cd "$ROOT"
            node scripts/texis.mjs run
            ;;
        installer|build|compiler|package|dist)
            cd "$ROOT"
            node scripts/texis.mjs installer
            ;;
        frontend-build|check|frontend)
            cd "$ROOT"
            node scripts/texis.mjs frontend-build
            ;;
        check-all|verify|validate|complete)
            cd "$ROOT"
            node scripts/texis.mjs check-all
            ;;
        *)
            echo "  ERROR: accion no reconocida: $ACTION"
            echo "  Usa: run, installer, frontend-build o check-all"
            exit 1
            ;;
    esac
}

print_header

case "$OS" in
    Linux)
        ensure_linux_deps
        ;;
    Darwin)
        ensure_macos_deps
        ;;
    *)
        echo "  ERROR: este script es para Linux/macOS."
        echo "  En Windows usa: powershell -ExecutionPolicy Bypass -File scripts/bootstrap-windows.ps1"
        exit 1
        ;;
esac

ensure_node
ensure_rust
if [[ "$OS" == "Darwin" ]]; then
    ensure_macos_targets
fi
install_npm_deps
run_action
