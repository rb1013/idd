import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert, Modal,
  ScrollView,
} from 'react-native';
import AppText from '../../components/AppText';
import RainbowDivider from '../../components/RainbowDivider';
import GuardianFloatingTabBar from '../../components/GuardianFloatingTabBar';
import useNicoHeader from '../../hooks/useNicoHeader';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { calcAge } from '../../constants';
import { GuardianNavParamList } from '../../navigation';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, SHADOW, FONT_SIZE, FONT_WEIGHT,
  BTN_SIZE, BTN_VARIANT, BUTTERFLY_BORDER, BUTTERFLY_TILES, scale,
} from '../../constants/theme';

type Nav = NativeStackNavigationProp<GuardianNavParamList>;
// Manage Friends: Friends · Requests · Blocked. Finding new friends is its own screen (FindFriends).
type Tab = 'friends' | 'requests' | 'blocked';
type RequestsSubTab = 'sent' | 'received';

const AVATAR_COLORS = [NICO.teal, NICO.orange, NICO.coral, NICO.pink, NICO.purple, NICO.primary];

// Card fields of a learner + their guardian's name, embedded in the friendship row (one request).
const CARD_FIELDS = 'id, name, photo_url, county, region, date_of_birth, guardians!user_profiles_guardian_id_fkey(full_name)';
const FRIENDSHIP_SELECT =
  `id, requester_id, addressee_id, ` +
  `requester:user_profiles!friendships_requester_id_fkey(${CARD_FIELDS}), ` +
  `addressee:user_profiles!friendships_addressee_id_fkey(${CARD_FIELDS})`;

// ── Types ─────────────────────────────────────────────────────────────────────

interface Friend {
  friendshipId: string;
  learnerId: string;
  learnerName: string;
  learnerPhoto: string | null;
  learnerCounty: string;
  learnerRegion: string;
  learnerAge: number | null;
  guardianName: string | null;
}

interface FriendRequest {
  friendshipId: string;
  requesterId: string;
  requesterName: string;
  requesterPhoto: string | null;
  requesterAge: number;
  requesterCounty: string;
  requesterRegion: string;
  requesterGuardianName: string | null;
  myLearnerId: string;
  myLearnerName: string;
  direction: 'incoming' | 'outgoing';
}

