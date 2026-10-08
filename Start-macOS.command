#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$ROOT"
SETUP_ONLY=0
if [ "${1:-}" = "--setup-only" ]; then SETUP_ONLY=1; shift; fi
if [ -d "Neural Resonance.app" ]; then
    if [ "$SETUP_ONLY" = 1 ]; then echo "Portable application is ready."; exit 0; fi
    open "$ROOT/Neural Resonance.app" --args "$@"
    exit 0
fi
mkdir -p "$ROOT/.runtime"
UV="$ROOT/.runtime/uv"
if [ ! -x "$UV" ]; then
    ARCH=$(uname -m)
    case "$ARCH" in
      arm64) TARGET=aarch64-apple-darwin ;;
      x86_64) TARGET=x86_64-apple-darwin ;;
      *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
    esac
    ARCHIVE="$ROOT/.runtime/uv.tar.gz"
    RELEASE="https://github.com/astral-sh/uv/releases/download/0.12.23"
    curl --fail --location "$RELEASE/uv-$TARGET.tar.gz" --output "$ARCHIVE"
    curl --fail --location "$RELEASE/uv-$TARGET.tar.gz.sha256" --output "$ARCHIVE.sha256"
    EXPECTED=$(awk '{print $1}' "$ARCHIVE.sha256")
    ACTUAL=$(shasum -a 256 "$ARCHIVE" | awk '{print $1}')
    [ "$EXPECTED" = "$ACTUAL" ] || { echo "Runtime checksum mismatch"; exit 1; }
    tar -xzf "$ARCHIVE" -C "$ROOT/.runtime"
    mv "$ROOT/.runtime/uv-$TARGET/uv" "$UV"
    chmod +x "$UV"
fi
export UV_PROJECT_ENVIRONMENT="$ROOT/.runtime/gateway"
export UV_CACHE_DIR="$ROOT/.runtime/uv-cache"
export UV_PYTHON_INSTALL_DIR="$ROOT/.runtime/python"
export UV_LINK_MODE=copy
cd "$ROOT/gateway"
"$UV" sync --frozen --no-dev --python 3.13 --python-preference only-managed
if [ "$SETUP_ONLY" = 1 ]; then
    "$UV_PROJECT_ENVIRONMENT/bin/python" -c "import aiohttp, bleak, serial; print('Isolated acquisition environment is ready.')"
    exit 0
fi
exec "$UV_PROJECT_ENVIRONMENT/bin/python" "$ROOT/gateway/device_gateway.py" "$@"
