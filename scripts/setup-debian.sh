#!/usr/bin/env bash
# Compatibilidad: prepara Debian/Ubuntu usando el bootstrap general.

set -euo pipefail

if ! command -v apt-get &>/dev/null; then
    echo "  ERROR: este script es para Debian/Ubuntu."
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$SCRIPT_DIR/bootstrap.sh" "$@"
