import React, { useCallback, useMemo, useState } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, Modal, ScrollView, Image,
} from 'react-native';
import AppText from '../../components/AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { calcAge } from '../../constants';
import { GuardianNavParamList } from '../../navigation';
import { useVisibleCount } from '../../hooks/useVisibleCount';
import FilterSheet, { FilterSheetSection } from '../../components/FilterSheet';
import RainbowDivider from '../../components/RainbowDivider';
import GuardianFloatingTabBar from '../../components/GuardianFloatingTabBar';
import useNicoHeader from '../../hooks/useNicoHeader';
import MoreFiltersLink from '../../components/MoreFiltersLink';
import CountyFilterPill from '../../components/CountyFilterPill';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, SHADOW, FONT_SIZE, FONT_WEIGHT,
  BTN_SIZE, BTN_VARIANT, INPUT, BUTTERFLY_BORDER, BUTTERFLY_TILES, CARD_BTN_ALIGN,
  GRID_COLS, GRID_CARD_W, scale,
} from '../../constants/theme';

type Nav = NativeStackNavigationProp<GuardianNavParamList>;

const AVATAR_COLORS = [NICO.teal, NICO.orange, NICO.coral, NICO.pink, NICO.purple, NICO.primary];

const AGE_GROUPS     = ['Under 10', '10–14', '15–18', '19–25', '26–35', '36+'];
const GENDER_OPTIONS = ['Male', 'Female'];

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

type Status = 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'rejected';
type Tab = 'connected' | 'requests' | 'find';
type RequestsSubTab = 'sent' | 'received';

interface GuardianResult {
  guardianId: string;
  guardianName: string;
  guardianEmail: string;
  photoUrl: string;
  county: string;
  situationTags: string[];
  learnerName: string;
  learnerRegion: string;
  learnerDob: string | null;
  learnerGender: string;
  status: Status;
  connectionId: string | null;
  isRequester: boolean;
}

