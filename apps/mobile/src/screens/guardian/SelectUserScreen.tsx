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

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'SelectUser'> };

export default function SelectUserScreen({ navigation }: Props) {
  const { guardian, setActiveUser, signOut } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const guardianRef = useRef(guardian);
  guardianRef.current = guardian;

  // Initial load when guardian becomes available
  useEffect(() => {
    if (guardian) fetchUsers(guardian.id);
    else setLoading(false);
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
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No profiles yet. Create one below!</Text>
        }
      />

      <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('CreateUser')}>
        <Text style={styles.addButtonText}>+ Create New Profile</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

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
