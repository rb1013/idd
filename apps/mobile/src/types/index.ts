export type ComprehensionLevel = 'easy' | 'medium' | 'complex' | 'fluent';
export type FriendshipStatus = 'pending' | 'accepted' | 'rejected' | 'blocked';
export type NotificationType = 'friend_request' | 'message' | 'profile_change';
export type CategoryType = 'like' | 'dislike' | 'ability';

export interface Guardian {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  photo_url?: string;
  city?: string;
  state?: string;
  country?: string;
  situation_tags?: string[];
  created_at: string;
}

export interface UserProfile {
  id: string;
  guardian_id: string;
  name: string;
  age?: number | null;
  date_of_birth?: string | null;
  gender: string;
  languages: string[];
  photo_url?: string;
  city: string;
  region: string;
  country: string;
  email?: string;
  auth_user_id?: string;
  created_at: string;
  current_mood?: string | null;
  messaging_disabled?: boolean;
}

export interface ChatPreferences {
  user_id: string;
  open_to_online_chat: boolean;
  open_to_zoom: boolean;
  open_to_voice_chat: boolean;
  available_days: string[];
  available_time_start?: string;
  available_time_end?: string;
  comprehension_level: ComprehensionLevel;
}

export interface HealthInfo {
  user_id: string;
  willing_to_share: boolean;
  description?: string;
}

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
}

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at?: string;
}

export interface Conversation {
  id: string;
  created_at: string;
  participants?: UserProfile[];
  last_message?: Message;
}

export type TutorialFormat = 'video' | 'slideshow';
export type TutorialStatus = 'generating' | 'preview' | 'pending' | 'approved' | 'rejected';
export type TutorialSource = 'admin_upload' | 'ai_generated' | 'youtube';

export interface Tutorial {
  id: string;
  title: string;
  display_name: string | null;
  description: string;
  category: string;
  video_url: string | null;
  thumbnail_url?: string | null;
  created_at: string;
  // AI-generation columns (null on admin-uploaded rows)
  format: TutorialFormat;
  topic: string | null;
  category_id: string | null;
  comprehension_level: string;
  duration_seconds: number | null;
  status: TutorialStatus;
  source: TutorialSource;
  ai_prompt: string | null;
  created_by_guardian_id: string | null;
  link_count: number;
  admin_notes: string | null;
  updated_at: string | null;
  // Guardian input fields (null on older / admin-uploaded rows)
  core_action: string | null;
  visual_style: string | null;
  image_style: string | null;
  pacing_label: string | null;
  tone_label: string | null;
  background_audio: string | null;
  is_public: boolean;
  tutorial_error_code: number | null;
}

export interface TutorialFrame {
  id: string;
  tutorial_id: string;
  order_index: number;
  caption: string | null;
  tts_text: string | null;
  image_url: string | null;
  audio_url: string | null;
  image_prompt: string | null;
}

export interface TutorialWithFrames extends Tutorial {
  frames: TutorialFrame[];
}

export interface UserTutorial {
  id: string;
  user_id: string;
  tutorial_id: string;
  added_by_guardian_id: string | null;
  added_at: string;
  completed_at: string | null;
  tutorial?: Tutorial;
}

export interface GuardianNotificationSettings {
  guardian_id: string;
  notify_on_friend_request: boolean;
  notify_on_message: boolean;
  notify_on_profile_change: boolean;
}

export interface Notification {
  id: string;
  guardian_id: string;
  user_id: string;
  type: NotificationType;
  message: string;
  read: boolean;
  created_at: string;
}

export interface ScheduleTemplate {
  id: string;
  guardian_id: string;
  user_id: string;
  day_of_week: number; // 0 = Sun … 6 = Sat
  start_time: string;  // "HH:MM:SS"
  end_time: string;
  title: string;
  emoji: string;
  valid_from: string;  // ISO date "YYYY-MM-DD"
  valid_until: string;
  created_at: string;
}

export interface ScheduleEvent {
  id: string;
  guardian_id: string;
  user_id: string;
  event_date: string;  // "YYYY-MM-DD"
  start_time: string;
  end_time: string;
  title: string;
  emoji: string;
  is_cancellation: boolean;
  template_id: string | null;
  created_at: string;
}

export interface ScheduleItem {
  id: string;
  title: string;
  emoji: string;
  start_time: string;
  end_time: string;
}

export interface UserWithDetails extends UserProfile {
  likes: Category[];
  dislikes: Category[];
  abilities: Category[];
  chat_preferences?: ChatPreferences;
  health_info?: HealthInfo;
}
