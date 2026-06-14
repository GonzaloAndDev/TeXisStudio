#!/usr/bin/env bash
# Build local de TeXisStudio para Linux
# Genera: .deb (Debian/Ubuntu), .rpm (Fedora/RHEL), AppImage (universal)
#
# Uso:
#   bash scripts/build-linux.sh
#
# Requisitos: Rust stable, Node.js 20+
# Las dependencias Tauri del sistema se instalan automáticamente.

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
echo "  TeXisStudio — Build Linux v$VERSION"
echo "  ====================================="

missing=()

require_command() {
    if ! command -v "$1" &>/dev/null; then
        missing+=("$1")
    fi
}

linux_deps_ready() {
    command -v gcc &>/dev/null &&
        command -v pkg-config &>/dev/null &&
        pkg-config --exists webkit2gtk-4.1 gtk+-3.0 librsvg-2.0 &&
        command -v patchelf &>/dev/null &&
        command -v rpm &>/dev/null
}

version_major() {
    "$1" --version 2>/dev/null | grep -Eo '[0-9]+' | head -1
}

require_command node
require_command npm
require_command cargo
require_command rustc

if ((${#missing[@]})); then
    echo ""
    echo "  ERROR: faltan herramientas base: ${missing[*]}"
    echo ""
    echo "  En Debian/Ubuntu prepara el equipo con:"
    echo "    bash scripts/setup-debian.sh"
    echo ""
    echo "  O instala manualmente Node.js 20+ y Rust stable:"
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

# ── [1/3] Dependencias del sistema ───────────────────────────────────────────
echo ""
echo "  [1/3] Dependencias del sistema..."

if linux_deps_ready; then
    echo "  OK dependencias del sistema"

elif command -v apt-get &>/dev/null; then
    echo "  → Detectado: Debian / Ubuntu"
    sudo apt-get update -q
    sudo apt-get install -y \
        libwebkit2gtk-4.1-dev \
        libgtk-3-dev \
        libayatana-appindicator3-dev \
        librsvg2-dev \
        patchelf \
        libfuse2 \
        rpm

elif command -v dnf &>/dev/null; then
    echo "  → Detectado: Fedora / RHEL"
    sudo dnf install -y \
        webkit2gtk4.1-devel \
        gtk3-devel \
        libappindicator-gtk3-devel \
        librsvg2-devel \
        patchelf \
        fuse-libs \
        rpm-build

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
FINISH_EPOCH="$(date +%s)"
FINISH_DATE="$(date '+%Y-%m-%d %H:%M:%S %Z')"
ELAPSED_SECONDS=$((FINISH_EPOCH - START_EPOCH))
echo ""
echo "  Fin      : $FINISH_DATE"
echo "  Duracion : $(format_duration "$ELAPSED_SECONDS")"
echo ""
