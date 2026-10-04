import React, { useCallback, useMemo, useState } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert, Modal,
  ScrollView, TextInput,
} from 'react-native';
import AppText from '../../components/AppText';
import RainbowDivider from '../../components/RainbowDivider';
import GuardianFloatingTabBar from '../../components/GuardianFloatingTabBar';
import MoreFiltersLink from '../../components/MoreFiltersLink';
import FilterSheet, { FilterSheetSection } from '../../components/FilterSheet';
import CountyFilterPill from '../../components/CountyFilterPill';
import useNicoHeader from '../../hooks/useNicoHeader';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COMPREHENSION_LEVELS, calcAge } from '../../constants';
import { GuardianNavParamList } from '../../navigation';
import { useVisibleCount } from '../../hooks/useVisibleCount';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, SHADOW, FONT_SIZE, FONT_WEIGHT,
  BTN_SIZE, BTN_VARIANT, INPUT, BUTTERFLY_BORDER, BUTTERFLY_TILES, scale,
} from '../../constants/theme';

type Nav = NativeStackNavigationProp<GuardianNavParamList>;
type Tab = 'friends' | 'requests' | 'find' | 'blocked';
type RequestsSubTab = 'sent' | 'received';

const AVATAR_COLORS = [NICO.teal, NICO.orange, NICO.coral, NICO.pink, NICO.purple, NICO.primary];
const AGE_GROUPS    = ['Under 10', '10–14', '15–18', '19–25', '26–35', '36+'];

function getAgeGroup(dob: string | null): string | null {
  const age = calcAge(dob);
  if (age === null) return null;
  if (age < 10)  return 'Under 10';
  if (age <= 14) return '10–14';
  if (age <= 18) return '15–18';
  if (age <= 25) return '19–25';
  if (age <= 35) return '26–35';
  return '36+';
}

function toggle<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
}

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

interface LearnerResult {
  id: string;
  name: string;
  date_of_birth: string | null;
  photo_url: string | null;
  county: string;
  region: string;
  comprehension_level: string | null;
  likes:             string[];
  dislikes:          string[];
  abilities:         string[];
  connectionStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted';
  guardianName: string | null;
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

  // shared state
  const [myLearnerIds, setMyLearnerIds] = useState<string[]>([]);
  const [myLearnerMap, setMyLearnerMap] = useState<Record<string, string>>({});
  const [loading, setLoading]           = useState(true);

  // Friends tab
  const [friends, setFriends] = useState<Friend[]>([]);

