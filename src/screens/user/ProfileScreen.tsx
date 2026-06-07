import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Image,
  TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const { activeUser, setActiveUser, signOut, guardian } = useAuth();
  const navigation = useNavigation<Nav>();
  const [likes, setLikes] = useState<string[]>([]);
  const [abilities, setAbilities] = useState<string[]>([]);
  const [chatPrefs, setChatPrefs] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notifSettings, setNotifSettings] = useState<any>(null);

  useEffect(() => {
    if (activeUser) fetchDetails();
  }, [activeUser]);

  async function fetchDetails() {
    const [likesRes, abilitiesRes, chatRes, notifRes] = await Promise.all([
      supabase.from('user_likes').select('categories(name)').eq('user_id', activeUser!.id),
      supabase.from('user_abilities').select('categories(name)').eq('user_id', activeUser!.id),
      supabase.from('chat_preferences').select('*').eq('user_id', activeUser!.id).single(),
      supabase.from('guardian_notification_settings').select('*').eq('guardian_id', guardian!.id).single(),
    ]);

    setLikes((likesRes.data || []).map((l: any) => l.categories?.name).filter(Boolean));
    setAbilities((abilitiesRes.data || []).map((a: any) => a.categories?.name).filter(Boolean));
    setChatPrefs(chatRes.data);
    setNotifSettings(notifRes.data);
    setLoading(false);
  }

  async function toggleNotifSetting(key: string) {
    const current = notifSettings?.[key] ?? false;
    const newValue = !current;
    const newSettings = { ...notifSettings, [key]: newValue, guardian_id: guardian!.id };

    if (!notifSettings) {
      await supabase.from('guardian_notification_settings').insert(newSettings);
    } else {
      await supabase.from('guardian_notification_settings')
        .update({ [key]: newValue })
        .eq('guardian_id', guardian!.id);
    }
    setNotifSettings(newSettings);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      {/* Avatar + name */}
      <View style={styles.header}>
        {activeUser!.photo_url
          ? <Image source={{ uri: activeUser!.photo_url }} style={styles.avatar} />
          : <View style={styles.avatarPlaceholder}><Text style={styles.avatarInitial}>{activeUser!.name[0]}</Text></View>
        }
        <Text style={styles.name}>{activeUser!.name}</Text>
        <Text style={styles.meta}>{activeUser!.age} yrs • {activeUser!.gender} • {activeUser!.city}</Text>
      </View>

      {/* Likes */}
      {likes.length > 0 && (
        <Section title="Likes">
          <View style={styles.chips}>
            {likes.map(l => <Chip key={l} label={l} />)}
          </View>
        </Section>
      )}

      {/* Abilities */}
      {abilities.length > 0 && (
        <Section title="What I Can Do">
          <View style={styles.chips}>
            {abilities.map(a => <Chip key={a} label={a} color={COLORS.secondary} />)}
          </View>
        </Section>
      )}

      {/* Chat preferences */}
      {chatPrefs && (
        <Section title="Chat Preferences">
          <InfoRow label="Online chat" value={chatPrefs.open_to_online_chat ? 'Yes' : 'No'} />
          <InfoRow label="Zoom" value={chatPrefs.open_to_zoom ? 'Yes' : 'No'} />
          <InfoRow label="Voice chat" value={chatPrefs.open_to_voice_chat ? 'Yes' : 'No'} />
          <InfoRow label="Comprehension" value={chatPrefs.comprehension_level} />
          {chatPrefs.available_days?.length > 0 && (
            <InfoRow label="Available" value={chatPrefs.available_days.join(', ')} />
          )}
        </Section>
      )}

      {/* Guardian notification settings */}
      <Section title="Guardian Notifications">
        <NotifToggle label="Friend requests" value={notifSettings?.notify_on_friend_request} onToggle={() => toggleNotifSetting('notify_on_friend_request')} />
        <NotifToggle label="Messages" value={notifSettings?.notify_on_message} onToggle={() => toggleNotifSetting('notify_on_message')} />
        <NotifToggle label="Profile changes" value={notifSettings?.notify_on_profile_change} onToggle={() => toggleNotifSetting('notify_on_profile_change')} />
      </Section>

      <TouchableOpacity style={styles.switchBtn} onPress={() => setActiveUser(null)}>
        <Text style={styles.switchBtnText}>Switch Profile</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function Chip({ label, color }: { label: string; color?: string }) {
  return (
    <View style={[styles.chip, { borderColor: color || COLORS.primary }]}>
      <Text style={[styles.chipText, { color: color || COLORS.primary }]}>{label}</Text>
    </View>
  );
}

function NotifToggle({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity style={styles.notifRow} onPress={onToggle}>
      <Text style={styles.notifLabel}>{label}</Text>
      <View style={[styles.toggle, value && styles.toggleOn]}>
        <View style={[styles.toggleThumb, value && styles.toggleThumbOn]} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  inner: { padding: 24, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 96, height: 96, borderRadius: 48, marginBottom: 12 },
  avatarPlaceholder: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarInitial: { fontSize: 36, fontWeight: '700', color: COLORS.primary },
  name: { fontSize: 26, fontWeight: '700', color: COLORS.text },
  meta: { fontSize: 15, color: COLORS.textLight, marginTop: 4 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1.5, backgroundColor: COLORS.surface,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  infoLabel: { fontSize: 15, color: COLORS.textLight },
  infoValue: { fontSize: 15, color: COLORS.text, fontWeight: '500', textTransform: 'capitalize' },
  notifRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  notifLabel: { fontSize: 15, color: COLORS.text },
  toggle: { width: 52, height: 30, borderRadius: 15, backgroundColor: COLORS.border, justifyContent: 'center', padding: 2 },
  toggleOn: { backgroundColor: COLORS.primary },
  toggleThumb: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff' },
  toggleThumbOn: { alignSelf: 'flex-end' },
  switchBtn: {
    borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 12,
    padding: 14, alignItems: 'center', marginBottom: 12,
  },
  switchBtnText: { color: COLORS.primary, fontWeight: '600', fontSize: 16 },
  signOutBtn: { padding: 14, alignItems: 'center' },
  signOutText: { color: COLORS.textLight, fontSize: 15 },
});
