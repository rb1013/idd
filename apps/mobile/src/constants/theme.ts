/**
 * NICO Design System — single source of truth.
 *
 * HOW TO USE:
 *   import { NICO, FONT_SIZE, TEXT_STYLE, SPACING, RADIUS, SHADOW, BTN, INPUT } from '../constants/theme';
 *
 * MIGRATION:
 *   Gradually replace COLORS.xxx / bloomXxx / USER_TEXT / USER_HEADER / USER_TILES
 *   references with tokens from this file. Do NOT edit raw hex values in components.
 *
 * THEMING:
 *   To change the primary colour app-wide, edit NICO.primary (and NICO.primaryLight/Dark).
 *   To retheme the learner header, edit NICO.learnerHeader.
 */

import { Dimensions } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSIVE SCALE
// ─────────────────────────────────────────────────────────────────────────────

const { width, height } = Dimensions.get('window');

/**
 * True when the app is running on a tablet-class screen.
 * Threshold: shortest side ≥ 768pt (covers all iPad models).
 */
export const IS_TABLET = Math.min(width, height) >= 768;

/**
 * Moderate scale factor applied to font sizes, spacing, and touch targets.
 * Deliberately NOT the full proportional ratio — a full 375→768 scale would
 * make text and padding look enormous on iPad. 1.25 gives comfortable sizing
 * without inflating the UI.
 *
 * If the app ever supports iPad split-screen or Stage Manager, replace
 * this static check with `useWindowDimensions()` inside a ThemeProvider.
 */
const TABLET_SCALE = 1.25;

/**
 * Scale a raw design value for the current device class.
 * Phone → value unchanged. Tablet → value × TABLET_SCALE, rounded to integer.
 *
 * Usage: only needed if you compute a value outside the theme tokens.
 * Prefer spreading FONT_SIZE / SPACING / BTN_SIZE directly.
 */
export const scale = (value: number): number =>
  IS_TABLET ? Math.round(value * TABLET_SCALE) : value;

// ─────────────────────────────────────────────────────────────────────────────
// COLOUR PALETTE
// ─────────────────────────────────────────────────────────────────────────────

export const NICO = {

  // ── Primary interactive ─────────────────────────────────────────────────
  // Used for: buttons, nav active state, links, active tab underline, FAB.
  // Currently: slate grey. Change here to retheme all interactive elements.
  primary:      '#5B656F',   // ← adjust this to change the primary color
  primaryLight: '#ECEEF1',   // tinted background — chips, active rows, badges
  primaryDark:  '#3E4E5C',   // pressed / focus state

  // ── Brand butterfly accents — extracted from logo gradient ────────────
  // Six colour zones running left-wing → body → right-wing:
  teal:        '#3EC9BE',   // left upper wing
  tealLight:   '#DFF5F3',

  green:       '#52C9A0',   // left wing mid (teal→orange transition)
  greenLight:  '#E3F5EE',

  orange:      '#F5921C',   // center body / wing crossing
  orangeLight: '#FEF0E0',

  coral:       '#F07248',   // orange-to-warm tip (orange→red transition)
  coralLight:  '#FDEADF',

  pink:        '#CC6DA8',   // right upper wing near antennae
  pinkLight:   '#F8E6F3',

  purple:      '#9B6EC9',   // right wing
  purpleLight: '#EDE6F7',

  // ── Backgrounds & surfaces ──────────────────────────────────────────────
  background:  '#E8E7E5',   // page background — warm off-white
  surface:     '#FFFFFF',   // card, sheet, input surface
  surfaceAlt:  '#FDFBF7',   // slightly warmer surface (learner screens)

  // ── Borders & dividers ──────────────────────────────────────────────────
  border:      '#E5E2DE',   // standard border
  borderStrong:'#C8C4BE',   // emphasis border (active inputs, selected cards)

  // ── Typography ──────────────────────────────────────────────────────────
  text:        '#1C2B39',   // primary text — deep navy-charcoal
  textMuted:   '#4D5760',   // secondary text, placeholders, captions
  textOnAccent:'#FFFFFF',   // text on primary/teal/orange/purple backgrounds

  // ── Semantic ────────────────────────────────────────────────────────────
  error:       '#E53E3E',
  errorLight:  '#FEE2E2',
  success:     '#1FA85C',   // distinct from teal — positive confirmations
  successLight:'#D4F5E2',
  warning:     '#F59E0B',
  warningLight:'#FEF3C7',

  // ── Learner identity ────────────────────────────────────────────────────
  // The learner header/hero keeps its terracotta — it gives learner screens
  // a warm, distinctive feel separate from the guardian grey.
  heroPill:           'rgba(255,255,255,0.20)',  // frosted pill bg on coloured hero headers

  learnerHeader:      '#CF8660',
  learnerHeaderLight: '#FDEADB',
  learnerHeaderBtn:   'rgba(255,255,255,0.82)',

};

