import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  ActivityIndicator, Text, View, TouchableOpacity,
  Modal, StyleSheet, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../lib/AuthContext';
import { COLORS } from '../constants';

// Auth screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import UserRegisterScreen from '../screens/auth/UserRegisterScreen';

// Guardian screens
import SelectUserScreen from '../screens/guardian/SelectUserScreen';
import CreateUserScreen from '../screens/guardian/CreateUserScreen';
import EditUserScreen from '../screens/guardian/EditUserScreen';
import GuardianNotificationsScreen from '../screens/guardian/GuardianNotificationsScreen';
import GuardianAccountScreen from '../screens/guardian/GuardianAccountScreen';
import GuardianTutorialsScreen from '../screens/guardian/GuardianTutorialsScreen';
import CreateTutorialScreen from '../screens/guardian/CreateTutorialScreen';
import TutorialPreviewScreen from '../screens/tutorials/TutorialPreviewScreen';
import TutorialLibraryScreen from '../screens/tutorials/TutorialLibraryScreen';

// User screens
import UserHomeScreen from '../screens/user/UserHomeScreen';
import FriendsHubScreen from '../screens/user/FriendsHubScreen';
import DiscoveryScreen from '../screens/discovery/DiscoveryScreen';
import MessagesScreen from '../screens/messages/MessagesScreen';
import ChatScreen from '../screens/chat/ChatScreen';
import TutorialsScreen from '../screens/tutorials/TutorialsScreen';
import ProfileScreen from '../screens/user/ProfileScreen';
import ActivitiesScreen from '../screens/user/ActivitiesScreen';
import GuardianActivitiesScreen from '../screens/guardian/GuardianActivitiesScreen';

export type RootStackParamList = {
  Login: undefined;
  GuardianRegister: undefined;
  UserRegister: undefined;
  GuardianTabs: undefined;
  CreateUser: undefined;
  EditUser: { userId: string };
  CreateTutorial: undefined;
  TutorialPreview: { tutorialId: string };
  TutorialLibrary: { userId?: string };
  UserHome: undefined;
  Chat: { conversationId: string; participantName: string; participantPhoto?: string | null };
};

export type UserStackParamList = {
  Home: undefined;
  FriendsHub: undefined;
  Discovery: undefined;
  Messages: undefined;
  Tutorials: undefined;
  Profile: undefined;
  Activities: undefined;
  Chat: { conversationId: string; participantName: string; participantPhoto?: string | null };
  EditUser: { userId: string };
};

export type GuardianTabParamList = {
  Profiles: undefined;
  Notifications: undefined;
  Learning: undefined;
  Activities: undefined;
  Account: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const UserStack = createNativeStackNavigator<UserStackParamList>();
const GuardianTab = createBottomTabNavigator<GuardianTabParamList>();

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Profiles: '👥', Notifications: '🔔', Learning: '📚', Activities: '✅', Account: '👤',
  };
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{icons[label] ?? '●'}</Text>;
}

