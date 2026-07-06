import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';
import { GuardianNavParamList } from '../../navigation';
import { UserProfile } from '../../types';

type Nav = NativeStackNavigationProp<GuardianNavParamList>;

const AVATAR_COLORS = ['#8B5CF6', '#10B981', '#F59E0B', '#6366F1', '#EF4444', '#1ABC9C'];
function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

interface UserWithCount extends UserProfile {
  templateCount: number;
}

export default function ScheduleScreen() {
  const navigation = useNavigation<Nav>();
  const { guardian } = useAuth();
  const [users, setUsers] = useState<UserWithCount[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    loadUsers();
  }, [guardian]));

  async function loadUsers() {
    if (!guardian) return;
    setLoading(true);

    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('guardian_id', guardian.id)
      .order('name');

    if (!profiles || profiles.length === 0) {
      setUsers([]);
      setLoading(false);
      return;
    }

    // Count active templates per user
    const today = new Date().toISOString().slice(0, 10);
    const { data: templateCounts } = await supabase
      .from('schedule_templates')
      .select('user_id')
      .eq('guardian_id', guardian.id)
      .gte('valid_until', today);

    const countMap: Record<string, number> = {};
    (templateCounts || []).forEach((r: any) => {
      countMap[r.user_id] = (countMap[r.user_id] ?? 0) + 1;
    });

    setUsers(profiles.map(p => ({ ...p, templateCount: countMap[p.id] ?? 0 })));
    setLoading(false);
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  if (users.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyEmoji}>👥</Text>
        <Text style={styles.emptyTitle}>No users yet</Text>
        <Text style={styles.emptyHint}>Create a user profile first</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={users}
      keyExtractor={u => u.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={<Text style={styles.header}>Choose a user to manage their schedule</Text>}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('UserSchedule', { userId: item.id, userName: item.name })}
          activeOpacity={0.82}
        >
          <View style={[styles.avatar, { backgroundColor: avatarColor(item.name) }]}>
            <Text style={styles.avatarText}>{item.name[0]}</Text>
          </View>
          <View style={styles.info}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.count}>
              {item.templateCount > 0
                ? `${item.templateCount} recurring class${item.templateCount !== 1 ? 'es' : ''}`
                : 'No classes set'}
            </Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, backgroundColor: '#F9FAFB' },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  emptyHint: { fontSize: 14, color: COLORS.textLight },

  list: { padding: 16, gap: 10, backgroundColor: '#F9FAFB', flexGrow: 1 },
  header: {
    fontSize: 13, fontWeight: '700', color: '#9CA3AF',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 6,
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 50, height: 50, borderRadius: 25,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  avatarText: { fontSize: 20, fontWeight: '900', color: '#fff' },
  info: { flex: 1 },
  name: { fontSize: 17, fontWeight: '800', color: '#111827' },
  count: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  arrow: { fontSize: 20, color: '#D1D5DB' },
});
