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

      // ---- Admin Panel tables (migration 002) ----

      admin_roles: {
        Row: {
          id: string;
          user_id: string;
          role: string;
          granted_by: string | null;
          granted_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: string;
          granted_by?: string | null;
          granted_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: string;
          granted_by?: string | null;
          granted_at?: string;
        };
        Relationships: [];
      };

      role_permissions: {
        Row: {
          role: string;
          permissions: string[];
        };
        Insert: {
          role: string;
          permissions: string[];
        };
        Update: {
          role?: string;
          permissions?: string[];
        };
        Relationships: [];
      };

      policy_templates: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          config: Record<string, unknown>;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          config: Record<string, unknown>;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          config?: Record<string, unknown>;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };

      chat_templates: {
        Row: {
          id: string;
          chat_id: string;
          template_id: string | null;
          applied_at: string;
          last_checked_at: string | null;
          is_compliant: boolean;
          drift_details: Record<string, unknown> | null;
        };
        Insert: {
          id?: string;
          chat_id: string;
          template_id?: string | null;
          applied_at?: string;
          last_checked_at?: string | null;
          is_compliant?: boolean;
          drift_details?: Record<string, unknown> | null;
        };
        Update: {
          id?: string;
          chat_id?: string;
          template_id?: string | null;
          applied_at?: string;
          last_checked_at?: string | null;
          is_compliant?: boolean;
          drift_details?: Record<string, unknown> | null;
        };
        Relationships: [];
      };

      admin_audit_log: {
        Row: {
          id: number;
          admin_user_id: string | null;
          action_type: string;
          target_chat_id: string | null;
          target_user_id: string | null;
          payload: Record<string, unknown> | null;
          result_status: string | null;
          error_message: string | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          admin_user_id?: string | null;
          action_type: string;
          target_chat_id?: string | null;
          target_user_id?: string | null;
          payload?: Record<string, unknown> | null;
          result_status?: string | null;
          error_message?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          admin_user_id?: string | null;
          action_type?: string;
          target_chat_id?: string | null;
          target_user_id?: string | null;
          payload?: Record<string, unknown> | null;
          result_status?: string | null;
          error_message?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };

      chat_event_log: {
        Row: {
          id: number;
          chat_id: string;
          event_id: string;
          date: string;
          user_id: string | null;
          action: string | null;
          payload: Record<string, unknown> | null;
          collected_at: string;
        };
        Insert: {
          id?: number;
          chat_id: string;
          event_id: string;
          date: string;
          user_id?: string | null;
          action?: string | null;
          payload?: Record<string, unknown> | null;
          collected_at?: string;
        };
        Update: {
          id?: number;
          chat_id?: string;
          event_id?: string;
          date?: string;
          user_id?: string | null;
          action?: string | null;
          payload?: Record<string, unknown> | null;
          collected_at?: string;
        };
        Relationships: [];
      };

      chat_archive_state: {
        Row: {
          chat_id: number;
          last_collected_msg_id: number;
          last_collected_at: string | null;
          total_messages: number;
          total_files: number;
          is_enabled: boolean;
        };
        Insert: {
          chat_id: number;
          last_collected_msg_id?: number;
          last_collected_at?: string | null;
          total_messages?: number;
          total_files?: number;
          is_enabled?: boolean;
        };
        Update: {
          chat_id?: number;
          last_collected_msg_id?: number;
          last_collected_at?: string | null;
          total_messages?: number;
          total_files?: number;
          is_enabled?: boolean;
        };
        Relationships: [];
      };

      message_archive: {
        Row: {
          id: number;
          chat_id: number;
          message_id: number;
          sender_id: number | null;
          sender_name: string | null;
          text: string | null;
          date: string;
          media_type: string | null;
          media_file_path: string | null;
          media_file_name: string | null;
          media_file_size: number | null;
          reply_to_msg_id: number | null;
          forward_from: string | null;
          is_edited: boolean;
          raw_data: Record<string, unknown> | null;
          collected_at: string;
        };
        Insert: {
          id?: number;
          chat_id: number;
          message_id: number;
          sender_id?: number | null;
          sender_name?: string | null;
          text?: string | null;
          date: string;
          media_type?: string | null;
          media_file_path?: string | null;
          media_file_name?: string | null;
          media_file_size?: number | null;
          reply_to_msg_id?: number | null;
          forward_from?: string | null;
          is_edited?: boolean;
          raw_data?: Record<string, unknown> | null;
          collected_at?: string;
        };
        Update: {
          id?: number;
          chat_id?: number;
          message_id?: number;
          sender_id?: number | null;
          sender_name?: string | null;
          text?: string | null;
          date?: string;
          media_type?: string | null;
          media_file_path?: string | null;
          media_file_name?: string | null;
          media_file_size?: number | null;
          reply_to_msg_id?: number | null;
          forward_from?: string | null;
          is_edited?: boolean;
          raw_data?: Record<string, unknown> | null;
          collected_at?: string;
        };
        Relationships: [];
      };

      // ---- Agent Factory tables (migration 003) ----

      monitored_chats: {
        Row: {
          chat_id: number;
          title: string | null;
          monitoring_enabled: boolean;
          consent_obtained_at: string | null;
          assigned_agents: string[] | null;
          excluded_topics: string[] | null;
          created_at: string;
        };
        Insert: {
          chat_id: number;
          title?: string | null;
          monitoring_enabled?: boolean;
          consent_obtained_at?: string | null;
          assigned_agents?: string[] | null;
          excluded_topics?: string[] | null;
          created_at?: string;
        };
        Update: {
          chat_id?: number;
          title?: string | null;
          monitoring_enabled?: boolean;
          consent_obtained_at?: string | null;
          assigned_agents?: string[] | null;
          excluded_topics?: string[] | null;
          created_at?: string;
        };
        Relationships: [];
      };

      automation_patterns: {
        Row: {
          id: string;
          description: string;
          frequency: string | null;
          avg_duration_minutes: number | null;
          participants: number[] | null;
          sample_messages: Record<string, unknown> | null;
          estimated_roi_monthly: number | null;
          confidence: number | null;
          status: string;
          detected_at: string;
          reviewed_by: string | null;
          reviewed_at: string | null;
        };
        Insert: {
          id?: string;
          description: string;
          frequency?: string | null;
          avg_duration_minutes?: number | null;
          participants?: number[] | null;
          sample_messages?: Record<string, unknown> | null;
          estimated_roi_monthly?: number | null;
          confidence?: number | null;
          status?: string;
          detected_at?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
        };
        Update: {
          id?: string;
          description?: string;
          frequency?: string | null;
          avg_duration_minutes?: number | null;
          participants?: number[] | null;
          sample_messages?: Record<string, unknown> | null;
          estimated_roi_monthly?: number | null;
          confidence?: number | null;
          status?: string;
          detected_at?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
        };
        Relationships: [];
      };

      agents: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          status: string;
          pattern_id: string | null;
          workspace_path: string | null;
          model: string;
          gateway_id: string | null;
          permissions: Record<string, unknown>;
          config: Record<string, unknown>;
          assigned_chats: number[] | null;
          created_at: string;
          approved_by: string | null;
          approved_at: string | null;
          retired_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          status?: string;
          pattern_id?: string | null;
          workspace_path?: string | null;
          model: string;
          gateway_id?: string | null;
          permissions?: Record<string, unknown>;
          config?: Record<string, unknown>;
          assigned_chats?: number[] | null;
          created_at?: string;
          approved_by?: string | null;
          approved_at?: string | null;
          retired_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          status?: string;
          pattern_id?: string | null;
          workspace_path?: string | null;
          model?: string;
          gateway_id?: string | null;
          permissions?: Record<string, unknown>;
          config?: Record<string, unknown>;
          assigned_chats?: number[] | null;
          created_at?: string;
          approved_by?: string | null;
          approved_at?: string | null;
          retired_at?: string | null;
        };
        Relationships: [];
      };

      agent_metrics: {
        Row: {
          id: number;
          agent_id: string | null;
          period_start: string;
          period_end: string;
          executions: number;
          successful: number;
          failed: number;
          avg_response_time_ms: number | null;
          tokens_consumed: number;
          cost_usd: number;
          user_corrections: number;
          time_saved_minutes: number;
        };
        Insert: {
          id?: number;
          agent_id?: string | null;
          period_start: string;
          period_end: string;
          executions?: number;
          successful?: number;
          failed?: number;
          avg_response_time_ms?: number | null;
          tokens_consumed?: number;
          cost_usd?: number;
          user_corrections?: number;
          time_saved_minutes?: number;
        };
        Update: {
          id?: number;
          agent_id?: string | null;
          period_start?: string;
          period_end?: string;
          executions?: number;
          successful?: number;
          failed?: number;
          avg_response_time_ms?: number | null;
          tokens_consumed?: number;
          cost_usd?: number;
          user_corrections?: number;
          time_saved_minutes?: number;
        };
        Relationships: [];
      };

      agent_feedback: {
        Row: {
          id: number;
          agent_id: string | null;
          user_id: string | null;
          type: string;
          message: string | null;
          original_output: string | null;
          corrected_output: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          agent_id?: string | null;
          user_id?: string | null;
          type: string;
          message?: string | null;
          original_output?: string | null;
          corrected_output?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          agent_id?: string | null;
          user_id?: string | null;
          type?: string;
          message?: string | null;
          original_output?: string | null;
          corrected_output?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };

      agent_audit_log: {
        Row: {
          id: number;
          agent_id: string | null;
          action: string;
          chat_id: number | null;
          details: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          agent_id?: string | null;
          action: string;
          chat_id?: number | null;
          details?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          agent_id?: string | null;
          action?: string;
          chat_id?: number | null;
          details?: Record<string, unknown> | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
