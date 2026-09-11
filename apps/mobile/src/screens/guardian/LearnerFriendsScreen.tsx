import React, { useCallback, useMemo, useState } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert, Modal,
  ScrollView, TextInput, Dimensions, Platform,
} from 'react-native';
import AppText from '../../components/AppText';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS, COMPREHENSION_LEVELS, calcAge } from '../../constants';
import { GuardianNavParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<GuardianNavParamList>;
type Tab = 'friends' | 'requests' | 'find' | 'blocked';

const { height: SCREEN_H } = Dimensions.get('window');
const AVATAR_COLORS = [COLORS.statusRed, COLORS.statusPurple, COLORS.statusTeal, COLORS.statusAmber, COLORS.statusBlue, COLORS.statusPink];
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
  learnerCity: string;
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
  requesterCity: string;
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
  city: string;
  region: string;
  comprehension_level: string | null;
  likes:             string[];
  dislikes:          string[];
  abilities:         string[];
  medicalConditions: string[];
  connectionStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted';
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ name, photo, size = 48 }: { name: string; photo: string | null; size?: number }) {
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  const r = size / 2;
  if (photo) return <Image source={{ uri: photo }} style={{ width: size, height: size, borderRadius: r }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: r, backgroundColor: color, justifyContent: 'center', alignItems: 'center' }}>
      <AppText style={{ fontSize: size * 0.4, fontWeight: '800', color: '#fff' }}>{name[0]?.toUpperCase()}</AppText>
    </View>
  );
}

// ── Filter sheet section ──────────────────────────────────────────────────────

