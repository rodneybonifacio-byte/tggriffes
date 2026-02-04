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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      cart_reservations: {
        Row: {
          added_from: string | null
          color: string | null
          created_at: string
          expires_at: string
          id: string
          image_url: string | null
          product_id: string
          product_name: string
          quantity: number
          reserved_at: string
          session_id: string
          size: string
          unit_price_cents: number
          variant_id: string
        }
        Insert: {
          added_from?: string | null
          color?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          image_url?: string | null
          product_id: string
          product_name: string
          quantity?: number
          reserved_at?: string
          session_id: string
          size: string
          unit_price_cents?: number
          variant_id: string
        }
        Update: {
          added_from?: string | null
          color?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          image_url?: string | null
          product_id?: string
          product_name?: string
          quantity?: number
          reserved_at?: string
          session_id?: string
          size?: string
          unit_price_cents?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_reservations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_reservations_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
          updated_at: string
          whatsapp: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          updated_at?: string
          whatsapp: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          updated_at?: string
          whatsapp?: string
        }
        Relationships: []
      }
      order_history: {
        Row: {
          action: string
          changes: Json | null
          created_at: string
          description: string
          id: string
          order_intent_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string
          description: string
          id?: string
          order_intent_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string
          description?: string
          id?: string
          order_intent_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_history_order_intent_id_fkey"
            columns: ["order_intent_id"]
            isOneToOne: false
            referencedRelation: "order_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      order_intent_items: {
        Row: {
          added_from: string | null
          color: string | null
          created_at: string
          id: string
          line_total_cents: number
          order_intent_id: string
          product_id: string | null
          product_name: string
          qty: number
          size: string
          unit_price_cents: number
          variant_id: string | null
        }
        Insert: {
          added_from?: string | null
          color?: string | null
          created_at?: string
          id?: string
          line_total_cents?: number
          order_intent_id: string
          product_id?: string | null
          product_name: string
          qty?: number
          size: string
          unit_price_cents?: number
          variant_id?: string | null
        }
        Update: {
          added_from?: string | null
          color?: string | null
          created_at?: string
          id?: string
          line_total_cents?: number
          order_intent_id?: string
          product_id?: string | null
          product_name?: string
          qty?: number
          size?: string
          unit_price_cents?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_intent_items_order_intent_id_fkey"
            columns: ["order_intent_id"]
            isOneToOne: false
            referencedRelation: "order_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_intent_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_intent_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_intents: {
        Row: {
          created_at: string
          customer_id: string | null
          customer_name: string | null
          customer_whatsapp: string | null
          dest_cep: string | null
          id: string
          observations: string | null
          order_number: number | null
          seller_user_id: string | null
          shipping_deadline_days: number | null
          shipping_height_cm: number | null
          shipping_length_cm: number | null
          shipping_price_cents: number | null
          shipping_service: string | null
          shipping_weight_grams: number | null
          shipping_width_cm: number | null
          status: string
          subtotal_cents: number
          total_cents: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_whatsapp?: string | null
          dest_cep?: string | null
          id?: string
          observations?: string | null
          order_number?: number | null
          seller_user_id?: string | null
          shipping_deadline_days?: number | null
          shipping_height_cm?: number | null
          shipping_length_cm?: number | null
          shipping_price_cents?: number | null
          shipping_service?: string | null
          shipping_weight_grams?: number | null
          shipping_width_cm?: number | null
          status?: string
          subtotal_cents?: number
          total_cents?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_whatsapp?: string | null
          dest_cep?: string | null
          id?: string
          observations?: string | null
          order_number?: number | null
          seller_user_id?: string | null
          shipping_deadline_days?: number | null
          shipping_height_cm?: number | null
          shipping_length_cm?: number | null
          shipping_price_cents?: number | null
          shipping_service?: string | null
          shipping_weight_grams?: number | null
          shipping_width_cm?: number | null
          status?: string
          subtotal_cents?: number
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_intents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          product_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          product_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          color: string | null
          created_at: string
          id: string
          product_id: string
          size: string
          sku: string | null
          stock_qty: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          product_id: string
          size: string
          sku?: string | null
          stock_qty?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          product_id?: string
          size?: string
          sku?: string | null
          stock_qty?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          category_id: string | null
          created_at: string
          description: string | null
          height_cm: number | null
          id: string
          length_cm: number | null
          main_image_url: string | null
          name: string
          price_cents: number
          shopify_image_url: string | null
          slug: string
          updated_at: string
          weight_grams: number | null
          width_cm: number | null
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          description?: string | null
          height_cm?: number | null
          id?: string
          length_cm?: number | null
          main_image_url?: string | null
          name: string
          price_cents?: number
          shopify_image_url?: string | null
          slug: string
          updated_at?: string
          weight_grams?: number | null
          width_cm?: number | null
        }
        Update: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          description?: string | null
          height_cm?: number | null
          id?: string
          length_cm?: number | null
          main_image_url?: string | null
          name?: string
          price_cents?: number
          shopify_image_url?: string | null
          slug?: string
          updated_at?: string
          weight_grams?: number | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
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
      promotions: {
        Row: {
          active: boolean
          applies_to: string
          category_id: string | null
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          ends_at: string | null
          id: string
          min_quantity: number
          name: string
          product_id: string | null
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          applies_to?: string
          category_id?: string | null
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          ends_at?: string | null
          id?: string
          min_quantity?: number
          name: string
          product_id?: string | null
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          applies_to?: string
          category_id?: string | null
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          ends_at?: string | null
          id?: string
          min_quantity?: number
          name?: string
          product_id?: string | null
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_product_mappings: {
        Row: {
          created_at: string
          id: string
          last_synced_at: string | null
          product_id: string
          shopify_product_handle: string | null
          shopify_product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_synced_at?: string | null
          product_id: string
          shopify_product_handle?: string | null
          shopify_product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_synced_at?: string | null
          product_id?: string
          shopify_product_handle?: string | null
          shopify_product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopify_product_mappings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_sync_logs: {
        Row: {
          created_at: string
          errors: Json | null
          id: string
          products_synced: number | null
          status: string
          sync_type: string
          variants_synced: number | null
        }
        Insert: {
          created_at?: string
          errors?: Json | null
          id?: string
          products_synced?: number | null
          status: string
          sync_type: string
          variants_synced?: number | null
        }
        Update: {
          created_at?: string
          errors?: Json | null
          id?: string
          products_synced?: number | null
          status?: string
          sync_type?: string
          variants_synced?: number | null
        }
        Relationships: []
      }
      shopify_variant_mappings: {
        Row: {
          created_at: string
          id: string
          last_synced_at: string | null
          shopify_inventory_item_id: string | null
          shopify_variant_id: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_synced_at?: string | null
          shopify_inventory_item_id?: string | null
          shopify_variant_id: string
          variant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_synced_at?: string | null
          shopify_inventory_item_id?: string | null
          shopify_variant_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopify_variant_mappings_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          id: string
          movement_type: string
          product_id: string
          quantity: number
          reason: string | null
          stock_after: number
          stock_before: number
          user_id: string | null
          variant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          movement_type: string
          product_id: string
          quantity: number
          reason?: string | null
          stock_after: number
          stock_before: number
          user_id?: string | null
          variant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          movement_type?: string
          product_id?: string
          quantity?: number
          reason?: string | null
          stock_after?: number
          stock_before?: number
          user_id?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          created_at: string
          id: string
          origin_cep: string
          primary_color: string | null
          seller_whatsapp: string
          store_logo_url: string | null
          store_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          origin_cep?: string
          primary_color?: string | null
          seller_whatsapp?: string
          store_logo_url?: string | null
          store_name?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          origin_cep?: string
          primary_color?: string | null
          seller_whatsapp?: string
          store_logo_url?: string | null
          store_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      add_cart_reservation: {
        Args: {
          p_color: string
          p_image_url: string
          p_product_id: string
          p_product_name: string
          p_quantity: number
          p_session_id: string
          p_size: string
          p_unit_price_cents: number
          p_variant_id: string
        }
        Returns: {
          added_from: string | null
          color: string | null
          created_at: string
          expires_at: string
          id: string
          image_url: string | null
          product_id: string
          product_name: string
          quantity: number
          reserved_at: string
          session_id: string
          size: string
          unit_price_cents: number
          variant_id: string
        }
        SetofOptions: {
          from: "*"
          to: "cart_reservations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_cart_reservation_by_attrs: {
        Args: {
          p_added_from?: string
          p_color: string
          p_image_url: string
          p_product_id: string
          p_product_name: string
          p_quantity: number
          p_session_id: string
          p_size: string
          p_unit_price_cents: number
        }
        Returns: {
          added_from: string | null
          color: string | null
          created_at: string
          expires_at: string
          id: string
          image_url: string | null
          product_id: string
          product_name: string
          quantity: number
          reserved_at: string
          session_id: string
          size: string
          unit_price_cents: number
          variant_id: string
        }
        SetofOptions: {
          from: "*"
          to: "cart_reservations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      convert_reservations_to_order: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      generate_slug: { Args: { name: string }; Returns: string }
      get_next_order_number: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_seller: { Args: { _user_id: string }; Returns: boolean }
      upsert_customer: {
        Args: { p_name: string; p_whatsapp: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "seller" | "customer"
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
      app_role: ["admin", "seller", "customer"],
    },
  },
} as const
