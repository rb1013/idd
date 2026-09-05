import React, { useState } from 'react';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ActivityIndicator, View, TouchableOpacity, Text,
  Modal, StyleSheet, Alert,
} from 'react-native';
import AppText from '../components/AppText';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { COLORS } from '../constants';

// Auth screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

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
import EditEventScreen from '../screens/guardian/EditEventScreen';
import LearnerSelectScreen from '../screens/guardian/LearnerSelectScreen';
import FavouriteFriendsScreen from '../screens/guardian/FavouriteFriendsScreen';

// User screens
import UserHomeScreen from '../screens/user/UserHomeScreen';
import FriendsHubScreen from '../screens/user/FriendsHubScreen';
import DiscoveryScreen from '../screens/discovery/DiscoveryScreen';
// import MessagesScreen from '../screens/messages/MessagesScreen'; // Messages tile removed
import ChatScreen from '../screens/chat/ChatScreen';
import TutorialsScreen from '../screens/tutorials/TutorialsScreen';
import ProfileScreen from '../screens/user/ProfileScreen';
import ActivitiesScreen from '../screens/user/ActivitiesScreen';

// ── Param lists ───────────────────────────────────────────────────────────

export type RootStackParamList = {
  Login: undefined;
  GuardianRegister: undefined;
  GuardianTabs: undefined;
  UserHome: undefined;
};

export type GuardianNavParamList = {
  LearnerSelect: undefined;
  GuardianHome: undefined;
  Profiles: undefined;
  Notifications: undefined;
  Learning: { initialTab?: 'search' | 'my' | 'create' } | undefined;
  Activities: undefined;
  Account: undefined;
  Schedule: undefined;
  UserSchedule: { userId: string; userName: string };
  CreateUser: undefined;
  EditUser: { userId: string };
  CreateTutorial: undefined;
  TutorialPreview: { tutorialId: string };
  TutorialLibrary: { userId?: string; linkedOnly?: boolean };
  LearnerDiscovery: undefined;
  LearnerPublicProfile: { learnerId: string };
  LearnerFriendRequests: undefined;
  GuardianConnections: undefined;
  Discussions: undefined;
  DiscussionDetail: { postId: string };
  Events: undefined;
  EventDetail: { eventId: string };
  CreateEvent: undefined;
  EditEvent: { eventId: string };
  FavouriteFriends: undefined;
};

