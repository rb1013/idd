import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, Alert, ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';
import { UserProfile } from '../../types';
import { RootStackParamList } from '../../navigation';

function NotifToggle({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity style={notifStyles.row} onPress={onToggle} delayPressIn={50}>
      <Text style={notifStyles.label}>{label}</Text>
      <View style={[notifStyles.toggle, value && notifStyles.toggleOn]}>
        <View style={[notifStyles.thumb, value && notifStyles.thumbOn]} />
      </View>
    </TouchableOpacity>
  );
}

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'SelectUser'> };

export default function SelectUserScreen({ navigation }: Props) {
  const { guardian, setActiveUser, signOut } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifSettings, setNotifSettings] = useState<any>(null);

  const guardianRef = useRef(guardian);
  guardianRef.current = guardian;

  // Initial load when guardian becomes available
  useEffect(() => {
    if (guardian) {
      fetchUsers(guardian.id);
      fetchNotifSettings(guardian.id);
    } else {
      setLoading(false);
    }
  }, [guardian]);

  // Re-fetch on screen focus (navigating back from CreateUser)
  useEffect(() => {
    return navigation.addListener('focus', () => {
      if (guardianRef.current) fetchUsers(guardianRef.current.id);
    });
  }, [navigation]);

  async function fetchUsers(guardianId: string) {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('guardian_id', guardianId);
    if (error) Alert.alert('Error loading profiles', error.message);
    else setUsers(data || []);
    setLoading(false);
  }

  async function fetchNotifSettings(guardianId: string) {
    const { data } = await supabase
      .from('guardian_notification_settings')
      .select('*')
      .eq('guardian_id', guardianId)
      .single();
    setNotifSettings(data || null);
  }

  async function toggleNotifSetting(key: string) {
    const current = notifSettings?.[key] ?? false;
    const newValue = !current;
    const newSettings = { ...notifSettings, [key]: newValue, guardian_id: guardian!.id };
    if (!notifSettings) {
      await supabase.from('guardian_notification_settings').insert(newSettings);
    } else {
      await supabase.from('guardian_notification_settings').update({ [key]: newValue }).eq('guardian_id', guardian!.id);
    }
    setNotifSettings(newSettings);
  }

  function selectUser(user: UserProfile) {
    setActiveUser(user);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Who is using the app?</Text>
      <Text style={styles.subtitle}>Select a profile or create a new one</Text>

      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => selectUser(item)}>
            {item.photo_url
              ? <Image source={{ uri: item.photo_url }} style={styles.avatar} />
              : <View style={styles.avatarPlaceholder}><Text style={styles.avatarText}>{item.name[0]}</Text></View>
            }
            <View style={styles.cardInfo}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>{item.age} years • {item.city}</Text>
            </View>
            <TouchableOpacity style={styles.editBtn} onPress={() => navigation.navigate('EditUser', { userId: item.id })}>
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No profiles yet. Create one below!</Text>
        }
      />

      <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('CreateUser')}>
        <Text style={styles.addButtonText}>+ Create New Profile</Text>
      </TouchableOpacity>

      <View style={notifStyles.section}>
        <Text style={notifStyles.sectionTitle}>Guardian Notifications</Text>
        <NotifToggle label="Friend requests" value={notifSettings?.notify_on_friend_request ?? false} onToggle={() => toggleNotifSetting('notify_on_friend_request')} />
        <NotifToggle label="Messages" value={notifSettings?.notify_on_message ?? false} onToggle={() => toggleNotifSetting('notify_on_message')} />
        <NotifToggle label="Profile changes" value={notifSettings?.notify_on_profile_change ?? false} onToggle={() => toggleNotifSetting('notify_on_profile_change')} />
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const notifStyles = StyleSheet.create({
  section: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLORS.border },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  label: { fontSize: 15, color: COLORS.text },
  toggle: { width: 46, height: 26, borderRadius: 13, backgroundColor: COLORS.border, justifyContent: 'center', padding: 2 },
  toggleOn: { backgroundColor: COLORS.primary },
  thumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  thumbOn: { alignSelf: 'flex-end' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '700', color: COLORS.text, marginTop: 16 },
  subtitle: { fontSize: 15, color: COLORS.textLight, marginBottom: 24 },
  list: { paddingBottom: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  editBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: COLORS.primary },
  editBtnText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarPlaceholder: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '700', color: COLORS.primary },
  cardInfo: { flex: 1, marginLeft: 16 },
  name: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  meta: { fontSize: 14, color: COLORS.textLight, marginTop: 2 },
  arrow: { fontSize: 24, color: COLORS.textLight },
  empty: { textAlign: 'center', color: COLORS.textLight, fontSize: 15, marginTop: 32 },
  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  signOutButton: { padding: 16, alignItems: 'center' },
  signOutText: { color: COLORS.textLight, fontSize: 14 },
});
