export interface EventMasterResponseDto {
  event_master_id: number;
  event_name: string;
  event_type: string;
  metric_value: number; //  now strictly number
  customer_id: number; //  now strictly number
  created_by: number; //  now strictly number
  operation_type: string;
  created_at: Date;
  updated_at: Date | null
}
