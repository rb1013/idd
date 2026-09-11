import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert, Image, Modal, ScrollView,
} from 'react-native';
import { Filter } from 'bad-words';
import wordConfig from '../../lib/badWordsList.json';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
// import { Audio } from 'expo-av'; // requires native rebuild — enable when running npx expo run:ios
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useHeaderHeight } from '@react-navigation/elements';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';
import { Message } from '../../types';
import { UserStackParamList } from '../../navigation';
import CommunicationBoard from './CommunicationBoard';
import { isSymbolMessage } from '../../lib/aacSymbols';

type Route = RouteProp<UserStackParamList, 'Chat'>;


const AVATAR_COLORS = ['#5CBB7A', '#9B59B6', '#F5A623', '#4A90E2', '#E53E3E', '#1ABC9C'];
function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

export default function ChatScreen() {
  const { activeUser, session } = useAuth();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NativeStackNavigationProp<UserStackParamList>>();
  const route = useRoute<Route>();
  const { conversationId, participantName, participantPhoto } = route.params;

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [friendLastSeen, setFriendLastSeen] = useState<string | null>(null);
  const [boardVisible, setBoardVisible] = useState(false);
  const [blockedVisible, setBlockedVisible] = useState(false);

  // Guardian PIN modal
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  // Guardian action modal state
  type ActionStep = 'menu' | 'reason' | 'scope' | 'confirm';
  type ActionType = 'delete_chat' | 'block_user' | 'report_user' | 'block_delete' | 'block_delete_report';
  const [guardianModalVisible, setGuardianModalVisible] = useState(false);
  const [actionStep, setActionStep] = useState<ActionStep>('menu');
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [deleteScope, setDeleteScope] = useState<'all' | 'custom'>('all');
  const [deleteScopeN, setDeleteScopeN] = useState('');
  const [guardianWorking, setGuardianWorking] = useState(false);

  const ACTIONS: { type: ActionType; label: string; icon: string; needsDelete: boolean }[] = [
    { type: 'delete_chat',          label: 'Delete Chat',                    icon: '🗑️',  needsDelete: true },
    { type: 'block_user',           label: 'Block User',                     icon: '🚫',  needsDelete: false },
    { type: 'report_user',          label: 'Report User',                    icon: '📢',  needsDelete: false },
    { type: 'block_delete',         label: 'Block & Delete Chat',            icon: '🔒',  needsDelete: true },
    { type: 'block_delete_report',  label: 'Block, Delete Chat & Report',    icon: '⛔',  needsDelete: true },
  ];
  const flatListRef = useRef<FlatList>(null);
  function playBlockedFeedback() {
    // TODO: play gentle-chime.wav before TTS once expo-av is enabled (requires npx expo run:ios)
    // const { sound } = await Audio.Sound.createAsync(require('../../../assets/sounds/gentle-chime.wav'));
    // await sound.playAsync();
    // sound.setOnPlaybackStatusUpdate(status => {
    //   if ('didJustFinish' in status && status.didJustFinish) {
    //     sound.unloadAsync();
    //     Speech.speak("Let's use kind words!", { rate: 0.75, pitch: 1.1 });
    //   }
    // });
    Speech.speak("Let's use kind words!", { rate: 0.75, pitch: 1.1 });
  }

  const wordFilter = useRef<Filter | null>(null);
  if (!wordFilter.current) {
    const f = new Filter();
    if (wordConfig.add.length) f.addWords(...wordConfig.add);
    if (wordConfig.remove.length) f.removeWords(...wordConfig.remove);
    wordFilter.current = f;
  }

  async function handleShieldPinSubmit() {
    if (pinValue.length !== 6 || !activeUser?.guardian_id) return;
    setPinLoading(true);
    const { data, error } = await supabase.rpc('verify_guardian_pin_for_learner', {
      guardian_id_input: activeUser.guardian_id,
      pin_input: pinValue,
    });
    setPinLoading(false);
    if (error || !data) {
      setPinError('Incorrect PIN. Please try again.');
      setPinValue('');
      return;
    }
    setPinModalVisible(false);
    setPinValue('');
    setPinError('');
    resetGuardianModal();
    setGuardianModalVisible(true);
  }

  function resetGuardianModal() {
    setActionStep('menu');
    setSelectedAction(null);
    setActionReason('');
    setDeleteScope('all');
    setDeleteScopeN('');
    setGuardianWorking(false);
  }

  function handleShieldPress() {
    setPinValue('');
    setPinError('');
    setPinModalVisible(true);
  }

  function chooseAction(action: typeof ACTIONS[number]) {
    setSelectedAction(action.type);
    setActionStep('reason');
  }

  function afterReason() {
    const action = ACTIONS.find(a => a.type === selectedAction);
    if (action?.needsDelete) {
      setActionStep('scope');
    } else {
      setActionStep('confirm');
    }
  }

  async function executeGuardianAction() {
    if (!activeUser || !selectedAction) return;
    setGuardianWorking(true);
    try {
      const body: any = {
        action_type: selectedAction,
        learner_id: activeUser.id,
        conversation_id: conversationId,
        reason: actionReason.trim() || undefined,
      };
      if (ACTIONS.find(a => a.type === selectedAction)?.needsDelete) {
        body.delete_scope = deleteScope === 'all' ? 'all' : (parseInt(deleteScopeN, 10) || 'all');
      }
      const { data, error } = await supabase.functions.invoke('guardian-action', {
        body,
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error || data?.error) {
        Alert.alert('Error', data?.error ?? error?.message ?? 'Action failed');
      } else {
        setGuardianModalVisible(false);
        resetGuardianModal();
        if (selectedAction !== 'block_user' && selectedAction !== 'report_user') {
          setMessages([]);
        }
        Alert.alert('Done', 'Action completed successfully.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Something went wrong');
    }
    setGuardianWorking(false);
  }

  const isOnline = friendLastSeen
    ? Date.now() - new Date(friendLastSeen).getTime() < 5 * 60 * 1000
    : false;

  // Custom header: friend photo centred, tap speaks name
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitleAlign: 'center',
      headerRight: () => (
        <TouchableOpacity onPress={handleShieldPress} style={guardianStyles.shieldBtn} activeOpacity={0.75}>
          <Text style={guardianStyles.shieldIcon}>🛡️</Text>
        </TouchableOpacity>
      ),
      headerTitle: () => (
        <TouchableOpacity
          style={styles.headerTitle}
          onPress={() => Speech.speak(participantName, { rate: 0.85, pitch: 1.0 })}
          activeOpacity={0.75}
        >
          <View style={styles.headerPhotoRow}>
            {participantPhoto
              ? <Image source={{ uri: participantPhoto }} style={styles.headerPhoto} />
              : (
                <View style={[styles.headerPhotoPlaceholder, { backgroundColor: avatarColor(participantName) }]}>
                  <Text style={styles.headerInitial}>{participantName[0]}</Text>
                </View>
              )
            }
            <Text style={styles.headerSpeaker}>📢</Text>
          </View>
          <Text style={styles.headerName}>{participantName}</Text>
          {isOnline && <Text style={styles.headerOnline}>● Online</Text>}
        </TouchableOpacity>
      ),
    });
  }, [navigation, participantName, participantPhoto, isOnline]);

  // Fetch friend's last_seen_at for online status
  useEffect(() => {
    if (!activeUser) return;
    supabase
      .from('conversation_participants')
      .select('user_id, user_profiles!inner(last_seen_at)')
      .eq('conversation_id', conversationId)
      .neq('user_id', activeUser.id)
      .single()
      .then(({ data }) => {
        if (data) {
          const profile = data.user_profiles as any;
          setFriendLastSeen(profile?.last_seen_at ?? null);
        }
      });
  }, [conversationId, activeUser]);

  // Realtime subscription
  useEffect(() => {
    fetchMessages();
    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, payload => {
        setMessages(prev => [...prev, payload.new as Message]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  // Mark read on enter and exit
  useEffect(() => {
    if (!activeUser) return;
    const stamp = () => supabase.rpc('mark_conversation_read', {
      p_conversation_id: conversationId,
      p_user_id: activeUser.id,
    });
    stamp();
    return () => { stamp(); };
  }, [conversationId, activeUser]);

  async function fetchMessages() {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (error) Alert.alert('Load error', error.message);
    setMessages(data || []);
    setLoading(false);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
  }

  async function sendMessage(content: string, fromInput = false) {
    const trimmed = content.trim();
    if (!trimmed || !activeUser) return;

    // Layer 1: client-side profanity check
    if (wordFilter.current?.isProfane(trimmed)) {
      setBlockedVisible(true);
      playBlockedFeedback();
      return;
    }

    if (fromInput) setText('');
    setBlockedVisible(false);

    // Layer 2: edge function validates against custom list then inserts
    const { data, error } = await supabase.functions.invoke('send-message', {
      body: { conversation_id: conversationId, sender_id: activeUser.id, content: trimmed },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });

    if (error || data?.error) {
      if (data?.error === 'blocked') {
        setBlockedVisible(true);
        playBlockedFeedback();
        if (fromInput) setText(trimmed);
      } else {
        let detail = data?.error ?? error?.message ?? 'Failed to send';
        try {
          const body = await (error as any)?.context?.json?.();
          if (body?.error) detail = `${body.error}${body.detail ? ': ' + body.detail : ''}`;
        } catch {}
        Alert.alert('Send error', detail);
        if (fromInput) setText(trimmed);
      }
      return;
    }

    if (data?.message) {
      setMessages(prev => prev.some(m => m.id === data.message.id) ? prev : [...prev, data.message as Message]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={headerHeight}
    >
      {/* Messages list */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const isMine = item.sender_id === activeUser!.id;
          const timeLabel = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const isSymbol = isSymbolMessage(item.content);

          if (isMine) {
            return (
              <View style={styles.bubbleWrapMine}>
                <View style={[styles.bubble, styles.bubbleMine, isSymbol && styles.bubbleSymbol]}>
                  {isSymbol
                    ? <Image source={{ uri: item.content }} style={styles.symbolBubbleImg} resizeMode="contain" />
                    : <Text style={[styles.bubbleText, styles.bubbleTextMine]}>{item.content}</Text>
                  }
                </View>
                <Text style={[styles.timestamp, styles.timestampMine]}>{timeLabel}</Text>
              </View>
            );
          }
          return (
            <View style={styles.bubbleWrapThem}>
              <View style={styles.bubbleSpeakRow}>
                <View style={[styles.bubble, styles.bubbleThem, isSymbol && styles.bubbleSymbol]}>
                  {isSymbol
                    ? <Image source={{ uri: item.content }} style={styles.symbolBubbleImg} resizeMode="contain" />
                    : <Text style={styles.bubbleText}>{item.content}</Text>
                  }
                </View>
                <TouchableOpacity
                  style={styles.speakMsgBtn}
                  onPress={() => Speech.speak(isSymbol ? item.content.split('/').pop()?.split('.')[0]?.replace(/_/g, ' ') ?? '' : item.content, { rate: 0.85, pitch: 1.0 })}
                  activeOpacity={0.7}
                >
                  <Text style={styles.speakMsgIcon}>📢</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.timestamp, styles.timestampThem]}>{timeLabel}</Text>
            </View>
          );
        }}
      />

      {/* Blocked word banner */}
      {blockedVisible && (
        <View style={styles.blockedBanner}>
          <Text style={styles.blockedBannerText}>Let's use kind words 😊</Text>
        </View>
      )}

      {/* Bottom controls */}
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom + 8, 16) }]}>
        <View style={styles.inputRow}>
          <TouchableOpacity
            style={styles.boardBtn}
            onPress={() => setBoardVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.boardBtnIcon}>🗣️</Text>
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            value={text}
            onChangeText={(val) => { setText(val); if (blockedVisible) setBlockedVisible(false); }}
            placeholder="Type a message…"
            placeholderTextColor={COLORS.textLight}
            returnKeyType="send"
            onSubmitEditing={() => sendMessage(text, true)}
            submitBehavior="submit"
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
            onPress={() => sendMessage(text, true)}
            disabled={!text.trim()}
          >
            <Text style={styles.sendBtnIcon}>➤</Text>
          </TouchableOpacity>
        </View>
      </View>

      <CommunicationBoard
        visible={boardVisible}
        onClose={() => setBoardVisible(false)}
        onSend={(imageUrl) => sendMessage(imageUrl)}
      />

      {/* Guardian PIN modal */}
      <Modal
        visible={pinModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { setPinModalVisible(false); setPinValue(''); setPinError(''); }}
      >
        <TouchableOpacity
          style={guardianStyles.overlay}
          activeOpacity={1}
          onPress={() => { setPinModalVisible(false); setPinValue(''); setPinError(''); }}
        >
          <View style={guardianStyles.pinCard} onStartShouldSetResponder={() => true}>
            <Text style={guardianStyles.pinTitle}>🛡️  Guardian PIN</Text>
            <Text style={guardianStyles.pinSub}>Enter your 6-digit PIN to continue</Text>
            <TextInput
              style={guardianStyles.pinInput}
              value={pinValue}
              onChangeText={v => { setPinValue(v.replace(/[^0-9]/g, '').slice(0, 6)); setPinError(''); }}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              placeholder="••••••"
              placeholderTextColor="#9CA3AF"
              autoFocus
            />
            {pinError ? <Text style={guardianStyles.pinError}>{pinError}</Text> : null}
            <View style={guardianStyles.btnRow}>
              <TouchableOpacity style={guardianStyles.backBtn} onPress={() => { setPinModalVisible(false); setPinValue(''); setPinError(''); }} activeOpacity={0.8}>
                <Text style={guardianStyles.backBtnTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[guardianStyles.nextBtn, (pinValue.length !== 6 || pinLoading) && { opacity: 0.5 }]}
                onPress={handleShieldPinSubmit}
                disabled={pinValue.length !== 6 || pinLoading}
                activeOpacity={0.8}
              >
                {pinLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={guardianStyles.nextBtnTxt}>Verify</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Guardian action modal */}
      <Modal
        visible={guardianModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => { setGuardianModalVisible(false); resetGuardianModal(); }}
      >
        <TouchableOpacity
          style={guardianStyles.overlay}
          activeOpacity={1}
          onPress={() => { setGuardianModalVisible(false); resetGuardianModal(); }}
        >
          <View style={guardianStyles.sheet} onStartShouldSetResponder={() => true}>
            <View style={guardianStyles.handle} />

            {/* Step: menu */}
            {actionStep === 'menu' && (
              <>
                <Text style={guardianStyles.sheetTitle}>Guardian Actions</Text>
                <Text style={guardianStyles.sheetSub}>These actions affect {participantName}'s conversation</Text>
                {ACTIONS.map(a => (
                  <TouchableOpacity key={a.type} style={guardianStyles.actionRow} onPress={() => chooseAction(a)} activeOpacity={0.8}>
                    <Text style={guardianStyles.actionIcon}>{a.icon}</Text>
                    <Text style={guardianStyles.actionLabel}>{a.label}</Text>
                    <Text style={guardianStyles.actionChevron}>›</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* Step: reason */}
            {actionStep === 'reason' && (
              <>
                <Text style={guardianStyles.sheetTitle}>Reason (optional)</Text>
                <Text style={guardianStyles.sheetSub}>Why are you taking this action?</Text>
                <TextInput
                  style={guardianStyles.reasonInput}
                  value={actionReason}
                  onChangeText={setActionReason}
                  placeholder="e.g. Inappropriate language, bullying…"
                  placeholderTextColor="#9CA3AF"
                  multiline
                  maxLength={300}
                />
                <View style={guardianStyles.btnRow}>
                  <TouchableOpacity style={guardianStyles.backBtn} onPress={() => setActionStep('menu')} activeOpacity={0.8}>
                    <Text style={guardianStyles.backBtnTxt}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={guardianStyles.nextBtn} onPress={afterReason} activeOpacity={0.8}>
                    <Text style={guardianStyles.nextBtnTxt}>Next</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Step: scope */}
            {actionStep === 'scope' && (
              <>
                <Text style={guardianStyles.sheetTitle}>How many messages to delete?</Text>
                <TouchableOpacity
                  style={[guardianStyles.scopeOption, deleteScope === 'all' && guardianStyles.scopeOptionActive]}
                  onPress={() => setDeleteScope('all')} activeOpacity={0.8}
                >
                  <Text style={guardianStyles.scopeOptionTxt}>All messages</Text>
                  {deleteScope === 'all' && <Text style={guardianStyles.scopeCheck}>✓</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[guardianStyles.scopeOption, deleteScope === 'custom' && guardianStyles.scopeOptionActive]}
                  onPress={() => setDeleteScope('custom')} activeOpacity={0.8}
                >
                  <Text style={guardianStyles.scopeOptionTxt}>Last N messages</Text>
                  {deleteScope === 'custom' && <Text style={guardianStyles.scopeCheck}>✓</Text>}
                </TouchableOpacity>
                {deleteScope === 'custom' && (
                  <TextInput
                    style={guardianStyles.scopeInput}
                    value={deleteScopeN}
                    onChangeText={setDeleteScopeN}
                    keyboardType="number-pad"
                    placeholder="e.g. 10"
                    placeholderTextColor="#9CA3AF"
                    maxLength={5}
                  />
                )}
                <View style={guardianStyles.btnRow}>
                  <TouchableOpacity style={guardianStyles.backBtn} onPress={() => setActionStep('reason')} activeOpacity={0.8}>
                    <Text style={guardianStyles.backBtnTxt}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={guardianStyles.nextBtn} onPress={() => setActionStep('confirm')} activeOpacity={0.8}>
                    <Text style={guardianStyles.nextBtnTxt}>Next</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Step: confirm */}
            {actionStep === 'confirm' && (() => {
              const action = ACTIONS.find(a => a.type === selectedAction);
              const hasDelete = action?.needsDelete;
              return (
                <>
                  <Text style={guardianStyles.sheetTitle}>Confirm Action</Text>
                  <View style={guardianStyles.summaryBox}>
                    <Text style={guardianStyles.summaryLine}><Text style={guardianStyles.summaryKey}>Action: </Text>{action?.label}</Text>
                    {actionReason.trim() ? <Text style={guardianStyles.summaryLine}><Text style={guardianStyles.summaryKey}>Reason: </Text>{actionReason.trim()}</Text> : null}
                    {hasDelete && (
                      <Text style={guardianStyles.summaryLine}>
                        <Text style={guardianStyles.summaryKey}>Delete: </Text>
                        {deleteScope === 'all' ? 'All messages' : `Last ${deleteScopeN || '?'} messages`}
                      </Text>
                    )}
                  </View>
                  {hasDelete && (
                    <View style={guardianStyles.warningBox}>
                      <Text style={guardianStyles.warningTxt}>⚠️ This cannot be undone. Chat history will be permanently deleted for both learners.</Text>
                    </View>
                  )}
                  <View style={guardianStyles.btnRow}>
                    <TouchableOpacity style={guardianStyles.backBtn} onPress={() => setActionStep(action?.needsDelete ? 'scope' : 'reason')} activeOpacity={0.8}>
                      <Text style={guardianStyles.backBtnTxt}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[hasDelete ? guardianStyles.confirmDestructBtn : guardianStyles.confirmBtn, guardianWorking && { opacity: 0.6 }]}
                      onPress={executeGuardianAction}
                      disabled={guardianWorking}
                      activeOpacity={0.8}
                    >
                      {guardianWorking
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={guardianStyles.confirmBtnTxt}>{hasDelete ? 'Yes, Delete' : 'Confirm'}</Text>
                      }
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()}

          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EFF6FF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  headerTitle: { flexDirection: 'column', alignItems: 'center', gap: 2, marginTop: 28, paddingBottom: 10 },
  headerPhotoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerPhoto: { width: 50, height: 50, borderRadius: 25, borderWidth: 2.5, borderColor: COLORS.primary },
  headerPhotoPlaceholder: {
    width: 50, height: 50, borderRadius: 25,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2.5, borderColor: COLORS.primary,
  },
  headerInitial: { fontSize: 20, fontWeight: '800', color: '#fff' },
  headerSpeaker: { fontSize: 20 },
  headerName: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  headerHint: { fontSize: 10, color: COLORS.textLight },
  headerOnline: { fontSize: 11, fontWeight: '700', color: '#16A34A' },

  // Messages
  list: { padding: 16, gap: 6, paddingBottom: 8 },
  bubble: {
    maxWidth: '75%', padding: 12, borderRadius: 20,
  },
  bubbleThem: {
    backgroundColor: '#FFF7ED', alignSelf: 'flex-start',
    borderBottomLeftRadius: 6,
    borderLeftWidth: 4, borderLeftColor: '#F97316',
    shadowColor: '#F97316', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 1,
  },
  bubbleMine: {
    backgroundColor: '#4F46E5', alignSelf: 'flex-end',
    borderBottomRightRadius: 6,
  },
  bubbleWrapThem: { alignSelf: 'flex-start', alignItems: 'flex-start', gap: 3 },
  bubbleWrapMine: { alignSelf: 'flex-end', alignItems: 'flex-end', gap: 3 },
  bubbleSpeakRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  speakMsgBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center', alignItems: 'center',
  },
  speakMsgIcon: { fontSize: 16 },
  bubbleText: { fontSize: 19, color: COLORS.text, lineHeight: 27 },
  bubbleTextMine: { color: '#fff' },
  timestamp: { fontSize: 11 },
  timestampThem: { color: COLORS.textLight, marginLeft: 6 },
  timestampMine: { color: COLORS.textLight, marginRight: 6 },

  // Blocked word banner
  blockedBanner: {
    backgroundColor: '#FEF3C7',
    borderTopWidth: 1.5, borderTopColor: '#F59E0B',
    paddingVertical: 10, paddingHorizontal: 20,
    alignItems: 'center',
  },
  blockedBannerText: {
    fontSize: 16, fontWeight: '700', color: '#92400E',
  },

  // Bottom panel
  bottom: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingTop: 10,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },

  // Symbol bubbles
  bubbleSymbol: { padding: 6, backgroundColor: 'transparent' },
  symbolBubbleImg: { width: 80, height: 80 },

  // Communication Board — compact inline icon
  boardBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  boardBtnIcon: { fontSize: 22 },

  // Input
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
  },
  input: {
    flex: 1, backgroundColor: '#EEF2FF',
    borderWidth: 1.5, borderColor: '#C7D2FE',
    borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 16, color: COLORS.text, maxHeight: 100,
  },
  sendBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#4F46E5',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 5,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnIcon: { fontSize: 18, color: '#fff', marginLeft: 2 },
});

const guardianStyles = StyleSheet.create({
  pinCard: {
    backgroundColor: '#fff', borderRadius: 24, padding: 24, margin: 32,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2, shadowRadius: 24, elevation: 12, gap: 12,
  },
  pinTitle: { fontSize: 18, fontWeight: '800', color: '#111827', textAlign: 'center' },
  pinSub:   { fontSize: 13, color: '#6B7280', textAlign: 'center' },
  pinInput: {
    borderWidth: 2, borderColor: '#4F46E5', borderRadius: 14,
    padding: 14, fontSize: 22, textAlign: 'center', letterSpacing: 8,
    color: '#111827', backgroundColor: '#EEF2FF',
  },
  pinError: { fontSize: 13, color: '#DC2626', fontWeight: '600', textAlign: 'center' },

  shieldBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(79,70,229,0.12)',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 4,
  },
  shieldIcon: { fontSize: 18 },

  overlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 8, gap: 12,
  },
  handle: {
    width: 38, height: 4, backgroundColor: '#E5E7EB',
    borderRadius: 2, alignSelf: 'center', marginBottom: 4,
  },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: '#111827', textAlign: 'center' },
  sheetSub:   { fontSize: 13, color: '#6B7280', textAlign: 'center', marginTop: -4 },

  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  actionIcon:    { fontSize: 22, width: 28, textAlign: 'center' },
  actionLabel:   { flex: 1, fontSize: 15, fontWeight: '700', color: '#111827' },
  actionChevron: { fontSize: 20, color: '#9CA3AF' },

  reasonInput: {
    borderWidth: 1.5, borderColor: '#D1D5DB', borderRadius: 14,
    padding: 12, fontSize: 14, color: '#111827',
    minHeight: 80, textAlignVertical: 'top',
  },

  scopeOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14,
  },
  scopeOptionActive: { borderColor: '#4F46E5', backgroundColor: '#EEF2FF' },
  scopeOptionTxt:    { fontSize: 15, fontWeight: '600', color: '#111827' },
  scopeCheck:        { fontSize: 16, color: '#4F46E5', fontWeight: '900' },
  scopeInput: {
    borderWidth: 1.5, borderColor: '#D1D5DB', borderRadius: 12,
    padding: 12, fontSize: 16, color: '#111827', textAlign: 'center',
  },

  summaryBox: {
    backgroundColor: '#F9FAFB', borderRadius: 14, padding: 14, gap: 6,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  summaryLine: { fontSize: 14, color: '#374151' },
  summaryKey:  { fontWeight: '700' },

  warningBox: {
    backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#FECACA',
  },
  warningTxt: { fontSize: 13, color: '#B91C1C', fontWeight: '600', lineHeight: 18 },

  btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  backBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    backgroundColor: '#F3F4F6', alignItems: 'center',
  },
  backBtnTxt: { fontSize: 15, fontWeight: '700', color: '#374151' },
  nextBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 14,
    backgroundColor: '#4F46E5', alignItems: 'center',
  },
  nextBtnTxt:  { fontSize: 15, fontWeight: '800', color: '#fff' },
  confirmBtn:  {
    flex: 2, paddingVertical: 14, borderRadius: 14,
    backgroundColor: '#4F46E5', alignItems: 'center',
  },
  confirmDestructBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 14,
    backgroundColor: '#DC2626', alignItems: 'center',
  },
  confirmBtnTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },
});
