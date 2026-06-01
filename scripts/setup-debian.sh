#!/usr/bin/env bash
# Prepara Debian/Ubuntu para correr TeXisStudio y generar paquetes Linux.

set -euo pipefail

echo ""
echo "  TeXisStudio — setup Debian/Ubuntu"
echo "  ================================="

if ! command -v apt-get &>/dev/null; then
    echo "  ERROR: este script es para Debian/Ubuntu."
    exit 1
fi

echo ""
echo "  [1/2] Dependencias del sistema para Tauri..."
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

echo ""
echo "  [2/2] Verificando Node.js y Rust..."

node_ok=0
if command -v node &>/dev/null; then
    node_major="$(node --version | grep -Eo '[0-9]+' | head -1)"
    if [[ -n "$node_major" && "$node_major" -ge 20 ]]; then
        node_ok=1
        echo "  OK Node.js: $(node --version)"
    fi
fi

if [[ "$node_ok" -ne 1 ]]; then
    echo "  Falta Node.js 20+."
    echo "  Instala Node.js LTS desde https://nodejs.org/ o con tu version manager favorito."
fi

if command -v cargo &>/dev/null && command -v rustc &>/dev/null; then
    echo "  OK Rust: $(rustc --version)"
else
    echo "  Falta Rust stable."
    echo "  Instala Rust con: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
fi

echo ""
echo "  Siguiente paso:"
echo "    node scripts/texis.mjs run"
echo "    node scripts/texis.mjs installer"
echo ""
