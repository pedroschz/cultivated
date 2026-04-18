import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { getAuth, signOut } from 'firebase/auth';
import { app } from '../../src/lib/firebase';

export default function MoreScreen() {
  const router = useRouter();
  const onLogout = async () => {
    try {
      await signOut(getAuth(app));
      router.replace('/login');
    } catch (e) {
      // noop
    }
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 16 }}>More</Text>
      <TouchableOpacity onPress={() => router.push('/settings')} style={{ paddingVertical: 12 }}>
        <Text>Settings</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onLogout} style={{ paddingVertical: 12 }}>
        <Text>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}


