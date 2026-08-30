import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Image,
  TouchableOpacity, ActivityIndicator, Modal, Alert, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS, calcAge } from '../../constants';
import { UserStackParamList } from '../../navigation';
import AvatarWithMood from '../../components/AvatarWithMood';

export default function ProfileScreen() {
  const { activeUser, signOut } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<UserStackParamList>>();
  const [likes, setLikes] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [abilities, setAbilities] = useState<string[]>([]);
  const [chatPrefs, setChatPrefs] = useState<any>(null);
  const [healthInfo, setHealthInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setShowMenu(prev => !prev)}
          style={{ paddingHorizontal: 12, paddingVertical: 6 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={{ fontSize: 22, color: COLORS.text }}>⚙</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    if (activeUser) fetchDetails();
  }, [activeUser]);

  async function fetchDetails() {
    const [likesRes, dislikesRes, abilitiesRes, chatRes, healthRes] = await Promise.all([
      supabase.from('user_likes').select('categories(name)').eq('user_id', activeUser!.id),
      supabase.from('user_dislikes').select('categories(name)').eq('user_id', activeUser!.id),
      supabase.from('user_abilities').select('categories(name)').eq('user_id', activeUser!.id),
      supabase.from('chat_preferences').select('*').eq('user_id', activeUser!.id).single(),
      supabase.from('health_info').select('*').eq('user_id', activeUser!.id).single(),
    ]);

    setLikes((likesRes.data || []).map((l: any) => l.categories?.name).filter(Boolean));
    setDislikes((dislikesRes.data || []).map((l: any) => l.categories?.name).filter(Boolean));
    setAbilities((abilitiesRes.data || []).map((a: any) => a.categories?.name).filter(Boolean));
    setChatPrefs(chatRes.data);
    setHealthInfo(healthRes.data);
    setLoading(false);
  }

  function handleDeleteProfile() {
    Alert.alert(
      'Delete Profile',
      `Permanently delete ${activeUser!.name}'s profile? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('user_profiles').delete().eq('id', activeUser!.id);
            if (error) Alert.alert('Error', error.message);
            else signOut();
          },
        },
      ]
    );
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  const locationParts = [activeUser!.city, activeUser!.region, activeUser!.country].filter(Boolean).join(', ');

  return (
    <View style={styles.wrapper}>
      {/* Dropdown menu */}
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity style={styles.overlay} onPress={() => setShowMenu(false)} activeOpacity={1}>
          <View style={styles.dropdownMenu}>
            <MenuItem
              label="Edit Profile"
              onPress={() => { setShowMenu(false); navigation.navigate('EditUser', { userId: activeUser!.id }); }}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              label="Sign Out"
              onPress={() => { setShowMenu(false); signOut(); }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.inner}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        scrollEventThrottle={16}
        bounces
      >
        {/* Avatar + name */}
        <View style={styles.header}>
          <AvatarWithMood
            name={activeUser!.name}
            photo={activeUser!.photo_url}
            size={96}
            mood={activeUser!.current_mood}
            badgeSize={32}
          />
          <Text style={styles.name}>{activeUser!.name}</Text>
          <Text style={styles.meta}>{calcAge(activeUser!.date_of_birth) ?? activeUser!.age ?? '—'} yrs • {activeUser!.gender}</Text>
          {locationParts ? <Text style={styles.metaLocation}>{locationParts}</Text> : null}
          {activeUser!.languages?.length > 0 && (
            <Text style={styles.metaLanguages}>{activeUser!.languages.join(', ')}</Text>
          )}
        </View>

        {/* Likes */}
        {likes.length > 0 && (
          <Section title="Likes">
            <View style={styles.chips}>
              {likes.map(l => <Chip key={l} label={l} color={COLORS.primary} />)}
            </View>
          </Section>
        )}

        {/* Dislikes */}
        {dislikes.length > 0 && (
          <Section title="Dislikes">
            <View style={styles.chips}>
              {dislikes.map(d => <Chip key={d} label={d} color={COLORS.error} />)}
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
              <View style={styles.daysRow}>
                <Text style={styles.infoLabel}>Available days</Text>
                <View style={styles.daysChips}>
                  {chatPrefs.available_days.map((d: string) => (
                    <Chip key={d} label={d} color={COLORS.primary} />
                  ))}
                </View>
              </View>
            )}
          </Section>
        )}

        {/* Health info */}
        {healthInfo?.willing_to_share && (
          <Section title="Health Information">
            {healthInfo.description
              ? <Text style={styles.healthDesc}>{healthInfo.description}</Text>
              : <Text style={styles.healthDesc}>No details provided.</Text>
            }
          </Section>
        )}
      </ScrollView>
    </View>
  );
}

function MenuItem({ label, color, onPress }: { label: string; color?: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <Text style={[styles.menuItemText, color ? { color } : null]}>{label}</Text>
    </TouchableOpacity>
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

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.chip, { borderColor: color }]}>
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
  );
}

const HEADER_OFFSET = Platform.OS === 'ios' ? 96 : 64;

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1, backgroundColor: COLORS.background },
  inner: { padding: 24, paddingBottom: 80 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  overlay: { flex: 1 },
  dropdownMenu: {
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
  menuItem: { paddingVertical: 14, paddingHorizontal: 20 },
  menuItemText: { fontSize: 15, color: COLORS.text, fontWeight: '500' },
  menuDivider: { height: 1, backgroundColor: COLORS.border },

  header: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 96, height: 96, borderRadius: 48, marginBottom: 12 },
  avatarPlaceholder: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarInitial: { fontSize: 36, fontWeight: '700', color: COLORS.primary },
  name: { fontSize: 26, fontWeight: '700', color: COLORS.text },
  meta: { fontSize: 15, color: COLORS.textLight, marginTop: 4 },
  metaLocation: { fontSize: 14, color: COLORS.textLight, marginTop: 2 },
  metaLanguages: { fontSize: 13, color: COLORS.textLight, marginTop: 4, fontStyle: 'italic' },

  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, backgroundColor: COLORS.surface },
  chipText: { fontSize: 13, fontWeight: '600' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  infoLabel: { fontSize: 15, color: COLORS.textLight },
  infoValue: { fontSize: 15, color: COLORS.text, fontWeight: '500', textTransform: 'capitalize' },
  daysRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  daysChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  healthDesc: { fontSize: 15, color: COLORS.text, lineHeight: 22 },
});
