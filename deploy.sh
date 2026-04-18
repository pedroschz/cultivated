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

echo "🚀 Starting Firebase deployment..."

if ! command -v firebase &> /dev/null; then
  echo "❌ Firebase CLI not found. Install with: npm install -g firebase-tools"
  exit 1
fi

export NODE_ENV=production
export NEXT_PUBLIC_STATIC_EXPORT=true

# Copy brand fonts into public/ if available (no-op for OSS users without fonts).
if [ -x "./scripts/setup-fonts.sh" ]; then
  ./scripts/setup-fonts.sh
fi

echo "📦 Building Next.js app for static export..."
npm run build

echo "🔥 Deploying Firebase Functions..."
firebase deploy --only functions

echo "🔥 Deploying Firebase Hosting (target: ${HOSTING_TARGET})..."
if [ "$HOSTING_TARGET" = "default" ]; then
  firebase deploy --only hosting
else
  firebase deploy --only "hosting:${HOSTING_TARGET}"
fi

echo "✅ Deployment successful!"
echo "🌐 App: ${APP_URL}"