function SheetSection({ id, emoji, title, options, selected, onToggle, openId, setOpenId }: {
  id: string; emoji: string; title: string; options: string[];
  selected: string[]; onToggle: (v: string) => void;
  openId: string | null; setOpenId: (v: string | null) => void;
}) {
  const open = openId === id;
  return (
    <View style={s.sheetSec}>
      <TouchableOpacity style={s.sheetSecHdr} onPress={() => setOpenId(open ? null : id)} activeOpacity={0.7}>
        <AppText style={s.sheetSecTitle}>{emoji}  {title}</AppText>
        <View style={s.sheetSecRight}>
          {selected.length > 0 && (
            <View style={s.sheetSecBadge}><AppText style={s.sheetSecBadgeTxt}>{selected.length}</AppText></View>
          )}
          <AppText style={s.sheetSecArr}>{open ? '▲' : '▼'}</AppText>
        </View>
      </TouchableOpacity>
      {open && options.map(opt => {
        const on = selected.includes(opt);
        return (
          <TouchableOpacity key={opt} style={s.optRow} onPress={() => onToggle(opt)} activeOpacity={0.7}>
            <AppText style={[s.optTxt, on && s.optTxtOn]}>{opt}</AppText>
            <View style={[s.optCheck, on && s.optCheckOn]}>
              {on && <AppText style={s.optCheckMark}>✓</AppText>}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function LearnerFriendsScreen() {
  const navigation = useNavigation<Nav>();
  const { guardian } = useAuth();
  const [tab, setTab] = useState<Tab>('friends');

  // shared state
  const [myLearnerIds, setMyLearnerIds] = useState<string[]>([]);
  const [myLearnerMap, setMyLearnerMap] = useState<Record<string, string>>({});
  const [loading, setLoading]           = useState(true);

  // Friends tab
  const [friends, setFriends] = useState<Friend[]>([]);

  // Requests tab
  const [requests,   setRequests]   = useState<FriendRequest[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);

  // Find tab
  const [learners,      setLearners]      = useState<LearnerResult[]>([]);
  const [catLikes,      setCatLikes]      = useState<string[]>([]);
  const [catDislikes,   setCatDislikes]   = useState<string[]>([]);
  const [catAbilities,  setCatAbilities]  = useState<string[]>([]);
  const [catMedical,    setCatMedical]    = useState<string[]>([]);
  const [blockedUsers,  setBlockedUsers]  = useState<BlockedUser[]>([]);
  const blockedIds = useMemo(() => new Set(blockedUsers.map(b => b.blockedLearnerId)), [blockedUsers]);
  const [sending,       setSending]       = useState<string | null>(null);
  const [searchName,    setSearchName]    = useState('');
  const [searchCity,    setSearchCity]    = useState('');
  const [filterAgeGroups, setFilterAgeGroups] = useState<string[]>([]);
  const [filterLevels,    setFilterLevels]    = useState<string[]>([]);
  const [filterLikes,     setFilterLikes]     = useState<string[]>([]);
  const [filterDislikes,  setFilterDislikes]  = useState<string[]>([]);
  const [filterAbilities, setFilterAbilities] = useState<string[]>([]);
  const [filterMedical,   setFilterMedical]   = useState<string[]>([]);
  const [draftAgeGroups,  setDraftAgeGroups]  = useState<string[]>([]);
  const [draftLevels,     setDraftLevels]     = useState<string[]>([]);
  const [draftLikes,      setDraftLikes]      = useState<string[]>([]);
  const [draftDislikes,   setDraftDislikes]   = useState<string[]>([]);
  const [draftAbilities,  setDraftAbilities]  = useState<string[]>([]);
  const [draftMedical,    setDraftMedical]    = useState<string[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [openSec,   setOpenSec]   = useState<string | null>('age');

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

  async function unblock(blockId: string) {
    Alert.alert('Unblock', 'Are you sure you want to unblock this person?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unblock', onPress: async () => {
        await supabase.from('blocked_learners').delete().eq('id', blockId);
        setBlockedUsers(prev => prev.filter(b => b.blockId !== blockId));
      }},
    ]);
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
      .select('id, name, photo_url, city, region, date_of_birth, guardian_id')
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
        learnerCity:  p?.city ?? '',
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
      .select('id, name, age, photo_url, city, region, guardian_id')
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
        requesterAge: other?.age ?? 0,
        requesterCity: other?.city ?? '',
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
      .select('id, name, date_of_birth, photo_url, city, region')
      .neq('guardian_id', guardianId)
      .order('name');
    if (!profiles) return;

    const otherIds = profiles.map((p: any) => p.id);
    const none = Promise.resolve({ data: [] });

    const [
      { data: categories },
      { data: chatPrefs },
      { data: likesData },
      { data: dislikesData },
      { data: abilitiesData },
      { data: friendships },
      { data: medicalOptions },
      { data: medicalData },
    ] = await Promise.all([
      supabase.from('categories').select('name, type').order('name'),
      otherIds.length > 0 ? supabase.from('chat_preferences').select('user_id, comprehension_level').in('user_id', otherIds) : none,
      otherIds.length > 0 ? supabase.from('user_likes').select('user_id, categories(name)').in('user_id', otherIds) : none,
      otherIds.length > 0 ? supabase.from('user_dislikes').select('user_id, categories(name)').in('user_id', otherIds) : none,
      otherIds.length > 0 ? supabase.from('user_abilities').select('user_id, categories(name)').in('user_id', otherIds) : none,
      myIds.length > 0 ? supabase.from('friendships').select('requester_id, addressee_id, status').or(myIds.map((id: string) => `requester_id.eq.${id},addressee_id.eq.${id}`).join(',')) : none,
      supabase.from('medical_conditions').select('label').order('label'),
      otherIds.length > 0 ? supabase.from('user_medical_conditions').select('user_id, medical_conditions(label)').in('user_id', otherIds) : none,
    ]);

    const cats = (categories ?? []) as { name: string; type: string }[];
    setCatLikes(cats.filter(c => c.type === 'like').map(c => c.name));
    setCatDislikes(cats.filter(c => c.type === 'dislike').map(c => c.name));
    setCatAbilities(cats.filter(c => c.type === 'ability').map(c => c.name));
    setCatMedical((medicalOptions ?? []).map((r: any) => r.label));

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

    const medicalMap: Record<string, string[]> = {};
    (medicalData ?? []).forEach((r: any) => {
      if (!medicalMap[r.user_id]) medicalMap[r.user_id] = [];
      if (r.medical_conditions?.label) medicalMap[r.user_id].push(r.medical_conditions.label);
    });

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
      photo_url: p.photo_url, city: p.city, region: p.region,
      comprehension_level: levelMap[p.id] ?? null,
      likes:             (likesMap[p.id]     ?? []).slice(0, 5),
      dislikes:          (dislikesMap[p.id]  ?? []).slice(0, 5),
      abilities:         (abilitiesMap[p.id] ?? []).slice(0, 8),
      medicalConditions: medicalMap[p.id]    ?? [],
      connectionStatus: getStatus(p.id),
    })));
  }

  // ── Request actions ────────────────────────────────────────────────────────

  async function accept(req: FriendRequest) {
    setProcessing(req.friendshipId);
    const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', req.friendshipId);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      const { data: requesterProfile } = await supabase
        .from('user_profiles').select('guardian_id').eq('id', req.requesterId).single();
      if (requesterProfile?.guardian_id && guardian) {
        try {
          await supabase.from('guardian_connections').upsert({
            requester_id: requesterProfile.guardian_id,
            addressee_id: guardian.id,
            status: 'accepted',
          }, { onConflict: 'requester_id,addressee_id', ignoreDuplicates: true });
        } catch {}
      }
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

      const { data: addrProfile } = await supabase
        .from('user_profiles').select('guardian_id').eq('id', learner.id).single();
      if (addrProfile?.guardian_id) {
        await supabase.from('notifications').insert({
          guardian_id: addrProfile.guardian_id, user_id: learner.id,
          type: 'friend_request',
          message: `${guardian.full_name} wants to connect their learner with ${learner.name}.`,
        });
      }
      setLearners(prev => prev.map(l => l.id === learner.id ? { ...l, connectionStatus: 'pending_sent' } : l));
      Alert.alert('Request sent!', `A friend request has been sent to ${learner.name}'s guardian.`);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Something went wrong.');
    }
    setSending(null);
  }

  // ── Filter helpers ─────────────────────────────────────────────────────────

  const totalActive = filterAgeGroups.length + filterLevels.length + filterLikes.length +
    filterDislikes.length + filterAbilities.length + filterMedical.length;

  const activePills = [
    ...filterAgeGroups.map(g => ({ key: `age-${g}`,  label: g,         type: 'age',     raw: g })),
    ...filterLevels.map(l    => ({ key: `lvl-${l}`,  label: l,         type: 'level',   raw: l })),
    ...filterLikes.map(l     => ({ key: `lk-${l}`,   label: `❤️ ${l}`, type: 'like',    raw: l })),
    ...filterDislikes.map(l  => ({ key: `dis-${l}`,  label: `🙅 ${l}`, type: 'dislike', raw: l })),
    ...filterAbilities.map(l => ({ key: `abi-${l}`,  label: `⭐ ${l}`, type: 'ability', raw: l })),
    ...filterMedical.map(l   => ({ key: `med-${l}`,  label: `🏥 ${l}`, type: 'medical', raw: l })),
  ];

  function removePill(type: string, val: string) {
    if (type === 'age')     setFilterAgeGroups(p => p.filter(x => x !== val));
    if (type === 'level')   setFilterLevels(p => p.filter(x => x !== val));
    if (type === 'like')    setFilterLikes(p => p.filter(x => x !== val));
    if (type === 'dislike') setFilterDislikes(p => p.filter(x => x !== val));
    if (type === 'ability') setFilterAbilities(p => p.filter(x => x !== val));
    if (type === 'medical') setFilterMedical(p => p.filter(x => x !== val));
  }

  function applySheet() {
    setFilterAgeGroups([...draftAgeGroups]);
    setFilterLevels([...draftLevels]);
    setFilterLikes([...draftLikes]);
    setFilterDislikes([...draftDislikes]);
    setFilterAbilities([...draftAbilities]);
    setFilterMedical([...draftMedical]);
    setSheetOpen(false);
  }

  function clearDraft() {
    setDraftAgeGroups([]); setDraftLevels([]);
    setDraftLikes([]);     setDraftDislikes([]);
    setDraftAbilities([]); setDraftMedical([]);
  }

  function applyFilters(list: LearnerResult[]) {
    return list.filter(l => {
      if (blockedIds.has(l.id)) return false;
      if (l.connectionStatus === 'accepted' || l.connectionStatus === 'pending_received') return false;
      if (searchName && !l.name.toLowerCase().includes(searchName.toLowerCase())) return false;
      if (searchCity && !l.city.toLowerCase().includes(searchCity.toLowerCase()))  return false;
      if (filterAgeGroups.length > 0 && !filterAgeGroups.includes(getAgeGroup(l.date_of_birth) ?? '')) return false;
      if (filterLevels.length > 0 && !filterLevels.some(fl => fl.toLowerCase() === l.comprehension_level)) return false;
      if (filterLikes.length > 0 && !l.likes.some(lk => filterLikes.includes(lk))) return false;
      if (filterDislikes.length > 0 && !l.dislikes.some(d => filterDislikes.includes(d))) return false;
      if (filterAbilities.length > 0 && !l.abilities.some(a => filterAbilities.includes(a))) return false;
      if (filterMedical.length > 0 && !l.medicalConditions.some(m => filterMedical.includes(m))) return false;
      return true;
    });
  }

  function applyDraftFilters(list: LearnerResult[]) {
    return list.filter(l => {
      if (blockedIds.has(l.id)) return false;
      if (l.connectionStatus === 'accepted' || l.connectionStatus === 'pending_received') return false;
      if (draftAgeGroups.length > 0 && !draftAgeGroups.includes(getAgeGroup(l.date_of_birth) ?? '')) return false;
      if (draftLevels.length > 0 && !draftLevels.some(fl => fl.toLowerCase() === l.comprehension_level)) return false;
      if (draftLikes.length > 0 && !l.likes.some(lk => draftLikes.includes(lk))) return false;
      if (draftDislikes.length > 0 && !l.dislikes.some(d => draftDislikes.includes(d))) return false;
      if (draftAbilities.length > 0 && !l.abilities.some(a => draftAbilities.includes(a))) return false;
      if (draftMedical.length > 0 && !l.medicalConditions.some(m => draftMedical.includes(m))) return false;
      return true;
    });
  }

  const filtered     = useMemo(() => applyFilters(learners),     [learners, searchName, searchCity, filterAgeGroups, filterLevels, filterLikes, filterDislikes, filterAbilities, filterMedical]);
  const draftPreview = useMemo(() => applyDraftFilters(learners), [learners, draftAgeGroups, draftLevels, draftLikes, draftDislikes, draftAbilities, draftMedical]);
  const levelLabels  = COMPREHENSION_LEVELS.map((c: any) => c.label as string);

  const incomingRequests = requests.filter(r => r.direction === 'incoming');
  const outgoingRequests = requests.filter(r => r.direction === 'outgoing');
  const pendingCount     = incomingRequests.length;

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={COLORS.bloomAccent} /></View>;
  }

  return (
    <View style={s.container}>

      {/* Tab bar */}
      <View style={s.tabBar}>
        {(['friends', 'requests', 'find', 'blocked'] as Tab[]).map(t => (
          <TouchableOpacity key={t} style={[s.tabBtn, tab === t && s.tabBtnActive]} onPress={() => setTab(t)} activeOpacity={0.7}>
            <AppText style={[s.tabLabel, tab === t && s.tabLabelActive]}>
              {t === 'friends' ? '👥 Friends' : t === 'requests' ? '🤝 Requests' : t === 'find' ? '🔍 Find' : '🚫 Blocked'}
            </AppText>
            {t === 'requests' && pendingCount > 0 && (
              <View style={s.tabBadge}><AppText style={s.tabBadgeTxt}>{pendingCount}</AppText></View>
            )}
          </TouchableOpacity>
        ))}
      </View>

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
            renderItem={({ item: f }) => (
              <TouchableOpacity
                style={s.card}
                onPress={() => navigation.navigate('LearnerPublicProfile', { learnerId: f.learnerId })}
                activeOpacity={0.85}
              >
                <Avatar name={f.learnerName} photo={f.learnerPhoto} size={52} />
                <View style={s.cardInfo}>
                  <AppText style={s.cardName}>{f.learnerName}</AppText>
                  <AppText style={s.cardMeta}>
                    {f.learnerAge != null ? `${f.learnerAge} yrs · ` : ''}{f.learnerCity}{f.learnerRegion ? `, ${f.learnerRegion}` : ''}
                  </AppText>
                  {f.guardianName && (
                    <AppText style={s.cardGuardian}>Guardian: {f.guardianName}</AppText>
                  )}
                </View>
                <View style={s.friendBadge}><AppText style={s.friendBadgeTxt}>✓ Friends</AppText></View>
              </TouchableOpacity>
            )}
          />
        );
      })()}

      {/* ── Requests tab ─────────────────────────────────────────────────────── */}
      {tab === 'requests' && (
        requests.length === 0 ? (
          <View style={s.center}>
            <AppText style={s.emptyEmoji}>🤝</AppText>
            <AppText style={s.emptyText}>No pending requests</AppText>
            <AppText style={s.emptyHint}>Use the Find tab to send requests to other learners</AppText>
          </View>
        ) : (
          <FlatList
            data={[]}
            renderItem={null}
            contentContainerStyle={s.listContent}
            ListHeaderComponent={
              <>
                {incomingRequests.length > 0 && (
                  <>
                    <AppText style={s.sectionTitle}>INCOMING ({incomingRequests.length})</AppText>
                    {incomingRequests.map(req => {
                      const isProcessing = processing === req.friendshipId;
                      return (
                        <View key={req.friendshipId} style={s.card}>
                          <Avatar name={req.requesterName} photo={req.requesterPhoto} size={52} />
                          <View style={s.cardInfo}>
                            <AppText style={s.cardName}>{req.requesterName}</AppText>
                            <AppText style={s.cardMeta}>{req.requesterAge} yrs · {req.requesterCity}, {req.requesterRegion}</AppText>
                            {req.requesterGuardianName && <AppText style={s.cardGuardian}>Guardian: {req.requesterGuardianName}</AppText>}
                          </View>
                          <View style={s.reqActions}>
                            {isProcessing ? <ActivityIndicator color={COLORS.bloomAccent} /> : (
                              <>
                                <TouchableOpacity style={s.acceptBtn} onPress={() => accept(req)}>
                                  <AppText style={s.acceptBtnTxt}>✓ Accept</AppText>
                                </TouchableOpacity>
                                <TouchableOpacity style={s.declineBtn} onPress={() => decline(req)}>
                                  <AppText style={s.declineBtnTxt}>Decline</AppText>
                                </TouchableOpacity>
                              </>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </>
                )}
                {outgoingRequests.length > 0 && (
                  <>
                    <AppText style={[s.sectionTitle, { marginTop: incomingRequests.length > 0 ? 24 : 0 }]}>
                      SENT ({outgoingRequests.length})
                    </AppText>
                    {outgoingRequests.map(req => {
                      const isProcessing = processing === req.friendshipId;
                      return (
                        <View key={req.friendshipId} style={s.card}>
                          <Avatar name={req.requesterName} photo={req.requesterPhoto} size={52} />
                          <View style={s.cardInfo}>
                            <AppText style={s.cardName}>{req.requesterName}</AppText>
                            <AppText style={s.cardMeta}>{req.requesterAge} yrs · {req.requesterCity}, {req.requesterRegion}</AppText>
                            {req.requesterGuardianName && <AppText style={s.cardGuardian}>Guardian: {req.requesterGuardianName}</AppText>}
                          </View>
                          <View style={s.reqActions}>
                            {isProcessing ? <ActivityIndicator color={COLORS.bloomMuted} /> : (
                              <TouchableOpacity style={s.cancelBtn} onPress={() => cancelRequest(req)}>
                                <AppText style={s.cancelBtnTxt}>Cancel</AppText>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </>
                )}
              </>
            }
          />
        )
      )}

      {/* ── Find tab ─────────────────────────────────────────────────────────── */}
      {tab === 'find' && (
        <View style={s.findContainer}>
          {/* Search */}
          <View style={s.searchRow}>
            <View style={s.searchInp}>
              <AppText style={s.searchIcon}>🔍</AppText>
              <TextInput style={s.searchText} value={searchName} onChangeText={setSearchName}
                placeholder="Name…" placeholderTextColor={COLORS.bloomMuted} clearButtonMode="while-editing" />
            </View>
            <View style={s.searchInp}>
              <AppText style={s.searchIcon}>📍</AppText>
              <TextInput style={s.searchText} value={searchCity} onChangeText={setSearchCity}
                placeholder="City…" placeholderTextColor={COLORS.bloomMuted} clearButtonMode="while-editing" />
            </View>
          </View>

          {/* Filter bar */}
          <View style={s.filterBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.pillsScroll} contentContainerStyle={s.pillsContent}>
              {activePills.map(p => (
                <TouchableOpacity key={p.key} style={s.pill} onPress={() => removePill(p.type, p.raw)} activeOpacity={0.75}>
                  <AppText style={s.pillTxt}>{p.label}</AppText>
                  <AppText style={s.pillX}>×</AppText>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={s.filterBtn} onPress={() => {
              setDraftAgeGroups([...filterAgeGroups]);
              setDraftLevels([...filterLevels]);
              setDraftLikes([...filterLikes]);
              setDraftDislikes([...filterDislikes]);
              setDraftAbilities([...filterAbilities]);
              setDraftMedical([...filterMedical]);
              setSheetOpen(true);
            }} activeOpacity={0.8}>
              <AppText style={s.filterBtnTxt}>More Filters</AppText>
              {totalActive > 0 && (
                <View style={s.filterBadge}><AppText style={s.filterBadgeTxt}>{totalActive}</AppText></View>
              )}
            </TouchableOpacity>
          </View>

          <View style={s.resBar}>
            <AppText style={s.resCount}>{filtered.length} learner{filtered.length !== 1 ? 's' : ''} found</AppText>
          </View>

          <FlatList
            data={filtered}
            keyExtractor={l => l.id}
            contentContainerStyle={s.listContent}
            renderItem={({ item: l, index }) => {
              const isSending = sending === l.id;
              return (
                <TouchableOpacity
                  style={s.card}
                  onPress={() => navigation.navigate('LearnerPublicProfile', { learnerId: l.id })}
                  activeOpacity={0.85}
                >
                  <Avatar name={l.name} photo={l.photo_url} size={42} />
                  <View style={s.cardInfo}>
                    <AppText style={s.cardName} numberOfLines={1}>{l.name}</AppText>
                    <AppText style={s.cardMeta} numberOfLines={1}>
                      {calcAge(l.date_of_birth) ?? '—'} yrs · {l.city}{l.region ? `, ${l.region}` : ''}
                    </AppText>
                  </View>
                  {l.connectionStatus === 'accepted' && (
                    <View style={s.friendBadge}><AppText style={s.friendBadgeTxt}>✓ Friends</AppText></View>
                  )}
                  {l.connectionStatus === 'pending_sent' && (
                    <View style={s.pendingBadge}><AppText style={s.pendingBadgeTxt}>Pending</AppText></View>
                  )}
                  {l.connectionStatus === 'pending_received' && (
                    <TouchableOpacity style={s.respondBtn} onPress={() => setTab('requests')} activeOpacity={0.8}>
                      <AppText style={s.respondBtnTxt}>Respond</AppText>
                    </TouchableOpacity>
                  )}
                  {l.connectionStatus === 'none' && (
                    <TouchableOpacity style={[s.connectBtn, isSending && { opacity: 0.6 }]}
                      onPress={() => sendRequest(l)} disabled={isSending} activeOpacity={0.8}>
                      {isSending
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <AppText style={s.connectBtnTxt}>Connect</AppText>
                      }
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            }}
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
            renderItem={({ item: b }) => (
              <View style={s.card}>
                <Avatar name={b.blockedLearnerName} photo={b.blockedLearnerPhoto} size={52} />
                <View style={s.cardInfo}>
                  <AppText style={s.cardName}>{b.blockedLearnerName}</AppText>
                  {b.reason && <AppText style={s.cardMeta}>Reason: {b.reason}</AppText>}
                </View>
                <TouchableOpacity style={s.unblockBtn} onPress={() => unblock(b.blockId)} activeOpacity={0.8}>
                  <AppText style={s.unblockBtnTxt}>Unblock</AppText>
                </TouchableOpacity>
              </View>
            )}
          />
        )
      )}

      {/* Filter sheet */}
      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <TouchableOpacity style={s.sheetOverlay} activeOpacity={1} onPress={() => setSheetOpen(false)}>
          <View style={s.sheet} onStartShouldSetResponder={() => true}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHdr}>
              <AppText style={s.sheetTitle}>Filter Learners</AppText>
              <TouchableOpacity onPress={clearDraft} activeOpacity={0.75}>
                <AppText style={s.sheetClear}>Clear all</AppText>
              </TouchableOpacity>
            </View>
            <ScrollView style={s.sheetBody} showsVerticalScrollIndicator={false}>
              <SheetSection id="age" emoji="🎂" title="Age Group" options={AGE_GROUPS} selected={draftAgeGroups} onToggle={val => setDraftAgeGroups(p => toggle(p, val))} openId={openSec} setOpenId={setOpenSec} />
              <SheetSection id="level" emoji="🧠" title="Comprehension Level" options={levelLabels} selected={draftLevels} onToggle={val => setDraftLevels(p => toggle(p, val))} openId={openSec} setOpenId={setOpenSec} />
              <SheetSection id="likes" emoji="❤️" title="Likes" options={catLikes} selected={draftLikes} onToggle={val => setDraftLikes(p => toggle(p, val))} openId={openSec} setOpenId={setOpenSec} />
              <SheetSection id="dislikes" emoji="🙅" title="Dislikes" options={catDislikes} selected={draftDislikes} onToggle={val => setDraftDislikes(p => toggle(p, val))} openId={openSec} setOpenId={setOpenSec} />
              <SheetSection id="abilities" emoji="⭐" title="What can they do?" options={catAbilities} selected={draftAbilities} onToggle={val => setDraftAbilities(p => toggle(p, val))} openId={openSec} setOpenId={setOpenSec} />
              {catMedical.length > 0 && (
                <SheetSection id="medical" emoji="🏥" title="Medical Condition" options={catMedical} selected={draftMedical} onToggle={val => setDraftMedical(p => toggle(p, val))} openId={openSec} setOpenId={setOpenSec} />
              )}
            </ScrollView>
            <TouchableOpacity style={s.sheetApply} onPress={applySheet} activeOpacity={0.85}>
              <AppText style={s.sheetApplyTxt}>Show {draftPreview.length} Results</AppText>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.bloomBody },
  findContainer: { flex: 1 },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
  listContent: { padding: 16, paddingBottom: 48 },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.bloomCard,
    borderBottomWidth: 1, borderBottomColor: COLORS.bloomBorder,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 13, gap: 5,
  },
  tabBtnActive: {
    borderBottomWidth: 2.5, borderBottomColor: COLORS.bloomAccent,
  },
  tabLabel:       { fontSize: 13, fontWeight: '600', color: COLORS.bloomMuted },
  tabLabelActive: { color: COLORS.bloomText, fontWeight: '800' },
  tabBadge: {
    backgroundColor: COLORS.statusRed, borderRadius: 9,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  tabBadgeTxt: { fontSize: 10, fontWeight: '900', color: '#fff' },

  // Empty
  emptyEmoji: { fontSize: 56 },
  emptyText:  { fontSize: 20, fontWeight: '800', color: COLORS.bloomText },
  emptyHint:  { fontSize: 14, color: COLORS.bloomMuted, textAlign: 'center' },

  // Card (shared across tabs)
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.bloomCard, borderRadius: 18, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.bloomBorder,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardInfo:    { flex: 1, minWidth: 0, gap: 2 },
  cardName:    { fontSize: 15, fontWeight: '800', color: COLORS.bloomText },
  cardMeta:    { fontSize: 12, color: COLORS.bloomMuted },
  cardGuardian:{ fontSize: 12, color: COLORS.bloomAccent, fontWeight: '600' },

  sectionTitle: { fontSize: 11, fontWeight: '900', color: COLORS.bloomMuted, letterSpacing: 1.2, marginBottom: 12 },

  // Friends tab
  friendBadge: { backgroundColor: COLORS.bloomActiveBg, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6 },
  friendBadgeTxt: { fontSize: 12, fontWeight: '700', color: COLORS.bloomActiveText },

  // Requests tab
  reqActions: { alignItems: 'center', gap: 6 },
  acceptBtn: { backgroundColor: COLORS.bloomAccent, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  acceptBtnTxt: { color: COLORS.bloomOnAccent, fontWeight: '700', fontSize: 13 },
  declineBtn: { backgroundColor: COLORS.statusRedLight, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  declineBtnTxt: { color: COLORS.statusRedDark, fontWeight: '700', fontSize: 13 },
  cancelBtn: { backgroundColor: COLORS.bloomBorder, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  cancelBtnTxt: { color: COLORS.bloomMuted, fontWeight: '600', fontSize: 12 },

  // Find tab
  searchRow:    { flexDirection: 'row', gap: 8, padding: 14, paddingBottom: 8 },
  searchInp:    {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.bloomCard, borderRadius: 13,
    borderWidth: 1.5, borderColor: COLORS.bloomBorder,
    paddingHorizontal: 10, height: 42,
  },
  searchIcon:   { fontSize: 13 },
  searchText:   { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.bloomText },

  filterBar:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 6, gap: 8 },
  pillsScroll:  { flex: 1 },
  pillsContent: { gap: 6, flexDirection: 'row' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE',
    borderRadius: 18, paddingHorizontal: 10, paddingVertical: 5,
  },
  pillTxt: { fontSize: 11, fontWeight: '800', color: '#1D4ED8' },
  pillX:   { fontSize: 11, color: '#93C5FD', fontWeight: '900' },

  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.bloomCard, borderWidth: 1.5, borderColor: COLORS.bloomAccent,
    borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7,
  },
  filterBtnTxt:   { fontSize: 12, fontWeight: '800', color: COLORS.bloomActiveText },
  filterBadge:    { backgroundColor: COLORS.bloomAccent, borderRadius: 9, paddingHorizontal: 6, paddingVertical: 1 },
  filterBadgeTxt: { fontSize: 10, fontWeight: '900', color: COLORS.bloomOnAccent },

  resBar:   { paddingHorizontal: 14, paddingBottom: 6 },
  resCount: { fontSize: 12, fontWeight: '700', color: COLORS.bloomMuted },

  pendingBadge:  { backgroundColor: COLORS.bloomBorder, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6 },
  pendingBadgeTxt: { fontSize: 12, fontWeight: '600', color: COLORS.bloomMuted },
  respondBtn:    { backgroundColor: COLORS.bloomAccent, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 7 },
  respondBtnTxt: { color: COLORS.bloomOnAccent, fontWeight: '700', fontSize: 12 },
  connectBtn:    { backgroundColor: COLORS.bloomAccent, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 7 },
  connectBtnTxt: { color: COLORS.bloomOnAccent, fontWeight: '700', fontSize: 12 },

  // Filter sheet
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    height: SCREEN_H * 0.72,
    backgroundColor: COLORS.bloomCard,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    overflow: 'hidden',
  },
  sheetHandle: { width: 38, height: 4, backgroundColor: COLORS.bloomBorder, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 2 },
  sheetHdr: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.bloomBorder,
  },
  sheetTitle: { fontSize: 15, fontWeight: '900', color: COLORS.bloomText },
  sheetClear: { fontSize: 13, fontWeight: '700', color: COLORS.bloomAccent },
  sheetBody:  { flex: 1 },
  sheetSec:   { borderBottomWidth: 1, borderBottomColor: COLORS.bloomBorder },
  sheetSecHdr: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 13,
  },
  sheetSecRight:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheetSecTitle:    { fontSize: 13, fontWeight: '800', color: COLORS.bloomText },
  sheetSecBadge:    { backgroundColor: COLORS.bloomAccent, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 },
  sheetSecBadgeTxt: { fontSize: 10, fontWeight: '900', color: COLORS.bloomOnAccent },
  sheetSecArr:      { fontSize: 10, color: COLORS.bloomMuted },
  optRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 11,
    borderTopWidth: 1, borderTopColor: COLORS.bloomBorder,
  },
  optTxt:       { fontSize: 14, color: COLORS.bloomText, flex: 1 },
  optTxtOn:     { color: COLORS.bloomAccent, fontWeight: '600' },
  optCheck:     { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: COLORS.bloomBorder, justifyContent: 'center', alignItems: 'center' },
  optCheckOn:   { backgroundColor: COLORS.bloomAccent, borderColor: COLORS.bloomAccent },
  optCheckMark: { color: COLORS.bloomOnAccent, fontSize: 11, fontWeight: '900' },
  sheetApply:   { marginHorizontal: 18, marginTop: 10, backgroundColor: COLORS.bloomAccent, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  sheetApplyTxt: { color: COLORS.bloomOnAccent, fontWeight: '900', fontSize: 15 },

  // Blocked tab
  unblockBtn: { backgroundColor: '#FEF2F2', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: '#FECACA' },
  unblockBtnTxt: { fontSize: 12, fontWeight: '700', color: '#DC2626' },
});
