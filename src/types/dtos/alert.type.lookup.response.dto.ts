export interface AlertTypeLookupResponseDto {
  alert_type_lookup_id: number;
  event_name: string;
  event_type?: string | null;
  metric_value: number;
  operation_type: string;
  status?: string | null;
  customer_id?: number | null;
  alert_category_lookup_id?: number | null;
  created_at: Date;
  created_by?: number | null;
  updated_at?: Date | null;
  updated_by?: string | null
}


