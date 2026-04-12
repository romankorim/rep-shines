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
    }
    Enums: {
      app_role: "admin" | "rep"
      deal_status: "closed" | "open"
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
      app_role: ["admin", "rep"],
      deal_status: ["closed", "open"],
      quota_period: ["month", "quarter", "year"],
    },
  },
} as const
