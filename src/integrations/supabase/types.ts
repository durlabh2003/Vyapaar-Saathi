export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      businesses: {
        Row: {
          business_type: string;
          created_at: string;
          currency: string;
          id: string;
          inventory_enabled: boolean;
          language: string;
          name: string;
          owner_id: string;
          updated_at: string;
        };
        Insert: {
          business_type?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          inventory_enabled?: boolean;
          language?: string;
          name: string;
          owner_id: string;
          updated_at?: string;
        };
        Update: {
          business_type?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          inventory_enabled?: boolean;
          language?: string;
          name?: string;
          owner_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          avatar_url: string | null;
          business_id: string;
          created_at: string;
          id: string;
          name: string;
          notes: string | null;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          business_id: string;
          created_at?: string;
          id?: string;
          name: string;
          notes?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          business_id?: string;
          created_at?: string;
          id?: string;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customers_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          business_id: string;
          category: string | null;
          created_at: string;
          id: string;
          low_stock_threshold: number;
          name: string;
          purchase_price: number;
          selling_price: number;
          sku: string | null;
          stock: number;
          unit: string;
          updated_at: string;
        };
        Insert: {
          business_id: string;
          category?: string | null;
          created_at?: string;
          id?: string;
          low_stock_threshold?: number;
          name: string;
          purchase_price?: number;
          selling_price?: number;
          sku?: string | null;
          stock?: number;
          unit?: string;
          updated_at?: string;
        };
        Update: {
          business_id?: string;
          category?: string | null;
          created_at?: string;
          id?: string;
          low_stock_threshold?: number;
          name?: string;
          purchase_price?: number;
          selling_price?: number;
          sku?: string | null;
          stock?: number;
          unit?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string | null;
          id: string;
          phone: string | null;
          preferred_language: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          full_name?: string | null;
          id: string;
          phone?: string | null;
          preferred_language?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          preferred_language?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reminders: {
        Row: {
          amount: number | null;
          business_id: string;
          channel: string;
          created_at: string;
          customer_id: string | null;
          due_at: string;
          id: string;
          is_done: boolean;
          note: string | null;
          updated_at: string;
          vendor_id: string | null;
        };
        Insert: {
          amount?: number | null;
          business_id: string;
          channel?: string;
          created_at?: string;
          customer_id?: string | null;
          due_at: string;
          id?: string;
          is_done?: boolean;
          note?: string | null;
          updated_at?: string;
          vendor_id?: string | null;
        };
        Update: {
          amount?: number | null;
          business_id?: string;
          channel?: string;
          created_at?: string;
          customer_id?: string | null;
          due_at?: string;
          id?: string;
          is_done?: boolean;
          note?: string | null;
          updated_at?: string;
          vendor_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "reminders_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reminders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reminders_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
        ];
      };
      transaction_items: {
        Row: {
          business_id: string;
          created_at: string;
          discount: number;
          id: string;
          product_id: string | null;
          product_name: string;
          quantity: number;
          transaction_id: string;
          unit_price: number;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          discount?: number;
          id?: string;
          product_id?: string | null;
          product_name: string;
          quantity?: number;
          transaction_id: string;
          unit_price?: number;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          discount?: number;
          id?: string;
          product_id?: string | null;
          product_name?: string;
          quantity?: number;
          transaction_id?: string;
          unit_price?: number;
        };
        Relationships: [
          {
            foreignKeyName: "transaction_items_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transaction_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transaction_items_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      transactions: {
        Row: {
          ai_confidence: number | null;
          amount: number;
          amount_paid: number;
          business_id: string;
          category: string | null;
          created_at: string;
          customer_id: string | null;
          id: string;
          notes: string | null;
          occurred_at: string;
          party_name: string | null;
          payment_method: string | null;
          source: Database["public"]["Enums"]["txn_source"];
          type: Database["public"]["Enums"]["txn_type"];
          updated_at: string;
          vendor_id: string | null;
        };
        Insert: {
          ai_confidence?: number | null;
          amount?: number;
          amount_paid?: number;
          business_id: string;
          category?: string | null;
          created_at?: string;
          customer_id?: string | null;
          id?: string;
          notes?: string | null;
          occurred_at?: string;
          party_name?: string | null;
          payment_method?: string | null;
          source?: Database["public"]["Enums"]["txn_source"];
          type: Database["public"]["Enums"]["txn_type"];
          updated_at?: string;
          vendor_id?: string | null;
        };
        Update: {
          ai_confidence?: number | null;
          amount?: number;
          amount_paid?: number;
          business_id?: string;
          category?: string | null;
          created_at?: string;
          customer_id?: string | null;
          id?: string;
          notes?: string | null;
          occurred_at?: string;
          party_name?: string | null;
          payment_method?: string | null;
          source?: Database["public"]["Enums"]["txn_source"];
          type?: Database["public"]["Enums"]["txn_type"];
          updated_at?: string;
          vendor_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
        ];
      };
      vendors: {
        Row: {
          business_id: string;
          created_at: string;
          id: string;
          name: string;
          notes: string | null;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          id?: string;
          name: string;
          notes?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          id?: string;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vendors_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      voice_interactions: {
        Row: {
          business_id: string;
          confidence: number | null;
          created_at: string;
          detected_language: string | null;
          extracted: Json | null;
          id: string;
          intent: string | null;
          transaction_id: string | null;
          transcript: string | null;
        };
        Insert: {
          business_id: string;
          confidence?: number | null;
          created_at?: string;
          detected_language?: string | null;
          extracted?: Json | null;
          id?: string;
          intent?: string | null;
          transaction_id?: string | null;
          transcript?: string | null;
        };
        Update: {
          business_id?: string;
          confidence?: number | null;
          created_at?: string;
          detected_language?: string | null;
          extracted?: Json | null;
          id?: string;
          intent?: string | null;
          transaction_id?: string | null;
          transcript?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "voice_interactions_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "voice_interactions_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      owns_business: { Args: { _business_id: string }; Returns: boolean };
    };
    Enums: {
      txn_source: "voice" | "manual" | "import";
      txn_type: "sale" | "purchase" | "expense" | "payment_in" | "payment_out" | "adjustment";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      txn_source: ["voice", "manual", "import"],
      txn_type: ["sale", "purchase", "expense", "payment_in", "payment_out", "adjustment"],
    },
  },
} as const;
