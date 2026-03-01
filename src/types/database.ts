export interface Database {
  public: {
    Tables: {
      telegram_sessions: {
        Row: {
          id: string;
          user_id: string;
          session_data: string;
          dc_id: number | null;
          phone_hash: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_data: string;
          dc_id?: number | null;
          phone_hash?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_data?: string;
          dc_id?: number | null;
          phone_hash?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      cached_dialogs: {
        Row: {
          id: number;
          user_id: string;
          dialog_type: string;
          title: string | null;
          photo_path: string | null;
          last_message_text: string | null;
          last_message_date: string | null;
          unread_count: number;
          is_pinned: boolean;
          folder_id: number;
          raw_data: Record<string, unknown> | null;
          updated_at: string;
        };
        Insert: {
          id: number;
          user_id: string;
          dialog_type: string;
          title?: string | null;
          photo_path?: string | null;
          last_message_text?: string | null;
          last_message_date?: string | null;
          unread_count?: number;
          is_pinned?: boolean;
          folder_id?: number;
          raw_data?: Record<string, unknown> | null;
          updated_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          dialog_type?: string;
          title?: string | null;
          photo_path?: string | null;
          last_message_text?: string | null;
          last_message_date?: string | null;
          unread_count?: number;
          is_pinned?: boolean;
          folder_id?: number;
          raw_data?: Record<string, unknown> | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      cached_messages: {
        Row: {
          id: number;
          chat_id: number;
          user_id: string;
          sender_id: number | null;
          message_text: string | null;
          date: string;
          media_type: string | null;
          media_path: string | null;
          reply_to_id: number | null;
          is_outgoing: boolean;
          raw_data: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id: number;
          chat_id: number;
          user_id: string;
          sender_id?: number | null;
          message_text?: string | null;
          date: string;
          media_type?: string | null;
          media_path?: string | null;
          reply_to_id?: number | null;
          is_outgoing?: boolean;
          raw_data?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          chat_id?: number;
          user_id?: string;
          sender_id?: number | null;
          message_text?: string | null;
          date?: string;
          media_type?: string | null;
          media_path?: string | null;
          reply_to_id?: number | null;
          is_outgoing?: boolean;
          raw_data?: Record<string, unknown> | null;
          created_at?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          keys_p256dh: string;
          keys_auth: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          keys_p256dh: string;
          keys_auth: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          endpoint?: string;
          keys_p256dh?: string;
          keys_auth?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      user_settings: {
        Row: {
          user_id: string;
          theme: string;
          notifications_enabled: boolean;
          message_font_size: number;
          language: string;
          settings_json: Record<string, unknown>;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          theme?: string;
          notifications_enabled?: boolean;
          message_font_size?: number;
          language?: string;
          settings_json?: Record<string, unknown>;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          theme?: string;
          notifications_enabled?: boolean;
          message_font_size?: number;
          language?: string;
          settings_json?: Record<string, unknown>;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