interface BlockedUser {
  blockId: string;
  learnerId: string;
  blockedLearnerId: string;
  blockedLearnerName: string;
  blockedLearnerPhoto: string | null;
  reason: string | null;
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ name, photo, size = 48 }: { name: string; photo: string | null; size?: number }) {
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  const r = size / 2;
  if (photo) return <Image source={{ uri: photo }} style={{ width: size, height: size, borderRadius: r }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: r, backgroundColor: color, justifyContent: 'center', alignItems: 'center' }}>
      <AppText style={{ fontSize: size * 0.4, fontWeight: FONT_WEIGHT.extraBold, color: '#fff' }}>{name[0]?.toUpperCase()}</AppText>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function LearnerFriendsScreen() {
  const navigation = useNavigation<Nav>();
  const { guardian } = useAuth();
  const [tab, setTab] = useState<Tab>('friends');

  useNicoHeader(navigation);

  // My learner — fetched once per visit to this screen, then reused by every tab
  const mineRef = useRef<{ ids: string[]; map: Record<string, string> } | null>(null);

  // Per-tab loading: a tab loads when it's opened (and again on every open / return to the screen).
  // Spinner only on a tab's first open; later loads refresh quietly behind the list.
  const [loadedTabs, setLoadedTabs] = useState<Set<Tab>>(new Set());

  // Friends tab
  const [friends,  setFriends]  = useState<Friend[]>([]);
  const [removing, setRemoving] = useState<string | null>(null);

  // Requests tab
  const [requests,   setRequests]   = useState<FriendRequest[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [activeRequestsTab, setActiveRequestsTab] = useState<RequestsSubTab>('received');

  // Blocked tab (blocked ids also hide blocked learners on the Friends tab)
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [reportedMap,  setReportedMap]  = useState<Map<string, string | null>>(new Map());
  const [reasonModal,  setReasonModal]  = useState<{ name: string; reason: string | null } | null>(null);
  const blockedIds = useMemo(() => new Set(blockedUsers.map(b => b.blockedLearnerId)), [blockedUsers]);

  // Runs on focus and whenever the tab changes
  useFocusEffect(useCallback(() => {
    if (guardian) loadTab(tab, guardian.id);
  }, [guardian, tab]));

  async function getMine(guardianId: string) {
    if (mineRef.current) return mineRef.current;
    const { data } = await supabase.from('user_profiles').select('id, name').eq('guardian_id', guardianId);
    const ids = (data ?? []).map((r: any) => r.id as string);
    const map: Record<string, string> = {};
    (data ?? []).forEach((l: any) => { map[l.id] = l.name; });
    mineRef.current = { ids, map };
    return mineRef.current;
  }

  async function loadTab(t: Tab, guardianId: string) {
    const mine = await getMine(guardianId);
    if (t === 'friends')       await Promise.all([loadFriends(mine.ids), loadBlocked(mine.ids), loadReported(mine.ids)]);
    else if (t === 'requests') await loadRequests(mine.ids, mine.map);
    else                       await loadBlocked(mine.ids);
    setLoadedTabs(prev => prev.has(t) ? prev : new Set(prev).add(t));
  }

  // ── Blocked tab loader ─────────────────────────────────────────────────────

  async function loadBlocked(myIds: string[]) {
    if (myIds.length === 0) { setBlockedUsers([]); return; }
    const { data } = await supabase
      .from('blocked_learners')
      .select('id, learner_id, blocked_learner_id, reason, blocked:user_profiles!blocked_learners_blocked_learner_id_fkey(name, photo_url)')
      .in('learner_id', myIds);
    setBlockedUsers((data ?? []).map((b: any) => ({
      blockId: b.id,
      learnerId: b.learner_id,
      blockedLearnerId: b.blocked_learner_id,
      blockedLearnerName: b.blocked?.name ?? 'Unknown',
      blockedLearnerPhoto: b.blocked?.photo_url ?? null,
      reason: b.reason,
    })));
  }

  async function loadReported(myIds: string[]) {
    if (myIds.length === 0) { setReportedMap(new Map()); return; }
    const { data } = await supabase
      .from('reports')
      .select('reported_learner_id, reason')
      .in('learner_id', myIds)
      .order('created_at', { ascending: false });
    const map = new Map<string, string | null>();
    (data ?? []).forEach((r: any) => {
      if (!map.has(r.reported_learner_id)) map.set(r.reported_learner_id, r.reason ?? null);
    });
    setReportedMap(map);
  }

  async function unblock(blockId: string) {
    Alert.alert('Unblock', 'Are you sure you want to unblock this person?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unblock', onPress: async () => {
        await supabase.from('blocked_learners').delete().eq('id', blockId);
        setBlockedUsers(prev => prev.filter(b => b.blockId !== blockId));
      }},
    ]);
  }

  async function removeFriend(friendshipId: string, learnerName: string) {
    Alert.alert(
      'Remove friend',
      `Remove ${learnerName} from your learner's friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: async () => {
          setRemoving(friendshipId);
          const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
          setRemoving(null);
          if (error) { Alert.alert('Error', error.message); return; }
          setFriends(prev => prev.filter(f => f.friendshipId !== friendshipId));
        }},
      ]
    );
  }

  // ── Friends tab loader ─────────────────────────────────────────────────────

  async function loadFriends(myIds: string[]) {
    if (myIds.length === 0) { setFriends([]); return; }

    const { data } = await supabase
      .from('friendships')
      .select(FRIENDSHIP_SELECT)
      .eq('status', 'accepted')
      .or(myIds.map((id: string) => `requester_id.eq.${id},addressee_id.eq.${id}`).join(','));

    setFriends(((data ?? []) as any[]).map(f => {
      const iAmRequester = myIds.includes(f.requester_id);
      const p = iAmRequester ? f.addressee : f.requester;
      return {
        friendshipId:  f.id,
        learnerId:     iAmRequester ? f.addressee_id : f.requester_id,
        learnerName:   p?.name ?? 'Unknown',
        learnerPhoto:  p?.photo_url ?? null,
        learnerCounty: p?.county ?? '',
        learnerRegion: p?.region ?? '',
        learnerAge:    calcAge(p?.date_of_birth ?? null),
        guardianName:  p?.guardians?.full_name ?? null,
      };
    }));
  }

  // ── Requests tab loader ────────────────────────────────────────────────────

  async function loadRequests(myIds: string[], myMap: Record<string, string>) {
    if (myIds.length === 0) { setRequests([]); return; }

    const { data } = await supabase
      .from('friendships')
      .select(FRIENDSHIP_SELECT)
      .eq('status', 'pending')
      .or(myIds.map((id: string) => `requester_id.eq.${id},addressee_id.eq.${id}`).join(','));

    setRequests(((data ?? []) as any[]).map(f => {
      const iAmRequester = myIds.includes(f.requester_id);
      const myLearnerId  = iAmRequester ? f.requester_id : f.addressee_id;
      const other        = iAmRequester ? f.addressee : f.requester;
      return {
        friendshipId: f.id,
        requesterId: iAmRequester ? f.addressee_id : f.requester_id,
        requesterName: other?.name ?? 'Unknown',
        requesterPhoto: other?.photo_url ?? null,
        requesterAge: calcAge(other?.date_of_birth) ?? 0,
        requesterCounty: other?.county ?? '',
        requesterRegion: other?.region ?? '',
        requesterGuardianName: other?.guardians?.full_name ?? null,
        myLearnerId,
        myLearnerName: myMap[myLearnerId] ?? '',
        direction: iAmRequester ? 'outgoing' : 'incoming',
      } as FriendRequest;
    }));
  }

  // ── Request actions ────────────────────────────────────────────────────────

  async function accept(req: FriendRequest) {
    setProcessing(req.friendshipId);
    const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', req.friendshipId);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setRequests(prev => prev.filter(r => r.friendshipId !== req.friendshipId));
      // The Friends tab reloads when it's opened
      Alert.alert('Connected!', `${req.myLearnerName} and ${req.requesterName} are now friends.`);
    }
    setProcessing(null);
  }

  async function decline(req: FriendRequest) {
    Alert.alert('Decline request', `Decline the friend request from ${req.requesterName}'s guardian?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Decline', style: 'destructive', onPress: async () => {
        setProcessing(req.friendshipId);
        // Delete (like Cancel), not status 'rejected' — a rejected row showed as "Pending" forever
        // and blocked a new request (docs/learnerFriend.md §8, migration 096)
        await supabase.from('friendships').delete().eq('id', req.friendshipId);
        setRequests(prev => prev.filter(r => r.friendshipId !== req.friendshipId));
        setProcessing(null);
      }},
    ]);
  }

  async function cancelRequest(req: FriendRequest) {
    Alert.alert('Cancel request', `Cancel your friend request for ${req.requesterName}?`, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Cancel request', style: 'destructive', onPress: async () => {
        setProcessing(req.friendshipId);
        await supabase.from('friendships').delete().eq('id', req.friendshipId);
        setRequests(prev => prev.filter(r => r.friendshipId !== req.friendshipId));
        setProcessing(null);
      }},
    ]);
  }

  const incomingRequests = requests.filter(r => r.direction === 'incoming');
  const outgoingRequests = requests.filter(r => r.direction === 'outgoing');
  const pendingCount     = incomingRequests.length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={s.container}>
      <RainbowDivider />

      {/* Tab bar */}
      <View style={s.tabBar}>
        {(['friends', 'requests', 'blocked'] as Tab[]).map(t => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)} activeOpacity={0.75}>
            <View style={s.tabInner}>
              <AppText style={[s.tabTxt, tab === t && s.tabTxtActive]}>
                {t === 'friends' ? '👥 Friends' : t === 'requests' ? '🤝 Requests' : '🚫 Blocked'}
              </AppText>
              {t === 'requests' && pendingCount > 0 && (
                <View style={s.tabBadge}><AppText style={s.tabBadgeTxt}>{pendingCount}</AppText></View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.tabPane}>

      {!loadedTabs.has(tab) && (
        <View style={s.center}><ActivityIndicator size="large" color={NICO.primary} /></View>
      )}

      {/* ── Friends tab ──────────────────────────────────────────────────────── */}
      {tab === 'friends' && loadedTabs.has('friends') && (() => {
        const visibleFriends = friends.filter(f => !blockedIds.has(f.learnerId));
        return visibleFriends.length === 0 ? (
          <View style={s.center}>
            <AppText style={s.emptyEmoji}>👥</AppText>
            <AppText style={s.emptyText}>No friends yet</AppText>
            <AppText style={s.emptyHint}>Use 'Find Friends' tile on dashboard to add friends for your learner</AppText>
          </View>
        ) : (
          <FlatList
            data={visibleFriends}
            keyExtractor={f => f.friendshipId}
            contentContainerStyle={s.listContent}
            renderItem={({ item: f, index }) => {
              const isReported = reportedMap.has(f.learnerId);
              const reportReason = reportedMap.get(f.learnerId) ?? null;
              const tileBg = BUTTERFLY_TILES[index % BUTTERFLY_TILES.length].bg;
              return (
                <TouchableOpacity
                  style={[s.card, s.cardColumn, { backgroundColor: tileBg, borderColor: 'transparent' }]}
                  onPress={() => navigation.navigate('LearnerPublicProfile', { learnerId: f.learnerId })}
                  activeOpacity={0.85}
                >
                  <View style={s.cardMainRow}>
                    <View style={s.avatarCol}>
                      <Avatar name={f.learnerName} photo={f.learnerPhoto} size={scale(52)} />
                      {f.learnerAge != null && <AppText style={s.avatarAge}>{f.learnerAge} yrs</AppText>}
                    </View>
                    <View style={s.cardInfo}>
                      <AppText style={s.cardName}>{f.learnerName}</AppText>
                      <AppText style={s.cardMeta}>
                        {f.learnerCounty}
                      </AppText>
                      {f.guardianName && (
                        <AppText style={s.cardMeta}>Guardian: {f.guardianName}</AppText>
                      )}
                    </View>
                    {removing === f.friendshipId ? (
                      <ActivityIndicator size="small" color={NICO.error} style={s.cardCornerIcon} />
                    ) : (
                      <TouchableOpacity
                        style={[s.cardCornerIcon, s.cardRemoveIcon]}
                        onPress={() => removeFriend(f.friendshipId, f.learnerName)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <AppText style={s.cardRemoveIconTxt}>✕</AppText>
                      </TouchableOpacity>
                    )}
                  </View>
                  {isReported && (
                    <View style={s.reportedRow}>
                      <View style={s.reportedPill}>
                        <AppText style={s.reportedPillTxt}>⚠️ Reported</AppText>
                      </View>
                      <TouchableOpacity
                        onPress={() => setReasonModal({ name: f.learnerName, reason: reportReason })}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <View style={s.infoIconCircle}>
                          <AppText style={s.infoIconTxt}>i</AppText>
                        </View>
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        );
      })()}

      {/* ── Requests tab ─────────────────────────────────────────────────────── */}
      {tab === 'requests' && loadedTabs.has('requests') && (
        <>
          {/* Sub-tab bar */}
          <View style={s.subTabBar}>
            {([
              { key: 'received', label: 'Received', count: incomingRequests.length },
              { key: 'sent',     label: 'Sent',     count: outgoingRequests.length },
            ] as { key: RequestsSubTab; label: string; count: number }[]).map(({ key, label, count }) => {
              const isActive = activeRequestsTab === key;
              return (
                <View key={key} style={s.subTabWrap}>
                  <LinearGradient
                    colors={[...BUTTERFLY_BORDER.colors]}
                    start={BUTTERFLY_BORDER.start}
                    end={BUTTERFLY_BORDER.end}
                    style={[s.subTabGradient, !isActive && s.subTabGradientDim]}
                  >
                    <TouchableOpacity
                      style={[s.subTabInner, isActive && s.subTabInnerActive]}
                      onPress={() => setActiveRequestsTab(key)}
                      activeOpacity={0.8}
                    >
                      <AppText style={[s.subTabTxt, isActive && s.subTabTxtActive]}>
                        {label}
                      </AppText>
                    </TouchableOpacity>
                  </LinearGradient>
                  {key === 'received' && count > 0 && (
                    <View style={s.tabBadge}>
                      <AppText style={s.tabBadgeTxt}>{count > 9 ? '9+' : count}</AppText>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {activeRequestsTab === 'received' ? (
            incomingRequests.length === 0 ? (
              <View style={s.center}>
                <AppText style={s.emptyEmoji}>🤝</AppText>
                <AppText style={s.emptyText}>No pending requests</AppText>
                <AppText style={s.emptyHint}>Use Find Friends to send requests to other learners</AppText>
              </View>
            ) : (
              <ScrollView contentContainerStyle={s.listContent}>
                {incomingRequests.map((req, index) => {
                  const isProcessing = processing === req.friendshipId;
                  const tileBg = BUTTERFLY_TILES[index % BUTTERFLY_TILES.length].bg;
                  return (
                    <TouchableOpacity
                      key={req.friendshipId}
                      style={[s.card, s.cardColumn, { backgroundColor: tileBg, borderColor: 'transparent' }]}
                      onPress={() => navigation.navigate('LearnerPublicProfile', { learnerId: req.requesterId })}
                      activeOpacity={0.85}
                    >
                      <View style={s.cardMainRow}>
                        <View style={s.avatarCol}>
                          <Avatar name={req.requesterName} photo={req.requesterPhoto} size={scale(52)} />
                          {req.requesterAge > 0 && <AppText style={s.avatarAge}>{req.requesterAge} yrs</AppText>}
                        </View>
                        <View style={s.cardInfo}>
                          <AppText style={s.cardName}>{req.requesterName}</AppText>
                          <AppText style={s.cardMeta}>{req.requesterCounty}</AppText>
                          {req.requesterGuardianName && <AppText style={s.cardMeta}>Guardian: {req.requesterGuardianName}</AppText>}
                        </View>
                        <View style={s.reqActions}>
                          {isProcessing ? <ActivityIndicator color={NICO.primary} /> : (
                            <>
                              <TouchableOpacity style={[s.reqBtn, s.acceptBtn]} onPress={() => accept(req)} activeOpacity={0.8}>
                                <AppText style={s.acceptBtnTxt}>✓ Accept</AppText>
                              </TouchableOpacity>
                              <TouchableOpacity style={[s.reqBtn, s.declineBtn]} onPress={() => decline(req)} activeOpacity={0.8}>
                                <AppText style={s.declineBtnTxt}>Decline</AppText>
                              </TouchableOpacity>
                            </>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )
          ) : (
            outgoingRequests.length === 0 ? (
              <View style={s.center}>
                <AppText style={s.emptyEmoji}>📤</AppText>
                <AppText style={s.emptyText}>No sent requests</AppText>
                <AppText style={s.emptyHint}>Requests you send will appear here.</AppText>
              </View>
            ) : (
              <ScrollView contentContainerStyle={s.listContent}>
                {outgoingRequests.map((req, index) => {
                  const isProcessing = processing === req.friendshipId;
                  const tileBg = BUTTERFLY_TILES[index % BUTTERFLY_TILES.length].bg;
                  return (
                    <TouchableOpacity
                      key={req.friendshipId}
                      style={[s.card, s.cardColumn, { backgroundColor: tileBg, borderColor: 'transparent' }]}
                      onPress={() => navigation.navigate('LearnerPublicProfile', { learnerId: req.requesterId })}
                      activeOpacity={0.85}
                    >
                      <View style={s.cardMainRow}>
                        <View style={s.avatarCol}>
                          <Avatar name={req.requesterName} photo={req.requesterPhoto} size={scale(52)} />
                          {req.requesterAge > 0 && <AppText style={s.avatarAge}>{req.requesterAge} yrs</AppText>}
                        </View>
                        <View style={s.cardInfo}>
                          <AppText style={s.cardName}>{req.requesterName}</AppText>
                          <AppText style={s.cardMeta}>{req.requesterCounty}</AppText>
                          {req.requesterGuardianName && <AppText style={s.cardMeta}>Guardian: {req.requesterGuardianName}</AppText>}
                        </View>
                        <View style={s.reqActions}>
                          {isProcessing ? <ActivityIndicator color={NICO.textMuted} /> : (
                            <TouchableOpacity style={[s.reqBtn, s.cancelBtn]} onPress={() => cancelRequest(req)} activeOpacity={0.8}>
                              <AppText style={s.cancelBtnTxt}>Cancel</AppText>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )
          )}
        </>
      )}

      {/* ── Blocked tab ──────────────────────────────────────────────────────── */}
      {tab === 'blocked' && loadedTabs.has('blocked') && (
        blockedUsers.length === 0 ? (
          <View style={s.center}>
            <AppText style={s.emptyEmoji}>🚫</AppText>
            <AppText style={s.emptyText}>No blocked users</AppText>
            <AppText style={s.emptyHint}>Blocked learners will appear here</AppText>
          </View>
        ) : (
          <FlatList
            data={blockedUsers}
            keyExtractor={b => b.blockId}
            contentContainerStyle={s.listContent}
            renderItem={({ item: b, index }) => {
              const tileBg = BUTTERFLY_TILES[index % BUTTERFLY_TILES.length].bg;
              return (
                <View style={[s.card, { backgroundColor: tileBg, borderColor: 'transparent' }]}>
                  <Avatar name={b.blockedLearnerName} photo={b.blockedLearnerPhoto} size={scale(52)} />
                  <View style={s.cardInfo}>
                    <AppText style={s.cardName}>{b.blockedLearnerName}</AppText>
                    {b.reason && <AppText style={s.cardMeta}>Reason: {b.reason}</AppText>}
                  </View>
                  <TouchableOpacity style={[s.reqBtn, s.unblockBtn]} onPress={() => unblock(b.blockId)} activeOpacity={0.8}>
                    <AppText style={s.unblockBtnTxt}>Unblock</AppText>
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        )
      )}

      </View>

      {/* Report reason nudge */}
      <Modal visible={!!reasonModal} transparent animationType="fade" onRequestClose={() => setReasonModal(null)}>
        <TouchableOpacity style={s.nudgeOverlay} activeOpacity={1} onPress={() => setReasonModal(null)}>
          <View style={s.nudge} onStartShouldSetResponder={() => true}>
            <AppText style={s.nudgeTitle}>Reason for reporting this user</AppText>
            <View style={s.nudgeBodyBox}>
              <AppText style={s.nudgeBody}>
                {reasonModal?.reason ?? 'No reason was recorded for this report.'}
              </AppText>
            </View>
            <AppText style={s.nudgeNote}>
              <AppText style={s.nudgeNoteAsterisk}>*** </AppText>
              Admin will look into the reason for reporting and decide the next action i.e. to talk to user, delete user or block user.
            </AppText>
            <TouchableOpacity style={s.nudgeClose} onPress={() => setReasonModal(null)} activeOpacity={0.8}>
              <AppText style={s.nudgeCloseTxt}>Close</AppText>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <GuardianFloatingTabBar />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:     { flex: 1, backgroundColor: NICO.screenBg },
  center:        { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACING.md, padding: SPACING.xl },
  listContent:   { padding: SPACING.base, paddingBottom: 48 },

  // Tab bar
  tabBar: {
    flexDirection: 'row', backgroundColor: NICO.surface,
    borderBottomWidth: 1, borderBottomColor: NICO.border,
  },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: SPACING.md,
    borderBottomWidth: 2.5, borderBottomColor: 'transparent',
  },
  tabActive:      { borderBottomColor: NICO.primary },
  tabInner:       { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  tabTxt:         { ...TEXT_STYLE.tabLabel },
  tabTxtActive:   { ...TEXT_STYLE.tabLabel, color: NICO.primary, fontWeight: FONT_WEIGHT.extraBold },
  tabPane:        { flex: 1, backgroundColor: NICO.screenBg },
  tabBadge: {
    backgroundColor: NICO.error, borderRadius: RADIUS.full,
    minWidth: scale(16), height: scale(16), paddingHorizontal: 3,
    justifyContent: 'center', alignItems: 'center',
  },
  tabBadgeTxt: { fontSize: scale(9), fontWeight: FONT_WEIGHT.extraBold, color: '#fff' },

  // Requests sub-tab bar (Sent / Received)
  subTabBar: {
    flexDirection: 'row', backgroundColor: NICO.screenBg,
    borderBottomWidth: 1, borderBottomColor: NICO.border,
    paddingHorizontal: SPACING.base, paddingVertical: SPACING.sm,
    gap: SPACING.xl,
  },
  subTabWrap:        { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  subTabGradient:    { padding: BUTTERFLY_BORDER.width, borderRadius: RADIUS.full },
  subTabGradientDim: { opacity: 0.35 },
  subTabInner: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    paddingVertical: SPACING.xs, paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.full, backgroundColor: NICO.screenBg,
  },
  subTabInnerActive: { backgroundColor: NICO.primaryLight },
  subTabTxt:         { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semiBold, color: NICO.textMuted },
  subTabTxtActive:   { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.extraBold, color: NICO.primary },

  // Empty
  emptyEmoji: { fontSize: scale(56) },
  emptyText:  { fontSize: FONT_SIZE['2xl'], fontWeight: FONT_WEIGHT.extraBold, color: NICO.text },
  emptyHint:  { ...TEXT_STYLE.screenHint, textAlign: 'center' },

  // Card (shared across tabs)
  card: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    borderRadius: RADIUS.xl, padding: SPACING.md, marginBottom: SPACING.sm,
    borderWidth: 1, borderColor: 'transparent',
    ...SHADOW.md,
  },
  // Cards needing an extra row below the main one (Reported pill) — stack instead of a single row.
  cardColumn:   { flexDirection: 'column', alignItems: 'stretch', gap: 0 },
  cardMainRow:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  cardInfo:    { flex: 1, minWidth: 0, gap: 2 },
  cardName:    { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.extraBold, color: NICO.text },
  cardMeta:    { fontSize: FONT_SIZE.md, color: NICO.text, fontWeight: FONT_WEIGHT.medium },

  avatarCol: { alignItems: 'center', gap: 2 },
  avatarAge: { fontSize: FONT_SIZE.md, color: NICO.text, fontWeight: FONT_WEIGHT.semiBold },

  sectionTitle: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.black, color: NICO.textMuted, letterSpacing: 1, marginBottom: SPACING.md },

  // Request/action buttons (shared small pill buttons across tabs)
  reqActions: { alignItems: 'center', gap: SPACING.xs },
  reqBtn:        { ...BTN_SIZE.sm },
  acceptBtn:     { ...BTN_VARIANT.primary },
  acceptBtnTxt:  { color: NICO.textOnAccent, fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.sm },
  declineBtn:    { backgroundColor: NICO.errorLight, alignItems: 'center', justifyContent: 'center' },
  declineBtnTxt: { color: NICO.error, fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.sm },
  cancelBtn:     { backgroundColor: NICO.background, alignItems: 'center', justifyContent: 'center' },
  cancelBtnTxt:  { color: NICO.textMuted, fontWeight: FONT_WEIGHT.semiBold, fontSize: FONT_SIZE.sm },

  // Friends tab
  infoIconCircle: {
    width: scale(18), height: scale(18), borderRadius: scale(9),
    borderWidth: 1.5, borderColor: NICO.textMuted,
    justifyContent: 'center', alignItems: 'center',
  },
  infoIconTxt: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.black, color: NICO.textMuted, lineHeight: scale(14) },
  cardCornerIcon: { position: 'absolute', top: SPACING.sm, right: SPACING.sm },
  reportedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: SPACING.sm, alignSelf: 'flex-end',
  },
  cardRemoveIcon: {
    width: scale(26), height: scale(26), borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.75)',
    justifyContent: 'center', alignItems: 'center',
  },
  cardRemoveIconTxt: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.extraBold, color: NICO.error },
  reportedPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: NICO.errorLight,
    borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 4,
  },
  reportedPillTxt: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, color: NICO.error },

  // Report reason nudge modal
  nudgeOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center', padding: SPACING.xl,
  },
  nudge: {
    backgroundColor: NICO.surface, borderRadius: RADIUS.xl,
    padding: SPACING.lg, width: '100%', gap: SPACING.md,
    ...SHADOW.lg,
  },
  nudgeTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extraBold, color: NICO.text },
  nudgeBodyBox: {
    backgroundColor: NICO.background, borderRadius: RADIUS.lg,
    padding: SPACING.base, borderWidth: 1, borderColor: NICO.border,
  },
  nudgeBody:  { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.semiBold, color: NICO.text, lineHeight: 26 },
  nudgeNote:  { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semiBold, color: NICO.text, lineHeight: 21 },
  nudgeNoteAsterisk: { color: NICO.warning, fontWeight: FONT_WEIGHT.black, fontSize: FONT_SIZE.lg },
  nudgeClose: { ...BTN_SIZE.sm, ...BTN_VARIANT.primary, alignSelf: 'flex-end' },
  nudgeCloseTxt: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, color: NICO.textOnAccent },

  // Blocked tab
  unblockBtn:    { backgroundColor: NICO.errorLight, alignItems: 'center', justifyContent: 'center' },
  unblockBtnTxt: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, color: NICO.error },

});