/**
 * Butterfly tile palette — all 6 gradient zones, usable for any tile/card.
 * Assign by slot index: BUTTERFLY_TILES[index % 6]
 * Each entry: { bg, accent } where bg is the tile background and accent is
 * the text/icon/border colour.
 */
export const BUTTERFLY_TILES = [
  { bg: NICO.tealLight,   accent: NICO.teal   },  // 0 — left upper wing
  { bg: NICO.greenLight,  accent: NICO.green  },  // 1 — teal-orange transition
  { bg: NICO.orangeLight, accent: NICO.orange },  // 2 — center body
  { bg: NICO.coralLight,  accent: NICO.coral  },  // 3 — warm tip
  { bg: NICO.pinkLight,   accent: NICO.pink   },  // 4 — right upper wing
  { bg: NICO.purpleLight, accent: NICO.purple },  // 5 — right wing
] as const;

// Cycle shorthand: index % 6
export const LEARNER_TILE_CYCLE = BUTTERFLY_TILES;

/**
 * Gradient border using all 6 butterfly hues, left → right.
 * Usage: wrap target View in a LinearGradient with paddingBottom/sides = width,
 * then place the content View (with matching borderRadius) inside.
 * Import BUTTERFLY_BORDER from theme and spread colors into LinearGradient.
 */
export const BUTTERFLY_BORDER = {
  colors: [
    NICO.teal, NICO.green, NICO.orange, NICO.coral, NICO.pink, NICO.purple,
  ] as const,
  width: 3,
  start: { x: 0, y: 0 } as const,
  end:   { x: 1, y: 0 } as const,
};


// ─────────────────────────────────────────────────────────────────────────────
// TYPOGRAPHY
// ─────────────────────────────────────────────────────────────────────────────

/** Numeric font sizes — auto-scaled for tablet. Use FONT_SIZE.xx in StyleSheet. */
export const FONT_SIZE = {
  xs:    scale(11),   // chip labels, badge counts, fine print
  sm:    scale(12),   // timestamps, secondary meta, error messages
  base:  scale(13),   // supporting body / hints
  md:    scale(14),   // standard body, list item secondary
  lg:    scale(15),   // primary body text, form fields, list item primary
  xl:    scale(16),   // button text, card titles, tab labels
  '2xl': scale(18),   // sub-headings, modal titles, stat numbers
  '3xl': scale(20),   // screen headers
  '4xl': scale(22),   // large headings
  '5xl': scale(28),   // display numbers, hero callouts
};

/** Numeric font weights mapped to named roles. */
export const FONT_WEIGHT = {
  regular:   '400' as const,
  medium:    '500' as const,
  semiBold:  '600' as const,
  bold:      '700' as const,
  extraBold: '800' as const,
  black:     '900' as const,
};

/**
 * Pre-composed text styles.
 * Spread into your StyleSheet: `{ ...TEXT_STYLE.body, marginTop: 4 }`
 */
