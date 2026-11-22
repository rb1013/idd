import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import { GuardianNavParamList } from '../../navigation';
import { useVisibleCount } from '../../hooks/useVisibleCount';
import FilterSheet, { FilterSheetSection } from '../../components/FilterSheet';
import RainbowDivider from '../../components/RainbowDivider';
import GuardianFloatingTabBar from '../../components/GuardianFloatingTabBar';
import useNicoHeader from '../../hooks/useNicoHeader';
import MoreFiltersLink from '../../components/MoreFiltersLink';
import ReportFlag from '../../components/ReportFlag';
import BlockButton from '../../components/BlockButton';
import { unblockGuardian } from '../../lib/blocking';
import ActiveFilterChips from '../../components/ActiveFilterChips';
import CountyFilterPill from '../../components/CountyFilterPill';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, SHADOW, FONT_SIZE, FONT_WEIGHT,
  BTN_SIZE, BTN_VARIANT, INPUT, BUTTERFLY_BORDER, BUTTERFLY_TILES, CARD_BTN_ALIGN,
  scale,
} from '../../constants/theme';

type Nav = NativeStackNavigationProp<GuardianNavParamList>;

const AVATAR_COLORS = [NICO.teal, NICO.orange, NICO.coral, NICO.pink, NICO.purple, NICO.primary];

function toggle<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
}

type Status = 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'rejected';
type Tab = 'connected' | 'requests' | 'find' | 'blocked';

interface BlockedGuardian { guardianId: string; name: string; photoUrl: string | null; county: string }
type RequestsSubTab = 'sent' | 'received';

interface GuardianResult {
  guardianId: string;
  guardianName: string;
  photoUrl: string;
  county: string;
  situationTags: string[];
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
  const [situationTagOptions, setSituationTagOptions] = useState<string[]>([]);

  const [results, setResults]       = useState<GuardianResult[]>([]);
  const [loading, setLoading]       = useState(true);
  const loadedRef = useRef(false);   // set after the first load; later loads refresh without a spinner
  const [sending, setSending]       = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [unreadMap, setUnreadMap]   = useState<Record<string, number>>({});
  const [openingChat, setOpeningChat] = useState<string | null>(null);
  const [blockedGuardians, setBlockedGuardians] = useState<BlockedGuardian[]>([]);
  // Guardian whose chat was most recently opened — the next unread-count
  // refetch forces this entry to 0 so a racy stale server read (see
  // mark_guardian_conversation_read's unmount-time call) can't clobber a
  // badge we already know is cleared.
  const recentChatGuardianRef = useRef<string | null>(null);

  // My Connections search
  const [connectedSearchName, setConnectedSearchName] = useState('');
  const [connectedSearchCounty, setConnectedSearchCounty] = useState('');
  const [connectedFilterTags, setConnectedFilterTags] = useState<string[]>([]);
  const [connectedSheetOpen, setConnectedSheetOpen] = useState(false);