export default function GuardianConnectionsScreen() {
  const { guardian } = useAuth();
  const navigation = useNavigation<Nav>();
  useNicoHeader(navigation);

  const [activeTab, setActiveTab]               = useState<Tab>('connected');
  const [activeRequestsTab, setActiveRequestsTab] = useState<RequestsSubTab>('received');
  const [peekGuardian, setPeekGuardian]         = useState<GuardianResult | null>(null);
  const [situationTagOptions, setSituationTagOptions] = useState<string[]>([]);

  const [results, setResults]       = useState<GuardianResult[]>([]);
  const [loading, setLoading]       = useState(true);
  const [sending, setSending]       = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [unreadMap, setUnreadMap]   = useState<Record<string, number>>({});
  const [openingChat, setOpeningChat] = useState<string | null>(null);

  // My Connections search
  const [connectedSearchName, setConnectedSearchName] = useState('');
  const [connectedSearchCounty, setConnectedSearchCounty] = useState('');

  // Find tab search + filters
  const [searchName, setSearchName] = useState('');
  const [searchCounty, setSearchCounty] = useState('');
  const [filterAgeGroups, setFilterAgeGroups] = useState<string[]>([]);
  const [filterTags,      setFilterTags]      = useState<string[]>([]);
  const [filterGenders,   setFilterGenders]   = useState<string[]>([]);
  const [sheetOpen, setSheetOpen]             = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (guardian) {
        load(guardian.id);
        supabase.rpc('get_guardian_unread_counts', { p_guardian_id: guardian.id }).then(({ data }) => {
          const map: Record<string, number> = {};
          (data ?? []).forEach((r: any) => { map[r.other_guardian_id] = Number(r.unread_count); });
          setUnreadMap(map);
        });
      }
      supabase.from('medical_conditions').select('label').order('label').then(({ data }) => {
        if (data) setSituationTagOptions(data.map((r: any) => r.label));
      });
    }, [guardian]),
  );

  async function openChat(item: GuardianResult) {
    if (!guardian) return;
    setOpeningChat(item.guardianId);
    const { data: conversationId, error } = await supabase.rpc('find_or_create_guardian_conversation', {
      p_guardian_a: guardian.id, p_guardian_b: item.guardianId,
    });
    setOpeningChat(null);
    if (error || !conversationId) { Alert.alert('Chat error', error?.message ?? 'Failed to open chat'); return; }
    setUnreadMap(prev => ({ ...prev, [item.guardianId]: 0 }));
    navigation.navigate('GuardianChat', {
      conversationId, participantName: item.guardianName, participantPhoto: item.photoUrl || null,
    });
  }

  async function load(myId: string) {
    setLoading(true);

    const { data: guardians } = await supabase
      .from('guardians')
      .select('id, full_name, email, photo_url, county, situation_tags')
      .neq('id', myId);

    if (!guardians || guardians.length === 0) { setLoading(false); return; }

    const otherIds = guardians.map((g: any) => g.id);

    const [{ data: learners }, { data: connections }] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('id, name, date_of_birth, gender, region, guardian_id')
        .in('guardian_id', otherIds),
      supabase
        .from('guardian_connections')
        .select('id, requester_id, addressee_id, status')
        .or(`requester_id.eq.${myId},addressee_id.eq.${myId}`),
    ]);

    const learnerMap: Record<string, any> = {};
    (learners ?? []).forEach((l: any) => { if (!learnerMap[l.guardian_id]) learnerMap[l.guardian_id] = l; });

    function getStatus(otherId: string): { status: Status; connectionId: string | null; isRequester: boolean } {
      const c = (connections ?? []).find((r: any) =>
        (r.requester_id === myId && r.addressee_id === otherId) ||
        (r.addressee_id === myId && r.requester_id === otherId)
      );
      if (!c) return { status: 'none', connectionId: null, isRequester: false };
      const isRequester = c.requester_id === myId;
      if (c.status === 'accepted') return { status: 'accepted', connectionId: c.id, isRequester };
      if (c.status === 'rejected') return { status: 'rejected', connectionId: c.id, isRequester };
      return {
        status: isRequester ? 'pending_sent' : 'pending_received',
        connectionId: c.id,
        isRequester,
      };
    }

    const list: GuardianResult[] = guardians.map((g: any) => {
      const l = learnerMap[g.id];
      const { status, connectionId, isRequester } = getStatus(g.id);
      return {
        guardianId:    g.id,
        guardianName:  g.full_name ?? 'Unknown',
        guardianEmail: g.email ?? '',
        photoUrl:      g.photo_url ?? '',
        county:        g.county ?? '',
        situationTags: g.situation_tags ?? [],
        learnerName:   l?.name ?? '',
        learnerRegion: l?.region ?? '',
        learnerDob:    l?.date_of_birth ?? null,
        learnerGender: l?.gender ?? '',
        status,
        connectionId,
        isRequester,
      };
    });

    setResults(list);
    setLoading(false);
  }

  async function sendRequest(item: GuardianResult) {
    if (!guardian) return;
    setSending(item.guardianId);
    try {
      if (item.connectionId) {
        // Re-request after rejection: update existing row, flip requester direction
        const { error } = await supabase.from('guardian_connections')
          .update({ requester_id: guardian.id, addressee_id: item.guardianId, status: 'pending' })
          .eq('id', item.connectionId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from('guardian_connections')
          .insert({ requester_id: guardian.id, addressee_id: item.guardianId, status: 'pending' });
        if (error) throw new Error(error.message);
      }
      setResults(prev => prev.map(r =>
        r.guardianId === item.guardianId
          ? { ...r, status: 'pending_sent', isRequester: true }
          : r
      ));
      Alert.alert('Request sent!', `A connection request has been sent to ${item.guardianName}.`);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Something went wrong.');
    }
    setSending(null);
  }

  async function accept(item: GuardianResult) {
    if (!item.connectionId) return;
    setProcessing(item.guardianId);
    await supabase.from('guardian_connections').update({ status: 'accepted' }).eq('id', item.connectionId);
    setResults(prev => prev.map(r =>
      r.guardianId === item.guardianId ? { ...r, status: 'accepted' } : r
    ));
    setProcessing(null);
    Alert.alert('Connected!', `You are now connected with ${item.guardianName}.`);
  }

  async function decline(item: GuardianResult) {
    if (!item.connectionId) return;
    setProcessing(item.guardianId);
    await supabase.from('guardian_connections').update({ status: 'rejected' }).eq('id', item.connectionId);
    setResults(prev => prev.map(r =>
      r.guardianId === item.guardianId ? { ...r, status: 'rejected' } : r
    ));
    setProcessing(null);
  }

  async function disconnect(item: GuardianResult) {
    if (!item.connectionId) return;
    Alert.alert('Disconnect', `Remove connection with ${item.guardianName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect', style: 'destructive', onPress: async () => {
          setProcessing(item.guardianId);
          await supabase.from('guardian_connections').delete().eq('id', item.connectionId!);
          setResults(prev => prev.map(r =>
            r.guardianId === item.guardianId ? { ...r, status: 'none', connectionId: null, isRequester: false } : r
          ));
          setProcessing(null);
        },
      },
    ]);
  }

  function avatarColor(name: string) {
    return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  }

  // ── Derived lists ────────────────────────────────────────────────────────────

  const connected = useMemo(() => results.filter(r => r.status === 'accepted'), [results]);

  const filteredConnected = useMemo(() =>
    connected.filter(r => {
      const matchName = !connectedSearchName || r.guardianName.toLowerCase().includes(connectedSearchName.toLowerCase());
      const matchCounty = !connectedSearchCounty || r.county.toLowerCase().includes(connectedSearchCounty.toLowerCase());
      return matchName && matchCounty;
    }),
  [connected, connectedSearchName, connectedSearchCounty]);

  // All rows where current user sent the request (pending, accepted, rejected)
  const sentRequests = useMemo(() =>
    results.filter(r => r.isRequester && (r.status === 'pending_sent' || r.status === 'rejected')),
  [results]);

  // All rows where current user received a request and it's still pending
  const receivedRequests = useMemo(() =>
    results.filter(r => r.status === 'pending_received'),
  [results]);

  const discovered = useMemo(() =>
    results.filter(r => {
      if (r.status === 'accepted' || r.status === 'pending_sent' || r.status === 'pending_received') return false;
      // 'none' and 'rejected' are both discoverable (re-request allowed)
      const matchName   = !searchName || r.guardianName.toLowerCase().includes(searchName.toLowerCase());
      const matchCounty   = !searchCounty || r.county.toLowerCase().includes(searchCounty.toLowerCase());
      const matchAge    = filterAgeGroups.length === 0 || filterAgeGroups.includes(getAgeGroup(r.learnerDob) ?? '');
      const matchTags   = filterTags.length === 0 || filterTags.some(t => r.situationTags.includes(t));
      const matchGender = filterGenders.length === 0 || filterGenders.includes(r.learnerGender);
      return matchName && matchCounty && matchAge && matchTags && matchGender;
    }),
  [results, searchName, searchCounty, filterAgeGroups, filterTags, filterGenders]);

  // ── Pagination ───────────────────────────────────────────────────────────────

  const resetKeyConnected = `${connectedSearchName}|${connectedSearchCounty}|${connected.length}`;
  const { visible: visibleConnected, showLoadMore: showLoadMoreConnected, loadMore: loadMoreConnected, showCapMessage: showCapConnected, pageSize } =
    useVisibleCount(filteredConnected, resetKeyConnected);

  const resetKeyDiscover = `${searchName}|${searchCounty}|${filterAgeGroups.join(',')}|${filterTags.join(',')}|${filterGenders.join(',')}`;
  const { visible: visibleDiscovered, showLoadMore: showLoadMoreDiscovered, loadMore: loadMoreDiscovered, showCapMessage: showCapDiscovered, pageSize: pageSizeDiscover } =
    useVisibleCount(discovered, resetKeyDiscover);

  const hasFindMore = filterAgeGroups.length + filterTags.length + filterGenders.length > 0;

  // ── Card renderers ───────────────────────────────────────────────────────────

  function renderConnectedCard(item: GuardianResult, index: number) {
    const tileBg = BUTTERFLY_TILES[index % BUTTERFLY_TILES.length].bg;
    return (
      <TouchableOpacity key={item.guardianId} style={[s.gridCard, { backgroundColor: tileBg, borderColor: 'transparent' }]} activeOpacity={0.75} onPress={() => setPeekGuardian(item)}>
        <View style={[s.gridAvatar, { backgroundColor: avatarColor(item.guardianName) }]}>
          <AppText style={s.gridAvatarInitial}>{item.guardianName[0]?.toUpperCase()}</AppText>
        </View>
        <AppText style={s.gridName} numberOfLines={1}>{item.guardianName}</AppText>
        {item.county ? <AppText style={s.gridCounty} numberOfLines={1}>{item.county}</AppText> : null}
        <View style={s.gridAction}>
          {processing === item.guardianId ? (
            <ActivityIndicator color={NICO.primary} />
          ) : (
            <View style={s.gridTwoBtn}>
              <TouchableOpacity
                style={[s.gridHalfBtn, { backgroundColor: NICO.primaryLight, borderWidth: 1.5, borderColor: NICO.primary }]}
                onPress={(e) => { e.stopPropagation(); openChat(item); }}
                disabled={openingChat === item.guardianId}
                activeOpacity={0.7}
              >
                {openingChat === item.guardianId ? (
                  <ActivityIndicator size="small" color={NICO.primary} />
                ) : (
                  <AppText style={[s.gridHalfBtnTxt, { color: NICO.primary }]}>💬</AppText>
                )}
                {!!unreadMap[item.guardianId] && (
                  <View style={s.messageBadge}>
                    <AppText style={s.messageBadgeTxt}>{unreadMap[item.guardianId] > 9 ? '9+' : unreadMap[item.guardianId]}</AppText>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={s.disconnectBtn}
                onPress={(e) => { e.stopPropagation(); disconnect(item); }}
                activeOpacity={0.7}
              >
                <AppText style={s.disconnectIcon}>✕</AppText>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  function renderSentCard(item: GuardianResult, index: number) {
    const tileBg = BUTTERFLY_TILES[index % BUTTERFLY_TILES.length].bg;
    const badge =
      item.status === 'accepted'     ? { label: 'Connected',  style: s.badgeAccepted,  textStyle: s.badgeAcceptedTxt  } :
      item.status === 'rejected'     ? { label: 'Rejected',   style: s.badgeRejected,  textStyle: s.badgeRejectedTxt  } :
      /* pending_sent */               { label: 'Pending',    style: s.badgePending,   textStyle: s.badgePendingTxt   };
    return (
      <TouchableOpacity key={item.guardianId} style={[s.gridCard, { backgroundColor: tileBg, borderColor: 'transparent' }]} activeOpacity={0.75} onPress={() => setPeekGuardian(item)}>
        <View style={[s.gridAvatar, { backgroundColor: avatarColor(item.guardianName) }]}>
          <AppText style={s.gridAvatarInitial}>{item.guardianName[0]?.toUpperCase()}</AppText>
        </View>
        <AppText style={s.gridName} numberOfLines={1}>{item.guardianName}</AppText>
        {item.county ? <AppText style={s.gridCounty} numberOfLines={1}>{item.county}</AppText> : null}
        <View style={s.gridAction}>
          <View style={badge.style}>
            <AppText style={badge.textStyle}>{badge.label}</AppText>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  function renderReceivedCard(item: GuardianResult, index: number) {
    const tileBg = BUTTERFLY_TILES[index % BUTTERFLY_TILES.length].bg;
    const isProcessing = processing === item.guardianId;
    return (
      <TouchableOpacity key={item.guardianId} style={[s.gridCard, { backgroundColor: tileBg, borderColor: 'transparent' }]} activeOpacity={0.75} onPress={() => setPeekGuardian(item)}>
        <View style={[s.gridAvatar, { backgroundColor: avatarColor(item.guardianName) }]}>
          <AppText style={s.gridAvatarInitial}>{item.guardianName[0]?.toUpperCase()}</AppText>
        </View>
        <AppText style={s.gridName} numberOfLines={1}>{item.guardianName}</AppText>
        {item.county ? <AppText style={s.gridCounty} numberOfLines={1}>{item.county}</AppText> : null}
        <AppText style={s.gridPendingLabel}>Wants to connect</AppText>
        <View style={s.gridAction}>
          {isProcessing ? (
            <ActivityIndicator color={NICO.primary} />
          ) : (
            <View style={s.gridTwoBtn}>
              <TouchableOpacity style={[s.gridHalfBtn, { backgroundColor: NICO.successLight, borderWidth: 1.5, borderColor: NICO.success }]} onPress={() => accept(item)}>
                <AppText style={[s.gridHalfBtnTxt, { color: NICO.success }]}>✓</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={[s.gridHalfBtn, { backgroundColor: NICO.errorLight, borderWidth: 1.5, borderColor: NICO.error }]} onPress={() => decline(item)}>
                <AppText style={[s.gridHalfBtnTxt, { color: NICO.error }]}>✕</AppText>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  function renderDiscoverCard(item: GuardianResult, index: number) {
    const tileBg = BUTTERFLY_TILES[index % BUTTERFLY_TILES.length].bg;
    const isProcessing = processing === item.guardianId;
    const isSending    = sending === item.guardianId;
    return (
      <TouchableOpacity key={item.guardianId} style={[s.gridCard, { backgroundColor: tileBg, borderColor: 'transparent' }]} activeOpacity={0.75} onPress={() => setPeekGuardian(item)}>
        <View style={[s.gridAvatar, { backgroundColor: avatarColor(item.guardianName) }]}>
          <AppText style={s.gridAvatarInitial}>{item.guardianName[0]?.toUpperCase()}</AppText>
        </View>
        <AppText style={s.gridName} numberOfLines={1}>{item.guardianName}</AppText>
        {item.county ? <AppText style={s.gridCounty} numberOfLines={1}>{item.county}</AppText> : null}
        <View style={s.gridAction}>
          {isProcessing || isSending ? (
            <ActivityIndicator color={NICO.primary} />
          ) : (
            <TouchableOpacity style={s.gridConnectBtn} onPress={(e) => { e.stopPropagation(); sendRequest(item); }} activeOpacity={0.8}>
              <AppText style={s.gridConnectIcon}>🤝</AppText>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={s.container}>
      <RainbowDivider />

      {/* Tab bar */}
      <View style={s.tabBar}>
        {(['connected', 'requests', 'find'] as Tab[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[s.tab, activeTab === tab && s.tabActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.8}
          >
            <AppText style={[s.tabTxt, activeTab === tab && s.tabTxtActive]}>
              {tab === 'connected' ? 'My Connections' : tab === 'requests' ? 'Requests' : 'Find'}
            </AppText>
            {tab === 'requests' && receivedRequests.length > 0 && (
              <View style={s.tabBadge}>
                <AppText style={s.tabBadgeTxt}>{receivedRequests.length > 9 ? '9+' : receivedRequests.length}</AppText>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={NICO.primary} /></View>

      ) : activeTab === 'connected' ? (
        /* ── My Connections tab ──────────────────────────────────────────── */
        <View style={s.tabPane}>
          <View style={s.searchRow}>
            <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={s.searchGradient}>
              <TextInput
                style={s.searchInput}
                value={connectedSearchName}
                onChangeText={setConnectedSearchName}
                placeholder="Search by name…"
                placeholderTextColor={NICO.textMuted}
                clearButtonMode="while-editing"
              />
            </LinearGradient>
            <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={s.searchGradient}>
              <CountyFilterPill value={connectedSearchCounty} onSelect={setConnectedSearchCounty} placeholder="Search by county…" />
            </LinearGradient>
          </View>

          <ScrollView contentContainerStyle={s.list}>
            {connected.length === 0 ? (
              <View style={s.empty}>
                <AppText style={s.emptyEmoji}>🤝</AppText>
                <AppText style={s.emptyText}>No connections yet</AppText>
                <AppText style={s.emptyHint}>Connect with other guardians who share similar experiences.</AppText>
                <TouchableOpacity style={s.emptyBtn} onPress={() => setActiveTab('find')} activeOpacity={0.8}>
                  <AppText style={s.emptyBtnTxt}>Find Guardians</AppText>
                </TouchableOpacity>
              </View>
            ) : filteredConnected.length === 0 ? (
              <View style={s.empty}>
                <AppText style={s.emptyEmoji}>🔍</AppText>
                <AppText style={s.emptyText}>No matches</AppText>
                <AppText style={s.emptyHint}>Try a different name or county</AppText>
              </View>
            ) : (
              <>
                <View style={s.gridWrap}>
                  {visibleConnected.map((item, index) => renderConnectedCard(item, index))}
                </View>
                {showLoadMoreConnected && (
                  <TouchableOpacity style={s.loadMoreBtn} onPress={loadMoreConnected} activeOpacity={0.7}>
                    <AppText style={s.loadMoreText}>Load {pageSize} more</AppText>
                  </TouchableOpacity>
                )}
                {showCapConnected && (
                  <View style={s.capMessage}>
                    <AppText style={s.capMessageText}>Use filters to search records</AppText>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>

      ) : activeTab === 'requests' ? (
        /* ── Requests tab ────────────────────────────────────────────────── */
        <View style={s.tabPane}>
          {/* Sub-tab bar */}
          <View style={s.subTabBar}>
            {([
              { key: 'received', label: 'Received', count: receivedRequests.length },
              { key: 'sent',     label: 'Sent',     count: sentRequests.length },
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
                      style={[s.subTabInner, key === 'received' && s.subTabInnerWide, isActive && s.subTabInnerActive]}
                      onPress={() => setActiveRequestsTab(key)}
                      activeOpacity={0.8}
                    >
                      <AppText style={[s.subTabTxt, isActive && s.subTabTxtActive]}>
                        {label}
                      </AppText>
                      {key === 'received' && count > 0 && (
                        <View style={s.subTabBadge}>
                          <AppText style={s.tabBadgeTxt}>{count > 9 ? '9+' : count}</AppText>
                        </View>
                      )}
                    </TouchableOpacity>
                  </LinearGradient>
                </View>
              );
            })}
          </View>

          {activeRequestsTab === 'sent' ? (
            <ScrollView contentContainerStyle={s.list}>
              {sentRequests.length === 0 ? (
                <View style={s.empty}>
                  <AppText style={s.emptyEmoji}>📤</AppText>
                  <AppText style={s.emptyText}>No sent requests</AppText>
                  <AppText style={s.emptyHint}>Requests you send will appear here.</AppText>
                </View>
              ) : (
                <View style={s.gridWrap}>
                  {sentRequests.map((item, index) => renderSentCard(item, index))}
                </View>
              )}
            </ScrollView>
          ) : (
            <ScrollView contentContainerStyle={s.list}>
              {receivedRequests.length === 0 ? (
                <View style={s.empty}>
                  <AppText style={s.emptyText}>No pending requests</AppText>
                  <AppText style={s.emptyHint}>Connection requests from others will appear here.</AppText>
                </View>
              ) : (
                <View style={s.gridWrap}>
                  {receivedRequests.map((item, index) => renderReceivedCard(item, index))}
                </View>
              )}
            </ScrollView>
          )}
        </View>

      ) : (
        /* ── Find tab ────────────────────────────────────────────────────── */
        <View style={s.tabPane}>
          <View style={s.searchRow}>
            <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={s.searchGradient}>
              <TextInput
                style={s.searchInput}
                value={searchName}
                onChangeText={setSearchName}
                placeholder="Search by guardian name…"
                placeholderTextColor={NICO.textMuted}
                clearButtonMode="while-editing"
              />
            </LinearGradient>
            <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={s.searchGradient}>
              <CountyFilterPill value={searchCounty} onSelect={setSearchCounty} placeholder="Search by county…" />
            </LinearGradient>
          </View>

          <View style={s.filterBar}>
            <AppText style={s.resultCount}>{discovered.length} result{discovered.length !== 1 ? 's' : ''}</AppText>
            <MoreFiltersLink onPress={() => setSheetOpen(true)} isActive={hasFindMore} />
          </View>

          <FlatList
            data={visibleDiscovered}
            keyExtractor={r => r.guardianId}
            numColumns={GRID_COLS}
            key={String(GRID_COLS)}
            columnWrapperStyle={s.gridRow}
            contentContainerStyle={s.gridList}
            renderItem={({ item, index }) => renderDiscoverCard(item, index)}
            ListFooterComponent={
              showLoadMoreDiscovered ? (
                <TouchableOpacity style={s.loadMoreBtn} onPress={loadMoreDiscovered} activeOpacity={0.7}>
                  <AppText style={s.loadMoreText}>Load {pageSizeDiscover} more</AppText>
                </TouchableOpacity>
              ) : showCapDiscovered ? (
                <View style={s.capMessage}>
                  <AppText style={s.capMessageText}>Use filters to search records</AppText>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={s.empty}>
                <AppText style={s.emptyEmoji}>🔍</AppText>
                <AppText style={s.emptyText}>No guardians found</AppText>
                <AppText style={s.emptyHint}>Try adjusting your search or filters</AppText>
              </View>
            }
          />

          <FilterSheet
            visible={sheetOpen}
            title="More Filters"
            sections={[
              {
                key: 'situation', emoji: '🎯', title: 'Learner Situation',
                options: situationTagOptions.map(t => ({ key: t, label: t })),
                selected: filterTags,
                onToggle: v => setFilterTags(prev => toggle(prev, v)),
              },
              {
                key: 'age', emoji: '👤', title: 'Learner Age',
                options: AGE_GROUPS.map(g => ({ key: g, label: g })),
                selected: filterAgeGroups,
                onToggle: v => setFilterAgeGroups(prev => toggle(prev, v)),
              },
              {
                key: 'gender', emoji: '⚧', title: 'Learner Gender',
                options: GENDER_OPTIONS.map(g => ({ key: g, label: g })),
                selected: filterGenders,
                onToggle: v => setFilterGenders(prev => toggle(prev, v)),
              },
            ] satisfies FilterSheetSection[]}
            onClearAll={() => { setFilterAgeGroups([]); setFilterTags([]); setFilterGenders([]); }}
            onDone={() => setSheetOpen(false)}
          />
        </View>
      )}

      {/* Quick-look modal */}
      <Modal visible={!!peekGuardian} transparent animationType="slide" onRequestClose={() => setPeekGuardian(null)}>
        <TouchableOpacity style={s.sheetBackdrop} activeOpacity={1} onPress={() => setPeekGuardian(null)}>
          {peekGuardian && (
            <View style={s.peekSheet} onStartShouldSetResponder={() => true}>
              <View style={s.peekHandle} />

              <View style={s.peekHeader}>
                {peekGuardian.photoUrl ? (
                  <Image source={{ uri: peekGuardian.photoUrl }} style={s.peekPhoto} />
                ) : (
                  <View style={[s.peekPhoto, s.peekPhotoFallback, { backgroundColor: avatarColor(peekGuardian.guardianName) }]}>
                    <AppText style={s.peekInitial}>{peekGuardian.guardianName[0]?.toUpperCase()}</AppText>
                  </View>
                )}
                <View style={s.peekHeaderInfo}>
                  <AppText style={s.peekName}>{peekGuardian.guardianName}</AppText>
                  {peekGuardian.county ? <AppText style={s.peekCounty}>📍 {peekGuardian.county}</AppText> : null}
                </View>
              </View>

              {peekGuardian.learnerName ? (
                <View style={s.peekSection}>
                  <AppText style={s.peekSectionLabel}>Learner</AppText>
                  <AppText style={s.peekLearnerName}>{peekGuardian.learnerName}</AppText>
                  <AppText style={s.peekLearnerMeta}>
                    {[
                      peekGuardian.learnerDob ? `${calcAge(peekGuardian.learnerDob) ?? '—'} yrs` : null,
                      peekGuardian.learnerGender || null,
                    ].filter(Boolean).join('  ·  ')}
                  </AppText>
                </View>
              ) : null}

              {peekGuardian.situationTags.length > 0 ? (
                <View style={s.peekSection}>
                  <AppText style={s.peekSectionLabel}>Learner Situation</AppText>
                  <View style={s.peekTagWrap}>
                    {peekGuardian.situationTags.map(tag => (
                      <View key={tag} style={s.peekTag}>
                        <AppText style={s.peekTagTxt}>{tag}</AppText>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={s.peekActions}>
                {peekGuardian.status === 'accepted' ? (
                  <View style={[s.peekActionBtn, { backgroundColor: NICO.successLight }]}>
                    <AppText style={[s.peekActionTxt, { color: NICO.success }]}>✓ Connected</AppText>
                  </View>
                ) : peekGuardian.status === 'pending_sent' ? (
                  <View style={[s.peekActionBtn, { backgroundColor: NICO.background }]}>
                    <AppText style={[s.peekActionTxt, { color: NICO.textMuted }]}>Request Sent</AppText>
                  </View>
                ) : peekGuardian.status === 'pending_received' ? (
                  <View style={{ flexDirection: 'row', gap: SPACING.md }}>
                    <TouchableOpacity style={[s.peekActionBtn, { flex: 1, backgroundColor: NICO.primary }]} onPress={() => { accept(peekGuardian); setPeekGuardian(null); }} activeOpacity={0.85}>
                      <AppText style={[s.peekActionTxt, { color: NICO.textOnAccent }]}>✓ Accept</AppText>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.peekActionBtn, { flex: 1, backgroundColor: NICO.errorLight }]} onPress={() => { decline(peekGuardian); setPeekGuardian(null); }} activeOpacity={0.85}>
                      <AppText style={[s.peekActionTxt, { color: NICO.error }]}>✕ Decline</AppText>
                    </TouchableOpacity>
                  </View>
                ) : peekGuardian.status === 'rejected' ? (
                  <TouchableOpacity style={[s.peekActionBtn, { backgroundColor: NICO.primary }]} onPress={() => { sendRequest(peekGuardian); setPeekGuardian(null); }} activeOpacity={0.85}>
                    <AppText style={[s.peekActionTxt, { color: NICO.textOnAccent }]}>Send Request Again</AppText>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={[s.peekActionBtn, { backgroundColor: NICO.primary }]} onPress={() => { sendRequest(peekGuardian); setPeekGuardian(null); }} activeOpacity={0.85}>
                    <AppText style={[s.peekActionTxt, { color: NICO.textOnAccent }]}>Connect</AppText>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </TouchableOpacity>
      </Modal>
      <GuardianFloatingTabBar />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: NICO.screenBg },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
  tabPane:   { flex: 1, backgroundColor: NICO.screenBg },

  // Primary tab bar
  tabBar: {
    flexDirection: 'row', backgroundColor: NICO.surface,
    borderBottomWidth: 1, borderBottomColor: NICO.border,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: SPACING.md, gap: SPACING.xs,
    borderBottomWidth: 2.5, borderBottomColor: 'transparent',
  },
  tabActive:    { borderBottomColor: NICO.primary },
  tabTxt:       { ...TEXT_STYLE.tabLabel },
  tabTxtActive: { ...TEXT_STYLE.tabLabel, color: NICO.primary, fontWeight: FONT_WEIGHT.extraBold },
  tabBadge: {
    backgroundColor: NICO.error, borderRadius: RADIUS.full,
    minWidth: scale(16), height: scale(16), paddingHorizontal: 3,
    justifyContent: 'center', alignItems: 'center',
  },
  tabBadgeTxt: { fontSize: scale(9), fontWeight: FONT_WEIGHT.extraBold, color: '#fff' },

  // Secondary (Requests) sub-tab bar
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
    position: 'relative',
  },
  // Wider than the default pill — only the "Received" sub-tab gets this.
  subTabInnerWide: { paddingHorizontal: SPACING['2xl'] },
  subTabBadge: {
    position: 'absolute', top: 2, right: 2,
    backgroundColor: NICO.error, borderRadius: RADIUS.full,
    minWidth: scale(16), height: scale(16), paddingHorizontal: 3,
    justifyContent: 'center', alignItems: 'center',
  },
  subTabInnerActive: { backgroundColor: NICO.primaryLight },
  subTabTxt:         { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semiBold, color: NICO.textMuted },
  subTabTxtActive:   { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.extraBold, color: NICO.primary },

  sectionHeader: {
    ...TEXT_STYLE.labelSmall, textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: SPACING.sm, marginTop: SPACING.xs,
  },

  // Search row
  searchRow: { padding: SPACING.base, gap: SPACING.sm, backgroundColor: NICO.screenBg },
  searchGradient: {
    padding: BUTTERFLY_BORDER.width,
    borderRadius: RADIUS.md + BUTTERFLY_BORDER.width,
  },
  searchInput: { ...INPUT.base, borderWidth: 0 },

  // Filter bar (Find tab)
  filterBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.base, paddingBottom: SPACING.sm,
    backgroundColor: NICO.screenBg,
  },
  resultCount:     { ...TEXT_STYLE.caption, color: NICO.textMuted },
  moreBtnGradient: { padding: BUTTERFLY_BORDER.width, borderRadius: RADIUS.full },
  moreBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.base, paddingVertical: SPACING.xs,
    backgroundColor: NICO.screenBg,
  },
  moreBtnActive:     { backgroundColor: NICO.primaryLight },
  moreBtnText:       { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.medium, color: NICO.textMuted },
  moreBtnTextActive: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semiBold, color: NICO.primary },

  list:     { padding: SPACING.base, gap: SPACING.sm, paddingBottom: SPACING['2xl'] },
  gridList: { padding: SPACING.base, paddingBottom: SPACING['2xl'] },
  gridRow:  { gap: SPACING.sm, marginBottom: SPACING.sm },

  // Shared grid card
  gridCard: {
    width: GRID_CARD_W,
    backgroundColor: 'white', borderRadius: RADIUS.xl, padding: SPACING.base,
    borderWidth: 1, borderColor: NICO.border,
    alignItems: 'center', gap: SPACING.xs,
    ...SHADOW.md,
  },
gridAvatar:        { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.xs },
  gridAvatarInitial: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.extraBold, color: 'white' },
  gridName:          { ...TEXT_STYLE.bodyMedium, textAlign: 'center' as const },
  gridCounty:          { ...TEXT_STYLE.caption, textAlign: 'center' as const },
  gridPendingLabel:  { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semiBold, color: NICO.primary },
  gridAction:        { width: '100%', alignItems: 'center', marginTop: SPACING.xs },
  gridConnectBtn: {
    width: scale(44), height: scale(44), borderRadius: RADIUS.full,
    backgroundColor: NICO.primaryLight, borderWidth: 1.5, borderColor: NICO.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  gridConnectIcon: { fontSize: scale(22) },
  gridTwoBtn:      { flexDirection: 'row' as const, gap: SPACING.xs, width: '100%' },
  gridHalfBtn: {
    flex: 1, borderRadius: RADIUS.lg,
    paddingVertical: SPACING.sm, alignItems: 'center' as const,
  },
  gridHalfBtnTxt: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.extraBold },
  gridWrap:        { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: SPACING.sm },

  // Sent request status badges
  badgeAccepted:    { backgroundColor: NICO.successLight, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs },
  badgeAcceptedTxt: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, color: NICO.success },
  badgeRejected:    { backgroundColor: NICO.errorLight, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs },
  badgeRejectedTxt: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, color: NICO.error },
  badgePending:     { backgroundColor: NICO.background, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs },
  badgePendingTxt:  { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semiBold, color: NICO.textMuted },

  disconnectBtn:  { width: scale(32), height: scale(32), borderRadius: RADIUS.full, backgroundColor: NICO.errorLight, borderWidth: 1.5, borderColor: NICO.error, justifyContent: 'center', alignItems: 'center' },
  disconnectIcon: { fontSize: scale(FONT_SIZE.sm), color: NICO.error, fontWeight: FONT_WEIGHT.bold },
  messageBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: NICO.error, borderRadius: RADIUS.full,
    minWidth: scale(16), height: scale(16), paddingHorizontal: 3,
    justifyContent: 'center', alignItems: 'center',
  },
  messageBadgeTxt: { fontSize: scale(9), fontWeight: FONT_WEIGHT.extraBold, color: '#fff' },

  loadMoreBtn:    { ...BTN_SIZE.sm, ...BTN_VARIANT.outline, alignSelf: 'center', marginTop: SPACING.base },
  loadMoreText:   { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extraBold, color: NICO.primary },
  capMessage:     { alignItems: 'center', paddingVertical: SPACING.base },
  capMessageText: { ...TEXT_STYLE.hint, fontStyle: 'italic' },

  empty:       { alignItems: 'center', paddingTop: 60, gap: SPACING.md },
  emptyEmoji:  { fontSize: 56 },
  emptyText:   { ...TEXT_STYLE.cardTitle },
  emptyHint:   { ...TEXT_STYLE.screenHint, textAlign: 'center', paddingHorizontal: SPACING['2xl'] },
  emptyBtn:    { ...BTN_SIZE.md, ...BTN_VARIANT.primary, marginTop: SPACING.sm },
  emptyBtnTxt: { ...TEXT_STYLE.buttonSmall },

  // Quick-look sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  peekSheet: {
    backgroundColor: NICO.screenBg, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    maxHeight: '80%', paddingBottom: SPACING.xl,
  },
  peekHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: NICO.border,
    alignSelf: 'center', marginTop: SPACING.md, marginBottom: SPACING.xs,
  },
  peekHeader: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.base,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.base,
    borderBottomWidth: 1, borderBottomColor: NICO.border,
  },
  peekPhoto:         { width: 72, height: 72, borderRadius: 36 },
  peekPhotoFallback: { justifyContent: 'center', alignItems: 'center' },
  peekInitial:       { fontSize: 28, fontWeight: FONT_WEIGHT.extraBold, color: 'white' },
  peekHeaderInfo:    { flex: 1, gap: SPACING.xs },
  peekName:          { ...TEXT_STYLE.cardTitle },
  peekCounty:          { ...TEXT_STYLE.caption },

  peekSection:      { paddingHorizontal: SPACING.lg, paddingTop: SPACING.base, gap: SPACING.xs },
  peekSectionLabel: { ...TEXT_STYLE.labelSmall, textTransform: 'uppercase', letterSpacing: 0.7 },
  peekLearnerName:  { ...TEXT_STYLE.bodyMedium, fontWeight: FONT_WEIGHT.bold },
  peekLearnerMeta:  { ...TEXT_STYLE.caption },
  peekTagWrap:      { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  peekTag: {
    backgroundColor: NICO.background, borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
    borderWidth: 1, borderColor: NICO.border,
  },
  peekTagTxt:    { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semiBold, color: NICO.text },
  peekActions:   { paddingHorizontal: SPACING.lg, paddingTop: SPACING.base },
  peekActionBtn: { borderRadius: RADIUS.xl, paddingVertical: SPACING.base, alignItems: 'center' },
  peekActionTxt: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.extraBold },
});
