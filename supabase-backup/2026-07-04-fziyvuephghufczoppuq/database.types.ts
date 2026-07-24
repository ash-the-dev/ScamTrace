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
      alerts: {
        Row: {
          alert_id: string
          alert_type: string | null
          created_at: string
          message: string | null
          resolved: boolean | null
          scam_report_id: string | null
          severity: string | null
        }
        Insert: {
          alert_id?: string
          alert_type?: string | null
          created_at?: string
          message?: string | null
          resolved?: boolean | null
          scam_report_id?: string | null
          severity?: string | null
        }
        Update: {
          alert_id?: string
          alert_type?: string | null
          created_at?: string
          message?: string | null
          resolved?: boolean | null
          scam_report_id?: string | null
          severity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_alerts_report"
            columns: ["scam_report_id"]
            isOneToOne: false
            referencedRelation: "scam_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      data_sources: {
        Row: {
          active: boolean | null
          created_at: string
          source_id: string
          source_name: string
          source_type: string
          source_url: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          source_id?: string
          source_name: string
          source_type: string
          source_url?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string
          source_id?: string
          source_name?: string
          source_type?: string
          source_url?: string | null
        }
        Relationships: []
      }
      ingestion_logs: {
        Row: {
          created_at: string | null
          data_source_id: string | null
          id: string
          message: string | null
          records_processed: number | null
          records_saved: number | null
          source: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          data_source_id?: string | null
          id?: string
          message?: string | null
          records_processed?: number | null
          records_saved?: number | null
          source?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          data_source_id?: string | null
          id?: string
          message?: string | null
          records_processed?: number | null
          records_saved?: number | null
          source?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ingestion_logs_data_source"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["source_id"]
          },
        ]
      }
      report_outputs: {
        Row: {
          generated_at: string
          output_data: Json | null
          output_id: string
          output_type: string | null
          scam_report_id: string | null
          summary: string | null
        }
        Insert: {
          generated_at?: string
          output_data?: Json | null
          output_id?: string
          output_type?: string | null
          scam_report_id?: string | null
          summary?: string | null
        }
        Update: {
          generated_at?: string
          output_data?: Json | null
          output_id?: string
          output_type?: string | null
          scam_report_id?: string | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_report_outputs_report"
            columns: ["scam_report_id"]
            isOneToOne: false
            referencedRelation: "scam_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      scam_classifications: {
        Row: {
          classification_id: string
          classification_method: string | null
          classified_at: string
          confidence_level: string | null
          risk_score: number | null
          scam_report_id: string | null
          scam_type: string
        }
        Insert: {
          classification_id?: string
          classification_method?: string | null
          classified_at?: string
          confidence_level?: string | null
          risk_score?: number | null
          scam_report_id?: string | null
          scam_type: string
        }
        Update: {
          classification_id?: string
          classification_method?: string | null
          classified_at?: string
          confidence_level?: string | null
          risk_score?: number | null
          scam_report_id?: string | null
          scam_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_scam_classifications_report"
            columns: ["scam_report_id"]
            isOneToOne: false
            referencedRelation: "scam_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      scam_indicators: {
        Row: {
          created_at: string
          indicator_id: string
          indicator_type: string
          indicator_value: string
          risk_level: string | null
          scam_report_id: string | null
        }
        Insert: {
          created_at?: string
          indicator_id?: string
          indicator_type: string
          indicator_value: string
          risk_level?: string | null
          scam_report_id?: string | null
        }
        Update: {
          created_at?: string
          indicator_id?: string
          indicator_type?: string
          indicator_value?: string
          risk_level?: string | null
          scam_report_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_scam_indicators_report"
            columns: ["scam_report_id"]
            isOneToOne: false
            referencedRelation: "scam_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      scam_keywords: {
        Row: {
          created_at: string
          frequency: number | null
          keyword: string
          keyword_id: string
          scam_report_id: string | null
        }
        Insert: {
          created_at?: string
          frequency?: number | null
          keyword: string
          keyword_id?: string
          scam_report_id?: string | null
        }
        Update: {
          created_at?: string
          frequency?: number | null
          keyword?: string
          keyword_id?: string
          scam_report_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_scam_keywords_report"
            columns: ["scam_report_id"]
            isOneToOne: false
            referencedRelation: "scam_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      scam_reports: {
        Row: {
          author: string | null
          body: string | null
          created_at_source: string | null
          data_source_id: string | null
          id: string
          inserted_at: string | null
          keywords: string[] | null
          raw_data: Json | null
          scam_type: string | null
          source: string
          source_id: string | null
          title: string | null
          url: string | null
        }
        Insert: {
          author?: string | null
          body?: string | null
          created_at_source?: string | null
          data_source_id?: string | null
          id?: string
          inserted_at?: string | null
          keywords?: string[] | null
          raw_data?: Json | null
          scam_type?: string | null
          source: string
          source_id?: string | null
          title?: string | null
          url?: string | null
        }
        Update: {
          author?: string | null
          body?: string | null
          created_at_source?: string | null
          data_source_id?: string | null
          id?: string
          inserted_at?: string | null
          keywords?: string[] | null
          raw_data?: Json | null
          scam_type?: string | null
          source?: string
          source_id?: string | null
          title?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_scam_reports_data_source"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["source_id"]
          },
        ]
      }
      trend_analysis: {
        Row: {
          analysis_period_end: string | null
          analysis_period_start: string | null
          created_at: string
          report_count: number | null
          scam_type: string | null
          trend_id: string
          trend_metadata: Json | null
          trend_name: string
        }
        Insert: {
          analysis_period_end?: string | null
          analysis_period_start?: string | null
          created_at?: string
          report_count?: number | null
          scam_type?: string | null
          trend_id?: string
          trend_metadata?: Json | null
          trend_name: string
        }
        Update: {
          analysis_period_end?: string | null
          analysis_period_start?: string | null
          created_at?: string
          report_count?: number | null
          scam_type?: string | null
          trend_id?: string
          trend_metadata?: Json | null
          trend_name?: string
        }
        Relationships: []
      }
      trend_analysis_reports: {
        Row: {
          created_at: string
          scam_report_id: string
          trend_id: string
        }
        Insert: {
          created_at?: string
          scam_report_id: string
          trend_id: string
        }
        Update: {
          created_at?: string
          scam_report_id?: string
          trend_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trend_analysis_reports_scam_report_id_fkey"
            columns: ["scam_report_id"]
            isOneToOne: false
            referencedRelation: "scam_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trend_analysis_reports_trend_id_fkey"
            columns: ["trend_id"]
            isOneToOne: false
            referencedRelation: "trend_analysis"
            referencedColumns: ["trend_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
