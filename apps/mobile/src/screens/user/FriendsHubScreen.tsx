import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, Dimensions, Alert,
} from 'react-native';
import * as Speech from 'expo-speech';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';
import { UserStackParamList } from '../../navigation';

const COLUMN_COUNT = 2;
const GAP = 16;
const PADDING = 20;
const CARD_WIDTH = (Dimensions.get('window').width - PADDING * 2 - GAP) / COLUMN_COUNT;

interface Friend {
  id: string;
  name: string;
  photo_url: string | null;
  city: string | null;
  conversationId?: string;
}

export default function FriendsHubScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<UserStackParamList>>();
  const { activeUser } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={styles.discoverBtn}
          onPress={() => navigation.navigate('Discovery')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.discoverIcon}>🔍</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    if (activeUser) loadFriends(activeUser.id);
  }, [activeUser]);

  async function loadFriends(userId: string) {
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        id, requester_id, addressee_id,
        requester:user_profiles!friendships_requester_id_fkey(id, name, photo_url, city),
        addressee:user_profiles!friendships_addressee_id_fkey(id, name, photo_url, city)
      `)
      .eq('status', 'accepted')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

    if (error) { setLoading(false); return; }

    const list: Friend[] = (data || []).map((f: any) => {
      const isRequester = f.requester_id === userId;
      const friend = isRequester ? f.addressee : f.requester;
      return { id: friend.id, name: friend.name, photo_url: friend.photo_url, city: friend.city };
    });

    setFriends(list);
    setLoading(false);
  }

  async function openChat(friend: Friend) {
    if (!activeUser) return;
    const { data: convId, error } = await supabase.rpc('find_or_create_conversation', {
      p_user_a: activeUser.id,
      p_user_b: friend.id,
    });
    if (error || !convId) { Alert.alert('Chat error', error?.message ?? 'Failed to open chat'); return; }
    navigation.navigate('Chat', { conversationId: convId, participantName: friend.name });
  }

  function speakName(name: string) {
    Speech.speak(name, { rate: 0.85, pitch: 1.0 });
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  if (friends.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyEmoji}>🤝</Text>
        <Text style={styles.emptyText}>No friends yet!</Text>
        <Text style={styles.emptyHint}>Tap 🔍 to find people to connect with</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={friends}
      keyExtractor={item => item.id}
      numColumns={COLUMN_COUNT}
      contentContainerStyle={styles.grid}
      columnWrapperStyle={{ gap: GAP }}
      renderItem={({ item }) => (
        <View style={styles.card}>
          {/* Photo with green active ring */}
          <View style={styles.photoWrapper}>
            {item.photo_url
              ? <Image source={{ uri: item.photo_url }} style={styles.photo} />
              : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoInitial}>{item.name[0]}</Text>
                </View>
              )
            }
            <View style={styles.activeRing} />
            <View style={styles.activeDot} />
          </View>

          {/* Name — tap to hear it spoken */}
          <TouchableOpacity
            style={styles.nameRow}
            onPress={() => speakName(item.name)}
            activeOpacity={0.7}
          >
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.speakerIcon}>📣</Text>
          </TouchableOpacity>

          {item.city ? <Text style={styles.city} numberOfLines={1}>{item.city}</Text> : null}

          {/* Message button */}
          <TouchableOpacity style={styles.messageBtn} onPress={() => openChat(item)} activeOpacity={0.85}>
            <Text style={styles.messageBtnText}>💬  Message</Text>
          </TouchableOpacity>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background, padding: 32 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyText: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  emptyHint: { fontSize: 15, color: COLORS.textLight, textAlign: 'center' },

  grid: { padding: PADDING, paddingBottom: 48, gap: GAP },

  card: {
    width: CARD_WIDTH,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },

  photoWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  photo: {
    width: CARD_WIDTH * 0.65,
    height: CARD_WIDTH * 0.65,
    borderRadius: CARD_WIDTH * 0.325,
  },
  photoPlaceholder: {
    width: CARD_WIDTH * 0.65,
    height: CARD_WIDTH * 0.65,
    borderRadius: CARD_WIDTH * 0.325,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoInitial: {
    fontSize: 36,
    fontWeight: '700',
    color: COLORS.primary,
  },
  activeRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: CARD_WIDTH * 0.375,
    borderWidth: 3,
    borderColor: COLORS.secondary,
  },
  activeDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.secondary,
    borderWidth: 3,
    borderColor: COLORS.surface,
  },

  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    flexShrink: 1,
  },
  speakerIcon: { fontSize: 16 },

  city: {
    fontSize: 13,
    color: COLORS.textLight,
    marginBottom: 14,
  },

  messageBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 20,
    width: '100%',
    alignItems: 'center',
  },
  messageBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  discoverBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  discoverIcon: { fontSize: 28 },
});
