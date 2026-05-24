#!/usr/bin/env bash
# Build local de TeXisStudio para Linux
# Genera: .deb (Debian/Ubuntu), .rpm (Fedora/RHEL), AppImage (universal)
#
# Uso:
#   bash scripts/build-linux.sh
#
# Requisitos: Rust stable, Node.js 18+
# Las dependencias del sistema se instalan automáticamente.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
VERSION="1.0.0"

echo ""
echo "  TeXisStudio — Build Linux v$VERSION"
echo "  ====================================="

# ── [1/3] Dependencias del sistema ───────────────────────────────────────────
echo ""
echo "  [1/3] Dependencias del sistema..."

if command -v apt-get &>/dev/null; then
    echo "  → Detectado: Debian / Ubuntu"
    sudo apt-get update -q
    sudo apt-get install -y \
        libwebkit2gtk-4.1-dev \
        libgtk-3-dev \
        libayatana-appindicator3-dev \
        librsvg2-dev \
        patchelf \
        libfuse2

elif command -v dnf &>/dev/null; then
    echo "  → Detectado: Fedora / RHEL"
    sudo dnf install -y \
        webkit2gtk4.1-devel \
        gtk3-devel \
        libappindicator-gtk3-devel \
        librsvg2-devel \
        patchelf \
        fuse-libs

elif command -v pacman &>/dev/null; then
    echo "  → Detectado: Arch Linux"
    sudo pacman -S --needed --noconfirm \
        webkit2gtk-4.1 \
        gtk3 \
        libappindicator-gtk3 \
        librsvg \
        patchelf \
        fuse2

else
    echo "  ⚠  Gestor de paquetes no reconocido."
    echo "  Instala manualmente: libwebkit2gtk-4.1, libgtk-3, libayatana-appindicator3, patchelf"
fi

# ── [2/3] npm ci ─────────────────────────────────────────────────────────────
echo ""
echo "  [2/3] Instalando dependencias npm..."
cd "$ROOT/texis-app"
npm ci

# ── [3/3] Build ──────────────────────────────────────────────────────────────
echo ""
echo "  [3/3] Compilando (deb + rpm + AppImage)..."
npm run tauri build

# ── Resumen ──────────────────────────────────────────────────────────────────
echo ""
echo "  ✅ Build completado:"
find "$ROOT/target/release/bundle" -type f \
    \( -name "*.deb" -o -name "*.rpm" -o -name "*.AppImage" \) \
    2>/dev/null | sort | while read -r f; do
    echo "     $f"
done
echo ""
