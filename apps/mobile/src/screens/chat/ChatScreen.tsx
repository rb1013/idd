import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert, Image, Modal,
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
import { Message } from '../../types';
import { UserStackParamList } from '../../navigation';
import CommunicationBoard from './CommunicationBoard';
import { isSymbolMessage } from '../../lib/aacSymbols';
import AppText from '../../components/AppText';
import useNicoHeader from '../../hooks/useNicoHeader';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, SHADOW, FONT_SIZE, FONT_WEIGHT,
  BTN_SIZE, BTN_VARIANT, scale,
} from '../../constants/theme';

type Route = RouteProp<UserStackParamList, 'Chat'>;

const AVATAR_COLORS = [NICO.teal, NICO.purple, NICO.orange, NICO.primary, NICO.coral, NICO.green];
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

  useNicoHeader(navigation);

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
    // { type: 'block_delete_report',  label: 'Block, Delete Chat & Report',    icon: '⛔',  needsDelete: true },
  ];
  const flatListRef = useRef<FlatList>(null);
  function playBlockedFeedback() {
    // TODO: play gentle-chime.wav before TTS once expo-av is enabled (requires npx expo run:ios)
    // const { sound } = await Audio.Sound.createAsync(require('../../../assets/sounds/gentle-chime.wav'));
    // await sound.playAsync();
    // sound.setOnPlaybackStatusUpdate(status => {
    //   if ('didJustFinish' in status && status.didJustFinish) {
    //     sound.unloadAsync();
    //     Speech.speak("Let's use kind words!", { rate: 0.65, pitch: 1.0 });
    //   }
    // });
    Speech.speak("Let's use kind words!", { rate: 0.65, pitch: 1.0 });
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
        Alert.alert('Done', 'Action completed successfully.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
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
          onPress={() => Speech.speak(participantName, { rate: 0.65, pitch: 1.0 })}
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
    return <View style={styles.center}><ActivityIndicator size="large" color={NICO.primary} /></View>;
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
                  onPress={() => Speech.speak(isSymbol ? item.content.split('/').pop()?.split('.')[0]?.replace(/_/g, ' ') ?? '' : item.content, { rate: 0.65, pitch: 1.0 })}
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
            placeholderTextColor={NICO.textMuted}
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
              placeholderTextColor={NICO.textMuted}
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
                  ? <ActivityIndicator size="small" color={NICO.textOnAccent} />
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
                <Text style={guardianStyles.sheetTitle}>Reason</Text>
                <Text style={guardianStyles.sheetSub}>Why are you taking this action?</Text>
                <TextInput
                  style={guardianStyles.reasonInput}
                  value={actionReason}
                  onChangeText={setActionReason}
                  placeholder="e.g. Inappropriate language, bullying…"
                  placeholderTextColor={NICO.textMuted}
                  multiline
                  maxLength={100}
                  autoFocus
                />
                <View style={guardianStyles.btnRow}>
                  <TouchableOpacity style={guardianStyles.backBtn} onPress={() => setActionStep('menu')} activeOpacity={0.8}>
                    <Text style={guardianStyles.backBtnTxt}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[guardianStyles.nextBtn, !actionReason.trim() && { opacity: 0.4 }]}
                    onPress={afterReason}
                    disabled={!actionReason.trim()}
                    activeOpacity={0.8}
                  >
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
                    placeholderTextColor={NICO.textMuted}
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
                        ? <ActivityIndicator size="small" color={NICO.textOnAccent} />
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
  container: { flex: 1, backgroundColor: NICO.screenBg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: NICO.screenBg },

  // Header
  headerTitle: { flexDirection: 'column', alignItems: 'center', gap: 2, marginTop: 28, paddingBottom: 10 },
  headerPhotoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerPhoto: { width: scale(50), height: scale(50), borderRadius: scale(25), borderWidth: 2.5, borderColor: NICO.primary },
  headerPhotoPlaceholder: {
    width: scale(50), height: scale(50), borderRadius: scale(25),
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2.5, borderColor: NICO.primary,
  },
  headerInitial: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.extraBold, color: '#fff' },
  headerSpeaker: { fontSize: FONT_SIZE.xl },
  headerName: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.extraBold, color: NICO.text },
  headerOnline: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, color: NICO.success },

  // Messages
  list: { padding: SPACING.base, gap: SPACING.xs, paddingBottom: SPACING.sm },
  bubble: {
    maxWidth: '75%', padding: SPACING.md, borderRadius: RADIUS.xl,
  },
  bubbleThem: {
    backgroundColor: NICO.chatBubbleOther, alignSelf: 'flex-start',
    borderBottomLeftRadius: 6,
    borderLeftWidth: 4, borderLeftColor: NICO.pink,
    ...SHADOW.sm,
  },
  bubbleMine: {
    backgroundColor: NICO.chatBubbleMe, alignSelf: 'flex-end',
    borderBottomRightRadius: 6,
    borderRightWidth: 4, borderRightColor: NICO.teal,
    ...SHADOW.sm,
  },
  bubbleWrapThem: { alignSelf: 'flex-start', alignItems: 'flex-start', gap: 3 },
  bubbleWrapMine: { alignSelf: 'flex-end', alignItems: 'flex-end', gap: 3 },
  bubbleSpeakRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  speakMsgBtn: {
    width: scale(32), height: scale(32), borderRadius: scale(16),
    backgroundColor: NICO.purpleLight,
    justifyContent: 'center', alignItems: 'center',
  },
  speakMsgIcon: { fontSize: FONT_SIZE.md },
  bubbleText: { fontSize: FONT_SIZE.xl, color: NICO.text, lineHeight: 27 },
  bubbleTextMine: { color: NICO.text },
  timestamp: { fontSize: FONT_SIZE.xs },
  timestampThem: { color: NICO.textMuted, marginLeft: 6 },
  timestampMine: { color: NICO.textMuted, marginRight: 6 },

  // Blocked word banner
  blockedBanner: {
    backgroundColor: NICO.warningLight,
    borderTopWidth: 1.5, borderTopColor: NICO.warning,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg,
    alignItems: 'center',
  },
  blockedBannerText: {
    fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: '#92400E',
  },

  // Bottom panel
  bottom: {
    backgroundColor: NICO.surface,
    borderTopWidth: 1, borderTopColor: NICO.border,
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },

  // Symbol bubbles
  bubbleSymbol: { padding: 6, backgroundColor: 'transparent' },
  symbolBubbleImg: { width: scale(80), height: scale(80) },

  // Communication Board — compact inline icon
  boardBtn: {
    width: scale(44), height: scale(44), borderRadius: scale(22),
    backgroundColor: NICO.purpleLight,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  boardBtnIcon: { fontSize: FONT_SIZE['2xl'] },

  // Input
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.sm,
  },
  input: {
    flex: 1, backgroundColor: NICO.primaryLight,
    borderWidth: 1.5, borderColor: NICO.border,
    borderRadius: RADIUS['2xl'], paddingHorizontal: SPACING.base, paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.xl, color: NICO.text, maxHeight: 100,
  },
  sendBtn: {
    width: scale(46), height: scale(46), borderRadius: scale(23),
    backgroundColor: NICO.primary,
    justifyContent: 'center', alignItems: 'center',
    ...SHADOW.btnPrimary,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnIcon: { fontSize: FONT_SIZE['2xl'], color: NICO.textOnAccent, marginLeft: 2 },
});

