import { Tabs } from 'expo-router';
import { LayoutDashboard, Users, Bot, Megaphone, Ellipsis } from 'lucide-react-native';
import Constants from 'expo-constants';
import { useMemo } from 'react';

export default function TabsLayout() {
  const baseUrl = useMemo(() => (Constants.expoConfig?.extra as any)?.WEB_BASE_URL || 'https://example.com', []);
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="dashboard" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} /> }} />
      <Tabs.Screen name="friends" options={{ title: 'Friends', tabBarIcon: ({ color, size }) => <Users color={color} size={size} /> }} />
      <Tabs.Screen name="my-tutor" options={{ title: 'Tutor', tabBarIcon: ({ color, size }) => <Bot color={color} size={size} /> }} />
      <Tabs.Screen name="forum" options={{ title: 'Forum', tabBarIcon: ({ color, size }) => <Megaphone color={color} size={size} /> }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color, size }) => <Ellipsis color={color} size={size} /> }} />
    </Tabs>
  );
}