export type UserStackParamList = {
  Home: undefined;
  FriendsHub: undefined;
  Discovery: undefined;
  // Messages: undefined; // Messages tile removed
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
  const [hasLearner, setHasLearner] = useState(false);

  React.useEffect(() => {
    if (!guardian) return;
    supabase.from('user_profiles').select('id', { count: 'exact', head: true }).eq('guardian_id', guardian.id)
      .then(({ count }) => setHasLearner((count ?? 0) > 0));
  }, [guardian]);

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
        <AppText style={navStyles.gearIcon}>⚙️</AppText>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={navStyles.overlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <TouchableOpacity style={navStyles.card} activeOpacity={1} onPress={() => {}}>
            <AppText style={navStyles.cardTitle}>Settings</AppText>

            <TouchableOpacity style={navStyles.item} onPress={() => { setVisible(false); navigation.navigate('Account'); }}>
              <AppText style={navStyles.itemIcon}>👤</AppText>
              <AppText style={navStyles.itemText}>Account</AppText>
            </TouchableOpacity>
            <View style={navStyles.divider} />

            {!hasLearner && (
              <>
                <TouchableOpacity style={navStyles.item} onPress={() => { setVisible(false); navigation.navigate('CreateUser'); }}>
                  <AppText style={navStyles.itemIcon}>➕</AppText>
                  <AppText style={navStyles.itemText}>Create New Profile</AppText>
                </TouchableOpacity>
                <View style={navStyles.divider} />
              </>
            )}

            <TouchableOpacity style={[navStyles.item, { paddingBottom: 4 }]} onPress={handleSignOut}>
              <AppText style={navStyles.itemIcon}>🚪</AppText>
              <AppText style={[navStyles.itemText, { color: '#EF4444' }]}>Sign Out</AppText>
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

// ── Pending screen (session exists but no role yet) ──────────────────────

function PendingScreen() {
  const { signOut } = useAuth();
  const [showSignOut, setShowSignOut] = useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setShowSignOut(true), 6000);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bloomBody, gap: 20 }}>
      <ActivityIndicator size="large" color={COLORS.bloomAccent} />
      {showSignOut && (
        <TouchableOpacity
          onPress={signOut}
          style={{ paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, backgroundColor: '#FEF2F2', borderWidth: 1.5, borderColor: '#FECACA' }}
        >
          <AppText style={{ fontSize: 14, fontWeight: '700', color: '#DC2626' }}>Sign out and try again</AppText>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Guardian stack (replaces bottom tabs) ────────────────────────────────

function GuardianTabs() {
  return (
    <GuardianNav.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.bloomAccent },
        headerTintColor: COLORS.bloomNavy,
        headerBackTitle: '',
        headerShadowVisible: false,
        headerRight: () => <GuardianSettingsBtn />,
      }}
    >
      <GuardianNav.Screen name="LearnerSelect"   component={LearnerSelectScreen}         options={{ headerShown: false, headerBackTitle: '' }} />
      <GuardianNav.Screen name="GuardianHome"    component={GuardianHomeScreen}          options={{ headerShown: false, headerBackTitle: '' }} />
      <GuardianNav.Screen name="Profiles"        component={SelectUserScreen}            options={{ title: 'Profiles' }} />
      <GuardianNav.Screen name="Notifications"   component={GuardianNotificationsScreen} options={{ title: 'Notifications' }} />
      <GuardianNav.Screen name="Learning"        component={GuardianTutorialsScreen}     options={{ title: 'Tutorials', headerRight: undefined }} />
      <GuardianNav.Screen name="Activities"      component={GuardianActivitiesScreen}    options={{ title: 'Activities', headerRight: undefined }} />
      <GuardianNav.Screen name="Account"         component={GuardianAccountScreen}       options={{ title: 'Account', headerRight: undefined }} />
      <GuardianNav.Screen name="Schedule"        component={ScheduleScreen}              options={{ title: 'Schedule' }} />
      <GuardianNav.Screen name="UserSchedule"    component={UserScheduleScreen}          options={{ title: 'Schedule' }} />
      <GuardianNav.Screen name="CreateUser"      component={CreateUserScreen}            options={{ title: 'Create Profile' }} />
      <GuardianNav.Screen name="EditUser"        component={EditUserScreen}              options={{ title: 'Edit Profile' }} />
      <GuardianNav.Screen name="CreateTutorial"      component={CreateTutorialScreen}        options={{ title: 'Create Tutorial', headerRight: undefined }} />
      <GuardianNav.Screen name="TutorialPreview"    component={TutorialPreviewScreen}       options={{ title: 'Preview Tutorial', headerRight: undefined }} />
      <GuardianNav.Screen name="TutorialLibrary"    component={TutorialLibraryScreen}       options={{ title: 'Search Tutorials', headerRight: undefined }} />
      <GuardianNav.Screen name="LearnerDiscovery"   component={LearnerDiscoveryScreen}      options={{ title: 'Find Friends', headerRight: undefined }} />
      <GuardianNav.Screen name="LearnerPublicProfile" component={LearnerPublicProfileScreen} options={{ title: 'Learner Profile', headerRight: undefined }} />
      <GuardianNav.Screen name="LearnerFriendRequests" component={LearnerFriendRequestsScreen} options={{ title: 'Friend Requests', headerRight: undefined }} />
      <GuardianNav.Screen name="GuardianConnections"  component={GuardianConnectionsScreen}   options={{ title: 'My Connections', headerRight: undefined }} />
      <GuardianNav.Screen name="Discussions"         component={DiscussionsScreen}           options={{ title: 'Discussions', headerRight: undefined }} />
      <GuardianNav.Screen name="DiscussionDetail"    component={DiscussionDetailScreen}      options={{ title: 'Discussion', headerRight: undefined }} />
      <GuardianNav.Screen name="Events"              component={EventsScreen}                options={{ title: 'Events', headerRight: undefined }} />
      <GuardianNav.Screen name="EventDetail"         component={EventDetailScreen}           options={{ title: 'Event' }} />
      <GuardianNav.Screen name="CreateEvent"         component={CreateEventScreen}           options={{ title: 'Create Event' }} />
      <GuardianNav.Screen name="EditEvent"           component={EditEventScreen}             options={{ title: 'Edit Event' }} />
      <GuardianNav.Screen name="FavouriteFriends"   component={FavouriteFriendsScreen}      options={{ title: 'Manage Friends', headerRight: undefined }} />
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
        headerBackTitle: '',
        headerShadowVisible: false,
      }}
    >
      <UserStack.Screen name="Home"       component={UserHomeScreen}    options={{ headerShown: false, headerBackTitle: '' }} />
      <UserStack.Screen name="FriendsHub" component={FriendsHubScreen}  options={{ title: '🤝  My Friends', headerBackTitle: '' }} />
      <UserStack.Screen name="Discovery"  component={DiscoveryScreen}   options={{ title: '🔍  Find Friends' }} />
      {/* <UserStack.Screen name="Messages" component={MessagesScreen} options={{ title: '💬  Messages', headerBackTitle: '' }} /> */}{/* Messages tile removed */}
      <UserStack.Screen name="Activities" component={ActivitiesScreen}  options={{ title: '✅  Today\'s Activities' }} />
      <UserStack.Screen name="Tutorials"  component={TutorialsScreen}   options={{ title: '📚  Learn' }} />
      <UserStack.Screen name="Profile"    component={ProfileScreen}     options={{ title: 'My Profile' }} />
      <UserStack.Screen name="Chat"       component={ChatScreen} />
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
          </>
        ) : guardian ? (
          <Stack.Screen name="GuardianTabs" component={GuardianTabs} />
        ) : activeUser ? (
          <Stack.Screen name="UserHome" component={UserNavigator} />
        ) : (
          <Stack.Screen name="Pending" component={PendingScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
