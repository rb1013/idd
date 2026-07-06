import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../lib/AuthContext';
import { COLORS } from '../constants';

// Auth screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import UserRegisterScreen from '../screens/auth/UserRegisterScreen';

// Guardian screens
import GuardianHomeScreen from '../screens/guardian/GuardianHomeScreen';
import SelectUserScreen from '../screens/guardian/SelectUserScreen';
import CreateUserScreen from '../screens/guardian/CreateUserScreen';
import EditUserScreen from '../screens/guardian/EditUserScreen';
import GuardianNotificationsScreen from '../screens/guardian/GuardianNotificationsScreen';
import GuardianAccountScreen from '../screens/guardian/GuardianAccountScreen';
import GuardianTutorialsScreen from '../screens/guardian/GuardianTutorialsScreen';
import CreateTutorialScreen from '../screens/guardian/CreateTutorialScreen';
import TutorialPreviewScreen from '../screens/tutorials/TutorialPreviewScreen';
import TutorialLibraryScreen from '../screens/tutorials/TutorialLibraryScreen';
import GuardianActivitiesScreen from '../screens/guardian/GuardianActivitiesScreen';
import ScheduleScreen from '../screens/guardian/ScheduleScreen';
import UserScheduleScreen from '../screens/guardian/UserScheduleScreen';

// User screens
import UserHomeScreen from '../screens/user/UserHomeScreen';
import FriendsHubScreen from '../screens/user/FriendsHubScreen';
import DiscoveryScreen from '../screens/discovery/DiscoveryScreen';
import MessagesScreen from '../screens/messages/MessagesScreen';
import ChatScreen from '../screens/chat/ChatScreen';
import TutorialsScreen from '../screens/tutorials/TutorialsScreen';
import ProfileScreen from '../screens/user/ProfileScreen';
import ActivitiesScreen from '../screens/user/ActivitiesScreen';

// ── Param lists ───────────────────────────────────────────────────────────

export type RootStackParamList = {
  Login: undefined;
  GuardianRegister: undefined;
  UserRegister: undefined;
  GuardianTabs: undefined;
  UserHome: undefined;
};

export type GuardianNavParamList = {
  GuardianHome: undefined;
  Profiles: undefined;
  Notifications: undefined;
  Learning: undefined;
  Activities: undefined;
  Account: undefined;
  Schedule: undefined;
  UserSchedule: { userId: string; userName: string };
  CreateUser: undefined;
  EditUser: { userId: string };
  CreateTutorial: undefined;
  TutorialPreview: { tutorialId: string };
  TutorialLibrary: { userId?: string };
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

// ── Navigators ────────────────────────────────────────────────────────────

const Stack        = createNativeStackNavigator<RootStackParamList>();
const GuardianNav  = createNativeStackNavigator<GuardianNavParamList>();
const UserStack    = createNativeStackNavigator<UserStackParamList>();

// ── Guardian stack (replaces bottom tabs) ────────────────────────────────

function GuardianTabs() {
  return (
    <GuardianNav.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.text,
        headerBackTitle: '',
        headerShadowVisible: false,
      }}
    >
      <GuardianNav.Screen name="GuardianHome"    component={GuardianHomeScreen}          options={{ headerShown: false }} />
      <GuardianNav.Screen name="Profiles"        component={SelectUserScreen}            options={{ title: 'Profiles' }} />
      <GuardianNav.Screen name="Notifications"   component={GuardianNotificationsScreen} options={{ title: 'Notifications' }} />
      <GuardianNav.Screen name="Learning"        component={GuardianTutorialsScreen}     options={{ title: 'Learning' }} />
      <GuardianNav.Screen name="Activities"      component={GuardianActivitiesScreen}    options={{ title: 'Activities' }} />
      <GuardianNav.Screen name="Account"         component={GuardianAccountScreen}       options={{ title: 'Account' }} />
      <GuardianNav.Screen name="Schedule"        component={ScheduleScreen}              options={{ title: 'Schedule' }} />
      <GuardianNav.Screen name="UserSchedule"    component={UserScheduleScreen}          options={{ title: 'Schedule' }} />
      <GuardianNav.Screen name="CreateUser"      component={CreateUserScreen}            options={{ title: 'Create Profile' }} />
      <GuardianNav.Screen name="EditUser"        component={EditUserScreen}              options={{ title: 'Edit Profile' }} />
      <GuardianNav.Screen name="CreateTutorial"  component={CreateTutorialScreen}        options={{ title: 'Create Tutorial' }} />
      <GuardianNav.Screen name="TutorialPreview" component={TutorialPreviewScreen}       options={{ title: 'Preview Tutorial' }} />
      <GuardianNav.Screen name="TutorialLibrary" component={TutorialLibraryScreen}       options={{ title: 'Tutorial Library' }} />
    </GuardianNav.Navigator>
  );
}

// ── User stack ────────────────────────────────────────────────────────────

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
      <UserStack.Screen name="Home"       component={UserHomeScreen}    options={{ headerShown: false }} />
      <UserStack.Screen name="FriendsHub" component={FriendsHubScreen}  options={{ title: '🤝  My Friends' }} />
      <UserStack.Screen name="Discovery"  component={DiscoveryScreen}   options={{ title: '🔍  Find Friends' }} />
      <UserStack.Screen name="Messages"   component={MessagesScreen}    options={{ title: '💬  Messages', headerBackTitle: '' }} />
      <UserStack.Screen name="Activities" component={ActivitiesScreen}  options={{ title: '✅  Today\'s Activities' }} />
      <UserStack.Screen name="Tutorials"  component={TutorialsScreen}   options={{ title: '📚  Learn' }} />
      <UserStack.Screen name="Profile"    component={ProfileScreen}     options={{ title: 'My Profile' }} />
      <UserStack.Screen name="Chat"       component={ChatScreen}        options={{ headerBackTitle: '' }} />
      <UserStack.Screen name="EditUser"   component={EditUserScreen}    options={{ title: 'Edit Profile' }} />
    </UserStack.Navigator>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────

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
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          <>
            <Stack.Screen name="Login"           component={LoginScreen} />
            <Stack.Screen name="GuardianRegister" component={RegisterScreen}
              options={{ headerShown: true, headerStyle: { backgroundColor: COLORS.surface }, headerTintColor: COLORS.text, title: 'Guardian Registration' }} />
            <Stack.Screen name="UserRegister"    component={UserRegisterScreen}
              options={{ headerShown: true, headerStyle: { backgroundColor: COLORS.surface }, headerTintColor: COLORS.text, title: 'User Registration' }} />
          </>
        ) : guardian ? (
          <Stack.Screen name="GuardianTabs" component={GuardianTabs} />
        ) : activeUser ? (
          <Stack.Screen name="UserHome" component={UserNavigator} />
        ) : null}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
