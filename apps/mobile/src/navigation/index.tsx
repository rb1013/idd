import React, { useState } from 'react';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ActivityIndicator, View, TouchableOpacity, Text,
  Modal, StyleSheet, Alert,
} from 'react-native';
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
import LearnerDiscoveryScreen from '../screens/guardian/LearnerDiscoveryScreen';
import LearnerPublicProfileScreen from '../screens/guardian/LearnerPublicProfileScreen';
import LearnerFriendRequestsScreen from '../screens/guardian/LearnerFriendRequestsScreen';
import GuardianConnectionsScreen from '../screens/guardian/GuardianConnectionsScreen';
import DiscussionsScreen from '../screens/guardian/DiscussionsScreen';
import DiscussionDetailScreen from '../screens/guardian/DiscussionDetailScreen';
import EventsScreen from '../screens/guardian/EventsScreen';
import EventDetailScreen from '../screens/guardian/EventDetailScreen';
import CreateEventScreen from '../screens/guardian/CreateEventScreen';

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
  LearnerDiscovery: undefined;
  LearnerPublicProfile: { learnerId: string };
  LearnerFriendRequests: undefined;
  GuardianConnections: undefined;
  Discussions: undefined;
  DiscussionDetail: { postId: string };
  Events: undefined;
  EventDetail: { eventId: string };
  CreateEvent: undefined;
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

// ── Guardian header gear icon ────────────────────────────────────────────

function GuardianSettingsBtn() {
  const navigation = useNavigation<NativeStackNavigationProp<GuardianNavParamList>>();
  const { guardian, signOut } = useAuth();
  const [visible, setVisible] = useState(false);

  function handleSignOut() {
    setVisible(false);
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  }

  return (
    <>
      <TouchableOpacity onPress={() => setVisible(true)} style={navStyles.gearBtn} activeOpacity={0.7}>
        <Text style={navStyles.gearIcon}>⚙️</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={navStyles.overlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <TouchableOpacity style={navStyles.card} activeOpacity={1} onPress={() => {}}>
            <Text style={navStyles.cardTitle}>Settings</Text>

            <TouchableOpacity style={navStyles.item} onPress={() => { setVisible(false); navigation.navigate('Account'); }}>
              <Text style={navStyles.itemIcon}>👤</Text>
              <Text style={navStyles.itemText}>Account</Text>
            </TouchableOpacity>
            <View style={navStyles.divider} />

            <TouchableOpacity style={navStyles.item} onPress={() => { setVisible(false); navigation.navigate('CreateUser'); }}>
              <Text style={navStyles.itemIcon}>➕</Text>
              <Text style={navStyles.itemText}>Create New Profile</Text>
            </TouchableOpacity>
            <View style={navStyles.divider} />

            <TouchableOpacity style={[navStyles.item, { paddingBottom: 4 }]} onPress={handleSignOut}>
              <Text style={navStyles.itemIcon}>🚪</Text>
              <Text style={[navStyles.itemText, { color: '#EF4444' }]}>Sign Out</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const navStyles = StyleSheet.create({
  gearBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 4,
  },
  gearIcon: { fontSize: 18 },
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,.45)',
    justifyContent: 'center', alignItems: 'center',
  },
  card: {
    backgroundColor: '#fff', borderRadius: 20,
    paddingTop: 20, paddingBottom: 8, width: 280,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2, shadowRadius: 24, elevation: 12,
    overflow: 'hidden',
  },
  cardTitle: {
    fontSize: 17, fontWeight: '800', color: '#111827',
    textAlign: 'center', marginBottom: 12,
  },
  divider: { height: 1, backgroundColor: '#F3F4F6' },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 20,
  },
  itemIcon: { fontSize: 18 },
  itemText: { fontSize: 15, fontWeight: '600', color: '#111827' },
});

// ── Guardian stack (replaces bottom tabs) ────────────────────────────────

function GuardianTabs() {
  return (
    <GuardianNav.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.bloomNavy },
        headerTintColor: '#FFFFFF',
        headerBackTitle: '',
        headerShadowVisible: false,
        headerRight: () => <GuardianSettingsBtn />,
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
      <GuardianNav.Screen name="CreateTutorial"      component={CreateTutorialScreen}        options={{ title: 'Create Tutorial' }} />
      <GuardianNav.Screen name="TutorialPreview"    component={TutorialPreviewScreen}       options={{ title: 'Preview Tutorial' }} />
      <GuardianNav.Screen name="TutorialLibrary"    component={TutorialLibraryScreen}       options={{ title: 'Tutorial Library' }} />
      <GuardianNav.Screen name="LearnerDiscovery"   component={LearnerDiscoveryScreen}      options={{ title: 'Find Friends' }} />
      <GuardianNav.Screen name="LearnerPublicProfile" component={LearnerPublicProfileScreen} options={{ title: 'Learner Profile' }} />
      <GuardianNav.Screen name="LearnerFriendRequests" component={LearnerFriendRequestsScreen} options={{ title: 'Friend Requests' }} />
      <GuardianNav.Screen name="GuardianConnections"  component={GuardianConnectionsScreen}   options={{ title: 'My Connections' }} />
      <GuardianNav.Screen name="Discussions"         component={DiscussionsScreen}           options={{ title: 'Discussions' }} />
      <GuardianNav.Screen name="DiscussionDetail"    component={DiscussionDetailScreen}      options={{ title: 'Discussion' }} />
      <GuardianNav.Screen name="Events"              component={EventsScreen}                options={{ title: 'Events' }} />
      <GuardianNav.Screen name="EventDetail"         component={EventDetailScreen}           options={{ title: 'Event' }} />
      <GuardianNav.Screen name="CreateEvent"         component={CreateEventScreen}           options={{ title: 'Create Event' }} />
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