export const TEXT_STYLE = {

  // ── Headings ──────────────────────────────────────────────────────────
  displayHero:  { fontSize: FONT_SIZE['5xl'], fontWeight: FONT_WEIGHT.black,     color: NICO.text },
  screenTitle:  { fontSize: FONT_SIZE['3xl'], fontWeight: FONT_WEIGHT.black,     color: NICO.text },
  sectionTitle: { fontSize: FONT_SIZE['4xl'], fontWeight: FONT_WEIGHT.extraBold, color: NICO.text },
  cardTitle:    { fontSize: FONT_SIZE['2xl'], fontWeight: FONT_WEIGHT.extraBold, color: NICO.text },
  modalTitle:   { fontSize: FONT_SIZE['2xl'], fontWeight: FONT_WEIGHT.bold,      color: NICO.text },

  // ── Section label (ALL CAPS, small) ───────────────────────────────────
  sectionLabel: {
    fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.extraBold,
    color: NICO.textMuted, textTransform: 'uppercase' as const, letterSpacing: 1,
  },

  // ── Body ──────────────────────────────────────────────────────────────
  bodyLarge:  { fontSize: FONT_SIZE.xl,   fontWeight: FONT_WEIGHT.regular,  color: NICO.text },
  body:       { fontSize: FONT_SIZE.lg,   fontWeight: FONT_WEIGHT.regular,  color: NICO.text },
  bodyMedium: { fontSize: FONT_SIZE.lg,   fontWeight: FONT_WEIGHT.semiBold, color: NICO.text },
  bodySmall:  { fontSize: FONT_SIZE.md,   fontWeight: FONT_WEIGHT.regular,  color: NICO.text },
  hint:       { fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.medium,   color: NICO.textMuted },

  // ── Labels & captions ─────────────────────────────────────────────────
  label:      { fontSize: FONT_SIZE.lg,   fontWeight: FONT_WEIGHT.bold,     color: NICO.text },
  labelSmall: { fontSize: FONT_SIZE.sm,   fontWeight: FONT_WEIGHT.bold,     color: NICO.textMuted },
  caption:    { fontSize: FONT_SIZE.xs,   fontWeight: FONT_WEIGHT.semiBold, color: NICO.textMuted },

  // ── Interactive ───────────────────────────────────────────────────────
  buttonPrimary: { fontSize: FONT_SIZE.xl,   fontWeight: FONT_WEIGHT.extraBold, color: NICO.textOnAccent },
  buttonSmall:   { fontSize: FONT_SIZE.lg,   fontWeight: FONT_WEIGHT.extraBold, color: NICO.textOnAccent },
  link:          { fontSize: FONT_SIZE.lg,   fontWeight: FONT_WEIGHT.bold,      color: NICO.primary, textDecorationLine: 'underline' as const },
  linkSmall:     { fontSize: FONT_SIZE.sm,   fontWeight: FONT_WEIGHT.bold,      color: NICO.primary, textDecorationLine: 'underline' as const },

  // ── Form ──────────────────────────────────────────────────────────────
  fieldLabel:   { fontSize: FONT_SIZE.lg,  fontWeight: FONT_WEIGHT.bold,    color: NICO.text },
  fieldValue:   { fontSize: FONT_SIZE.lg,  fontWeight: FONT_WEIGHT.regular, color: NICO.text },
  placeholder:  { fontSize: FONT_SIZE.lg,  fontWeight: FONT_WEIGHT.regular, color: NICO.textMuted },
  errorMessage: { fontSize: FONT_SIZE.sm,  fontWeight: FONT_WEIGHT.semiBold,color: NICO.error },

  // ── Learner (larger, bolder — designed for accessibility) ─────────────
  learnerTileTitle: { fontSize: FONT_SIZE.xl,   fontWeight: FONT_WEIGHT.bold,  color: NICO.text },
  learnerTileSub:   { fontSize: FONT_SIZE.md,   fontWeight: FONT_WEIGHT.medium,color: NICO.textMuted },
  learnerGreeting:  { fontSize: FONT_SIZE['3xl'],fontWeight: FONT_WEIGHT.black, color: NICO.textOnAccent },
};


// ─────────────────────────────────────────────────────────────────────────────
// SPACING
// ─────────────────────────────────────────────────────────────────────────────

/** 8-point spacing scale — auto-scaled for tablet. Use for padding, margin, gap. */
export const SPACING = {
  xs:    scale(4),
  sm:    scale(8),
  md:    scale(12),
  base:  scale(16),
  lg:    scale(20),
  xl:    scale(24),
  '2xl': scale(32),
  '3xl': scale(48),
};


// ─────────────────────────────────────────────────────────────────────────────
// BORDER RADIUS
// ─────────────────────────────────────────────────────────────────────────────

export const RADIUS = {
  xs:    6,     // chips, small tags
  sm:    8,     // small buttons, inline badges
  md:    12,    // inputs, small modals
  lg:    14,    // standard cards, action tiles
  xl:    18,    // large tiles
  '2xl': 22,    // hero cards, bottom sheet items
  '3xl': 28,    // modals, bottom sheets
  full:  9999,  // pills, avatars, circular buttons
};


// ─────────────────────────────────────────────────────────────────────────────
// SHADOWS
// ─────────────────────────────────────────────────────────────────────────────