  // Requests tab
  const [requests,   setRequests]   = useState<FriendRequest[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [activeRequestsTab, setActiveRequestsTab] = useState<RequestsSubTab>('received');

  // Find tab
  const [learners,      setLearners]      = useState<LearnerResult[]>([]);
  const [catLikes,      setCatLikes]      = useState<string[]>([]);
  const [catDislikes,   setCatDislikes]   = useState<string[]>([]);
  const [catAbilities,  setCatAbilities]  = useState<string[]>([]);
  const [blockedUsers,  setBlockedUsers]  = useState<BlockedUser[]>([]);
  const [reportedMap,   setReportedMap]   = useState<Map<string, string | null>>(new Map());
  const [reasonModal,   setReasonModal]   = useState<{ name: string; reason: string | null } | null>(null);
  const blockedIds  = useMemo(() => new Set(blockedUsers.map(b => b.blockedLearnerId)), [blockedUsers]);
  const reportedIds = useMemo(() => new Set(reportedMap.keys()), [reportedMap]);
  const hiddenIds   = useMemo(() => new Set([...blockedIds, ...reportedIds]), [blockedIds, reportedIds]);
  const [sending,       setSending]       = useState<string | null>(null);
  const [removing,      setRemoving]      = useState<string | null>(null);
  const [searchName,    setSearchName]    = useState('');
  const [searchCounty,    setSearchCounty]    = useState('');
  const [filterAgeGroups, setFilterAgeGroups] = useState<string[]>([]);
  const [filterLevels,    setFilterLevels]    = useState<string[]>([]);
  const [filterLikes,     setFilterLikes]     = useState<string[]>([]);
  const [filterDislikes,  setFilterDislikes]  = useState<string[]>([]);
  const [filterAbilities, setFilterAbilities] = useState<string[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);

  useFocusEffect(useCallback(() => {
    if (guardian) loadAll(guardian.id);
  }, [guardian]));

  async function loadAll(guardianId: string) {
    setLoading(true);

    // My learners
    const { data: mine } = await supabase
      .from('user_profiles').select('id, name').eq('guardian_id', guardianId);
    const myIds = (mine ?? []).map((r: any) => r.id);
    const myMap: Record<string, string> = {};
    (mine ?? []).forEach((l: any) => { myMap[l.id] = l.name; });
    setMyLearnerIds(myIds);
    setMyLearnerMap(myMap);

    await Promise.all([
      loadFriends(myIds, guardianId),
      loadRequests(myIds, myMap),
      loadDiscovery(myIds, guardianId),
      loadBlocked(myIds),
      loadReported(myIds),
    ]);

    setLoading(false);
  }

  // ── Blocked tab loader ─────────────────────────────────────────────────────

  async function loadBlocked(myIds: string[]) {
    if (myIds.length === 0) { setBlockedUsers([]); return; }
    const { data } = await supabase
      .from('blocked_learners')
      .select('id, learner_id, blocked_learner_id, reason')
      .in('learner_id', myIds);
    if (!data || data.length === 0) { setBlockedUsers([]); return; }
    const blockedProfileIds = data.map((b: any) => b.blocked_learner_id);
    const { data: profiles } = await supabase
      .from('user_profiles').select('id, name, photo_url').in('id', blockedProfileIds);
    const profileMap: Record<string, any> = {};
    (profiles ?? []).forEach((p: any) => { profileMap[p.id] = p; });
    setBlockedUsers(data.map((b: any) => ({
      blockId: b.id,
      learnerId: b.learner_id,
      blockedLearnerId: b.blocked_learner_id,
      blockedLearnerName: profileMap[b.blocked_learner_id]?.name ?? 'Unknown',
      blockedLearnerPhoto: profileMap[b.blocked_learner_id]?.photo_url ?? null,
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

  async function loadFriends(myIds: string[], guardianId: string) {
    if (myIds.length === 0) { setFriends([]); return; }

    const { data: accepted } = await supabase
      .from('friendships')
      .select('id, requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(myIds.map((id: string) => `requester_id.eq.${id},addressee_id.eq.${id}`).join(','));

    if (!accepted || accepted.length === 0) { setFriends([]); return; }

    const otherIds = accepted.map((f: any) =>
      myIds.includes(f.requester_id) ? f.addressee_id : f.requester_id
    );

    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, name, photo_url, county, region, date_of_birth, guardian_id')
      .in('id', otherIds);

    const guardianIds = [...new Set((profiles ?? []).map((p: any) => p.guardian_id).filter(Boolean))];
    const { data: guardians } = guardianIds.length > 0
      ? await supabase.from('guardians').select('id, full_name').in('id', guardianIds)
      : { data: [] };

    const guardianNameMap: Record<string, string> = {};
    (guardians ?? []).forEach((g: any) => { guardianNameMap[g.id] = g.full_name; });

    const profileMap: Record<string, any> = {};
    (profiles ?? []).forEach((p: any) => { profileMap[p.id] = p; });

    const list: Friend[] = accepted.map((f: any) => {
      const otherId = myIds.includes(f.requester_id) ? f.addressee_id : f.requester_id;
      const p = profileMap[otherId];
      return {
        friendshipId: f.id,
        learnerId:    otherId,
        learnerName:  p?.name ?? 'Unknown',
        learnerPhoto: p?.photo_url ?? null,
        learnerCounty:  p?.county ?? '',
        learnerRegion:p?.region ?? '',
        learnerAge:   calcAge(p?.date_of_birth ?? null),
        guardianName: p?.guardian_id ? (guardianNameMap[p.guardian_id] ?? null) : null,
      };
    });

    setFriends(list);
  }

  // ── Requests tab loader ────────────────────────────────────────────────────

  async function loadRequests(myIds: string[], myMap: Record<string, string>) {
    if (myIds.length === 0) { setRequests([]); return; }

    const { data: friendships } = await supabase
      .from('friendships')
      .select('id, requester_id, addressee_id, requested_by_guardian_id, status')
      .eq('status', 'pending')
      .or(myIds.map((id: string) => `requester_id.eq.${id},addressee_id.eq.${id}`).join(','));

    if (!friendships || friendships.length === 0) { setRequests([]); return; }

    const otherIds = friendships.map((f: any) =>
      myIds.includes(f.requester_id) ? f.addressee_id : f.requester_id
    );

    const { data: otherProfiles } = await supabase
      .from('user_profiles')
      .select('id, name, date_of_birth, photo_url, county, region, guardian_id')
      .in('id', otherIds);

    const otherGuardianIds = [...new Set((otherProfiles ?? []).map((p: any) => p.guardian_id).filter(Boolean))];
    const { data: otherGuardians } = otherGuardianIds.length > 0
      ? await supabase.from('guardians').select('id, full_name').in('id', otherGuardianIds)
      : { data: [] };

    const guardianNameMap: Record<string, string> = {};
    (otherGuardians ?? []).forEach((g: any) => { guardianNameMap[g.id] = g.full_name; });

    const profileMap: Record<string, any> = {};
    (otherProfiles ?? []).forEach((p: any) => { profileMap[p.id] = p; });

    setRequests(friendships.map((f: any) => {
      const iAmRequester = myIds.includes(f.requester_id);
      const myLearnerId  = iAmRequester ? f.requester_id : f.addressee_id;
      const otherId      = iAmRequester ? f.addressee_id : f.requester_id;
      const other        = profileMap[otherId];
      return {
        friendshipId: f.id,
        requesterId: otherId,
        requesterName: other?.name ?? 'Unknown',
        requesterPhoto: other?.photo_url ?? null,
        requesterAge: calcAge(other?.date_of_birth) ?? 0,
        requesterCounty: other?.county ?? '',
        requesterRegion: other?.region ?? '',
        requesterGuardianName: other?.guardian_id ? (guardianNameMap[other.guardian_id] ?? null) : null,
        myLearnerId,
        myLearnerName: myMap[myLearnerId] ?? '',
        direction: iAmRequester ? 'outgoing' : 'incoming',
      };
    }));
  }

  // ── Discovery tab loader ───────────────────────────────────────────────────

  async function loadDiscovery(myIds: string[], guardianId: string) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, name, date_of_birth, photo_url, county, region, guardian_id')
      .neq('guardian_id', guardianId)
      .order('name');
    if (!profiles) return;

    const otherIds = profiles.map((p: any) => p.id);
    const none = Promise.resolve({ data: [] });

    const otherGuardianIds = [...new Set(profiles.map((p: any) => p.guardian_id).filter(Boolean))];

    const [
      { data: categories },
      { data: chatPrefs },
      { data: likesData },
      { data: dislikesData },
      { data: abilitiesData },
      { data: friendships },
      { data: otherGuardians },
    ] = await Promise.all([
      supabase.from('categories').select('name, type').order('name'),
      otherIds.length > 0 ? supabase.from('chat_preferences').select('user_id, comprehension_level').in('user_id', otherIds) : none,
      otherIds.length > 0 ? supabase.from('user_likes').select('user_id, categories(name)').in('user_id', otherIds) : none,
      otherIds.length > 0 ? supabase.from('user_dislikes').select('user_id, categories(name)').in('user_id', otherIds) : none,
      otherIds.length > 0 ? supabase.from('user_abilities').select('user_id, categories(name)').in('user_id', otherIds) : none,
      myIds.length > 0 ? supabase.from('friendships').select('requester_id, addressee_id, status').or(myIds.map((id: string) => `requester_id.eq.${id},addressee_id.eq.${id}`).join(',')) : none,
      otherGuardianIds.length > 0 ? supabase.from('guardians').select('id, full_name').in('id', otherGuardianIds) : none,
    ]);

    const guardianNameMap: Record<string, string> = {};
    (otherGuardians ?? []).forEach((g: any) => { guardianNameMap[g.id] = g.full_name; });

    const cats = (categories ?? []) as { name: string; type: string }[];
    setCatLikes(cats.filter(c => c.type === 'like').map(c => c.name));
    setCatDislikes(cats.filter(c => c.type === 'dislike').map(c => c.name));
    setCatAbilities(cats.filter(c => c.type === 'ability').map(c => c.name));

    const levelMap: Record<string, string> = {};
    (chatPrefs ?? []).forEach((c: any) => { levelMap[c.user_id] = c.comprehension_level; });

    function buildMap(rows: any[]): Record<string, string[]> {
      const m: Record<string, string[]> = {};
      (rows ?? []).forEach((r: any) => {
        if (!m[r.user_id]) m[r.user_id] = [];
        if (r.categories?.name) m[r.user_id].push(r.categories.name);
      });
      return m;
    }
    const likesMap     = buildMap(likesData     ?? []);
    const dislikesMap  = buildMap(dislikesData  ?? []);
    const abilitiesMap = buildMap(abilitiesData ?? []);

    function getStatus(otherId: string): LearnerResult['connectionStatus'] {
      const f = (friendships ?? []).find((fr: any) =>
        (myIds.includes(fr.requester_id) && fr.addressee_id === otherId) ||
        (myIds.includes(fr.addressee_id) && fr.requester_id === otherId)
      );
      if (!f) return 'none';
      if (f.status === 'accepted') return 'accepted';
      return myIds.includes(f.requester_id) ? 'pending_sent' : 'pending_received';
    }

    setLearners(profiles.map((p: any) => ({
      id: p.id, name: p.name, date_of_birth: p.date_of_birth ?? null,
      photo_url: p.photo_url, county: p.county, region: p.region,
      comprehension_level: levelMap[p.id] ?? null,
      likes:             (likesMap[p.id]     ?? []).slice(0, 5),
      dislikes:          (dislikesMap[p.id]  ?? []).slice(0, 5),
      abilities:         (abilitiesMap[p.id] ?? []).slice(0, 8),
      connectionStatus: getStatus(p.id),
      guardianName: p.guardian_id ? (guardianNameMap[p.guardian_id] ?? null) : null,
    })));
  }

  // ── Request actions ────────────────────────────────────────────────────────

  async function accept(req: FriendRequest) {
    setProcessing(req.friendshipId);
    const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', req.friendshipId);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setRequests(prev => prev.filter(r => r.friendshipId !== req.friendshipId));
      // refresh friends list
      if (guardian) loadFriends(myLearnerIds, guardian.id);
      Alert.alert('Connected!', `${req.myLearnerName} and ${req.requesterName} are now friends.`);
    }
    setProcessing(null);
  }

  async function decline(req: FriendRequest) {
    Alert.alert('Decline request', `Decline the friend request from ${req.requesterName}'s guardian?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Decline', style: 'destructive', onPress: async () => {
        setProcessing(req.friendshipId);
        await supabase.from('friendships').update({ status: 'rejected' }).eq('id', req.friendshipId);
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

  // ── Discovery actions ──────────────────────────────────────────────────────

  async function sendRequest(learner: LearnerResult) {
    if (!guardian || myLearnerIds.length === 0) {
      Alert.alert('No learners', 'You need to add a learner before connecting with others.');
      return;
    }
    setSending(learner.id);
    try {
      const { error } = await supabase.from('friendships').insert({
        requester_id: myLearnerIds[0],
        addressee_id: learner.id,
        status: 'pending',
        requested_by_guardian_id: guardian.id,
      });
      if (error) throw new Error(error.message);

      setLearners(prev => prev.map(l => l.id === learner.id ? { ...l, connectionStatus: 'pending_sent' } : l));
      Alert.alert('Request sent!', `A friend request has been sent to ${learner.name}'s guardian.`);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Something went wrong.');
    }
    setSending(null);
  }

  // ── Filter helpers ─────────────────────────────────────────────────────────

  const totalActive = filterAgeGroups.length + filterLevels.length + filterLikes.length +
    filterDislikes.length + filterAbilities.length;

  const activePills = [
    ...filterAgeGroups.map(g => ({ key: `age-${g}`,  label: g,         type: 'age',     raw: g })),
    ...filterLevels.map(l    => ({ key: `lvl-${l}`,  label: l,         type: 'level',   raw: l })),
    ...filterLikes.map(l     => ({ key: `lk-${l}`,   label: `❤️ ${l}`, type: 'like',    raw: l })),
    ...filterDislikes.map(l  => ({ key: `dis-${l}`,  label: `🙅 ${l}`, type: 'dislike', raw: l })),
    ...filterAbilities.map(l => ({ key: `abi-${l}`,  label: `⭐ ${l}`, type: 'ability', raw: l })),
  ];

  function removePill(type: string, val: string) {
    if (type === 'age')     setFilterAgeGroups(p => p.filter(x => x !== val));
    if (type === 'level')   setFilterLevels(p => p.filter(x => x !== val));
    if (type === 'like')    setFilterLikes(p => p.filter(x => x !== val));
    if (type === 'dislike') setFilterDislikes(p => p.filter(x => x !== val));
    if (type === 'ability') setFilterAbilities(p => p.filter(x => x !== val));
  }

  function clearAllFilters() {
    setFilterAgeGroups([]); setFilterLevels([]);
    setFilterLikes([]);     setFilterDislikes([]);
    setFilterAbilities([]);
  }

  function applyFilters(list: LearnerResult[]) {
    return list.filter(l => {
      if (hiddenIds.has(l.id)) return false;
      if (l.connectionStatus === 'accepted' || l.connectionStatus === 'pending_received') return false;
      if (searchName && !l.name.toLowerCase().includes(searchName.toLowerCase())) return false;
      if (searchCounty && !l.county.toLowerCase().includes(searchCounty.toLowerCase()))  return false;
      if (filterAgeGroups.length > 0 && !filterAgeGroups.includes(getAgeGroup(l.date_of_birth) ?? '')) return false;
      if (filterLevels.length > 0 && !filterLevels.some(fl => fl.toLowerCase() === l.comprehension_level)) return false;
      if (filterLikes.length > 0 && !l.likes.some(lk => filterLikes.includes(lk))) return false;
      if (filterDislikes.length > 0 && !l.dislikes.some(d => filterDislikes.includes(d))) return false;
      if (filterAbilities.length > 0 && !l.abilities.some(a => filterAbilities.includes(a))) return false;
      return true;
    });
  }

  const filtered     = useMemo(() => applyFilters(learners), [learners, searchName, searchCounty, filterAgeGroups, filterLevels, filterLikes, filterDislikes, filterAbilities]);
  const levelLabels  = COMPREHENSION_LEVELS.map((c: any) => c.label as string);

  const findResetKey = `${searchName}|${searchCounty}|${filterAgeGroups.join(',')}|${filterLevels.join(',')}|${filterLikes.join(',')}|${filterDislikes.join(',')}|${filterAbilities.join(',')}`;
  const { visible: visibleFind, showLoadMore: showLoadMoreFind, loadMore: loadMoreFind, showCapMessage: showCapFind, pageSize: pageSizeFind } = useVisibleCount(filtered, findResetKey);

  const incomingRequests = requests.filter(r => r.direction === 'incoming');
  const outgoingRequests = requests.filter(r => r.direction === 'outgoing');
  const pendingCount     = incomingRequests.length;

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={NICO.primary} /></View>;
  }

  return (
    <View style={s.container}>
      <RainbowDivider />

      {/* Tab bar */}
      <View style={s.tabBar}>
        {(['friends', 'requests', 'find', 'blocked'] as Tab[]).map(t => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)} activeOpacity={0.75}>
            <View style={s.tabInner}>
              <AppText style={[s.tabTxt, tab === t && s.tabTxtActive]}>
                {t === 'friends' ? '👥 Friends' : t === 'requests' ? '🤝 Requests' : t === 'find' ? '🔍 Find' : '🚫 Blocked'}
              </AppText>
              {t === 'requests' && pendingCount > 0 && (
                <View style={s.tabBadge}><AppText style={s.tabBadgeTxt}>{pendingCount}</AppText></View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.tabPane}>

      {/* ── Friends tab ──────────────────────────────────────────────────────── */}
      {tab === 'friends' && (() => {
        const visibleFriends = friends.filter(f => !blockedIds.has(f.learnerId));
        return visibleFriends.length === 0 ? (
          <View style={s.center}>
            <AppText style={s.emptyEmoji}>👥</AppText>
            <AppText style={s.emptyText}>No friends yet</AppText>
            <AppText style={s.emptyHint}>Accept requests or find learners in the Find tab</AppText>
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
      {tab === 'requests' && (
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
                <AppText style={s.emptyHint}>Use the Find tab to send requests to other learners</AppText>
              </View>
            ) : (
              <ScrollView contentContainerStyle={s.listContent}>
                {incomingRequests.map((req, index) => {
                  const isProcessing = processing === req.friendshipId;
                  const tileBg = BUTTERFLY_TILES[index % BUTTERFLY_TILES.length].bg;
                  return (
                    <View key={req.friendshipId} style={[s.card, s.cardColumn, { backgroundColor: tileBg, borderColor: 'transparent' }]}>
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
                    </View>
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
                    <View key={req.friendshipId} style={[s.card, s.cardColumn, { backgroundColor: tileBg, borderColor: 'transparent' }]}>
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
                    </View>
                  );
                })}
              </ScrollView>
            )
          )}
        </>
      )}

      {/* ── Find tab ─────────────────────────────────────────────────────────── */}
      {tab === 'find' && (
        <View style={s.findContainer}>
          {/* Search */}
          <View style={s.searchRow}>
            <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={s.searchGradient}>
              <View style={s.searchInputRow}>
                <AppText style={s.searchIcon}>🔍</AppText>
                <TextInput style={s.searchInputText} value={searchName} onChangeText={setSearchName}
                  placeholder="Name…" placeholderTextColor={NICO.textMuted} clearButtonMode="while-editing" />
              </View>
            </LinearGradient>
            <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={s.searchGradient}>
              <CountyFilterPill value={searchCounty} onSelect={setSearchCounty} placeholder="County…" icon="📍" />
            </LinearGradient>
          </View>

          {/* Filter bar */}
          <View style={s.filterBar}>
            <AppText style={s.resultCount}>{filtered.length} learner{filtered.length !== 1 ? 's' : ''} found</AppText>
            <MoreFiltersLink onPress={() => setSheetOpen(true)} isActive={totalActive > 0} />
          </View>

          {activePills.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipsRow} contentContainerStyle={s.chipsContent}>
              {activePills.map(p => (
                <TouchableOpacity key={p.key} style={s.chip} onPress={() => removePill(p.type, p.raw)} activeOpacity={0.75}>
                  <AppText style={s.chipText}>{p.label}</AppText>
                  <AppText style={s.chipX}>×</AppText>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={s.clearAllChip} onPress={clearAllFilters} activeOpacity={0.75}>
                <AppText style={s.clearAllChipText}>Clear all</AppText>
              </TouchableOpacity>
            </ScrollView>
          )}

          <FlatList
            data={visibleFind}
            keyExtractor={l => l.id}
            contentContainerStyle={s.listContent}
            renderItem={({ item: l, index }) => {
              const isSending = sending === l.id;
              const tileBg = BUTTERFLY_TILES[index % BUTTERFLY_TILES.length].bg;
              return (
                <TouchableOpacity
                  style={[s.card, s.cardColumn, { backgroundColor: tileBg, borderColor: 'transparent' }]}
                  onPress={() => navigation.navigate('LearnerPublicProfile', { learnerId: l.id })}
                  activeOpacity={0.85}
                >
                  <View style={s.cardMainRow}>
                    <View style={s.avatarCol}>
                      <Avatar name={l.name} photo={l.photo_url} size={scale(52)} />
                      {calcAge(l.date_of_birth) != null && <AppText style={s.avatarAge}>{calcAge(l.date_of_birth)} yrs</AppText>}
                    </View>
                    <View style={s.cardInfo}>
                      <AppText style={s.cardName} numberOfLines={1}>{l.name}</AppText>
                      <AppText style={s.cardMeta} numberOfLines={1}>
                        {l.county}
                      </AppText>
                      {l.guardianName && (
                        <AppText style={s.cardMeta}>Guardian: {l.guardianName}</AppText>
                      )}
                    </View>
                    {l.connectionStatus === 'accepted' && (
                      <View style={s.friendBadge}><AppText style={s.friendBadgeTxt}>✓ Friends</AppText></View>
                    )}
                    {l.connectionStatus === 'pending_sent' && (
                      <View style={s.pendingBadge}><AppText style={s.pendingBadgeTxt}>Pending</AppText></View>
                    )}
                    {l.connectionStatus === 'pending_received' && (
                      <TouchableOpacity style={[s.reqBtn, s.respondBtn]} onPress={() => setTab('requests')} activeOpacity={0.8}>
                        <AppText style={s.respondBtnTxt}>Respond</AppText>
                      </TouchableOpacity>
                    )}
                    {l.connectionStatus === 'none' && (
                      <TouchableOpacity style={[s.reqBtn, s.connectBtn, isSending && s.btnDisabled]}
                        onPress={() => sendRequest(l)} disabled={isSending} activeOpacity={0.8}>
                        {isSending
                          ? <ActivityIndicator size="small" color={NICO.textOnAccent} />
                          : <AppText style={s.connectBtnTxt}>Connect</AppText>
                        }
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
            ListFooterComponent={
              showLoadMoreFind ? (
                <TouchableOpacity style={s.loadMoreBtn} onPress={loadMoreFind} activeOpacity={0.75}>
                  <AppText style={s.loadMoreText}>Load {pageSizeFind} more</AppText>
                </TouchableOpacity>
              ) : showCapFind ? (
                <View style={s.capMessage}>
                  <AppText style={s.capMessageText}>Use filters to search records</AppText>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={s.center}>
                <AppText style={s.emptyEmoji}>🔍</AppText>
                <AppText style={s.emptyText}>No learners found</AppText>
                <AppText style={s.emptyHint}>Try adjusting your filters</AppText>
              </View>
            }
          />
        </View>
      )}

      {/* ── Blocked tab ──────────────────────────────────────────────────────── */}
      {tab === 'blocked' && (
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

      {/* Filter sheet */}
      <FilterSheet
        visible={sheetOpen}
        title="Filter Learners"
        onClearAll={clearAllFilters}
        onDone={() => setSheetOpen(false)}
        sections={[
          {
            key: 'age', emoji: '🎂', title: 'Age Group',
            options: AGE_GROUPS.map(g => ({ key: g, label: g })),
            selected: filterAgeGroups,
            onToggle: val => setFilterAgeGroups(p => toggle(p, val)),
          },
          {
            key: 'level', emoji: '🧠', title: 'Comprehension Level',
            options: levelLabels.map(l => ({ key: l, label: l })),
            selected: filterLevels,
            onToggle: val => setFilterLevels(p => toggle(p, val)),
          },
          {
            key: 'likes', emoji: '❤️', title: 'Likes',
            options: catLikes.map(l => ({ key: l, label: l })),
            selected: filterLikes,
            onToggle: val => setFilterLikes(p => toggle(p, val)),
          },
          {
            key: 'dislikes', emoji: '🙅', title: 'Dislikes',
            options: catDislikes.map(l => ({ key: l, label: l })),
            selected: filterDislikes,
            onToggle: val => setFilterDislikes(p => toggle(p, val)),
          },
          {
            key: 'abilities', emoji: '⭐', title: 'What can they do?',
            options: catAbilities.map(l => ({ key: l, label: l })),
            selected: filterAbilities,
            onToggle: val => setFilterAbilities(p => toggle(p, val)),
          },
        ] satisfies FilterSheetSection[]}
      />

      <GuardianFloatingTabBar />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:     { flex: 1, backgroundColor: NICO.screenBg },
  findContainer: { flex: 1 },
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

  // Friends tab
  friendBadge: { backgroundColor: NICO.successLight, borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs },
  friendBadgeTxt: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, color: NICO.success },

  // Request/action buttons (shared small pill buttons across tabs)
  reqActions: { alignItems: 'center', gap: SPACING.xs },
  reqBtn:        { ...BTN_SIZE.sm },
  acceptBtn:     { ...BTN_VARIANT.primary },
  acceptBtnTxt:  { color: NICO.textOnAccent, fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.sm },
  declineBtn:    { backgroundColor: NICO.errorLight, alignItems: 'center', justifyContent: 'center' },
  declineBtnTxt: { color: NICO.error, fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.sm },
  cancelBtn:     { backgroundColor: NICO.background, alignItems: 'center', justifyContent: 'center' },
  cancelBtnTxt:  { color: NICO.textMuted, fontWeight: FONT_WEIGHT.semiBold, fontSize: FONT_SIZE.sm },
  btnDisabled:   { opacity: 0.6 },

  // Find tab
  searchRow:    { flexDirection: 'row', gap: SPACING.sm, padding: SPACING.base, paddingBottom: SPACING.sm },
  searchGradient: { flex: 1, padding: BUTTERFLY_BORDER.width, borderRadius: RADIUS.md + BUTTERFLY_BORDER.width },
  searchInputRow: {
    ...INPUT.base, borderWidth: 0,
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingVertical: SPACING.sm,
  },
  searchIcon:     { fontSize: FONT_SIZE.sm },
  searchInputText:{ flex: 1, fontSize: FONT_SIZE.md, color: NICO.text, padding: 0 },

  filterBar:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.base, paddingBottom: SPACING.sm },
  resultCount:  { ...TEXT_STYLE.caption, color: NICO.textMuted },

  chipsRow:     { maxHeight: 40 },
  chipsContent: { paddingHorizontal: SPACING.base, paddingBottom: SPACING.sm, gap: SPACING.xs, alignItems: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: NICO.primaryLight, borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm, paddingVertical: 4,
  },
  chipText: { ...TEXT_STYLE.caption, color: NICO.primary },
  chipX:    { fontSize: FONT_SIZE.xs, color: NICO.primary, fontWeight: FONT_WEIGHT.bold },
  clearAllChip: {
    paddingHorizontal: SPACING.sm, paddingVertical: 4,
    borderRadius: RADIUS.full, borderWidth: 1, borderColor: NICO.border,
  },
  clearAllChipText: { ...TEXT_STYLE.caption, color: NICO.textMuted },

  pendingBadge:    { backgroundColor: NICO.background, borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs },
  pendingBadgeTxt: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semiBold, color: NICO.textMuted },
  respondBtn:      { ...BTN_VARIANT.primary },
  respondBtnTxt:   { color: NICO.textOnAccent, fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.sm },
  connectBtn:      { ...BTN_VARIANT.primary },
  connectBtnTxt:   { color: NICO.textOnAccent, fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.sm },

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

  loadMoreBtn:    { ...BTN_SIZE.sm, ...BTN_VARIANT.outline, alignSelf: 'center', marginTop: SPACING.base },
  loadMoreText:   { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extraBold, color: NICO.primary },
  capMessage:     { alignItems: 'center', paddingVertical: SPACING.base },
  capMessageText: { ...TEXT_STYLE.hint, fontStyle: 'italic' },
});
