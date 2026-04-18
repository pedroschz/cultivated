import { useMemo, useRef, useEffect, useCallback } from 'react';
import { BackHandler } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';
import Constants from 'expo-constants';

export default function TutorScreen() {
  const baseUrl = useMemo(() => (Constants.expoConfig?.extra as any)?.WEB_BASE_URL || 'https://example.com', []);
  const webRef = useRef<WebView>(null);
  const canGoBack = useRef(false);
  const onNavChange = useCallback((navState: WebViewNavigation) => { canGoBack.current = !!navState.canGoBack; }, []);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack.current) { webRef.current?.goBack(); return true; }
      return false;
    });
    return () => sub.remove();
  }, []);
  return <WebView ref={webRef} source={{ uri: baseUrl + '/my-tutor' }} onNavigationStateChange={onNavChange} />;
}


