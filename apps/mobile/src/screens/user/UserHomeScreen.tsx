import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image, SafeAreaView,
  Modal, Dimensions,
} from 'react-native';
import * as Speech from 'expo-speech';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';
import { UserStackParamList } from '../../navigation';

function LogoutIcon() {
  const c = '#fff';
  return (
    <View style={{ width: 38, height: 38 }}>
      {/* Person: head */}
      <View style={{ position: 'absolute', top: 2, left: 2, width: 9, height: 9, borderRadius: 4.5, backgroundColor: c }} />
      {/* Person: body leaning forward */}
      <View style={{ position: 'absolute', top: 12, left: 4, width: 3.5, height: 12, borderRadius: 1.75, backgroundColor: c, transform: [{ rotate: '10deg' }] }} />
      {/* Person: front leg */}
      <View style={{ position: 'absolute', top: 22, left: 8, width: 3.5, height: 9, borderRadius: 1.75, backgroundColor: c, transform: [{ rotate: '20deg' }] }} />
      {/* Person: back leg */}
      <View style={{ position: 'absolute', top: 22, left: 1, width: 3.5, height: 9, borderRadius: 1.75, backgroundColor: c, transform: [{ rotate: '-20deg' }] }} />
      {/* Person: arm reaching toward door */}
      <View style={{ position: 'absolute', top: 14, left: 7, width: 9, height: 3.5, borderRadius: 1.75, backgroundColor: c, transform: [{ rotate: '-25deg' }] }} />

      {/* Door frame: top */}
      <View style={{ position: 'absolute', top: 4, left: 20, right: 2, height: 3.5, borderRadius: 1.75, backgroundColor: c }} />
      {/* Door frame: right side */}
      <View style={{ position: 'absolute', top: 4, right: 2, bottom: 4, width: 3.5, borderRadius: 1.75, backgroundColor: c }} />
      {/* Door frame: bottom */}
      <View style={{ position: 'absolute', bottom: 4, left: 20, right: 2, height: 3.5, borderRadius: 1.75, backgroundColor: c }} />

      {/* Arrow going into door */}
      {/* Stem */}
      <View style={{ position: 'absolute', top: 17, left: 16, width: 14, height: 3.5, borderRadius: 1.75, backgroundColor: c }} />
      {/* Top wing */}
      <View style={{ position: 'absolute', top: 10, left: 23, width: 3.5, height: 10, borderRadius: 1.75, backgroundColor: c, transform: [{ rotate: '45deg' }] }} />
      {/* Bottom wing */}
      <View style={{ position: 'absolute', top: 17, left: 23, width: 3.5, height: 10, borderRadius: 1.75, backgroundColor: c, transform: [{ rotate: '-45deg' }] }} />
    </View>
  );
}

const MOODS = [
  { emoji: '😊', label: 'Happy' },
  { emoji: '😔', label: 'Sad' },
  { emoji: '😡', label: 'Angry' },
  { emoji: '😴', label: 'Tired' },
];

const { width } = Dimensions.get('window');
const TILE_W = (width - 48 - 16) / 2;

