import { Stack } from 'expo-router';
import 'react-native-gesture-handler';
import 'react-native-reanimated';

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}


