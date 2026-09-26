import React, { useEffect, useLayoutEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import AppText from '../../components/AppText';
import useNicoHeader from '../../hooks/useNicoHeader';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { VideoView, useVideoPlayer } from 'expo-video';
import YoutubePlayer from '../../components/YoutubePlayer';
import { supabase } from '../../lib/supabase';
import { UserStackParamList } from '../../navigation';
import type { Tutorial } from '../../types';
import { NICO, SPACING, FONT_SIZE, FONT_WEIGHT } from '../../constants/theme';

const { width } = Dimensions.get('window');

type Route = RouteProp<UserStackParamList, 'VideoPlayer'>;
type Nav   = NativeStackNavigationProp<UserStackParamList>;

export default function VideoPlayerScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { tutorialId } = route.params;

  useNicoHeader(navigation);

  const [tutorial, setTutorial] = useState<Tutorial | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('tutorials').select('*').eq('id', tutorialId).single()
      .then(({ data }) => {
        setTutorial(data as Tutorial | null);
        setLoading(false);
      });
  }, [tutorialId]);

  useLayoutEffect(() => {
    if (tutorial) navigation.setOptions({ title: tutorial.display_name || tutorial.category });
  }, [tutorial]);

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={NICO.primary} /></View>;
  }
  if (!tutorial) {
    return <View style={s.center}><AppText style={s.errorText}>Tutorial not found</AppText></View>;
  }

  return tutorial.source === 'youtube'
    ? <YoutubeVideo tutorial={tutorial} />
    : <NativeVideo tutorial={tutorial} />;
}

function YoutubeVideo({ tutorial }: { tutorial: Tutorial }) {
  const videoId = tutorial.video_url?.match(/embed\/([a-zA-Z0-9_-]{11})/)?.[1] ?? null;
  return (
    <View style={s.container}>
      {videoId && (
        <>
          <YoutubePlayer videoId={videoId} height={Math.round(width * 9 / 16)} />
          <View style={s.info}>
            <AppText style={s.title}>{tutorial.title}</AppText>
            <AppText style={s.desc}>{tutorial.description}</AppText>
          </View>
        </>
      )}
    </View>
  );
}

function NativeVideo({ tutorial }: { tutorial: Tutorial }) {
  const player = useVideoPlayer(tutorial.video_url ?? null, p => { if (tutorial.video_url) p.play(); });

  useEffect(() => {
    if (tutorial.video_url) {
      player.replace({ uri: tutorial.video_url });
      player.play();
    }
  }, [tutorial.video_url]);

  return (
    <View style={s.container}>
      {tutorial.video_url && (
        <>
          <VideoView player={player} style={s.video} nativeControls contentFit="contain" />
          <View style={s.info}>
            <AppText style={s.title}>{tutorial.title}</AppText>
            <AppText style={s.desc}>{tutorial.description}</AppText>
          </View>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: NICO.screenBg },
  errorText: { fontSize: FONT_SIZE.md, color: NICO.textMuted },
  video: { width, height: width * 0.5625 },
  info: { padding: SPACING.xl, backgroundColor: NICO.screenBg, flex: 1 },
  title: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, color: NICO.text, marginBottom: SPACING.sm },
  desc: { fontSize: FONT_SIZE.md, color: NICO.textMuted, lineHeight: 22 },
});
