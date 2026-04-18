import { StatusBar } from 'expo-status-bar';
import { Slot } from 'expo-router';

export default function App() {
  return <><Slot /><StatusBar style="auto" /></>;
}
