import type { ExpoConfig } from 'expo/config';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load env from repo root .env.local if present
const rootEnvPath = path.resolve(__dirname, '..', '..', '.env.local');
if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
}

const WEB_BASE_URL = process.env.NEXT_PUBLIC_WEB_BASE_URL || process.env.WEB_BASE_URL || 'https://your-hosted-domain';

const config: ExpoConfig = {
  name: 'CultivatED Mobile',
  slug: 'cultivated-mobile',
  scheme: 'cultivated',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: { supportsTablet: true },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    edgeToEdgeEnabled: true,
  },
  web: { favicon: './assets/favicon.png' },
  plugins: ['expo-router'],
  experiments: { typedRoutes: true },
  extra: {
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    WEB_BASE_URL,
    // Support EAS build-time reading of env
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
  icon: './assets/icon.png',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  assetBundlePatterns: ['**/*'],
};

export default config;


