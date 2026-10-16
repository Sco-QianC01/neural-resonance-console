#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$ROOT"
SETUP_ONLY=0
if [ "${1:-}" = "--setup-only" ]; then SETUP_ONLY=1; shift; fi
if [ -d "Neural Resonance.app" ] && \
    [ -f "Neural Resonance.app/Contents/Resources/gateway/build-manifest.json" ] && \
    grep -q '"portable-20261016-v1"' "Neural Resonance.app/Contents/Resources/gateway/build-manifest.json"; then
    if [ "$SETUP_ONLY" = 1 ]; then echo "Portable application is ready."; exit 0; fi
    open "$ROOT/Neural Resonance.app" --args "$@"
    exit 0
fi
ARCH=$(uname -m)
case "$ARCH" in
  arm64) TARGET=aarch64-apple-darwin ;;
  x86_64) TARGET=x86_64-apple-darwin ;;
  *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac
RUNTIME=${NEURAL_RESONANCE_RUNTIME:-"$HOME/Library/Application Support/NeuralResonance/runtime/darwin-$ARCH"}
mkdir -p "$RUNTIME"
PYTHON="$RUNTIME/gateway/bin/python"
STAMP="$RUNTIME/ready.json"
unset PYTHONHOME PYTHONPATH
export PYTHONNOUSERSITE=1
export PYTHONUTF8=1
if [ -x "$PYTHON" ] && "$PYTHON" "$ROOT/tools/runtime-check.py" \
    --project "$ROOT/gateway" --stamp "$STAMP"; then
    if [ "$SETUP_ONLY" = 1 ]; then exit 0; fi
    exec "$PYTHON" "$ROOT/gateway/device_gateway.py" "$@"
fi
if [ -f "$RUNTIME/gateway/pyvenv.cfg" ]; then
    PYTHON_BASE=$(awk '/^home[ \t]*=/ {sub(/^home[ \t]*=[ \t]*/, ""); sub(/\r$/, ""); print; exit}' "$RUNTIME/gateway/pyvenv.cfg")
    SYSTEM_SITE=$(awk '/^include-system-site-packages[ \t]*=/ {sub(/^[^=]*=[ \t]*/, ""); sub(/\r$/, ""); print tolower($0); exit}' "$RUNTIME/gateway/pyvenv.cfg")
    if [ ! -d "$PYTHON_BASE" ] || [ "$SYSTEM_SITE" != "false" ]; then
        grep -q '^prompt *= *neural-resonance-gateway' "$RUNTIME/gateway/pyvenv.cfg" || {
            echo "Runtime belongs to another project; choose a private runtime directory."; exit 1;
        }
        mv "$RUNTIME/gateway" "$RUNTIME/gateway-invalid-$(date +%Y%m%d%H%M%S)-$$"
        echo "Preserved incompatible private environment; creating a new one."
    fi
fi
UV="$RUNTIME/uv"
if [ -x "$UV" ] && ! "$UV" --version >/dev/null 2>&1; then
    mv "$UV" "$UV.invalid-$(date +%Y%m%d%H%M%S)-$$"
    echo "Preserved damaged private installer; downloading a verified replacement."
fi
if [ ! -x "$UV" ]; then
    ARCHIVE="$RUNTIME/uv.tar.gz"
    RELEASE="https://github.com/astral-sh/uv/releases/download/0.12.23"
    curl --fail --location --connect-timeout 15 --max-time 180 --retry 2 "$RELEASE/uv-$TARGET.tar.gz" --output "$ARCHIVE"
    curl --fail --location --connect-timeout 15 --max-time 60 --retry 2 "$RELEASE/uv-$TARGET.tar.gz.sha256" --output "$ARCHIVE.sha256"
    EXPECTED=$(awk '{print $1}' "$ARCHIVE.sha256")
    ACTUAL=$(shasum -a 256 "$ARCHIVE" | awk '{print $1}')
    [ "$EXPECTED" = "$ACTUAL" ] || { echo "Runtime checksum mismatch"; exit 1; }
    tar -xzf "$ARCHIVE" -C "$RUNTIME"
    mv "$RUNTIME/uv-$TARGET/uv" "$UV"
    chmod +x "$UV"
fi
export UV_PROJECT_ENVIRONMENT="$RUNTIME/gateway"
export UV_CACHE_DIR="$RUNTIME/uv-cache"
export UV_PYTHON_INSTALL_DIR="$RUNTIME/python"
export UV_LINK_MODE=copy
cd "$ROOT/gateway"
"$UV" sync --frozen --no-dev --reinstall --python 3.13 --python-preference only-managed
"$PYTHON" "$ROOT/tools/runtime-check.py" --project "$ROOT/gateway" --stamp "$STAMP" --write-stamp
if [ "$SETUP_ONLY" = 1 ]; then exit 0; fi
exec "$UV_PROJECT_ENVIRONMENT/bin/python" "$ROOT/gateway/device_gateway.py" "$@"
