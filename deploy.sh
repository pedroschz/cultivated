#!/bin/bash
# Build the Next.js app for static export and deploy to Firebase Hosting + Functions.
#
# Configuration (env vars or defaults):
#   FIREBASE_HOSTING_TARGET   The hosting target name to deploy. Defaults to
#                             "default" (use the project's default site). If you
#                             use named hosting targets (firebase target:apply),
#                             set this to that target's name.
#   APP_URL                   Public URL printed in the success message.

set -e

HOSTING_TARGET="${FIREBASE_HOSTING_TARGET:-default}"
APP_URL="${APP_URL:-${NEXT_PUBLIC_WEB_BASE_URL:-https://your-app.web.app}}"

echo "Starting Firebase deployment..."

if ! command -v firebase &> /dev/null; then
  echo "Firebase CLI not found. Install with: npm install -g firebase-tools"
  exit 1
fi

export NODE_ENV=production
export NEXT_PUBLIC_STATIC_EXPORT=true

# Copy brand fonts into public/ if available (no-op for OSS users without fonts).
if [ -x "./scripts/setup-fonts.sh" ]; then
  ./scripts/setup-fonts.sh
fi

# ---------------------------------------------------------------------------
# Brand font patch: if the fonts were copied into public/, temporarily rewrite
# layout.tsx to use localFont() instead of the OSS Inter fallback. The file is
# always restored (even on build failure) so the working tree stays clean.
# ---------------------------------------------------------------------------
BRAND_FONTS_PATCHED=false
LAYOUT_FILE="src/app/layout.tsx"
LAYOUT_BACKUP="src/app/layout.tsx.oss-backup"

restore_layout() {
  if [ "$BRAND_FONTS_PATCHED" = "true" ] && [ -f "$LAYOUT_BACKUP" ]; then
    mv "$LAYOUT_BACKUP" "$LAYOUT_FILE"
  fi
}
trap restore_layout EXIT

if [ -f "public/brasley.otf" ]; then
  echo "Brand fonts detected — patching layout.tsx for production build..."
  cp "$LAYOUT_FILE" "$LAYOUT_BACKUP"
  node -e "
const fs = require('fs');
let src = fs.readFileSync('$LAYOUT_FILE', 'utf8');

// Swap Google Fonts import to add localFont
src = src.replace(
  'import { Geist_Mono, Inter } from \"next/font/google\";',
  'import { Geist_Mono } from \"next/font/google\";\nimport localFont from \"next/font/local\";'
);

// Replace dinRoundPro (Inter fallback) with the real DIN Round Pro localFont
src = src.replace(
  /const dinRoundPro = Inter\(\{[\s\S]*?\}\);/,
  \`const dinRoundPro = localFont({
  src: [
    { path: '../../public/DIN Round Pro/dinroundpro_light.otf', weight: '300', style: 'normal' },
    { path: '../../public/DIN Round Pro/dinroundpro.otf',       weight: '400', style: 'normal' },
    { path: '../../public/DIN Round Pro/dinroundpro_medi.otf',  weight: '500', style: 'normal' },
    { path: '../../public/DIN Round Pro/dinroundpro_bold.otf',  weight: '700', style: 'normal' },
    { path: '../../public/DIN Round Pro/dinroundpro_black.otf', weight: '900', style: 'normal' },
  ],
  variable: '--font-din',
  display: 'swap',
});\`
);

// Replace brasley (Inter fallback) with the real Brasley localFont
src = src.replace(
  /const brasley = Inter\(\{[\s\S]*?\}\);/,
  \`const brasley = localFont({
  src: '../../public/brasley.otf',
  variable: '--font-brasley',
  display: 'swap',
});\`
);

fs.writeFileSync('$LAYOUT_FILE', src);
console.log('  layout.tsx patched.');
"
  BRAND_FONTS_PATCHED=true
fi

echo "Building Next.js app for static export..."
npm run build

echo "Deploying Firebase Functions..."
firebase deploy --only functions

echo "Deploying Firebase Hosting (target: ${HOSTING_TARGET})..."
if [ "$HOSTING_TARGET" = "default" ]; then
  firebase deploy --only hosting
else
  firebase deploy --only "hosting:${HOSTING_TARGET}"
fi

echo "Deployment successful!"
echo "App: ${APP_URL}"
