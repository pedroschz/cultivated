import { useMemo } from 'react';
import { WebView } from 'react-native-webview';
import Constants from 'expo-constants';

export default function SettingsScreen() {
  const baseUrl = useMemo(() => (Constants.expoConfig?.extra as any)?.WEB_BASE_URL || (process.env.NEXT_PUBLIC_WEB_BASE_URL as any) || 'https://example.com', []);
  return <WebView source={{ uri: baseUrl + '/settings' }} />;
}


