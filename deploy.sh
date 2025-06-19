#!/bin/bash

echo "🚀 Starting Firebase Hosting deployment..."

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Installing..."
    npm install -g firebase-tools
fi

# Build the Next.js app
echo "📦 Building Next.js app..."
npm run build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
else
    echo "❌ Build failed. Please fix the errors and try again."
    exit 1
fi

# Deploy to Firebase Hosting
echo "🔥 Deploying to Firebase Hosting..."
firebase deploy --only hosting

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
    echo "🌐 Your admin upload page is now live!"
    echo "📱 Access it at: https://your-project-id.web.app/admin/upload-question"
else
    echo "❌ Deployment failed. Please check your Firebase configuration."
    exit 1
fi 