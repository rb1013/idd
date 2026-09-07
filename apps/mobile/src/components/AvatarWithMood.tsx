import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { COLORS } from '../constants';

const AVATAR_COLORS = ['#4A90E2', '#5CBB7A', '#F5A623', '#9B59B6', '#E53E3E', '#1ABC9C'];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

interface Props {
  name: string;
  photo?: string | null;
  size: number;
  mood?: string | null;
  badgeSize?: number;
}

export default function AvatarWithMood({ name, photo, size, mood, badgeSize }: Props) {
  const radius = size / 2;
  const badge = badgeSize ?? Math.round(size * 0.36);
  const overhang = Math.round(badge * 0.25);

  return (
    <View style={{ width: size + overhang, height: size + overhang }}>
      {photo ? (
        <Image source={{ uri: photo }} style={{ width: size, height: size, borderRadius: radius, borderWidth: 2.5, borderColor: '#fff' }} />
      ) : (
        <View style={[styles.placeholder, { width: size, height: size, borderRadius: radius, backgroundColor: avatarColor(name), borderWidth: 2.5, borderColor: '#fff' }]}>
          <Text style={{ fontSize: size * 0.38, fontWeight: '800', color: '#fff' }}>{name[0]}</Text>
        </View>
      )}

      {!!mood && (
        <View style={[
          styles.badge,
          {
            width: badge, height: badge, borderRadius: badge / 2,
            bottom: 0, right: 0,
          },
        ]}>
          <Text style={{ fontSize: badge * 0.7, lineHeight: badge }}>{mood}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { justifyContent: 'center', alignItems: 'center' },
  badge: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderWidth: 2.5,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
});
