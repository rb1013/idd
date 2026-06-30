import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image, SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';
import { UserStackParamList } from '../../navigation';

export default function UserHomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<UserStackParamList>>();
  const { activeUser } = useAuth();

  const firstName = activeUser?.name?.split(' ')[0] ?? 'there';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hi, {firstName}! 👋</Text>
          <Text style={styles.subGreeting}>What do you want to do today?</Text>
        </View>
        <TouchableOpacity
          style={styles.avatarBtn}
          onPress={() => navigation.navigate('Profile')}
        >
          {activeUser?.photo_url
            ? <Image source={{ uri: activeUser.photo_url }} style={styles.avatar} />
            : <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{activeUser?.name?.[0] ?? '?'}</Text>
              </View>
          }
        </TouchableOpacity>
      </View>

      <View style={styles.choices}>
        <TouchableOpacity
          style={[styles.card, styles.friendsCard]}
          onPress={() => navigation.navigate('FriendsHub')}
          activeOpacity={0.85}
        >
          <Text style={styles.cardEmoji}>🤝</Text>
          <Text style={styles.cardTitle}>Friends</Text>
          <Text style={styles.cardSubtitle}>Meet new people and connect</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, styles.learnCard]}
          onPress={() => navigation.navigate('Tutorials')}
          activeOpacity={0.85}
        >
          <Text style={styles.cardEmoji}>📚</Text>
          <Text style={styles.cardTitle}>Learn</Text>
          <Text style={styles.cardSubtitle}>Watch videos and discover new things</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 16,
  },
  greeting: {
    fontSize: 30,
    fontWeight: '800',
    color: COLORS.text,
  },
  subGreeting: {
    fontSize: 17,
    color: COLORS.textLight,
    marginTop: 4,
  },
  avatarBtn: {
    borderRadius: 36,
    overflow: 'hidden',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.primary,
  },
  choices: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 20,
    justifyContent: 'center',
  },
  card: {
    flex: 1,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  friendsCard: {
    backgroundColor: COLORS.secondary,
  },
  learnCard: {
    backgroundColor: COLORS.primary,
  },
  cardEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
