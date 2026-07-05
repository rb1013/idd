export interface ActivityPreset {
  key: string;
  emoji: string;
  name: string;
  color: string;
  bgColor: string;
}

export const ACTIVITY_PRESETS: ActivityPreset[] = [
  { key: 'brush_teeth',   emoji: '🪥', name: 'Brush Teeth',   color: '#4A90E2', bgColor: '#EBF4FF' },
  { key: 'shower',        emoji: '🚿', name: 'Take a Shower', color: '#5CBB7A', bgColor: '#EDFBF2' },
  { key: 'get_dressed',   emoji: '👗', name: 'Get Dressed',   color: '#9B59B6', bgColor: '#F5EEFF' },
  { key: 'eat_breakfast', emoji: '🍳', name: 'Eat Breakfast', color: '#F5A623', bgColor: '#FFF8ED' },
  { key: 'take_medicine', emoji: '💊', name: 'Take Medicine', color: '#E53E3E', bgColor: '#FFF0F0' },
  { key: 'go_for_walk',   emoji: '🚶', name: 'Go for a Walk', color: '#1ABC9C', bgColor: '#E8FDFB' },
  { key: 'make_bed',      emoji: '🛏️', name: 'Make Bed',      color: '#E91E8C', bgColor: '#FFF0F8' },
  { key: 'read_book',     emoji: '📚', name: 'Read a Book',   color: '#2563EB', bgColor: '#EFF6FF' },
  { key: 'tidy_room',     emoji: '🧹', name: 'Tidy Room',     color: '#7C3AED', bgColor: '#F3EEFF' },
  { key: 'eat_lunch',     emoji: '🥗', name: 'Eat Lunch',     color: '#16A34A', bgColor: '#F0FDF4' },
  { key: 'eat_dinner',    emoji: '🍲', name: 'Eat Dinner',    color: '#D97706', bgColor: '#FFFBEB' },
  { key: 'drink_water',   emoji: '💧', name: 'Drink Water',   color: '#0891B2', bgColor: '#ECFEFF' },
  { key: 'art_craft',     emoji: '🎨', name: 'Art & Craft',   color: '#DC2626', bgColor: '#FFF1F2' },
  { key: 'music_time',    emoji: '🎵', name: 'Music Time',    color: '#9B59B6', bgColor: '#F5EEFF' },
  { key: 'calm_time',     emoji: '🧘', name: 'Calm Time',     color: '#4A90E2', bgColor: '#EBF4FF' },
  { key: 'feed_pet',      emoji: '🐕', name: 'Feed Pet',      color: '#F5A623', bgColor: '#FFF8ED' },
  { key: 'wash_hands',    emoji: '🧴', name: 'Wash Hands',    color: '#5CBB7A', bgColor: '#EDFBF2' },
  { key: 'rest_nap',      emoji: '😴', name: 'Rest / Nap',    color: '#E91E8C', bgColor: '#FFF0F8' },
];

export const PRESET_MAP: Record<string, ActivityPreset> = Object.fromEntries(
  ACTIVITY_PRESETS.map(p => [p.key, p]),
);
