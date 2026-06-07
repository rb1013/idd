import 'react-native-gesture-handler';
import React from 'react';
import { AuthProvider } from './src/lib/AuthContext';
import Navigation from './src/navigation';

export default function App() {
  return (
    <AuthProvider>
      <Navigation />
    </AuthProvider>
  );
}
