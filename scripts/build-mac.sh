#!/usr/bin/env bash
# Build local de TeXisStudio para macOS
# Genera: DMG universal (Intel x86_64 + Apple Silicon arm64)
#
# Uso:
#   bash scripts/build-mac.sh
#
# Requisitos: Rust stable, Node.js 18+, Xcode Command Line Tools
#   xcode-select --install

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
VERSION="1.0.0"

echo ""
echo "  TeXisStudio — Build macOS v$VERSION"
echo "  ======================================"

# ── Verificar que estamos en macOS ───────────────────────────────────────────
if [[ "$(uname)" != "Darwin" ]]; then
    echo "  ✗ Este script solo funciona en macOS."
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
echo ""
echo "  Nota: sin firma de código Apple, macOS mostrará una advertencia"
echo "  al abrir el DMG. Clic derecho → Abrir → Abrir de todas formas."
echo ""
