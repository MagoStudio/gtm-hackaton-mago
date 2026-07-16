export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agent_api_keys: {
        Row: {
          agent_name: string
          created_at: string
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          scopes: Json
          user_id: string
        }
        Insert: {
          agent_name: string
          created_at?: string
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          scopes?: Json
          user_id: string
        }
        Update: {
          agent_name?: string
          created_at?: string
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          scopes?: Json
          user_id?: string
        }
        Relationships: []
      }
      agent_conversations: {
        Row: {
          agent_type: string
          content: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          user_id: string
        }
        Insert: {
          agent_type: string
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          user_id: string
        }
        Update: {
          agent_type?: string
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_memories: {
        Row: {
          agent_type: string
          content: string
          created_at: string
          embedding: string | null
          id: string
          memory_type: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          agent_type: string
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          memory_type?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          agent_type?: string
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          memory_type?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      agent_settings: {
        Row: {
          agent_type: string
          id: string
          settings: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_type: string
          id?: string
          settings?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_type?: string
          id?: string
          settings?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string
          actor_label: string | null
          actor_type: string
          created_at: string
          id: string
          metadata: Json | null
          resource_id: string | null
          resource_type: string | null
        }
        Insert: {
          action: string
          actor_id: string
          actor_label?: string | null
          actor_type: string
          created_at?: string
          id?: string
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          actor_label?: string | null
          actor_type?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
        }
        Relationships: []
      }
      bot_configs: {
        Row: {
          created_at: string
          id: string
          identity: Json | null
          instructions: string | null
          model_preference: string | null
          name: string
          soul: string | null
          tools_notes: string | null
          updated_at: string
          user_id: string
          user_profile: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          identity?: Json | null
          instructions?: string | null
          model_preference?: string | null
          name?: string
          soul?: string | null
          tools_notes?: string | null
          updated_at?: string
          user_id: string
          user_profile?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          identity?: Json | null
          instructions?: string | null
          model_preference?: string | null
          name?: string
          soul?: string | null
          tools_notes?: string | null
          updated_at?: string
          user_id?: string
          user_profile?: string | null
        }
        Relationships: []
      }
      bot_skills: {
        Row: {
          bot_id: string
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          instructions: string | null
          name: string
          tool_definitions: Json | null
        }
        Insert: {
          bot_id: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          instructions?: string | null
          name: string
          tool_definitions?: Json | null
        }
        Update: {
          bot_id?: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          instructions?: string | null
          name?: string
          tool_definitions?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_skills_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bot_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_contacts: {
        Row: {
          company: string | null
          created_at: string
          deal_id: string
          email: string | null
          first_name: string | null
          id: string
          is_champion: boolean
          job_title: string | null
          last_name: string | null
          linkedin_url: string | null
          notes: string | null
          phone: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          deal_id: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_champion?: boolean
          job_title?: string | null
          last_name?: string | null
          linkedin_url?: string | null
          notes?: string | null
          phone?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          deal_id?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_champion?: boolean
          job_title?: string | null
          last_name?: string | null
          linkedin_url?: string | null
          notes?: string | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_contacts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_interactions: {
        Row: {
          body: string | null
          contact_email: string | null
          created_at: string
          deal_id: string
          external_id: string | null
          id: string
          interaction_type: string
          metadata: Json | null
          occurred_at: string
          source: string
          subject: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          contact_email?: string | null
          created_at?: string
          deal_id: string
          external_id?: string | null
          id?: string
          interaction_type: string
          metadata?: Json | null
          occurred_at?: string
          source?: string
          subject?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          contact_email?: string | null
          created_at?: string
          deal_id?: string
          external_id?: string | null
          id?: string
          interaction_type?: string
          metadata?: Json | null
          occurred_at?: string
          source?: string
          subject?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_interactions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_notes: {
        Row: {
          author: string | null
          content: string
          created_at: string
          deal_id: string
          granola_meeting_id: string | null
          id: string
          note_type: string
        }
        Insert: {
          author?: string | null
          content: string
          created_at?: string
          deal_id: string
          granola_meeting_id?: string | null
          id?: string
          note_type?: string
        }
        Update: {
          author?: string | null
          content?: string
          created_at?: string
          deal_id?: string
          granola_meeting_id?: string | null
          id?: string
          note_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_notes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          actual_acv: number | null
          address: string | null
          closed_date: string | null
          company: string | null
          company_size: string | null
          company_vertical: string | null
          country: string | null
          created_at: string
          deal_value: number | null
          description: string | null
          email: string | null
          employee_count: string | null
          entity_type: string | null
          external_id: string | null
          first_name: string | null
          fit_reason: string | null
          fit_score: number | null
          funding_stage: string | null
          icp_key: string | null
          id: string
          job_title: string | null
          last_interaction: string | null
          last_name: string | null
          linkedin_url: string | null
          lost_reason: string | null
          nb_interactions: number | null
          next_steps: string | null
          pain_points: string[] | null
          phone: string | null
          product_hooks: string[] | null
          prospect_owner: string | null
          recent_signals: string[] | null
          region: string | null
          status: string
          strongest_connection: string | null
          tech_stack: string[] | null
          upload_id: string
        }
        Insert: {
          actual_acv?: number | null
          address?: string | null
          closed_date?: string | null
          company?: string | null
          company_size?: string | null
          company_vertical?: string | null
          country?: string | null
          created_at?: string
          deal_value?: number | null
          description?: string | null
          email?: string | null
          employee_count?: string | null
          entity_type?: string | null
          external_id?: string | null
          first_name?: string | null
          fit_reason?: string | null
          fit_score?: number | null
          funding_stage?: string | null
          icp_key?: string | null
          id?: string
          job_title?: string | null
          last_interaction?: string | null
          last_name?: string | null
          linkedin_url?: string | null
          lost_reason?: string | null
          nb_interactions?: number | null
          next_steps?: string | null
          pain_points?: string[] | null
          phone?: string | null
          product_hooks?: string[] | null
          prospect_owner?: string | null
          recent_signals?: string[] | null
          region?: string | null
          status?: string
          strongest_connection?: string | null
          tech_stack?: string[] | null
          upload_id: string
        }
        Update: {
          actual_acv?: number | null
          address?: string | null
          closed_date?: string | null
          company?: string | null
          company_size?: string | null
          company_vertical?: string | null
          country?: string | null
          created_at?: string
          deal_value?: number | null
          description?: string | null
          email?: string | null
          employee_count?: string | null
          entity_type?: string | null
          external_id?: string | null
          first_name?: string | null
          fit_reason?: string | null
          fit_score?: number | null
          funding_stage?: string | null
          icp_key?: string | null
          id?: string
          job_title?: string | null
          last_interaction?: string | null
          last_name?: string | null
          linkedin_url?: string | null
          lost_reason?: string | null
          nb_interactions?: number | null
          next_steps?: string | null
          pain_points?: string[] | null
          phone?: string | null
          product_hooks?: string[] | null
          prospect_owner?: string | null
          recent_signals?: string[] | null
          region?: string | null
          status?: string
          strongest_connection?: string | null
          tech_stack?: string[] | null
          upload_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sequences: {
        Row: {
          created_at: string
          id: string
          name: string
          steps: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          steps?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          steps?: Json
          user_id?: string
        }
        Relationships: []
      }
      gmail_tokens: {
        Row: {
          access_token: string
          created_at: string
          email: string | null
          expires_at: string
          id: string
          refresh_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          email?: string | null
          expires_at: string
          id?: string
          refresh_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          refresh_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      icps: {
        Row: {
          created_at: string
          definition: Json
          icp_key: string
          id: string
          name: string
          prompt: string | null
          tier: string | null
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          definition?: Json
          icp_key?: string
          id?: string
          name?: string
          prompt?: string | null
          tier?: string | null
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          definition?: Json
          icp_key?: string
          id?: string
          name?: string
          prompt?: string | null
          tier?: string | null
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      lead_candidates: {
        Row: {
          champions: Json | null
          company: string | null
          company_size: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          employee_count: string | null
          entity_type: string | null
          feedback: string | null
          fit_reason: string | null
          fit_score: number | null
          funding_stage: string | null
          icp_key: string | null
          id: string
          job_title: string | null
          last_enriched_at: string | null
          linkedin_url: string | null
          location: string | null
          pain_points: string[] | null
          product_hooks: string[] | null
          recent_signals: string[] | null
          region: string | null
          rejection_reason: string | null
          research_depth: string | null
          source: string | null
          status: string
          studio_type: string | null
          summary: string | null
          tech_stack: string[] | null
          user_id: string
          vertical: string | null
          website: string | null
        }
        Insert: {
          champions?: Json | null
          company?: string | null
          company_size?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          employee_count?: string | null
          entity_type?: string | null
          feedback?: string | null
          fit_reason?: string | null
          fit_score?: number | null
          funding_stage?: string | null
          icp_key?: string | null
          id?: string
          job_title?: string | null
          last_enriched_at?: string | null
          linkedin_url?: string | null
          location?: string | null
          pain_points?: string[] | null
          product_hooks?: string[] | null
          recent_signals?: string[] | null
          region?: string | null
          rejection_reason?: string | null
          research_depth?: string | null
          source?: string | null
          status?: string
          studio_type?: string | null
          summary?: string | null
          tech_stack?: string[] | null
          user_id: string
          vertical?: string | null
          website?: string | null
        }
        Update: {
          champions?: Json | null
          company?: string | null
          company_size?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          employee_count?: string | null
          entity_type?: string | null
          feedback?: string | null
          fit_reason?: string | null
          fit_score?: number | null
          funding_stage?: string | null
          icp_key?: string | null
          id?: string
          job_title?: string | null
          last_enriched_at?: string | null
          linkedin_url?: string | null
          location?: string | null
          pain_points?: string[] | null
          product_hooks?: string[] | null
          recent_signals?: string[] | null
          region?: string | null
          rejection_reason?: string | null
          research_depth?: string | null
          source?: string | null
          status?: string
          studio_type?: string | null
          summary?: string | null
          tech_stack?: string[] | null
          user_id?: string
          vertical?: string | null
          website?: string | null
        }
        Relationships: []
      }
      outreach_emails: {
        Row: {
          body: string | null
          created_at: string
          deal_id: string | null
          id: string
          recipient_email: string | null
          recipient_name: string | null
          sent_at: string | null
          sequence_id: string | null
          sequence_step: number | null
          status: string
          subject: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          recipient_email?: string | null
          recipient_name?: string | null
          sent_at?: string | null
          sequence_id?: string | null
          sequence_step?: number | null
          status?: string
          subject?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          recipient_email?: string | null
          recipient_name?: string | null
          sent_at?: string | null
          sequence_id?: string | null
          sequence_step?: number | null
          status?: string
          subject?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_emails_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_emails_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "email_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_actions: {
        Row: {
          action_type: string
          created_at: string
          deal_id: string | null
          id: string
          priority: string
          status: string
          summary: string
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          deal_id?: string | null
          id?: string
          priority?: string
          status?: string
          summary: string
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          deal_id?: string | null
          id?: string
          priority?: string
          status?: string
          summary?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_actions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      quote_settings: {
        Row: {
          id: string
          pricing: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          pricing?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          pricing?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      quotes: {
        Row: {
          company_name: string | null
          contact_email: string | null
          contact_person: string | null
          contract_discount: number
          created_at: string
          created_by: string
          deal_id: string | null
          description: string | null
          hosting_model: string | null
          id: string
          last_edited_by: string | null
          line_items: Json
          notes: string | null
          parent_quote_id: string | null
          quote_name: string | null
          quote_number: string
          quote_type: string
          status: string
          total_arr: number
          total_onetime: number
          total_year1: number
          updated_at: string
          valid_until: string | null
          version: number
        }
        Insert: {
          company_name?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contract_discount?: number
          created_at?: string
          created_by: string
          deal_id?: string | null
          description?: string | null
          hosting_model?: string | null
          id?: string
          last_edited_by?: string | null
          line_items?: Json
          notes?: string | null
          parent_quote_id?: string | null
          quote_name?: string | null
          quote_number: string
          quote_type?: string
          status?: string
          total_arr?: number
          total_onetime?: number
          total_year1?: number
          updated_at?: string
          valid_until?: string | null
          version?: number
        }
        Update: {
          company_name?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contract_discount?: number
          created_at?: string
          created_by?: string
          deal_id?: string | null
          description?: string | null
          hosting_model?: string | null
          id?: string
          last_edited_by?: string | null
          line_items?: Json
          notes?: string | null
          parent_quote_id?: string | null
          quote_name?: string | null
          quote_number?: string
          quote_type?: string
          status?: string
          total_arr?: number
          total_onetime?: number
          total_year1?: number
          updated_at?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_parent_quote_id_fkey"
            columns: ["parent_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      sequence_enrollments: {
        Row: {
          created_at: string
          current_step: number
          deal_id: string
          id: string
          last_error: string | null
          last_step_at: string | null
          next_action_at: string
          sequence_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_step?: number
          deal_id: string
          id?: string
          last_error?: string | null
          last_step_at?: string | null
          next_action_at?: string
          sequence_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_step?: number
          deal_id?: string
          id?: string
          last_error?: string | null
          last_step_at?: string | null
          next_action_at?: string
          sequence_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sequence_enrollments_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      sequences: {
        Row: {
          created_at: string
          icp_keys: string[]
          id: string
          is_active: boolean
          name: string
          steps: Json
          tier: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          icp_keys?: string[]
          id?: string
          is_active?: boolean
          name?: string
          steps?: Json
          tier?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          icp_keys?: string[]
          id?: string
          is_active?: boolean
          name?: string
          steps?: Json
          tier?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      social_content: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          platform: string
          post_text: string | null
          status: string
          user_id: string
          variant_group: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          platform?: string
          post_text?: string | null
          status?: string
          user_id: string
          variant_group?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          platform?: string
          post_text?: string | null
          status?: string
          user_id?: string
          variant_group?: string | null
        }
        Relationships: []
      }
      uploads: {
        Row: {
          created_at: string
          file_name: string | null
          id: string
          record_count: number | null
          upload_date: string
          user_id: string
          week_label: string
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          id?: string
          record_count?: number | null
          upload_date?: string
          user_id: string
          week_label: string
        }
        Update: {
          created_at?: string
          file_name?: string | null
          id?: string
          record_count?: number | null
          upload_date?: string
          user_id?: string
          week_label?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_agent_memories: {
        Args: {
          match_agent_type: string
          match_count?: number
          match_threshold?: number
          match_user_id: string
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          memory_type: string
          metadata: Json
          similarity: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
