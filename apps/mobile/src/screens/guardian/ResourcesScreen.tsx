import React from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import AppText from '../../components/AppText';
import RainbowDivider from '../../components/RainbowDivider';
import ContentContainer from '../../components/ContentContainer';
import GuardianFloatingTabBar from '../../components/GuardianFloatingTabBar';
import useNicoHeader from '../../hooks/useNicoHeader';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GuardianNavParamList } from '../../navigation';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT, BUTTERFLY_TILES,
} from '../../constants/theme';

type Nav = NativeStackNavigationProp<GuardianNavParamList>;

interface ServiceEntry {
  title: string;
  summary: string;
  audience: string;
  website: string;
}
interface ServiceCategory {
  title: string;
  services: ServiceEntry[];
}

// Static, non-admin-editable reference content — California I/DD support
// services directory. Update this array directly if the content changes.
// BUTTERFLY_TILES indices to use for category headings, in order — purple,
// green, orange — picked for clear contrast between adjacent headings.
const HEADING_COLOR_INDEXES = [5, 1, 2];

const CATEGORIES: ServiceCategory[] = [
  {
    title: 'Regional Centers & Early Intervention',
    services: [
      {
        title: 'California Regional Centers',
        summary: 'State-funded hubs providing lifelong service coordination, diagnostics, respite care, therapies, and behavioral interventions for individuals with developmental disabilities.',
        audience: 'Ages 0 to adulthood (Lanterman Act eligibility applies)',
        website: 'https://www.dds.ca.gov/rc/listings/',
      },
      {
        title: 'California Early Start',
        summary: "California's early intervention system providing speech, physical, and educational therapies directly to families with young children showing developmental delays.",
        audience: 'Infants and toddlers aged 0 to 36 months',
        website: 'https://www.dds.ca.gov/services/early-start/',
      },
      {
        title: 'Family Resource Centers (FRCs)',
        summary: 'Community networks staffed by experienced parents that offer peer-to-parent mentoring, emotional support, and local navigation assistance.',
        audience: 'Families of infants, toddlers, and young children with delays',
        website: 'https://www.dds.ca.gov/services/early-start/family-resource-center/',
      },
    ],
  },
  {
    title: 'Schooling & In-Home Assistance',
    services: [
      {
        title: 'Public School Special Education (IEP)',
        summary: 'District-provided evaluations and custom classroom accommodations, therapies, and specialized behavioral plans through an Individualized Education Program.',
        audience: 'School-aged children and young adults (Ages 3 to 22)',
        website: 'https://www.cde.ca.gov/sp/se/',
      },
      {
        title: 'In-Home Supportive Services (IHSS)',
        summary: 'County-administered financial aid paying for home care workers or funding 24-hour protective supervision to keep children with cognitive issues safe at home. Parents can often qualify as the paid provider.',
        audience: 'Children with severe functional or intellectual impairments',
        website: 'https://www.cdss.ca.gov/ihss-for-children',
      },
    ],
  },
  {
    title: 'Advocacy & Legal Support',
    services: [
      {
        title: 'Disability Rights California (DRC)',
        summary: 'Non-profit advocacy agency delivering free self-advocacy toolkits, legal help, and systemic representations to protect the rights of disabled individuals.',
        audience: 'Individuals with disabilities and their families statewide',
        website: 'https://www.disabilityrightsca.org/',
      },
    ],
  },
];

function displayUrl(url: string) {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export default function ResourcesScreen() {
  const navigation = useNavigation<Nav>();
  useNicoHeader(navigation);

  function openWebsite(url: string) {
    Linking.openURL(url).catch(() => {});
  }

  return (
    <View style={s.container}>
      <RainbowDivider />
      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <ContentContainer>
          <AppText style={s.pageTitle}>California Support Services</AppText>
          <AppText style={s.pageSubtitle}>
            A directory of California state and community programs for individuals with developmental disabilities and their families. These programs are specific to California — availability may differ if you're located elsewhere.
          </AppText>

          {CATEGORIES.map((category, ci) => {
            // Explicit, visually-distinct picks rather than cycling by index —
            // teal (0) and green (1) read as near-identical pale tints together.
            const headingBg = BUTTERFLY_TILES[HEADING_COLOR_INDEXES[ci % HEADING_COLOR_INDEXES.length]];
            return (
              <View key={category.title} style={s.categoryBlock}>
                <View style={[s.categoryHeading, { backgroundColor: headingBg.bg }]}>
                  <AppText style={[s.categoryTitle, { color: headingBg.accent }]}>{category.title}</AppText>
                </View>
                {category.services.map(svc => (
                  <View key={svc.title} style={s.card}>
                    <AppText style={s.cardTitle}>{svc.title}</AppText>
                    <AppText style={s.cardSummary}>{svc.summary}</AppText>
                    <AppText style={s.cardAudience}>
                      <AppText style={s.cardAudienceLabel}>Who it's for: </AppText>
                      <AppText style={s.cardAudienceValue}>{svc.audience}</AppText>
                    </AppText>
                    <TouchableOpacity onPress={() => openWebsite(svc.website)} activeOpacity={0.7}>
                      <AppText style={s.cardLink}>{displayUrl(svc.website)} →</AppText>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            );
          })}
        </ContentContainer>
      </ScrollView>

      <GuardianFloatingTabBar />
    </View>
  );
}

// Standard link blue — this app's palette has no blue of its own, and a link
// is one of the few places a color outside the butterfly/NICO set is justified.
const LINK_BLUE = '#007AFF';

const s = StyleSheet.create({
  container:     { flex: 1, backgroundColor: NICO.screenBg },
  scrollContent: { paddingTop: SPACING.lg, paddingHorizontal: SPACING.lg, paddingBottom: SPACING['2xl'] },

  pageTitle:    { ...TEXT_STYLE.screenTitle, marginBottom: SPACING.sm },
  pageSubtitle: { ...TEXT_STYLE.hint, fontSize: FONT_SIZE.md, lineHeight: 22, textAlign: 'justify', marginBottom: SPACING.xl },

  categoryBlock: { marginBottom: SPACING['2xl'] },
  categoryHeading: {
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.base,
    marginBottom: SPACING.lg,
    alignSelf: 'flex-start',
  },
  categoryTitle: { ...TEXT_STYLE.cardTitle },

  card: {
    backgroundColor: NICO.backgroundLight,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  cardTitle:         { ...TEXT_STYLE.bodyMedium, fontWeight: FONT_WEIGHT.extraBold, color: NICO.text, fontSize: FONT_SIZE.xl },
  cardSummary:       { fontSize: FONT_SIZE.md, color: NICO.text, lineHeight: 22, textAlign: 'justify' },
  cardAudience:      { lineHeight: 22 },
  cardAudienceLabel: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extraBold, color: NICO.text },
  cardAudienceValue: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semiBold, color: NICO.text },
  cardLink:          { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: LINK_BLUE, marginTop: SPACING.xs },
});
