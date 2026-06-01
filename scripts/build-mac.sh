#!/usr/bin/env bash
# Build local de TeXisStudio para macOS
# Genera: DMG universal (Intel x86_64 + Apple Silicon arm64)
#
# Uso:
#   bash scripts/build-mac.sh
#
# Requisitos: Rust stable, Node.js 20+, Xcode Command Line Tools
#   xcode-select --install

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
VERSION="1.0.0"
START_EPOCH="$(date +%s)"

format_duration() {
    local total_seconds="$1"
    local hours=$((total_seconds / 3600))
    local minutes=$(((total_seconds % 3600) / 60))
    local seconds=$((total_seconds % 60))

    if ((hours > 0)); then
        printf "%d h %d min %d s" "$hours" "$minutes" "$seconds"
    elif ((minutes > 0)); then
        printf "%d min %d s" "$minutes" "$seconds"
    else
        printf "%d s" "$seconds"
    fi
}

echo ""
echo "  TeXisStudio — Build macOS v$VERSION"
echo "  ======================================"

# ── Verificar que estamos en macOS ───────────────────────────────────────────
if [[ "$(uname)" != "Darwin" ]]; then
    echo "  ✗ Este script solo funciona en macOS."
    exit 1
fi

missing=()

require_command() {
    if ! command -v "$1" &>/dev/null; then
        missing+=("$1")
    fi
}

version_major() {
    "$1" --version 2>/dev/null | grep -Eo '[0-9]+' | head -1
}

require_command node
require_command npm
require_command cargo
require_command rustc
require_command rustup

if ((${#missing[@]})); then
    echo ""
    echo "  ERROR: faltan herramientas base: ${missing[*]}"
    echo ""
    echo "  Instala Node.js 20+ y Rust stable:"
    echo "    https://nodejs.org/"
    echo "    https://rustup.rs/"
    exit 1
fi

NODE_MAJOR="$(version_major node)"
if [[ -z "$NODE_MAJOR" || "$NODE_MAJOR" -lt 20 ]]; then
    echo ""
    echo "  ERROR: Node.js 20+ es requerido. Detectado: $(node --version)"
    echo "  Instala Node.js 20 LTS y vuelve a ejecutar este script."
    exit 1
fi

if ! xcode-select -p &>/dev/null; then
    echo ""
    echo "  ERROR: faltan Xcode Command Line Tools."
    echo "  Instala con: xcode-select --install"
    exit 1
fi

# ── [1/3] Targets Rust para universal binary ─────────────────────────────────
echo ""
echo "  [1/3] Añadiendo targets Rust (Intel + Apple Silicon)..."
rustup target add aarch64-apple-darwin x86_64-apple-darwin

# ── [2/3] npm ci ─────────────────────────────────────────────────────────────
echo ""
echo "  [2/3] Instalando dependencias npm..."
cd "$ROOT/texis-app"
npm ci

# ── [3/3] Build universal ─────────────────────────────────────────────────────
echo ""
echo "  [3/3] Compilando universal binary (Intel + Apple Silicon)..."
echo "  (Este paso tarda ~15–20 min la primera vez)"
npm run tauri build -- --target universal-apple-darwin

# ── Resumen ──────────────────────────────────────────────────────────────────
BUNDLE_DIR="$ROOT/target/universal-apple-darwin/release/bundle"
echo ""
echo "  ✅ Build completado:"
find "$BUNDLE_DIR" -type f \( -name "*.dmg" -o -name "*.app" \) \
    2>/dev/null | sort | while read -r f; do
    echo "     $f"
done
FINISH_EPOCH="$(date +%s)"
FINISH_DATE="$(date '+%Y-%m-%d %H:%M:%S %Z')"
ELAPSED_SECONDS=$((FINISH_EPOCH - START_EPOCH))
echo ""
echo "  Fin      : $FINISH_DATE"
echo "  Duracion : $(format_duration "$ELAPSED_SECONDS")"
echo ""
echo "  Nota: sin firma de código Apple, macOS mostrará una advertencia"
echo "  al abrir el DMG. Clic derecho → Abrir → Abrir de todas formas."
echo ""