const guardianStyles = StyleSheet.create({
  pinCard: {
    backgroundColor: NICO.surface, borderRadius: RADIUS['3xl'], padding: SPACING.xl, margin: SPACING['2xl'],
    gap: SPACING.md, ...SHADOW.xl,
  },
  pinTitle: { fontSize: FONT_SIZE['2xl'], fontWeight: FONT_WEIGHT.extraBold, color: NICO.text, textAlign: 'center' },
  pinSub:   { fontSize: FONT_SIZE.base, color: NICO.textMuted, textAlign: 'center' },
  pinInput: {
    borderWidth: 2, borderColor: NICO.primary, borderRadius: RADIUS.lg,
    padding: SPACING.md, fontSize: FONT_SIZE['2xl'], textAlign: 'center', letterSpacing: 8,
    color: NICO.text, backgroundColor: NICO.primaryLight,
  },
  pinError: { fontSize: FONT_SIZE.base, color: NICO.error, fontWeight: FONT_WEIGHT.semiBold, textAlign: 'center' },

  shieldBtn: {
    width: scale(34), height: scale(34), borderRadius: scale(17),
    backgroundColor: NICO.primaryLight,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 4,
  },
  shieldIcon: { fontSize: FONT_SIZE.xl },

  overlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: NICO.surface, borderTopLeftRadius: RADIUS['3xl'], borderTopRightRadius: RADIUS['3xl'],
    paddingHorizontal: SPACING.lg, paddingBottom: Platform.OS === 'ios' ? SPACING['3xl'] : SPACING.xl,
    paddingTop: SPACING.sm, gap: SPACING.md,
  },
  handle: {
    width: scale(38), height: 4, backgroundColor: NICO.border,
    borderRadius: 2, alignSelf: 'center', marginBottom: 4,
  },
  sheetTitle: { ...TEXT_STYLE.modalTitle, textAlign: 'center' },
  sheetSub:   { fontSize: FONT_SIZE.base, color: NICO.textMuted, textAlign: 'center', marginTop: -4 },

  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.lg,
    paddingVertical: SPACING.md, borderTopWidth: 1, borderTopColor: NICO.border,
  },
  actionIcon:    { fontSize: FONT_SIZE['2xl'], width: SPACING.xl, textAlign: 'center' },
  actionLabel:   { flex: 1, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, color: NICO.text },
  actionChevron: { fontSize: FONT_SIZE.xl, color: NICO.textMuted },

  reasonInput: {
    borderWidth: 1.5, borderColor: NICO.border, borderRadius: RADIUS.lg,
    padding: SPACING.md, fontSize: FONT_SIZE.md, color: NICO.text,
    minHeight: scale(80), textAlignVertical: 'top',
  },

  scopeOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: SPACING.md, borderWidth: 1.5, borderColor: NICO.border, borderRadius: RADIUS.lg,
  },
  scopeOptionActive: { borderColor: NICO.primary, backgroundColor: NICO.primaryLight },
  scopeOptionTxt:    { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.semiBold, color: NICO.text },
  scopeCheck:        { fontSize: FONT_SIZE.xl, color: NICO.primary, fontWeight: FONT_WEIGHT.black },
  scopeInput: {
    borderWidth: 1.5, borderColor: NICO.border, borderRadius: RADIUS.md,
    padding: SPACING.md, fontSize: FONT_SIZE.xl, color: NICO.text, textAlign: 'center',
  },

  summaryBox: {
    backgroundColor: NICO.background, borderRadius: RADIUS.lg, padding: SPACING.md, gap: SPACING.sm,
    borderWidth: 1, borderColor: NICO.border,
  },
  summaryLine: { fontSize: FONT_SIZE.md, color: NICO.text },
  summaryKey:  { fontWeight: FONT_WEIGHT.bold },

  warningBox: {
    backgroundColor: NICO.errorLight, borderRadius: RADIUS.md, padding: SPACING.md,
    borderWidth: 1, borderColor: NICO.error,
  },
  warningTxt: { fontSize: FONT_SIZE.base, color: NICO.error, fontWeight: FONT_WEIGHT.semiBold, lineHeight: 18 },

  btnRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: 4 },
  backBtn: {
    flex: 1, ...BTN_SIZE.md,
    backgroundColor: NICO.background, alignItems: 'center',
  },
  backBtnTxt: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, color: NICO.textMuted },
  nextBtn: {
    flex: 2, ...BTN_SIZE.md, ...BTN_VARIANT.primary,
  },
  nextBtnTxt:  { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extraBold, color: NICO.textOnAccent },
  confirmBtn:  {
    flex: 2, ...BTN_SIZE.md, ...BTN_VARIANT.primary,
  },
  confirmDestructBtn: {
    flex: 2, ...BTN_SIZE.md, ...BTN_VARIANT.danger,
  },
  confirmBtnTxt: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extraBold, color: NICO.textOnAccent },
});
