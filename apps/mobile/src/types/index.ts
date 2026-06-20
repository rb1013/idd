export type ComprehensionLevel = 'easy' | 'medium' | 'complex' | 'fluent';
export type FriendshipStatus = 'pending' | 'accepted' | 'rejected' | 'blocked';
export type NotificationType = 'friend_request' | 'message' | 'profile_change';
export type CategoryType = 'like' | 'dislike' | 'ability';

export interface Guardian {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  guardian_id: string;
  name: string;
  age: number;
  gender: string;
  languages: string[];
  photo_url?: string;
  city: string;
  region: string;
  country: string;
  email?: string;
  auth_user_id?: string;
  created_at: string;
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

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  category: string;
  video_url: string;
  thumbnail_url?: string;
  created_at: string;
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

export interface UserWithDetails extends UserProfile {
  likes: Category[];
  dislikes: Category[];
  abilities: Category[];
  chat_preferences?: ChatPreferences;
  health_info?: HealthInfo;
}
