import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, Modal, ScrollView, Dimensions, Image,
} from 'react-native';
import AppText from '../../components/AppText';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS, calcAge } from '../../constants';

const { height: SCREEN_H } = Dimensions.get('window');

const AVATAR_COLORS = [COLORS.statusRed, COLORS.statusPurple, COLORS.statusTeal, COLORS.statusAmber, COLORS.statusBlue, COLORS.statusPink];

const AGE_GROUPS    = ['Under 10', '10–14', '15–18', '19–25', '26–35', '36+'];
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

type Status = 'none' | 'pending_sent' | 'pending_received' | 'accepted';
type Tab = 'connected' | 'find';

interface GuardianResult {
  guardianId: string;
  guardianName: string;
  guardianEmail: string;
  photoUrl: string;
  city: string;
  situationTags: string[];
  learnerName: string;
  learnerRegion: string;
  learnerDob: string | null;
  learnerGender: string;
  status: Status;
  connectionId: string | null;
}

// ── SheetSection ──────────────────────────────────────────────────────────────

interface SectionProps {
  id: string; emoji: string; title: string;
  options: string[]; selected: string[];
  onToggle: (val: string) => void;
  openId: string | null; setOpenId: (id: string | null) => void;
}

function SheetSection({ id, emoji, title, options, selected, onToggle, openId, setOpenId }: SectionProps) {
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
      {open && (
        <View>
          {options.map(opt => {
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
      )}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function GuardianConnectionsScreen() {
  const { guardian } = useAuth();

  const [activeTab, setActiveTab]           = useState<Tab>('connected');
  const [peekGuardian, setPeekGuardian]     = useState<GuardianResult | null>(null);
  const [hoveredDisconnect, setHoveredDisconnect] = useState<string | null>(null);
  const [situationTagOptions, setSituationTagOptions] = useState<string[]>([]);

  useEffect(() => {
    supabase.from('situation_tag_options').select('label').order('label').then(({ data }) => {
      if (data) setSituationTagOptions(data.map((r: any) => r.label));
    });
  }, []);

  const [results, setResults]       = useState<GuardianResult[]>([]);
  const [loading, setLoading]       = useState(true);
  const [sending, setSending]       = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  // Search
  const [searchName, setSearchName] = useState('');
  const [searchCity, setSearchCity] = useState('');

  // Applied filters
  const [filterAgeGroups, setFilterAgeGroups] = useState<string[]>([]);
  const [filterTags,      setFilterTags]      = useState<string[]>([]);
  const [filterGenders,   setFilterGenders]   = useState<string[]>([]);

  // Draft filters
  const [draftAgeGroups, setDraftAgeGroups] = useState<string[]>([]);
  const [draftTags,      setDraftTags]      = useState<string[]>([]);
  const [draftGenders,   setDraftGenders]   = useState<string[]>([]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [openSec,   setOpenSec]   = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (guardian) load(guardian.id);
    }, [guardian]),
  );

  async function load(myId: string) {
    setLoading(true);

    const { data: guardians } = await supabase
      .from('guardians')
      .select('id, full_name, email, photo_url, city, state, situation_tags')
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

    function getStatus(otherId: string): { status: Status; connectionId: string | null } {
      const c = (connections ?? []).find((r: any) =>
        (r.requester_id === myId && r.addressee_id === otherId) ||
        (r.addressee_id === myId && r.requester_id === otherId)
      );
      if (!c) return { status: 'none', connectionId: null };
      if (c.status === 'accepted') return { status: 'accepted', connectionId: c.id };
      return { status: c.requester_id === myId ? 'pending_sent' : 'pending_received', connectionId: c.id };
    }

    const list: GuardianResult[] = guardians.map((g: any) => {
      const l = learnerMap[g.id];
      const { status, connectionId } = getStatus(g.id);
      return {
        guardianId: g.id,
        guardianName: g.full_name ?? 'Unknown',
        guardianEmail: g.email ?? '',
        photoUrl: g.photo_url ?? '',
        city: [g.city, g.state].filter(Boolean).join(', '),
        situationTags: g.situation_tags ?? [],
        learnerName: l?.name ?? '',
        learnerRegion: l?.region ?? '',
        learnerDob: l?.date_of_birth ?? null,
        learnerGender: l?.gender ?? '',
        status,
        connectionId,
      };
    });

    setResults(list);
    setLoading(false);
  }

  async function sendRequest(item: GuardianResult) {
    if (!guardian) return;
    setSending(item.guardianId);
    try {
      const { error } = await supabase.from('guardian_connections').insert({
        requester_id: guardian.id, addressee_id: item.guardianId, status: 'pending',
      });
      if (error) throw new Error(error.message);
      setResults(prev => prev.map(r =>
        r.guardianId === item.guardianId ? { ...r, status: 'pending_sent' } : r
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
    Alert.alert('Decline', `Decline connection request from ${item.guardianName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline', style: 'destructive', onPress: async () => {
          setProcessing(item.guardianId);
          await supabase.from('guardian_connections').delete().eq('id', item.connectionId!);
          setResults(prev => prev.map(r =>
            r.guardianId === item.guardianId ? { ...r, status: 'none', connectionId: null } : r
          ));
          setProcessing(null);
        },
      },
    ]);
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
            r.guardianId === item.guardianId ? { ...r, status: 'none', connectionId: null } : r
          ));
          setProcessing(null);
        },
      },
    ]);
  }

  function openSheet() {
    setDraftAgeGroups([...filterAgeGroups]);
    setDraftTags([...filterTags]);
    setDraftGenders([...filterGenders]);
    setOpenSec(null);
    setSheetOpen(true);
  }

  function applySheet() {
    setFilterAgeGroups([...draftAgeGroups]);
    setFilterTags([...draftTags]);
    setFilterGenders([...draftGenders]);
    setSheetOpen(false);
  }

  function clearSheet() {
    setDraftAgeGroups([]);
    setDraftTags([]);
    setDraftGenders([]);
  }

  const totalActive = filterAgeGroups.length + filterTags.length + filterGenders.length;

  const connected = useMemo(() =>
    results.filter(r => r.status === 'accepted'),
  [results]);

  const pendingReceived = useMemo(() =>
    results.filter(r => r.status === 'pending_received'),
  [results]);

  const discovered = useMemo(() => {
    return results.filter(r => {
      if (r.status === 'accepted' || r.status === 'pending_received' || r.status === 'pending_sent') return false;
      const matchName   = !searchName || r.guardianName.toLowerCase().includes(searchName.toLowerCase());
      const matchCity   = !searchCity || r.city.toLowerCase().includes(searchCity.toLowerCase());
      const matchAge    = filterAgeGroups.length === 0 || filterAgeGroups.includes(getAgeGroup(r.learnerDob) ?? '');
      const matchTags   = filterTags.length === 0 || filterTags.some(t => r.situationTags.includes(t));
      const matchGender = filterGenders.length === 0 || filterGenders.includes(r.learnerGender);
      return matchName && matchCity && matchAge && matchTags && matchGender;
    });
  }, [results, searchName, searchCity, filterAgeGroups, filterTags, filterGenders]);

  // ── Card renderers ──────────────────────────────────────────────────────────

  function avatarColor(name: string) {
    return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  }

  function renderConnectedCard(item: GuardianResult) {
    return (
      <TouchableOpacity key={item.guardianId} style={s.card} activeOpacity={0.75} onPress={() => setPeekGuardian(item)}>
        <View style={[s.avatar, { backgroundColor: avatarColor(item.guardianName) }]}>
          <AppText style={s.avatarInitial}>{item.guardianName[0]?.toUpperCase()}</AppText>
        </View>
        <View style={s.info}>
          <AppText style={s.guardianName}>{item.guardianName}</AppText>
          {item.city ? <AppText style={s.meta}>{item.city}</AppText> : null}
        </View>
        <View style={s.actions}>
          {processing === item.guardianId ? (
            <ActivityIndicator color={COLORS.bloomAccent} />
          ) : (
            <View style={s.disconnectWrap}>
              {hoveredDisconnect === item.guardianId && (
                <AppText style={s.disconnectLabel}>Delete Connection</AppText>
              )}
              <TouchableOpacity
                style={s.disconnectBtn}
                onPress={(e) => { e.stopPropagation(); disconnect(item); }}
                onPressIn={() => setHoveredDisconnect(item.guardianId)}
                onPressOut={() => setHoveredDisconnect(null)}
                activeOpacity={0.7}
              >
                <AppText style={s.disconnectIcon}>🗑️</AppText>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  function renderPendingCard(item: GuardianResult) {
    const isProcessing = processing === item.guardianId;
    return (
      <TouchableOpacity key={item.guardianId} style={[s.card, s.pendingCard]} activeOpacity={0.75} onPress={() => setPeekGuardian(item)}>
        <View style={[s.avatar, { backgroundColor: avatarColor(item.guardianName) }]}>
          <AppText style={s.avatarInitial}>{item.guardianName[0]?.toUpperCase()}</AppText>
        </View>
        <View style={s.info}>
          <AppText style={s.guardianName}>{item.guardianName}</AppText>
          {item.city ? <AppText style={s.meta}>{item.city}</AppText> : null}
          <AppText style={s.pendingLabel}>Wants to connect with you</AppText>
        </View>
        <View style={s.actions}>
          {isProcessing ? (
            <ActivityIndicator color={COLORS.bloomAccent} />
          ) : (
            <>
              <TouchableOpacity style={s.acceptBtn} onPress={() => accept(item)}>
                <AppText style={s.acceptText}>✓</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={s.declineBtn} onPress={() => decline(item)}>
                <AppText style={s.declineText}>✕</AppText>
              </TouchableOpacity>
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  function renderDiscoverCard(item: GuardianResult) {
    const isProcessing = processing === item.guardianId;
    const isSending    = sending === item.guardianId;
    return (
      <TouchableOpacity key={item.guardianId} style={s.card} activeOpacity={0.75} onPress={() => setPeekGuardian(item)}>
        <View style={[s.avatar, { backgroundColor: avatarColor(item.guardianName) }]}>
          <AppText style={s.avatarInitial}>{item.guardianName[0]?.toUpperCase()}</AppText>
        </View>
        <View style={s.info}>
          <AppText style={s.guardianName}>{item.guardianName}</AppText>
          {item.city ? <AppText style={s.meta}>{item.city}</AppText> : null}
        </View>
        <View style={s.actions}>
          {isProcessing || isSending ? (
            <ActivityIndicator color={COLORS.bloomAccent} />
          ) : item.status === 'accepted' ? (
            <View style={s.connectedBadge}><AppText style={s.connectedText}>✓ Connected</AppText></View>
          ) : item.status === 'pending_sent' ? (
            <View style={s.pendingBadge}><AppText style={s.pendingText}>Pending</AppText></View>
          ) : item.status === 'pending_received' ? (
            <>
              <TouchableOpacity style={s.acceptBtn} onPress={() => accept(item)}>
                <AppText style={s.acceptText}>✓ Accept</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={s.declineBtn} onPress={() => decline(item)}>
                <AppText style={s.declineText}>✕</AppText>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={s.connectBtn} onPress={(e) => { e.stopPropagation(); sendRequest(item); }}>
              <AppText style={s.connectText}>Connect</AppText>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={s.container}>
      {/* Tab bar */}
      <View style={s.tabBar}>
        <TouchableOpacity
          style={[s.tab, activeTab === 'connected' && s.tabActive]}
          onPress={() => setActiveTab('connected')}
          activeOpacity={0.8}
        >
          <AppText style={[s.tabTxt, activeTab === 'connected' && s.tabTxtActive]}>
            My Connections
            {connected.length > 0 ? `  ${connected.length}` : ''}
          </AppText>
          {pendingReceived.length > 0 && activeTab !== 'connected' && (
            <View style={s.tabDot} />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, activeTab === 'find' && s.tabActive]}
          onPress={() => setActiveTab('find')}
          activeOpacity={0.8}
        >
          <AppText style={[s.tabTxt, activeTab === 'find' && s.tabTxtActive]}>Find Guardians</AppText>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={COLORS.bloomAccent} /></View>
      ) : activeTab === 'connected' ? (
        /* ── Connected tab ─────────────────────────────────────────── */
        <ScrollView contentContainerStyle={s.list}>
          {pendingReceived.length === 0 && connected.length === 0 ? (
            <View style={s.empty}>
              <AppText style={s.emptyEmoji}>🤝</AppText>
              <AppText style={s.emptyText}>No connections yet</AppText>
              <AppText style={s.emptyHint}>
                Connect with other guardians who share similar experiences — filter by your learner's situation, age, or location to find the right people.
              </AppText>
              <TouchableOpacity style={s.emptyBtn} onPress={() => setActiveTab('find')} activeOpacity={0.8}>
                <AppText style={s.emptyBtnTxt}>Find Guardians</AppText>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {pendingReceived.length > 0 && (
                <>
                  <AppText style={s.sectionHeader}>Pending requests  ·  {pendingReceived.length}</AppText>
                  {pendingReceived.map(item => renderPendingCard(item))}
                </>
              )}
              {connected.length > 0 && (
                <>
                  <AppText style={[s.sectionHeader, pendingReceived.length > 0 && { marginTop: 20 }]}>
                    Connected  ·  {connected.length}
                  </AppText>
                  {connected.map(item => renderConnectedCard(item))}
                </>
              )}
            </>
          )}
        </ScrollView>
      ) : (
        /* ── Find tab ──────────────────────────────────────────────── */
        <>
          <View style={s.searchRow}>
            <TextInput
              style={s.searchInput}
              value={searchName}
              onChangeText={setSearchName}
              placeholder="Guardian name…"
              placeholderTextColor={COLORS.bloomMuted}
              clearButtonMode="while-editing"
            />
            <TextInput
              style={s.searchInput}
              value={searchCity}
              onChangeText={setSearchCity}
              placeholder="Guardian city or state…"
              placeholderTextColor={COLORS.bloomMuted}
              clearButtonMode="while-editing"
            />
          </View>

          <View style={s.filterRow}>
            <TouchableOpacity style={[s.filterBtn, totalActive > 0 && s.filterBtnActive]} onPress={openSheet} activeOpacity={0.8}>
              <AppText style={[s.filterBtnTxt, totalActive > 0 && s.filterBtnTxtActive]}>
                {totalActive > 0 ? `Filters  ·  ${totalActive}` : 'Filters'}
              </AppText>
              <AppText style={[s.filterBtnIcon, totalActive > 0 && s.filterBtnTxtActive]}>⊟</AppText>
            </TouchableOpacity>
            <AppText style={s.resultCount}>{discovered.length} result{discovered.length !== 1 ? 's' : ''}</AppText>
          </View>

          <FlatList
            data={discovered}
            keyExtractor={r => r.guardianId}
            contentContainerStyle={s.list}
            renderItem={({ item }) => renderDiscoverCard(item)}
            ListEmptyComponent={
              <View style={s.empty}>
                <AppText style={s.emptyEmoji}>🔍</AppText>
                <AppText style={s.emptyText}>No guardians found</AppText>
                <AppText style={s.emptyHint}>Try adjusting your filters</AppText>
              </View>
            }
          />
        </>
      )}

      {/* Quick look */}
      <Modal visible={!!peekGuardian} transparent animationType="slide" onRequestClose={() => setPeekGuardian(null)}>
        <TouchableOpacity style={s.sheetBackdrop} activeOpacity={1} onPress={() => setPeekGuardian(null)}>
          {peekGuardian && (
            <View style={s.sheet} onStartShouldSetResponder={() => true}>
              {/* Handle */}
              <View style={s.peekHandle} />

              {/* Guardian header */}
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
                  {peekGuardian.city ? (
                    <AppText style={s.peekCity}>📍 {peekGuardian.city}</AppText>
                  ) : null}
                </View>
              </View>

              {/* Learner section */}
              {peekGuardian.learnerName ? (
                <View style={s.peekSection}>
                  <AppText style={s.peekSectionLabel}>Learner</AppText>
                  <View style={s.peekLearnerRow}>
                    <View style={s.peekLearnerDetail}>
                      <AppText style={s.peekLearnerName}>{peekGuardian.learnerName}</AppText>
                      <AppText style={s.peekLearnerMeta}>
                        {[
                          peekGuardian.learnerDob ? `${calcAge(peekGuardian.learnerDob) ?? '—'} yrs` : null,
                          peekGuardian.learnerGender || null,
                        ].filter(Boolean).join('  ·  ')}
                      </AppText>
                    </View>
                  </View>
                </View>
              ) : null}

              {/* Situation tags */}
              {peekGuardian.situationTags.length > 0 ? (
                <View style={s.peekSection}>
                  <AppText style={s.peekSectionLabel}>Situation</AppText>
                  <View style={s.peekTagWrap}>
                    {peekGuardian.situationTags.map(tag => (
                      <View key={tag} style={s.peekTag}>
                        <AppText style={s.peekTagTxt}>{tag}</AppText>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* Action */}
              <View style={s.peekActions}>
                {peekGuardian.status === 'accepted' ? (
                  <View style={[s.sheetApply, { backgroundColor: COLORS.statusGreenDark }]}>
                    <AppText style={s.sheetApplyTxt}>✓ Connected</AppText>
                  </View>
                ) : peekGuardian.status === 'pending_sent' ? (
                  <View style={[s.sheetApply, { backgroundColor: COLORS.bloomMuted }]}>
                    <AppText style={s.sheetApplyTxt}>Request Sent</AppText>
                  </View>
                ) : peekGuardian.status === 'pending_received' ? (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity style={[s.sheetApply, { flex: 1 }]} onPress={() => { accept(peekGuardian); setPeekGuardian(null); }} activeOpacity={0.85}>
                      <AppText style={s.sheetApplyTxt}>✓ Accept</AppText>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.sheetApply, { flex: 1, backgroundColor: COLORS.statusRedLight }]} onPress={() => { decline(peekGuardian); setPeekGuardian(null); }} activeOpacity={0.85}>
                      <AppText style={[s.sheetApplyTxt, { color: '#B91C1C' }]}>✕ Decline</AppText>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={s.sheetApply} onPress={() => { sendRequest(peekGuardian); setPeekGuardian(null); }} activeOpacity={0.85}>
                    <AppText style={s.sheetApplyTxt}>Connect</AppText>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </TouchableOpacity>
      </Modal>

      {/* Filter sheet */}
      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <TouchableOpacity style={s.sheetBackdrop} activeOpacity={1} onPress={() => setSheetOpen(false)}>
          <View style={s.sheet} onStartShouldSetResponder={() => true}>
            <View style={s.sheetHdr}>
              <TouchableOpacity onPress={clearSheet} activeOpacity={0.7}>
                <AppText style={s.sheetClear}>Clear all</AppText>
              </TouchableOpacity>
              <AppText style={s.sheetTitle}>Filters</AppText>
              <TouchableOpacity onPress={() => setSheetOpen(false)} activeOpacity={0.7}>
                <AppText style={s.sheetClose}>✕</AppText>
              </TouchableOpacity>
            </View>

            <ScrollView style={s.sheetBody} showsVerticalScrollIndicator={false}>
              <SheetSection
                id="situation" emoji="🎯" title="Situation"
                options={situationTagOptions} selected={draftTags}
                onToggle={v => setDraftTags(t => toggle(t, v))}
                openId={openSec} setOpenId={setOpenSec}
              />
              <SheetSection
                id="age" emoji="👤" title="Learner age"
                options={AGE_GROUPS} selected={draftAgeGroups}
                onToggle={v => setDraftAgeGroups(g => toggle(g, v))}
                openId={openSec} setOpenId={setOpenSec}
              />
              <SheetSection
                id="gender" emoji="⚧" title="Learner gender"
                options={GENDER_OPTIONS} selected={draftGenders}
                onToggle={v => setDraftGenders(g => toggle(g, v))}
                openId={openSec} setOpenId={setOpenSec}
              />
            </ScrollView>

            <TouchableOpacity style={s.sheetApply} onPress={applySheet} activeOpacity={0.85}>
              <AppText style={s.sheetApplyTxt}>Show results</AppText>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bloomBody },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.bloomCard,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.bloomBorder,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, gap: 6,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: COLORS.bloomNavy },
  tabTxt:    { fontSize: 14, fontWeight: '600', color: COLORS.bloomMuted },
  tabTxtActive: { color: COLORS.bloomNavy, fontWeight: '800' },
  tabDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.statusError, marginLeft: 2,
  },

  sectionHeader: {
    fontSize: 12, fontWeight: '700', color: COLORS.bloomMuted,
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: 8, marginTop: 4,
  },

  searchRow:   { padding: 14, gap: 8 },
  searchInput: {
    backgroundColor: COLORS.bloomCard, borderRadius: 14, borderWidth: 1.5,
    borderColor: COLORS.bloomBorder, paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15, fontWeight: '500', color: COLORS.bloomText,
  },

  filterRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 10, gap: 10 },
  filterBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.bloomCard, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, borderColor: COLORS.bloomBorder },
  filterBtnActive: { backgroundColor: COLORS.bloomAccent, borderColor: COLORS.bloomAccent },
  filterBtnTxt:    { fontSize: 13, fontWeight: '700', color: COLORS.bloomMuted },
  filterBtnTxtActive: { color: COLORS.bloomOnAccent },
  filterBtnIcon:   { fontSize: 16, color: COLORS.bloomMuted },
  resultCount:     { fontSize: 13, color: COLORS.bloomMuted, fontWeight: '600' },

  list: { padding: 14, gap: 10, paddingBottom: 40 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.bloomCard, borderRadius: 18, padding: 14,
    borderWidth: 1, borderColor: COLORS.bloomBorder,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  pendingCard: { borderColor: '#FDE68A', borderWidth: 1.5 },

  avatar:        { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  avatarInitial: { fontSize: 20, fontWeight: '800', color: '#fff' },
  info:          { flex: 1, minWidth: 0, gap: 3 },
  guardianName:  { fontSize: 15, fontWeight: '800', color: COLORS.bloomText },
  meta:          { fontSize: 12, color: COLORS.bloomMuted },
  tags:          { fontSize: 11, color: COLORS.bloomMuted, marginTop: 1 },
  pendingLabel:  { fontSize: 12, fontWeight: '600', color: '#B45309', marginTop: 2 },
  actions:       { alignItems: 'center', gap: 6 },

  connectBtn:     { backgroundColor: COLORS.bloomAccent, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  connectText:    { color: COLORS.bloomOnAccent, fontWeight: '700', fontSize: 13 },
  connectedBadge: { backgroundColor: COLORS.secondaryLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  connectedText:  { fontSize: 12, fontWeight: '700', color: COLORS.statusGreenDark },
  disconnectWrap:  { alignItems: 'flex-end', gap: 4 },
  disconnectLabel: { fontSize: 10, fontWeight: '700', color: '#B91C1C', textAlign: 'right' },
  disconnectBtn:   { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.statusRedLight, justifyContent: 'center', alignItems: 'center' },
  disconnectIcon:  { fontSize: 18 },
  pendingBadge:   { backgroundColor: COLORS.bloomBorder, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  pendingText:    { fontSize: 12, fontWeight: '600', color: COLORS.bloomMuted },
  acceptBtn:      { backgroundColor: COLORS.bloomAccent, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  acceptText:     { color: COLORS.bloomOnAccent, fontWeight: '700', fontSize: 12 },
  declineBtn:     { backgroundColor: COLORS.statusRedLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  declineText:    { color: '#B91C1C', fontWeight: '700', fontSize: 12 },

  empty:      { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyEmoji: { fontSize: 56 },
  emptyText:  { fontSize: 20, fontWeight: '800', color: COLORS.bloomText },
  emptyHint:  { fontSize: 14, color: COLORS.bloomMuted, textAlign: 'center', paddingHorizontal: 32 },
  emptyBtn:   { backgroundColor: COLORS.bloomAccent, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  emptyBtnTxt: { color: COLORS.bloomOnAccent, fontWeight: '700', fontSize: 15 },

  // Filter sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.bloomCard, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: SCREEN_H * 0.75,
  },
  sheetHdr: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.bloomBorder,
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: COLORS.bloomText },
  sheetClear: { fontSize: 14, fontWeight: '600', color: COLORS.bloomAccent },
  sheetClose: { fontSize: 18, color: COLORS.bloomMuted },
  sheetBody:  { paddingHorizontal: 16 },

  sheetSec:    { borderBottomWidth: 1, borderBottomColor: COLORS.bloomBorder, paddingVertical: 4 },
  sheetSecHdr: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  sheetSecTitle: { fontSize: 15, fontWeight: '700', color: COLORS.bloomText },
  sheetSecRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheetSecBadge: { backgroundColor: COLORS.bloomAccent, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  sheetSecBadgeTxt: { fontSize: 11, fontWeight: '800', color: COLORS.bloomOnAccent },
  sheetSecArr: { fontSize: 11, color: COLORS.bloomMuted },

  optRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11 },
  optTxt:   { fontSize: 14, color: COLORS.bloomMuted, flex: 1 },
  optTxtOn: { color: COLORS.bloomText, fontWeight: '700' },
  optCheck: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: COLORS.bloomBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  optCheckOn:   { backgroundColor: COLORS.bloomAccent, borderColor: COLORS.bloomAccent },
  optCheckMark: { fontSize: 12, color: COLORS.bloomOnAccent, fontWeight: '900' },

  sheetApply: {
    margin: 16, backgroundColor: COLORS.bloomAccent,
    borderRadius: 14, paddingVertical: 15, alignItems: 'center',
  },
  sheetApplyTxt: { fontSize: 16, fontWeight: '800', color: COLORS.bloomOnAccent },

  // Quick look
  peekHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: COLORS.bloomBorder,
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  peekHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.bloomBorder,
  },
  peekPhoto:        { width: 72, height: 72, borderRadius: 36 },
  peekPhotoFallback: { justifyContent: 'center', alignItems: 'center' },
  peekInitial:      { fontSize: 28, fontWeight: '800', color: '#fff' },
  peekHeaderInfo:   { flex: 1, gap: 4 },
  peekName:         { fontSize: 20, fontWeight: '800', color: COLORS.bloomText },
  peekCity:         { fontSize: 13, color: COLORS.bloomMuted, fontWeight: '500' },

  peekSection:      { paddingHorizontal: 20, paddingTop: 16, gap: 8 },
  peekSectionLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.bloomMuted,
    textTransform: 'uppercase', letterSpacing: 0.7,
  },
  peekLearnerRow:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  peekLearnerDetail: { gap: 2 },
  peekLearnerName:   { fontSize: 16, fontWeight: '700', color: COLORS.bloomText },
  peekLearnerMeta:   { fontSize: 13, color: COLORS.bloomMuted },

  peekTagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  peekTag: {
    backgroundColor: COLORS.bloomBody, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: COLORS.bloomBorder,
  },
  peekTagTxt: { fontSize: 12, fontWeight: '600', color: COLORS.bloomText },

  peekActions: { paddingHorizontal: 16, paddingBottom: 8 },
});