export default function UserHomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<UserStackParamList>>();
  const { activeUser, signOut } = useAuth();
  const [mood, setMood] = useState<string | null>(null);
  const [showMoodPicker, setShowMoodPicker] = useState(false);
  const [showUserCard, setShowUserCard] = useState(false);

  const firstName = activeUser?.name?.split(' ')[0] ?? 'there';

  function openUserCard() {
    Speech.speak(`Hi ${activeUser?.name ?? firstName}`, { rate: 0.85, pitch: 1.0 });
    setShowUserCard(true);
  }

  function selectMood(m: { emoji: string; label: string }) {
    setMood(m.emoji);
    setShowMoodPicker(false);
  }

  function speakMood(label: string) {
    Speech.speak(label, { rate: 0.8, pitch: 1.0, volume: 0.7 });
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hi, {firstName}! 👋</Text>
          <Text style={styles.subGreeting}>What do you want to do today?</Text>
        </View>
        <TouchableOpacity style={styles.avatarBtn} onPress={openUserCard} activeOpacity={0.85}>
          {activeUser?.photo_url
            ? <Image source={{ uri: activeUser.photo_url }} style={styles.avatar} />
            : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{activeUser?.name?.[0] ?? '?'}</Text>
              </View>
            )
          }
          {mood && (
            <View style={styles.moodBadge}>
              <Text style={styles.moodBadgeEmoji}>{mood}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.grid}>
        <TouchableOpacity
          style={[styles.tile, styles.friendsTile]}
          onPress={() => navigation.navigate('FriendsHub')}
          activeOpacity={0.85}
        >
          <Text style={styles.tileEmoji}>🤝</Text>
          <Text style={styles.tileTitle}>Friends</Text>
          <Text style={styles.tileSub}>Meet new people{'\n'}and connect</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.tile, styles.messagesTile]} activeOpacity={0.85}>
          <Text style={styles.tileEmoji}>💬</Text>
          <Text style={styles.tileTitle}>Messages</Text>
          <Text style={styles.tileSub}>Chat with{'\n'}your friends</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tile, styles.moodTile]}
          onPress={() => setShowMoodPicker(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.tileEmoji}>{mood ?? '😊'}</Text>
          <Text style={styles.tileTitle}>My Mood</Text>
          <Text style={styles.tileSub}>How are you{'\n'}feeling today?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tile, styles.learnTile]}
          onPress={() => navigation.navigate('Tutorials')}
          activeOpacity={0.85}
        >
          <Text style={styles.tileEmoji}>📚</Text>
          <Text style={styles.tileTitle}>Learn</Text>
          <Text style={styles.tileSub}>Watch videos and{'\n'}discover new things</Text>
        </TouchableOpacity>
      </View>

      {/* User card */}
      <Modal
        visible={showUserCard}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUserCard(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setShowUserCard(false)}
        >
          <TouchableOpacity style={styles.userCard} activeOpacity={1} onPress={() => {}}>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setShowUserCard(false)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>

            {activeUser?.photo_url
              ? <Image source={{ uri: activeUser.photo_url }} style={styles.userCardAvatar} />
              : (
                <View style={styles.userCardAvatarPlaceholder}>
                  <Text style={styles.userCardAvatarText}>{activeUser?.name?.[0] ?? '?'}</Text>
                </View>
              )
            }

            <Text style={styles.userCardName}>Hi, {activeUser?.name}!</Text>

            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={signOut}
              onLongPress={() => Speech.speak('Log out', { rate: 0.85, pitch: 1.0 })}
              delayLongPress={400}
              activeOpacity={0.8}
            >
              <LogoutIcon />
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Mood picker */}
      <Modal
        visible={showMoodPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMoodPicker(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setShowMoodPicker(false)}
        >
          <TouchableOpacity style={styles.pickerCard} activeOpacity={1} onPress={() => {}}>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setShowMoodPicker(false)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>

            <Text style={styles.pickerTitle}>How are you feeling?</Text>

            <View style={styles.moodRow}>
              {MOODS.map(m => (
                <TouchableOpacity
                  key={m.emoji}
                  style={[styles.moodOption, mood === m.emoji && styles.moodOptionSelected]}
                  onPress={() => selectMood(m)}
                  onLongPress={() => speakMood(m.label)}
                  delayLongPress={400}
                  activeOpacity={0.8}
                >
                  <Text style={styles.moodEmoji}>{m.emoji}</Text>
                  <Text style={styles.moodLabel}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
  },
  greeting: { fontSize: 28, fontWeight: '800', color: COLORS.text },
  subGreeting: { fontSize: 15, color: COLORS.textLight, marginTop: 3 },

  avatarBtn: { position: 'relative' },
  avatar: { width: 68, height: 68, borderRadius: 34 },
  avatarPlaceholder: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 26, fontWeight: '700', color: COLORS.primary },
  moodBadge: {
    position: 'absolute',
    bottom: -2, right: -2,
    width: 28, height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4,
    elevation: 4,
    borderWidth: 2, borderColor: COLORS.background,
  },
  moodBadgeEmoji: { fontSize: 16 },

  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 16,
    alignContent: 'center',
  },
  tile: {
    width: TILE_W,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  friendsTile:  { backgroundColor: '#5CBB7A' },
  messagesTile: { backgroundColor: '#4A90E2', opacity: 0.75 },
  moodTile:     { backgroundColor: '#F5A623' },
  learnTile:    { backgroundColor: '#9B59B6' },
  tileEmoji:  { fontSize: 56, marginBottom: 12 },
  tileTitle:  { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 6 },
  tileSub:    { fontSize: 13, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 18 },

  // User card
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 28,
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 36,
    width: width - 80,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  userCardAvatar: { width: 88, height: 88, borderRadius: 44, marginBottom: 16 },
  userCardAvatarPlaceholder: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
  },
  userCardAvatarText: { fontSize: 36, fontWeight: '800', color: COLORS.primary },
  userCardName: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 28 },
  logoutBtn: {
    width: 72, height: 72,
    borderRadius: 36,
    backgroundColor: '#E53E3E',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#E53E3E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },

  // Mood picker
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerCard: {
    backgroundColor: '#fff',
    borderRadius: 28,
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 28,
    width: width - 48,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    width: 40, height: 40,
    borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.border,
    marginBottom: 8,
  },
  closeBtnText: { fontSize: 20, fontWeight: '900', color: COLORS.text, lineHeight: 22 },
  pickerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 24 },
  moodRow: { flexDirection: 'row', gap: 16 },
  moodOption: {
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  moodOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  moodEmoji: { fontSize: 44 },
  moodLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textLight },
});
