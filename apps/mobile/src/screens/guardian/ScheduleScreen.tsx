import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { NICO } from '../../constants/theme';
import { GuardianNavParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<GuardianNavParamList>;

export default function ScheduleScreen() {
  const navigation = useNavigation<Nav>();
  const { guardian } = useAuth();

  useEffect(() => {
    if (!guardian) return;
    supabase
      .from('user_profiles')
      .select('id, name')
      .eq('guardian_id', guardian.id)
      .single()
      .then(({ data }) => {
        if (data) {
          navigation.replace('UserSchedule', { userId: data.id, userName: data.name });
        }
      });
  }, [guardian]);

  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={NICO.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: NICO.screenBg },
});
