#!/usr/bin/env bash
# Download prebuilt sherpa-onnx WASM VAD files from SourceForge.
#
# Usage:
#   ./scripts/download-wasm-vad.sh [version]
#
# Examples:
#   ./scripts/download-wasm-vad.sh          # uses pinned version
#   ./scripts/download-wasm-vad.sh 1.12.36  # specific version

set -euo pipefail

# Pinned version — update this when upgrading sherpa-onnx
PINNED_VERSION="1.12.36"
VERSION="${1:-$PINNED_VERSION}"

TARBALL="sherpa-onnx-wasm-simd-v${VERSION}-vad.tar.bz2"
EXTRACT_DIR="sherpa-onnx-wasm-simd-v${VERSION}-vad"
URL="https://sourceforge.net/projects/sherpa-onnx.mirror/files/v${VERSION}/${TARBALL}/download"
DEST_DIR="$(cd "$(dirname "$0")/.." && pwd)/public/wasm/vad"

echo "Downloading sherpa-onnx WASM VAD v${VERSION}..."
echo "  URL: ${URL}"
echo "  Dest: ${DEST_DIR}"

# Download to temp directory
WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT

cd "$WORK_DIR"
curl -sL "$URL" -o "$TARBALL"

echo "Extracting..."
tar xjf "$TARBALL"

# Copy only the files we need
mkdir -p "$DEST_DIR"
cp "${EXTRACT_DIR}/sherpa-onnx-vad.js" "$DEST_DIR/"
cp "${EXTRACT_DIR}/sherpa-onnx-wasm-main-vad.js" "$DEST_DIR/"
cp "${EXTRACT_DIR}/sherpa-onnx-wasm-main-vad.wasm" "$DEST_DIR/"
cp "${EXTRACT_DIR}/sherpa-onnx-wasm-main-vad.data" "$DEST_DIR/"

echo "Done. Files in ${DEST_DIR}:"
ls -lh "$DEST_DIR"
