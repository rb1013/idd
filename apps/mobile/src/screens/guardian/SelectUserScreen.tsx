import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, Alert, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';
import { UserProfile } from '../../types';
import { GuardianNavParamList } from '../../navigation';

export default function SelectUserScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<GuardianNavParamList>>();
  const { guardian } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const guardianRef = useRef(guardian);
  guardianRef.current = guardian;

  useEffect(() => {
    if (guardian) fetchUsers(guardian.id);
    else setLoading(false);
  }, [guardian]);

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

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  return (
    <View style={styles.container}>
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={styles.subtitle}>Manage user profiles under your care</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            {item.photo_url
              ? <Image source={{ uri: item.photo_url }} style={styles.avatar} />
              : <View style={styles.avatarPlaceholder}><Text style={styles.avatarText}>{item.name[0]}</Text></View>
            }
            <View style={styles.cardInfo}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>{item.age} yrs • {item.city}</Text>
              {item.email && <Text style={styles.email}>{item.email}</Text>}
            </View>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => navigation.navigate('EditUser', { userId: item.id })}
            >
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No profiles yet. Tap ⚙ → Create New Profile.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  subtitle: { fontSize: 15, color: COLORS.textLight, marginBottom: 16, marginTop: 8 },
  list: { paddingBottom: 32 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: 16,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
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
  email: { fontSize: 12, color: COLORS.primary, marginTop: 2 },
  editBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: COLORS.primary },
  editBtnText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  empty: { textAlign: 'center', color: COLORS.textLight, fontSize: 15, marginTop: 48 },
});
