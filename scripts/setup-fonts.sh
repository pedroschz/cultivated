#!/bin/bash
# Copies brand fonts from private-assets/fonts/ into public/ so Next.js can
# bundle them at build time. Brand fonts are commercial and excluded from
# the public repository — see README.md ("Brand fonts" section) for setup.

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/private-assets/fonts"
DEST="$ROOT/public"

if [ ! -d "$SRC" ]; then
  echo "ℹ️  No private-assets/fonts/ directory found — skipping font setup."
  echo "   The app will use system font fallbacks. To use the brand fonts,"
  echo "   place licensed font files under private-assets/fonts/ (see README)."
  exit 0
fi

echo "📦 Copying brand fonts into public/..."

if [ -f "$SRC/brasley.otf" ]; then
  cp "$SRC/brasley.otf" "$DEST/brasley.otf"
  echo "   ✓ brasley.otf"
fi

if [ -d "$SRC/DIN Round Pro" ]; then
  mkdir -p "$DEST/DIN Round Pro"
  cp "$SRC/DIN Round Pro/"*.otf "$DEST/DIN Round Pro/" 2>/dev/null || true
  echo "   ✓ DIN Round Pro/*.otf"
fi

echo "✅ Brand fonts ready."
