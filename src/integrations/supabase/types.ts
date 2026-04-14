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
  public: {
    Tables: {
      accountant_offices: {
        Row: {
          created_at: string
          dic: string | null
          ico: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dic?: string | null
          ico?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dic?: string | null
          ico?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          changes: Json | null
          created_at: string
          id: string
          record_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string
          id?: string
          record_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string
          id?: string
          record_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      bank_integrations: {
        Row: {
          bank_name: string | null
          client_id: string
          consent_expires_at: string | null
          created_at: string
          id: string
          last_sync_at: string | null
          office_id: string
          provider: string | null
          salt_edge_connection_id: string | null
          status: Database["public"]["Enums"]["integration_status"]
          updated_at: string
        }
        Insert: {
          bank_name?: string | null
          client_id: string
          consent_expires_at?: string | null
          created_at?: string
          id?: string
          last_sync_at?: string | null
          office_id: string
          provider?: string | null
          salt_edge_connection_id?: string | null
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
        }
        Update: {
          bank_name?: string | null
          client_id?: string
          consent_expires_at?: string | null
          created_at?: string
          id?: string
          last_sync_at?: string | null
          office_id?: string
          provider?: string | null
          salt_edge_connection_id?: string | null
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_integrations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_integrations_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "accountant_offices"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          amount: number
          bank_name: string | null
          client_id: string
          counterparty_name: string | null
          created_at: string
          currency: string | null
          description: string | null
          external_id: string | null
          id: string
          matched_document_id: string | null
          office_id: string
          transaction_date: string
          variable_symbol: string | null
        }
        Insert: {
          amount: number
          bank_name?: string | null
          client_id: string
          counterparty_name?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          external_id?: string | null
          id?: string
          matched_document_id?: string | null
          office_id: string
          transaction_date: string
          variable_symbol?: string | null
        }
        Update: {
          amount?: number
          bank_name?: string | null
          client_id?: string
          counterparty_name?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          external_id?: string | null
          id?: string
          matched_document_id?: string | null
          office_id?: string
          transaction_date?: string
          variable_symbol?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_matched_document_id_fkey"
            columns: ["matched_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "accountant_offices"
            referencedColumns: ["id"]
          },
        ]
      }
      client_invitations: {
        Row: {
          client_id: string
          created_at: string
          expires_at: string
          id: string
          office_id: string
          status: Database["public"]["Enums"]["invitation_status"]
          token: string
        }
        Insert: {
          client_id: string
          created_at?: string
          expires_at?: string
          id?: string
          office_id: string
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          office_id?: string
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_invitations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_invitations_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "accountant_offices"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          company_name: string | null
          created_at: string
          dic: string | null
          email: string
          ic_dph: string | null
          ico: string | null
          id: string
          name: string
          notes: string | null
          office_id: string
          status: Database["public"]["Enums"]["client_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          dic?: string | null
          email: string
          ic_dph?: string | null
          ico?: string | null
          id?: string
          name: string
          notes?: string | null
          office_id: string
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          company_name?: string | null
          created_at?: string
          dic?: string | null
          email?: string
          ic_dph?: string | null
          ico?: string | null
          id?: string
          name?: string
          notes?: string | null
          office_id?: string
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "accountant_offices"
            referencedColumns: ["id"]
          },
        ]
      }
      comp_plans: {
        Row: {
          created_at: string
          created_by: string | null
          effective_date: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_date: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_date?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      comp_tiers: {
        Row: {
          commission_rate: number
          comp_plan_id: string
          created_at: string
          id: string
          max_deal_size: number | null
          min_deal_size: number
          tier_name: string
        }
        Insert: {
          commission_rate: number
          comp_plan_id: string
          created_at?: string
          id?: string
          max_deal_size?: number | null
          min_deal_size?: number
          tier_name: string
        }
        Update: {
          commission_rate?: number
          comp_plan_id?: string
          created_at?: string
          id?: string
          max_deal_size?: number | null
          min_deal_size?: number
          tier_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "comp_tiers_comp_plan_id_fkey"
            columns: ["comp_plan_id"]
            isOneToOne: false
            referencedRelation: "comp_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          close_date: string
          commission_amount: number
          created_at: string
          created_by: string | null
          deal_size: number
          deal_type: string
          deleted_at: string | null
          id: string
          notes: string | null
          rep_id: string
          status: Database["public"]["Enums"]["deal_status"]
          tier_applied: string | null
          updated_at: string
        }
        Insert: {
          close_date: string
          commission_amount?: number
          created_at?: string
          created_by?: string | null
          deal_size: number
          deal_type: string
          deleted_at?: string | null
          id?: string
          notes?: string | null
          rep_id: string
          status?: Database["public"]["Enums"]["deal_status"]
          tier_applied?: string | null
          updated_at?: string
        }
        Update: {
          close_date?: string
          commission_amount?: number
          created_at?: string
          created_by?: string | null
          deal_size?: number
          deal_type?: string
          deleted_at?: string | null
          id?: string
          notes?: string | null
          rep_id?: string
          status?: Database["public"]["Enums"]["deal_status"]
          tier_applied?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "reps"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          accountant_notes: string | null
          accounting_code: string | null
          ai_confidence: number | null
          ai_raw_data: Json | null
          client_id: string
          content_hash_sha256: string | null
          created_at: string
          currency: string | null
          delivery_date: string | null
          document_number: string | null
          document_type: Database["public"]["Enums"]["document_type"] | null
          download_source_url: string | null
          due_date: string | null
          email_message_id: string | null
          expense_category: string | null
          extraction_strategy: string | null
          file_name: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          id: string
          issue_date: string | null
          matched_transaction_id: string | null
          office_id: string
          original_email_html: string | null
          source: Database["public"]["Enums"]["document_source"]
          source_email_id: string | null
          status: Database["public"]["Enums"]["document_status"]
          supplier_dic: string | null
          supplier_ic_dph: string | null
          supplier_ico: string | null
          supplier_name: string | null
          tax_base: number | null
          tax_period_month: number | null
          tax_period_year: number | null
          thumbnail_url: string | null
          total_amount: number | null
          updated_at: string
          variable_symbol: string | null
          vat_amount: number | null
          vat_breakdown: Json | null
          vat_rate: number | null
        }
        Insert: {
          accountant_notes?: string | null
          accounting_code?: string | null
          ai_confidence?: number | null
          ai_raw_data?: Json | null
          client_id: string
          content_hash_sha256?: string | null
          created_at?: string
          currency?: string | null
          delivery_date?: string | null
          document_number?: string | null
          document_type?: Database["public"]["Enums"]["document_type"] | null
          download_source_url?: string | null
          due_date?: string | null
          email_message_id?: string | null
          expense_category?: string | null
          extraction_strategy?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          issue_date?: string | null
          matched_transaction_id?: string | null
          office_id: string
          original_email_html?: string | null
          source?: Database["public"]["Enums"]["document_source"]
          source_email_id?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          supplier_dic?: string | null
          supplier_ic_dph?: string | null
          supplier_ico?: string | null
          supplier_name?: string | null
          tax_base?: number | null
          tax_period_month?: number | null
          tax_period_year?: number | null
          thumbnail_url?: string | null
          total_amount?: number | null
          updated_at?: string
          variable_symbol?: string | null
          vat_amount?: number | null
          vat_breakdown?: Json | null
          vat_rate?: number | null
        }
        Update: {
          accountant_notes?: string | null
          accounting_code?: string | null
          ai_confidence?: number | null
          ai_raw_data?: Json | null
          client_id?: string
          content_hash_sha256?: string | null
          created_at?: string
          currency?: string | null
          delivery_date?: string | null
          document_number?: string | null
          document_type?: Database["public"]["Enums"]["document_type"] | null
          download_source_url?: string | null
          due_date?: string | null
          email_message_id?: string | null
          expense_category?: string | null
          extraction_strategy?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          issue_date?: string | null
          matched_transaction_id?: string | null
          office_id?: string
          original_email_html?: string | null
          source?: Database["public"]["Enums"]["document_source"]
          source_email_id?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          supplier_dic?: string | null
          supplier_ic_dph?: string | null
          supplier_ico?: string | null
          supplier_name?: string | null
          tax_base?: number | null
          tax_period_month?: number | null
          tax_period_year?: number | null
          thumbnail_url?: string | null
          total_amount?: number | null
          updated_at?: string
          variable_symbol?: string | null
          vat_amount?: number | null
          vat_breakdown?: Json | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "accountant_offices"
            referencedColumns: ["id"]
          },
        ]
      }
      email_integrations: {
        Row: {
          client_id: string
          created_at: string
          email_address: string | null
          id: string
          last_sync_at: string | null
          nylas_grant_id: string | null
          office_id: string
          provider: string | null
          status: Database["public"]["Enums"]["integration_status"]
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          email_address?: string | null
          id?: string
          last_sync_at?: string | null
          nylas_grant_id?: string | null
          office_id: string
          provider?: string | null
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          email_address?: string | null
          id?: string
          last_sync_at?: string | null
          nylas_grant_id?: string | null
          office_id?: string
          provider?: string | null
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_integrations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_integrations_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "accountant_offices"
            referencedColumns: ["id"]
          },
        ]
      }
      email_messages: {
        Row: {
          attachment_count: number | null
          client_id: string
          content_types: string[] | null
          created_at: string
          documents_created: number | null
          from_email: string | null
          from_name: string | null
          has_attachments: boolean | null
          id: string
          nylas_grant_id: string | null
          nylas_message_id: string
          office_id: string
          processing_status: string | null
          received_at: string | null
          snippet: string | null
          subject: string | null
          triage_confidence: number | null
          triage_reasoning: string | null
          triage_result: string | null
          updated_at: string
        }
        Insert: {
          attachment_count?: number | null
          client_id: string
          content_types?: string[] | null
          created_at?: string
          documents_created?: number | null
          from_email?: string | null
          from_name?: string | null
          has_attachments?: boolean | null
          id?: string
          nylas_grant_id?: string | null
          nylas_message_id: string
          office_id: string
          processing_status?: string | null
          received_at?: string | null
          snippet?: string | null
          subject?: string | null
          triage_confidence?: number | null
          triage_reasoning?: string | null
          triage_result?: string | null
          updated_at?: string
        }
        Update: {
          attachment_count?: number | null
          client_id?: string
          content_types?: string[] | null
          created_at?: string
          documents_created?: number | null
          from_email?: string | null
          from_name?: string | null
          has_attachments?: boolean | null
          id?: string
          nylas_grant_id?: string | null
          nylas_message_id?: string
          office_id?: string
          processing_status?: string | null
          received_at?: string | null
          snippet?: string | null
          subject?: string | null
          triage_confidence?: number | null
          triage_reasoning?: string | null
          triage_result?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      quota_tiers: {
        Row: {
          color: string
          created_at: string
          id: string
          max_attainment: number | null
          min_attainment: number
          rate_multiplier: number
          tier_name: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          max_attainment?: number | null
          min_attainment?: number
          rate_multiplier?: number
          tier_name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          max_attainment?: number | null
          min_attainment?: number
          rate_multiplier?: number
          tier_name?: string
        }
        Relationships: []
      }
      reps: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          quota_period: Database["public"]["Enums"]["quota_period"]
          quota_target: number
          team: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          quota_period?: Database["public"]["Enums"]["quota_period"]
          quota_target?: number
          team?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          quota_period?: Database["public"]["Enums"]["quota_period"]
          quota_target?: number
          team?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      sender_intelligence: {
        Row: {
          classification: string | null
          created_at: string
          emails_seen: number | null
          force_exclude: boolean | null
          force_include: boolean | null
          id: string
          known_vendor_name: string | null
          office_id: string | null
          sender_domain: string
          typical_content: string | null
          updated_at: string
        }
        Insert: {
          classification?: string | null
          created_at?: string
          emails_seen?: number | null
          force_exclude?: boolean | null
          force_include?: boolean | null
          id?: string
          known_vendor_name?: string | null
          office_id?: string | null
          sender_domain: string
          typical_content?: string | null
          updated_at?: string
        }
        Update: {
          classification?: string | null
          created_at?: string
          emails_seen?: number | null
          force_exclude?: boolean | null
          force_include?: boolean | null
          id?: string
          known_vendor_name?: string | null
          office_id?: string | null
          sender_domain?: string
          typical_content?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_sender_emails_seen: {
        Args: { p_count: number; p_domain: string; p_office_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "rep" | "client"
      client_status: "invited" | "active" | "paused" | "archived"
      deal_status: "closed" | "open"
      document_source: "email" | "upload" | "bank"
      document_status:
        | "processing"
        | "pending_approval"
        | "approved"
        | "rejected"
        | "duplicate"
        | "error"
      document_type:
        | "received_invoice"
        | "issued_invoice"
        | "receipt"
        | "credit_note"
        | "advance_invoice"
        | "bank_statement"
        | "other"
      integration_status: "connected" | "disconnected" | "error"
      invitation_status: "pending" | "accepted" | "expired"
      quota_period: "month" | "quarter" | "year"
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
  public: {
    Enums: {
      app_role: ["admin", "rep", "client"],
      client_status: ["invited", "active", "paused", "archived"],
      deal_status: ["closed", "open"],
      document_source: ["email", "upload", "bank"],
      document_status: [
        "processing",
        "pending_approval",
        "approved",
        "rejected",
        "duplicate",
        "error",
      ],
      document_type: [
        "received_invoice",
        "issued_invoice",
        "receipt",
        "credit_note",
        "advance_invoice",
        "bank_statement",
        "other",
      ],
      integration_status: ["connected", "disconnected", "error"],
      invitation_status: ["pending", "accepted", "expired"],
      quota_period: ["month", "quarter", "year"],
    },
  },
} as const