export const SHADOW = {
  none: {},
  sm: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  md: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  lg: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10, shadowRadius: 12, elevation: 4,
  },
  xl: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16, shadowRadius: 20, elevation: 8,
  },
  // Colored glow shadows for buttons — match the button's background color
  // so the shadow reads as a soft elevation of the button itself.
  btnPrimary: {
    shadowColor: NICO.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.38, shadowRadius: 10, elevation: 6,
  },
  btnTeal: {
    shadowColor: NICO.teal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.38, shadowRadius: 10, elevation: 6,
  },
  btnDanger: {
    shadowColor: NICO.error,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.38, shadowRadius: 10, elevation: 6,
  },
};


// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT PRESETS
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// BUTTON SIZES
// Separate from variant (primary/outline/ghost) so they compose freely.
// Usage: style={[BTN.size.md, BTN.variant.primary]}
// ─────────────────────────────────────────────────────────────────────────────

export const BTN_SIZE = {
  /** Small — inline actions, filter chips */
  sm: {
    paddingVertical:   SPACING.xs,      // 4  (5 tablet)
    paddingHorizontal: SPACING.md,      // 12 (15 tablet)
    borderRadius:      RADIUS.lg,       // 14 — pill-like even at small size
    minHeight:         scale(32),
  },
  /** Medium — secondary buttons, modal actions */
  md: {
    paddingVertical:   SPACING.sm + 2,  // 10 (12 tablet)
    paddingHorizontal: SPACING.base,    // 16 (20 tablet)
    borderRadius:      RADIUS.xl,       // 18 — clearly pill-shaped
    minHeight:         scale(40),
  },
  /** Large — primary CTA (Sign In, Save Changes, Create Event) */
  lg: {
    paddingVertical:   SPACING.sm,      // 8 (10 tablet)
    paddingHorizontal: scale(36),       // content-width pill
    borderRadius:      RADIUS['2xl'],   // 22 — matches FAB/New Discussion style
    minHeight:         scale(38),
    alignSelf:         'center' as const,
  },
};

/**
 * Button variants — colour only, no size.
 * Spread with a size: `style={[BTN_SIZE.lg, BTN_VARIANT.primary]}`
 */
export const BTN_VARIANT = {
  // Colored shadow matches the button background for a lifted, glowing look.
  primary: {
    backgroundColor: NICO.primary,
    alignItems: 'center' as const,
    ...SHADOW.btnPrimary,
  },
  // Outline — no shadow (transparent bg would make shadow look odd)
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: NICO.primary,
    alignItems: 'center' as const,
  },
  // Ghost — subtle tinted fill, no shadow
  ghost: {
    backgroundColor: NICO.primaryLight,
    alignItems: 'center' as const,
  },
  teal: {
    backgroundColor: NICO.teal,
    alignItems: 'center' as const,
    ...SHADOW.btnTeal,
  },
  danger: {
    backgroundColor: NICO.error,
    alignItems: 'center' as const,
    ...SHADOW.btnDanger,
  },
};

/**
 * Convenience shortcuts — pre-combined size + variant for the most common cases.
 * `style={BTN.primaryLg}` is equivalent to `style={[BTN_SIZE.lg, BTN_VARIANT.primary]}`
 */
export const BTN = {
  // Large primary — main CTAs
  primaryLg:  { ...BTN_SIZE.lg, ...BTN_VARIANT.primary  },
  outlineLg:  { ...BTN_SIZE.lg, ...BTN_VARIANT.outline   },
  dangerLg:   { ...BTN_SIZE.lg, ...BTN_VARIANT.danger    },

  // Medium — secondary / modal actions
  primaryMd:  { ...BTN_SIZE.md, ...BTN_VARIANT.primary  },
  outlineMd:  { ...BTN_SIZE.md, ...BTN_VARIANT.outline   },
  ghostMd:    { ...BTN_SIZE.md, ...BTN_VARIANT.ghost     },

  // Small — inline / filter actions
  primarySm:  { ...BTN_SIZE.sm, ...BTN_VARIANT.primary  },
  ghostSm:    { ...BTN_SIZE.sm, ...BTN_VARIANT.ghost     },
  outlineSm:  { ...BTN_SIZE.sm, ...BTN_VARIANT.outline   },
};

