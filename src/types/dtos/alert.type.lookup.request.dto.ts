export interface CreateAlertTypeLookupRequestDto {
  event_name: string;                 // required
  event_type?: string;                // optional
  metric_value?: number;              // optional
  operation_type: string;             // required
  status?: string;                    // optional
  customer_id?: number;               // optional
  alert_category_lookup_id?: number;  // optional
  created_by?: number;                // optional
  updated_by?: string               // optional
}
