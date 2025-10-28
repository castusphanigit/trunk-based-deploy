// Request DTOs

export interface CreateTelematicsAlertDto {
  // Basic info
  customer_id: number;
  account_id: number[];
  geofence_account_id?: number[];
  events_id?: number[];
  events_category_id: number;
  status: string;
  geofence_alert_name?: string;

  // Temperature fields
  event_low?: string;
  event_high?: string;
  temperature_unit_id?: number; // 1=Fahrenheit, 2=Celsius, 3=Celsius

  // Time-based settings
  between_hours_from?: string;
  between_hours_to?: string;
  specific_days?: string[];
  start_date?: string;
  end_date?: string;
  event_duration?: string;

  // Delivery and recipients
  delivery_methods?: number[];
  recipients?: string[];
  recipients_email?: string[];
  recipients_mobile?: string[];
  recipients_user_ids?: number[];
  textRecipientsObj?: string[];
  emailRecipientsObj?: string[];

  // Equipment selection
  equipment_ids: number[];
  selected_equipment_ids: number[];
  equipmentSelectAll?: boolean;

  // System fields
  webhook?: boolean;
  deleted_by?: number;
  created_by?: number;
  updated_by?: number;
}

export interface UpdateTelematicsAlertDto {
  // Basic info
  status?: string;
  geofence_alert_name?: string;

  // Temperature fields
  event_low?: string;
  event_high?: string;
  temperature_unit_id?: number;

  // Time-based settings
  between_hours_from?: string;
  between_hours_to?: string;
  specific_days?: string[];
  start_date?: string;
  end_date?: string;
  event_duration?: string;

  // Delivery and recipients
  delivery_methods?: number;
  recipients_email?: string[];
  recipients_mobile?: string[];
  recipients_user_ids?: number[];

  // Equipment selection
  equipment_ids?: number[];
  equipmentSelectAll?: boolean;

  // System fields
  webhook?: boolean;
  updated_by?: number;
}

export interface DeleteTelematicsAlertDto {
  user_id?: number;
}

export interface FetchUsersByAccountsDto {
  account_ids: number[];
  customer_id: number;
}

export interface FetchEquipmentByAccountsDto {
  account_ids: number[];
  customer_id: number;
}

export interface FetchEquipmentByAccountsEventsDto {
  account_ids: number[];
  customer_id: number;
  event_cat_id: number;
}
