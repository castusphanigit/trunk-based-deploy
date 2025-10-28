// Request DTOs for EventMaster

export interface CreateEventMasterRequestDto {
  event_name: string;
  event_type: string;
  metric_value: number;
  operation_type: string;
  created_by: number;
  customer_id: number
}