  // Find tab search + filters
  const [searchName, setSearchName] = useState('');
  const [searchCounty, setSearchCounty] = useState('');
  const [filterTags,      setFilterTags]      = useState<string[]>([]);
  const [sheetOpen, setSheetOpen]             = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (guardian) {
        load(guardian.id);
        loadBlocked();
        supabase.rpc('get_guardian_unread_counts', { p_guardian_id: guardian.id }).then(({ data }) => {
          const map: Record<string, number> = {};
          (data ?? []).forEach((r: any) => { map[r.other_guardian_id] = Number(r.unread_count); });
          if (recentChatGuardianRef.current) {
            map[recentChatGuardianRef.current] = 0;
            recentChatGuardianRef.current = null;
          }
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
    recentChatGuardianRef.current = item.guardianId;
    navigation.navigate('GuardianChat', {
      conversationId, participantName: item.guardianName, participantPhoto: item.photoUrl || null,
      participantId: item.guardianId,   // needed for 🚫 in the chat header
    });
  }

  // Blocked tab: guardians I blocked. Their profiles are hidden from me (migration 088), so this
  // comes from get_my_blocked_guardians() (migration 089), which only returns my own blocks.
  async function loadBlocked() {
    const { data } = await supabase.rpc('get_my_blocked_guardians');
    setBlockedGuardians((data ?? []).map((b: any) => ({
      guardianId: b.guardian_id, name: b.full_name ?? 'Unknown', photoUrl: b.photo_url ?? null, county: b.county ?? '',
    })));
  }

  // After blocking from a card: the database removed the connection / requests, so drop the card now
  function onGuardianBlocked(guardianId: string) {
    setResults(prev => prev.filter(r => r.guardianId !== guardianId));
    loadBlocked();
  }

  async function unblock(b: BlockedGuardian) {
    if (!(await unblockGuardian(b.guardianId, b.name))) return;
    setBlockedGuardians(prev => prev.filter(x => x.guardianId !== b.guardianId));
    if (guardian) load(guardian.id);   // they reappear in Find (not reconnected)
  }

  async function load(myId: string) {
    // Spinner only on the first load; on return visits (e.g. back from a chat) keep the list on
    // screen — same tab, filters and scroll — and refresh it quietly
    if (!loadedRef.current) setLoading(true);

    // Guardian search uses only the guardian's own details — no learner data from other families.
    // The two requests don't depend on each other, so they run in parallel (one round trip).
    const [{ data: guardians }, { data: connections }] = await Promise.all([
      supabase
        .from('guardians')
        .select('id, full_name, photo_url, county, situation_tags')   // no email: other guardians' emails are never needed
        .neq('id', myId),
      supabase
        .from('guardian_connections')
        .select('id, requester_id, addressee_id, status')
        .or(`requester_id.eq.${myId},addressee_id.eq.${myId}`),
    ]);

    if (!guardians || guardians.length === 0) { setResults([]); loadedRef.current = true; setLoading(false); return; }

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
      const { status, connectionId, isRequester } = getStatus(g.id);
      return {
        guardianId:    g.id,
        guardianName:  g.full_name ?? 'Unknown',
        photoUrl:      g.photo_url ?? '',
        county:        g.county ?? '',
        situationTags: g.situation_tags ?? [],
        status,
        connectionId,
        isRequester,
      };
    });

    setResults(list);
    loadedRef.current = true;
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
      const matchTags = connectedFilterTags.length === 0 || connectedFilterTags.some(t => r.situationTags.includes(t));
      return matchName && matchCounty && matchTags;
    }),
  [connected, connectedSearchName, connectedSearchCounty, connectedFilterTags]);

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
      const matchTags   = filterTags.length === 0 || filterTags.some(t => r.situationTags.includes(t));
      return matchName && matchCounty && matchTags;
    }),
  [results, searchName, searchCounty, filterTags]);

  // ── Pagination ───────────────────────────────────────────────────────────────

  const resetKeyConnected = `${connectedSearchName}|${connectedSearchCounty}|${connectedFilterTags.join(',')}|${connected.length}`;
  const hasConnectedMore = connectedFilterTags.length > 0;
  const { visible: visibleConnected, showLoadMore: showLoadMoreConnected, loadMore: loadMoreConnected, showCapMessage: showCapConnected, pageSize } =
    useVisibleCount(filteredConnected, resetKeyConnected);

  const resetKeyDiscover = `${searchName}|${searchCounty}|${filterTags.join(',')}`;
  const { visible: visibleDiscovered, showLoadMore: showLoadMoreDiscovered, loadMore: loadMoreDiscovered, showCapMessage: showCapDiscovered, pageSize: pageSizeDiscover } =
    useVisibleCount(discovered, resetKeyDiscover);

  const hasFindMore = filterTags.length > 0;

  // ── Card renderers ───────────────────────────────────────────────────────────

  function renderConnectedCard(item: GuardianResult, index: number) {
    const tileBg = BUTTERFLY_TILES[index % BUTTERFLY_TILES.length].bg;
    return (
      <View key={item.guardianId} style={[s.connectionCard, { backgroundColor: tileBg, borderColor: 'transparent' }]}>
        <View style={s.connectionRow}>
          {item.photoUrl ? (
            <Image source={{ uri: item.photoUrl }} style={s.connectionAvatar} />
          ) : (
            <View style={[s.connectionAvatar, s.connectionAvatarFallback, { backgroundColor: avatarColor(item.guardianName) }]}>
              <AppText style={s.connectionAvatarInitial}>{item.guardianName[0]?.toUpperCase()}</AppText>
            </View>
          )}
          <View style={s.connectionInfo}>
            <AppText style={s.connectionName} numberOfLines={1}>{item.guardianName}</AppText>
            {item.county ? <AppText style={s.connectionCounty} numberOfLines={1}>{item.county}</AppText> : null}
          </View>
          {processing === item.guardianId ? (
            <ActivityIndicator color={NICO.primary} />
          ) : (
            // 4 icons → two rows (decision 10a): 💬 ✕ on top, 🚩 🚫 below
            <View style={s.actionsColumn}>
            <View style={s.connectionActions}>
              <TouchableOpacity
                style={s.connectionMsgBtn}
                onPress={() => openChat(item)}
                disabled={openingChat === item.guardianId}
                activeOpacity={0.7}
              >
                {openingChat === item.guardianId ? (
                  <ActivityIndicator size="small" color={NICO.primary} />
                ) : (
                  <AppText style={s.connectionMsgIcon}>💬</AppText>
                )}
                {!!unreadMap[item.guardianId] && (
                  <View style={s.messageBadge}>
                    <AppText style={s.messageBadgeTxt}>{unreadMap[item.guardianId] > 9 ? '9+' : unreadMap[item.guardianId]}</AppText>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={s.disconnectBtn}
                onPress={() => disconnect(item)}
                activeOpacity={0.7}
              >
                <AppText style={s.disconnectIcon}>✕</AppText>
              </TouchableOpacity>
            </View>
            {item.guardianId !== guardian?.id && (
              <View style={s.connectionActions}>
                <ReportFlag target={{ area: 'guardian_profile', guardianId: item.guardianId }} />
                <BlockButton guardianId={item.guardianId} guardianName={item.guardianName} onBlocked={() => onGuardianBlocked(item.guardianId)} />
              </View>
            )}
            </View>
          )}
        </View>
        {item.situationTags.length > 0 && (
          <View style={s.connectionTagsStrip}>
            <AppText style={s.connectionTagsText}>👥 {item.situationTags.join(', ')}</AppText>
          </View>
        )}
      </View>
    );
  }

  function renderSentCard(item: GuardianResult, index: number) {
    const tileBg = BUTTERFLY_TILES[index % BUTTERFLY_TILES.length].bg;
    const badge =
      item.status === 'accepted'     ? { label: 'Connected',  style: s.badgeAccepted,  textStyle: s.badgeAcceptedTxt  } :
      item.status === 'rejected'     ? { label: 'Rejected',   style: s.badgeRejected,  textStyle: s.badgeRejectedTxt  } :
      /* pending_sent */               { label: 'Pending',    style: s.badgePending,   textStyle: s.badgePendingTxt   };
    return (
      <View key={item.guardianId} style={[s.connectionCard, { backgroundColor: tileBg, borderColor: 'transparent' }]}>
        <View style={s.connectionRow}>
          {item.photoUrl ? (
            <Image source={{ uri: item.photoUrl }} style={s.connectionAvatar} />
          ) : (
            <View style={[s.connectionAvatar, s.connectionAvatarFallback, { backgroundColor: avatarColor(item.guardianName) }]}>
              <AppText style={s.connectionAvatarInitial}>{item.guardianName[0]?.toUpperCase()}</AppText>
            </View>
          )}
          <View style={s.connectionInfo}>
            <AppText style={s.connectionName} numberOfLines={1}>{item.guardianName}</AppText>
            {item.county ? <AppText style={s.connectionCounty} numberOfLines={1}>{item.county}</AppText> : null}
          </View>
          <View style={s.connectionActions}>
            <BlockButton guardianId={item.guardianId} guardianName={item.guardianName} onBlocked={() => onGuardianBlocked(item.guardianId)} />
            <View style={badge.style}>
              <AppText style={badge.textStyle}>{badge.label}</AppText>
            </View>
          </View>
        </View>
        {item.situationTags.length > 0 && (
          <View style={s.connectionTagsStrip}>
            <AppText style={s.connectionTagsText}>👥 {item.situationTags.join(', ')}</AppText>
          </View>
        )}
      </View>
    );
  }

  function renderReceivedCard(item: GuardianResult, index: number) {
    const tileBg = BUTTERFLY_TILES[index % BUTTERFLY_TILES.length].bg;
    const isProcessing = processing === item.guardianId;
    return (
      <View key={item.guardianId} style={[s.connectionCard, { backgroundColor: tileBg, borderColor: 'transparent' }]}>
        <View style={s.connectionRow}>
          {item.photoUrl ? (
            <Image source={{ uri: item.photoUrl }} style={s.connectionAvatar} />
          ) : (
            <View style={[s.connectionAvatar, s.connectionAvatarFallback, { backgroundColor: avatarColor(item.guardianName) }]}>
              <AppText style={s.connectionAvatarInitial}>{item.guardianName[0]?.toUpperCase()}</AppText>
            </View>
          )}
          <View style={s.connectionInfo}>
            <AppText style={s.connectionName} numberOfLines={1}>{item.guardianName}</AppText>
            {item.county ? <AppText style={s.connectionCounty} numberOfLines={1}>{item.county}</AppText> : null}
            <AppText style={s.gridPendingLabel}>Wants to connect</AppText>
          </View>
          {isProcessing ? (
            <ActivityIndicator color={NICO.primary} />
          ) : (
            <View style={s.connectionActions}>
              <BlockButton guardianId={item.guardianId} guardianName={item.guardianName} onBlocked={() => onGuardianBlocked(item.guardianId)} />
              <TouchableOpacity
                style={[s.connectionMsgBtn, { backgroundColor: NICO.successLight, borderColor: NICO.success }]}
                onPress={() => accept(item)}
                activeOpacity={0.7}
              >
                <AppText style={[s.connectionMsgIcon, { color: NICO.success }]}>✓</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.disconnectBtn}
                onPress={() => decline(item)}
                activeOpacity={0.7}
              >
                <AppText style={s.disconnectIcon}>✕</AppText>
              </TouchableOpacity>
            </View>
          )}
        </View>
        {item.situationTags.length > 0 && (
          <View style={s.connectionTagsStrip}>
            <AppText style={s.connectionTagsText}>👥 {item.situationTags.join(', ')}</AppText>
          </View>
        )}
      </View>
    );
  }

  function renderDiscoverCard(item: GuardianResult, index: number) {
    const tileBg = BUTTERFLY_TILES[index % BUTTERFLY_TILES.length].bg;
    const isProcessing = processing === item.guardianId;
    const isSending    = sending === item.guardianId;
    return (
      <View key={item.guardianId} style={[s.connectionCard, { backgroundColor: tileBg, borderColor: 'transparent' }]}>
        <View style={s.connectionRow}>
          {item.photoUrl ? (
            <Image source={{ uri: item.photoUrl }} style={s.connectionAvatar} />
          ) : (
            <View style={[s.connectionAvatar, s.connectionAvatarFallback, { backgroundColor: avatarColor(item.guardianName) }]}>
              <AppText style={s.connectionAvatarInitial}>{item.guardianName[0]?.toUpperCase()}</AppText>
            </View>
          )}
          <View style={s.connectionInfo}>
            <AppText style={s.connectionName} numberOfLines={1}>{item.guardianName}</AppText>
            {item.county ? <AppText style={s.connectionCounty} numberOfLines={1}>{item.county}</AppText> : null}
          </View>
          {isProcessing || isSending ? (
            <ActivityIndicator color={NICO.primary} />
          ) : (
            <View style={s.connectionActions}>
              {/* 🚩 report this guardian's profile (never shown for yourself) */}
              {item.guardianId !== guardian?.id && (
                <ReportFlag target={{ area: 'guardian_profile', guardianId: item.guardianId }} />
              )}
              <BlockButton guardianId={item.guardianId} guardianName={item.guardianName} onBlocked={() => onGuardianBlocked(item.guardianId)} />
              <TouchableOpacity style={s.connectionMsgBtn} onPress={() => sendRequest(item)} activeOpacity={0.8}>
                <AppText style={s.connectionMsgIcon}>🤝</AppText>
              </TouchableOpacity>
            </View>
          )}
        </View>
        {item.situationTags.length > 0 && (
          <View style={s.connectionTagsStrip}>
            <AppText style={s.connectionTagsText}>👥 {item.situationTags.join(', ')}</AppText>
          </View>
        )}
      </View>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={s.container}>
      <RainbowDivider />

      {/* Tab bar */}
      <View style={s.tabBar}>
        {(['connected', 'requests', 'find', 'blocked'] as Tab[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[s.tab, activeTab === tab && s.tabActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.8}
          >
            <AppText style={[s.tabTxt, activeTab === tab && s.tabTxtActive]}>
              {tab === 'connected' ? 'Connected' : tab === 'requests' ? 'Requests' : tab === 'find' ? 'Find' : 'Blocked'}
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

          <View style={s.filterBar}>
            <AppText style={s.resultCount}>{filteredConnected.length} result{filteredConnected.length !== 1 ? 's' : ''}</AppText>
            <MoreFiltersLink onPress={() => setConnectedSheetOpen(true)} isActive={hasConnectedMore} />
          </View>

          <ActiveFilterChips
            chips={connectedFilterTags.map(t => ({
              key: `tag-${t}`, label: `🎯 ${t}`,
              onRemove: () => setConnectedFilterTags(prev => prev.filter(x => x !== t)),
            }))}
            onClearAll={() => setConnectedFilterTags([])}
          />

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
                <View style={s.connectionList}>
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

          <FilterSheet
            visible={connectedSheetOpen}
            title="More Filters"
            sections={[
              {
                key: 'situation', emoji: '🎯', title: 'Regional Support Category',
                options: situationTagOptions.map(t => ({ key: t, label: t })),
                selected: connectedFilterTags,
                onToggle: v => setConnectedFilterTags(prev => toggle(prev, v)),
              },
            ] satisfies FilterSheetSection[]}
            onClearAll={() => setConnectedFilterTags([])}
            onDone={() => setConnectedSheetOpen(false)}
          />
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
                <View style={s.connectionList}>
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
                <View style={s.connectionList}>
                  {receivedRequests.map((item, index) => renderReceivedCard(item, index))}
                </View>
              )}
            </ScrollView>
          )}
        </View>

      ) : activeTab === 'blocked' ? (
        /* ── Blocked tab: guardians I blocked ─────────────────────────────── */
        <View style={s.tabPane}>
          <ScrollView contentContainerStyle={s.list}>
            {blockedGuardians.length === 0 ? (
              <View style={s.empty}>
                <AppText style={s.emptyEmoji}>🚫</AppText>
                <AppText style={s.emptyText}>You haven't blocked anyone.</AppText>
              </View>
            ) : (
              <View style={s.connectionList}>
                {blockedGuardians.map((b, index) => (
                  <View key={b.guardianId} style={[s.connectionCard, { backgroundColor: BUTTERFLY_TILES[index % BUTTERFLY_TILES.length].bg, borderColor: 'transparent' }]}>
                    <View style={s.connectionRow}>
                      {b.photoUrl ? (
                        <Image source={{ uri: b.photoUrl }} style={s.connectionAvatar} />
                      ) : (
                        <View style={[s.connectionAvatar, s.connectionAvatarFallback, { backgroundColor: avatarColor(b.name) }]}>
                          <AppText style={s.connectionAvatarInitial}>{b.name[0]?.toUpperCase()}</AppText>
                        </View>
                      )}
                      <View style={s.connectionInfo}>
                        <AppText style={s.connectionName} numberOfLines={1}>{b.name}</AppText>
                        {b.county ? <AppText style={s.connectionCounty} numberOfLines={1}>{b.county}</AppText> : null}
                      </View>
                      <TouchableOpacity style={s.unblockBtn} onPress={() => unblock(b)} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={`Unblock ${b.name}`}>
                        <AppText style={s.unblockBtnText}>Unblock</AppText>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
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

          <ActiveFilterChips
            chips={[
              ...filterTags.map(t => ({
                key: `tag-${t}`, label: `🎯 ${t}`,
                onRemove: () => setFilterTags(prev => prev.filter(x => x !== t)),
              })),
            ]}
            onClearAll={() => setFilterTags([])}
          />

          <FlatList
            data={visibleDiscovered}
            keyExtractor={r => r.guardianId}
            contentContainerStyle={s.list}
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
                key: 'situation', emoji: '🎯', title: 'Regional Support Category',
                options: situationTagOptions.map(t => ({ key: t, label: t })),
                selected: filterTags,
                onToggle: v => setFilterTags(prev => toggle(prev, v)),
              },
            ] satisfies FilterSheetSection[]}
            onClearAll={() => setFilterTags([])}
            onDone={() => setSheetOpen(false)}
          />
        </View>
      )}

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

  // Horizontal row layout shared by all 3 tabs (My Connections, Requests, Find)
  connectionList: { gap: SPACING.sm },
  connectionCard: {
    backgroundColor: 'white', borderRadius: RADIUS.xl, padding: SPACING.base,
    borderWidth: 1, borderColor: NICO.border,
    ...SHADOW.md,
  },
  connectionRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  connectionAvatar: { width: scale(52), height: scale(52), borderRadius: scale(26) },
  connectionAvatarFallback: { justifyContent: 'center', alignItems: 'center' },
  connectionAvatarInitial: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.extraBold, color: 'white' },
  connectionInfo: { flex: 1, minWidth: 0, gap: 2 },
  connectionName: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extraBold, color: NICO.text },
  connectionCounty: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.medium, color: NICO.text },
  connectionActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  actionsColumn:     { alignItems: 'flex-end', gap: SPACING.sm },
  unblockBtn:        { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 2, borderRadius: RADIUS.full, borderWidth: 1, borderColor: NICO.primary },
  unblockBtnText:    { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: NICO.primary },
  connectionMsgBtn: {
    width: scale(40), height: scale(40), borderRadius: RADIUS.full,
    backgroundColor: NICO.primaryLight, borderWidth: 1.5, borderColor: NICO.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  connectionMsgIcon: { fontSize: FONT_SIZE.lg },
  // Regional Support Category — bleeds past the card's own padding to span
  // edge-to-edge and sit flush ("sticky") against the card's bottom corners.
  connectionTagsStrip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: NICO.background,
    marginTop: SPACING.sm, marginHorizontal: -SPACING.base, marginBottom: -SPACING.base,
    paddingHorizontal: SPACING.base, paddingVertical: SPACING.sm,
    borderBottomLeftRadius: RADIUS.xl, borderBottomRightRadius: RADIUS.xl,
  },
  connectionTagsText: { fontSize: FONT_SIZE.md, color: NICO.text, fontWeight: FONT_WEIGHT.medium },
  gridPendingLabel:  { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semiBold, color: NICO.primary },

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
});
