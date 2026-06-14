import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../lib/AuthContext';
import { COLORS } from '../constants';

// Auth screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// Guardian screens
import SelectUserScreen from '../screens/guardian/SelectUserScreen';
import CreateUserScreen from '../screens/guardian/CreateUserScreen';

// Main app screens
import DiscoveryScreen from '../screens/discovery/DiscoveryScreen';
import ChatListScreen from '../screens/chat/ChatListScreen';
import ChatScreen from '../screens/chat/ChatScreen';
import TutorialsScreen from '../screens/tutorials/TutorialsScreen';
import ProfileScreen from '../screens/user/ProfileScreen';
import NotificationSettingsScreen from '../screens/notifications/NotificationSettingsScreen';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  SelectUser: undefined;
  CreateUser: undefined;
  MainTabs: undefined;
  Chat: { conversationId: string; participantName: string };
};

export type MainTabParamList = {
  Discovery: undefined;
  ChatList: undefined;
  Tutorials: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textLight,
        tabBarStyle: { backgroundColor: COLORS.surface, borderTopColor: COLORS.border },
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.text,
      }}
    >
      <Tab.Screen name="Discovery" component={DiscoveryScreen} options={{ title: 'Find Friends' }} />
      <Tab.Screen name="ChatList" component={ChatListScreen} options={{ title: 'Messages' }} />
      <Tab.Screen name="Tutorials" component={TutorialsScreen} options={{ title: 'Learn' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'My Profile' }} />
    </Tab.Navigator>
  );
}

export default function Navigation() {
  const { session, activeUser, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: COLORS.surface }, headerTintColor: COLORS.text }}>
        {!session ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Create Account' }} />
          </>
        ) : !activeUser ? (
          <>
            <Stack.Screen name="SelectUser" component={SelectUserScreen} options={{ title: 'Select Profile', headerLeft: () => null }} />
            <Stack.Screen name="CreateUser" component={CreateUserScreen} options={{ title: 'Create Profile' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="Chat" component={ChatScreen} options={({ route }) => ({ title: route.params.participantName })} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