function GuardianGearMenu() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { signOut } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

  return (
    <>
      <TouchableOpacity
        onPress={() => setShowMenu(prev => !prev)}
        style={{ paddingHorizontal: 12, paddingVertical: 6 }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={{ fontSize: 22, color: COLORS.text }}>⚙</Text>
      </TouchableOpacity>

      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity style={menuStyles.overlay} onPress={() => setShowMenu(false)} activeOpacity={1}>
          <View style={menuStyles.dropdown}>
            <TouchableOpacity style={menuStyles.item} onPress={() => { setShowMenu(false); navigation.navigate('CreateUser'); }}>
              <Text style={menuStyles.itemText}>Create New Profile</Text>
            </TouchableOpacity>
            <View style={menuStyles.divider} />
            <TouchableOpacity style={menuStyles.item} onPress={() => { setShowMenu(false); signOut(); }}>
              <Text style={menuStyles.itemText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const HEADER_OFFSET = Platform.OS === 'ios' ? 96 : 64;

const menuStyles = StyleSheet.create({
  overlay: { flex: 1 },
  dropdown: {
    position: 'absolute',
    top: HEADER_OFFSET,
    right: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    minWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  item: { paddingVertical: 14, paddingHorizontal: 20 },
  itemText: { fontSize: 15, color: COLORS.text, fontWeight: '500' },
  divider: { height: 1, backgroundColor: COLORS.border },
});

function GuardianTabs() {
  return (
    <GuardianTab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textLight,
        tabBarStyle: { backgroundColor: COLORS.surface, borderTopColor: COLORS.border },
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.text,
        headerRight: () => <GuardianGearMenu />,
      })}
    >
      <GuardianTab.Screen name="Profiles" component={SelectUserScreen} options={{ title: 'Profiles' }} />
      <GuardianTab.Screen name="Notifications" component={GuardianNotificationsScreen} options={{ title: 'Notifications' }} />
      <GuardianTab.Screen name="Learning" component={GuardianTutorialsScreen} options={{ title: 'Learning' }} />
      <GuardianTab.Screen name="Activities" component={GuardianActivitiesScreen} options={{ title: 'Activities' }} />
      <GuardianTab.Screen name="Account" component={GuardianAccountScreen} options={{ title: 'Account' }} />
    </GuardianTab.Navigator>
  );
}

function UserNavigator() {
  return (
    <UserStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.background },
        headerTintColor: COLORS.text,
        headerBackTitle: ' ',
        headerShadowVisible: false,
      }}
    >
      <UserStack.Screen name="Home" component={UserHomeScreen} options={{ headerShown: false }} />
      <UserStack.Screen name="FriendsHub" component={FriendsHubScreen} options={{ title: '🤝  My Friends' }} />
      <UserStack.Screen name="Discovery" component={DiscoveryScreen} options={{ title: '🔍  Find Friends' }} />
      <UserStack.Screen name="Messages" component={MessagesScreen} options={{ title: '💬  Messages' }} />
      <UserStack.Screen name="Activities" component={ActivitiesScreen} options={{ title: '✅  Today\'s Activities' }} />
      <UserStack.Screen name="Tutorials" component={TutorialsScreen} options={{ title: '📚  Learn' }} />
      <UserStack.Screen name="Profile" component={ProfileScreen} options={{ title: 'My Profile' }} />
      <UserStack.Screen name="Chat" component={ChatScreen} options={{ headerBackTitle: '' }} />
      <UserStack.Screen name="EditUser" component={EditUserScreen} options={{ title: 'Edit Profile' }} />
    </UserStack.Navigator>
  );
}

export default function Navigation() {
  const { session, guardian, activeUser, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: COLORS.surface }, headerTintColor: COLORS.text, headerBackTitle: ' ' }}>
        {!session ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="GuardianRegister" component={RegisterScreen} options={{ title: 'Guardian Registration' }} />
            <Stack.Screen name="UserRegister" component={UserRegisterScreen} options={{ title: 'User Registration' }} />
          </>
        ) : guardian ? (
          <>
            <Stack.Screen name="GuardianTabs" component={GuardianTabs} options={{ headerShown: false }} />
            <Stack.Screen name="CreateUser" component={CreateUserScreen} options={{ title: 'Create Profile' }} />
            <Stack.Screen name="EditUser" component={EditUserScreen} options={{ title: 'Edit Profile' }} />
            <Stack.Screen name="CreateTutorial" component={CreateTutorialScreen} options={{ title: 'Create Tutorial' }} />
            <Stack.Screen name="TutorialPreview" component={TutorialPreviewScreen} options={{ title: 'Preview Tutorial' }} />
            <Stack.Screen name="TutorialLibrary" component={TutorialLibraryScreen} options={{ title: 'Tutorial Library' }} />
          </>
        ) : activeUser ? (
          <>
            <Stack.Screen name="UserHome" component={UserNavigator} options={{ headerShown: false }} />
          </>
        ) : null}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
