export const FONTS = {
  regular:   'Raleway_400Regular',
  medium:    'Raleway_500Medium',
  semiBold:  'Raleway_600SemiBold',
  bold:      'Raleway_700Bold',
  extraBold: 'Raleway_800ExtraBold',
  black:     'Raleway_900Black',
};

export const COLORS = {
  primary: '#4A90E2',
  primaryLight: '#D6E8FA',
  primaryDark: '#2F6BBF',
  secondary: '#5CBB7A',
  secondaryLight: '#D4F0DE',
  accent: '#F5A623',
  accentLight: '#FDE8C0',
  background: '#F7F9FC',
  surface: '#FFFFFF',
  text: '#2C3E50',
  textLight: '#7F8C8D',
  border: '#E2E8F0',
  error: '#E53E3E',
  success: '#5CBB7A',
  warning: '#F5A623',

  // ELIS guardian theme (Empathy · Learning · Inclusive · Support)
  bloomNavy: '#2D312E',    // Charcoal — primary buttons, nav headers
  bloomAccent: '#A2B997',  // Sage green — interactive, active states
  bloomDot: '#9BB2C4',     // Dusty sky blue — highlights, dots
  bloomBody: '#FDFBF7',    // Cream white — page background
  bloomCard: '#FFFFFF',    // White — card surfaces
  bloomBorder: '#E4E1DB',  // Warm stone border
  bloomMuted: '#525A53',   // Warm muted green-grey
  bloomText: '#2D312E',    // Charcoal — body text

  // ELIS active/selected state tints
  bloomActiveBg: '#E6EDE2',    // light sage — selected rows, active pills
  bloomTintBg: '#E2ECF3',      // sky-lt — quota pills, badge tints (Embrace sky-lt)
  bloomSageMid: '#C4D1BC',     // medium sage — secondary UI accents
  bloomActiveText: '#4A7C59',  // dark sage — badge text on bloomActiveBg
  bloomOnAccent: '#2D312E',    // charcoal — text/icons on sage (bloomAccent) backgrounds
  bloomOrange: '#C4804A',      // warm terracotta — learner section accent
  bloomOrangeLight: '#F5E6D8', // light tint — learner section backgrounds

  // Status — red / error family
  statusRed: '#FF6B6B',
  statusRedLight: '#FEE2E2',
  statusRedDark: '#DC2626',
  statusError: '#EF4444',

  // Status — green / approved family
  statusTeal: '#20C997',
  statusGreenDark: '#065F46',
  statusGreenLight: '#D1FAE5',

  // Status — amber / warning family
  statusAmber: '#F59E0B',
  statusAmberDark: '#92400E',
  statusAmberLight: '#FEF3C7',

  // Status — purple family
  statusPurple: '#845EF7',
  statusViolet: '#8B5CF6',
  statusDeepPurple: '#7C3AED',

  // Status — other accents
  statusPink: '#EC4899',
  statusBlue: '#3B82F6',

  // Status — neutrals
  statusGrey: '#E5E7EB',
  statusMidGrey: '#9CA3AF',
  statusDark: '#111827',
};

// ── Learner typography — change these to restyle all learner screens at once ──
const TERRA        = '#C4693A';
const TERRA_ACCENT = '#C4693A';
const L_TEXT       = '#2C3E50';
const L_MUTED      = '#7F8C8D';

export const USER_TEXT = {
  // Headings / names
  heading:   { fontSize: 22, fontWeight: '600' as const, color: L_TEXT },
  title:     { fontSize: 18, fontWeight: '600' as const, color: L_TEXT },
  // Body
  body:      { fontSize: 14, fontWeight: '400' as const, color: L_TEXT },
  bodyBold:  { fontSize: 14, fontWeight: '600' as const, color: L_TEXT },
  // Labels / captions
  label:     { fontSize: 12, fontWeight: '600' as const, color: L_MUTED },
  caption:   { fontSize: 11, fontWeight: '500' as const, color: L_MUTED },
  // Accent — terracotta
  accent:    { fontSize: 13, fontWeight: '600' as const, color: TERRA_ACCENT },
  // Greeting in header
  greeting:  { fontSize: 20, fontWeight: '700' as const, color: '#fff' },
  // Tile title & subtitle
  tileTitle: { fontSize: 16, fontWeight: '700' as const, color: L_TEXT },
  tileSub:   { fontSize: 13, fontWeight: '500' as const, color: '#4A5568' },
  // Schedule banner
  bannerTitle: { fontSize: 15, fontWeight: '600' as const, color: L_TEXT },
  bannerTime:  { fontSize: 11, fontWeight: '400' as const, color: '#4A5568' },
  bannerUntil: { fontSize: 13, fontWeight: '600' as const, color: TERRA },
};

// ── Learner header theme — edit here to retheme all learner screen headers ──
export const USER_HEADER = {
  backgroundColor: '#CF8660',           // terracotta — header background
  tintColor:       '#fff',              // text & icon color on the header
  btnBackground:   'rgba(255,255,255,0.82)', // circular action button bg
  borderTopLeftRadius:  28,
  borderTopRightRadius: 28,
  pageBackground:  '#FDFBF7',           // cream white — learner page background
};

// ── Learner tile palette — edit here to retheme all learner tile surfaces ──
export const USER_TILES = {
  friends:    { backgroundColor: '#E8F0E4', borderColor: '#A8C4A0' },
  activities: { backgroundColor: '#F5E4D8', borderColor: '#D4A888' },
  mood:       { backgroundColor: '#FDF0D4', borderColor: '#D4B860' },
  learn:      { backgroundColor: '#EAE4F4', borderColor: '#B4A8D8' },
};

// Ordered array — use for cycling tile colors across lists (index % 4)
export const USER_TILE_CYCLE = [
  USER_TILES.friends,
  USER_TILES.activities,
  USER_TILES.mood,
  USER_TILES.learn,
];

export const DAYS_OF_WEEK = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
];

export const COMPREHENSION_LEVELS = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'complex', label: 'Complex' },
  { value: 'fluent', label: 'Fluent' },
];

export const GENDERS = ['Male', 'Female', 'Prefer not to say'];

export const LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Mandarin',
  'Hindi', 'Arabic', 'Portuguese', 'Russian', 'Japanese',
];

export const TUTORIAL_TARGET_SKILLS = [
  'Speech & Communication',
  'Motor Skills',
  'Daily Living',
  'Social Skills',
  'Numeracy & Literacy',
  'Emotional Regulation',
];

export const TUTORIAL_VISUAL_STYLES = ['2D Animation', '3D Cartoon', 'Real Human'];
export const TUTORIAL_IMAGE_STYLES = ['Simple & Bold', 'Detailed', 'Symbol-Based'];
export const TUTORIAL_AUDIO = ['None', 'Calm Music', 'Upbeat Music'];
export const TUTORIAL_DURATIONS = [15, 20, 25, 30];
export const TUTORIAL_COMPREHENSION = ['easy', 'medium', 'complex', 'fluent'];

export const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California',
  'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia',
  'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland',
  'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri',
  'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
  'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
  'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
];

export function calcAge(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const birth = new Date(dob + 'T12:00:00');
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}
