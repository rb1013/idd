export interface CountryCode {
  code: string;
  flag: string;
  name: string;
}

export const COUNTRY_CODES: CountryCode[] = [
  { code: '+1',    flag: '🇺🇸', name: 'United States / Canada' },
  { code: '+7',    flag: '🇷🇺', name: 'Russia' },
  { code: '+20',   flag: '🇪🇬', name: 'Egypt' },
  { code: '+27',   flag: '🇿🇦', name: 'South Africa' },
  { code: '+31',   flag: '🇳🇱', name: 'Netherlands' },
  { code: '+32',   flag: '🇧🇪', name: 'Belgium' },
  { code: '+33',   flag: '🇫🇷', name: 'France' },
  { code: '+34',   flag: '🇪🇸', name: 'Spain' },
  { code: '+39',   flag: '🇮🇹', name: 'Italy' },
  { code: '+41',   flag: '🇨🇭', name: 'Switzerland' },
  { code: '+43',   flag: '🇦🇹', name: 'Austria' },
  { code: '+44',   flag: '🇬🇧', name: 'United Kingdom' },
  { code: '+45',   flag: '🇩🇰', name: 'Denmark' },
  { code: '+46',   flag: '🇸🇪', name: 'Sweden' },
  { code: '+47',   flag: '🇳🇴', name: 'Norway' },
  { code: '+48',   flag: '🇵🇱', name: 'Poland' },
  { code: '+49',   flag: '🇩🇪', name: 'Germany' },
  { code: '+51',   flag: '🇵🇪', name: 'Peru' },
  { code: '+52',   flag: '🇲🇽', name: 'Mexico' },
  { code: '+54',   flag: '🇦🇷', name: 'Argentina' },
  { code: '+55',   flag: '🇧🇷', name: 'Brazil' },
  { code: '+56',   flag: '🇨🇱', name: 'Chile' },
  { code: '+57',   flag: '🇨🇴', name: 'Colombia' },
  { code: '+58',   flag: '🇻🇪', name: 'Venezuela' },
  { code: '+60',   flag: '🇲🇾', name: 'Malaysia' },
  { code: '+61',   flag: '🇦🇺', name: 'Australia' },
  { code: '+62',   flag: '🇮🇩', name: 'Indonesia' },
  { code: '+63',   flag: '🇵🇭', name: 'Philippines' },
  { code: '+64',   flag: '🇳🇿', name: 'New Zealand' },
  { code: '+65',   flag: '🇸🇬', name: 'Singapore' },
  { code: '+81',   flag: '🇯🇵', name: 'Japan' },
  { code: '+82',   flag: '🇰🇷', name: 'South Korea' },
  { code: '+86',   flag: '🇨🇳', name: 'China' },
  { code: '+90',   flag: '🇹🇷', name: 'Turkey' },
  { code: '+91',   flag: '🇮🇳', name: 'India' },
  { code: '+92',   flag: '🇵🇰', name: 'Pakistan' },
  { code: '+94',   flag: '🇱🇰', name: 'Sri Lanka' },
  { code: '+98',   flag: '🇮🇷', name: 'Iran' },
  { code: '+234',  flag: '🇳🇬', name: 'Nigeria' },
  { code: '+254',  flag: '🇰🇪', name: 'Kenya' },
  { code: '+351',  flag: '🇵🇹', name: 'Portugal' },
  { code: '+353',  flag: '🇮🇪', name: 'Ireland' },
  { code: '+880',  flag: '🇧🇩', name: 'Bangladesh' },
  { code: '+966',  flag: '🇸🇦', name: 'Saudi Arabia' },
  { code: '+971',  flag: '🇦🇪', name: 'UAE' },
  { code: '+977',  flag: '🇳🇵', name: 'Nepal' },
  { code: '+1868', flag: '🇹🇹', name: 'Trinidad & Tobago' },
  { code: '+1876', flag: '🇯🇲', name: 'Jamaica' },
];

// Parse a stored E.164 phone string back into { code, local }.
// Tries longest code first to avoid +1 swallowing +1876.
export function parseStoredPhone(raw: string | null | undefined): { code: string; local: string } {
  if (!raw) return { code: '+1', local: '' };
  const sorted = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
  const match  = sorted.find(c => raw.startsWith(c.code));
  if (match) return { code: match.code, local: raw.slice(match.code.length) };
  return { code: '+1', local: raw.replace(/\D/g, '') };
}

export function validatePhone(code: string, local: string): string | null {
  const digits = local.replace(/\D/g, '');
  if (!digits) return 'Phone number is required';
  if (digits.length < 7)  return 'Phone number is too short';
  if (digits.length > 15) return 'Phone number is too long (max 15 digits, e.g. 2025550123 for a US number)';
  return null;
}

// Returns E.164: country code + digits only
export function buildE164(code: string, local: string): string {
  return `${code}${local.replace(/\D/g, '')}`;
}
