import 'react-native-gesture-handler';
import React from 'react';
import { useFonts } from 'expo-font';
import {
  Raleway_400Regular,
  Raleway_500Medium,
  Raleway_600SemiBold,
  Raleway_700Bold,
  Raleway_700Bold_Italic,
  Raleway_800ExtraBold,
  Raleway_900Black,
} from '@expo-google-fonts/raleway';
import { AuthProvider } from './src/lib/AuthContext';
import Navigation from './src/navigation';

export default function App() {
  const [fontsLoaded] = useFonts({
    Raleway_400Regular,
    Raleway_500Medium,
    Raleway_600SemiBold,
    Raleway_700Bold,
    Raleway_700Bold_Italic,
    Raleway_800ExtraBold,
    Raleway_900Black,
  });

  if (!fontsLoaded) return null;

  return (
    <AuthProvider>
      <Navigation />
    </AuthProvider>
  );
}