/** Base TextInput style. */
export const INPUT = {
  base: {
    backgroundColor: NICO.surface,
    borderWidth: 1.5,
    borderColor: NICO.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.lg,
    color: NICO.text,
  },
};

/** Standard card container. */
export const CARD = {
  base: {
    backgroundColor: NICO.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: NICO.border,
    padding: SPACING.base,
    ...SHADOW.md,
  },
};


// ─────────────────────────────────────────────────────────────────────────────
// PILLS & CHIPS
// Pills = rounded status/filter labels.  Chips = interactive toggles.
// Usage: style={[PILL.size.sm, PILL.color.teal]}
// ─────────────────────────────────────────────────────────────────────────────

export const PILL_SIZE = {
  /** Micro — badge counts, tiny status dots with text */
  xs: {
    paddingVertical:   2,
    paddingHorizontal: SPACING.sm,       // 8
    borderRadius:      RADIUS.full,
    // font: FONT_SIZE.xs (11)
  },
  /** Small — category chips, filter tags, section pills */
  sm: {
    paddingVertical:   SPACING.xs,       // 4
    paddingHorizontal: SPACING.md,       // 12
    borderRadius:      RADIUS.full,
    // font: FONT_SIZE.xs (11) or FONT_SIZE.sm (12)
  },
  /** Medium — active tab indicator pills, "FOR YOU" section headers */
  md: {
    paddingVertical:   SPACING.xs + 1,   // 5
    paddingHorizontal: SPACING.md,       // 12
    borderRadius:      RADIUS.full,
    // font: FONT_SIZE.sm (12)
  },
  /** Large — prominent filter pills, selected state toggles */
  lg: {
    paddingVertical:   SPACING.sm,       // 8
    paddingHorizontal: SPACING.base,     // 16
    borderRadius:      RADIUS.full,
    // font: FONT_SIZE.base (13) or FONT_SIZE.md (14)
  },
};

/** Pill colour variants — background + text colour pairs. */
export const PILL_COLOR = {
  primary:  { backgroundColor: NICO.primary,      /* text: textOnAccent #fff    */ },
  ghost:    { backgroundColor: NICO.primaryLight,  /* text: primary              */ },
  teal:     { backgroundColor: NICO.tealLight,     /* text: teal                 */ },
  orange:   { backgroundColor: NICO.orangeLight,   /* text: orange               */ },
  purple:   { backgroundColor: NICO.purpleLight,   /* text: purple               */ },
  neutral:  { backgroundColor: NICO.border,        /* text: textMuted            */ },
  success:  { backgroundColor: NICO.successLight,  /* text: success              */ },
  error:    { backgroundColor: NICO.errorLight,    /* text: error                */ },
  warning:  { backgroundColor: NICO.warningLight,  /* text: warning              */ },
};

/**
 * Convenience shortcuts for the most common pill combos.
 * `style={PILL.categoryTeal}` → small teal chip (e.g. discussion category).
 * `style={PILL.sectionHeader}` → medium ghost pill (e.g. "FOR YOU" label).
 */
export const PILL = {
  // Category / content chips
  categoryTeal:   { ...PILL_SIZE.sm, ...PILL_COLOR.teal   },
  categoryOrange: { ...PILL_SIZE.sm, ...PILL_COLOR.orange },
  categoryPurple: { ...PILL_SIZE.sm, ...PILL_COLOR.purple },
  categoryGhost:  { ...PILL_SIZE.sm, ...PILL_COLOR.ghost  },

  // Section header pills ("FOR YOU", "FOR YOUR LEARNER")
  sectionHeader:  { ...PILL_SIZE.md, backgroundColor: '#E6EDE2' /* sage tint */ },

  // Status badges
  badgeSuccess:   { ...PILL_SIZE.xs, ...PILL_COLOR.success },
  badgeError:     { ...PILL_SIZE.xs, ...PILL_COLOR.error   },
  badgeWarning:   { ...PILL_SIZE.xs, ...PILL_COLOR.warning },
  badgeNeutral:   { ...PILL_SIZE.xs, ...PILL_COLOR.neutral },
  badgePrimary:   { ...PILL_SIZE.xs, ...PILL_COLOR.primary },

  // Selected filter pill (active state)
  filterActive:   { ...PILL_SIZE.lg, ...PILL_COLOR.primary },
  filterInactive: { ...PILL_SIZE.lg, ...PILL_COLOR.ghost   },
};
