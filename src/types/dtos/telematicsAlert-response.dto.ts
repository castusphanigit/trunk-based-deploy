export interface TelematicsAlertResponseDto {
  telematic_alert_id: number;
  customer_id: number;
  account_id: number[];
  geofence_id: number[];
  alert_type_id: number[];
  alert_category_id?: number;
  status: string;
  alert_name?: string;

  // Temperature fields
  event_low?: string | null;
  event_high?: string | null;
  converted_type?: string | null;
  converted_value: number[];
  temperature_unit_id?: number | null;

  // Delivery and recipients
  delivery_methods: number[];
  recipients: string[];
  recipients_email: string[];
  recipients_mobile: string[];
  recipients_user_ids: number[];
  textRecipientsObj?: unknown;
  emailRecipientsObj?: unknown;

  // Time-based settings
  between_hours_from?: string | null;
  between_hours_to?: string | null;
  specific_days: string[];
  start_date?: Date | null;
  end_date?: Date | null;
  event_duration?: string | null;

  // Equipment
  equipmentSelectAll: boolean;
  equipment_ids: number[];
  selected_equipment_ids: number[];

  // System fields
  webhook: boolean;
  is_deleted: boolean;
  deleted_by?: number | null;
  deleted_at: Date;
  created_at: Date;
  created_by?: number | null;
  updated_at: Date;
  updated_by?: number | null;
}

export interface UserResponseDto {
  user_id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_number: string | null;
  user_role_id: number;
  role_name: string | null;
  role_description: string | null;
}

export interface EquipmentResponseDto {
  equipment_id: number;
  unit_number: string;
  customer_unit_number: string | null;
  description: string;
  status?: string | null;
}
