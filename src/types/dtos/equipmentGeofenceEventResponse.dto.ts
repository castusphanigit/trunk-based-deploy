export interface EquipmentGeofenceEventResponseDto {
  event_id: number;
  event_type: string;
  // event_detail: string;
  event_time: Date;
  equipment: {
    equipment_id: number,
    unit_number: string | null,
    customer_unit_number: string | null,
    description: string | null,
    date_in_service: Date | null,
    estmated_life_in_months: number | null,
    vin: string | null,
    equipment_type: string | null
  } | null;
  account: {
    account_id: number,
    account_name: string | null,
    account_number: string | null
  } | null;
  geofence: {
    geofence_account_id: number,
    geofence_name: string,
    description: string | null,
    geofence_location: string | null,
    shape_type: string | null,
    center_lat: number | null,
    center_lng: number | null,
    radius_meters: number | null
  } | null;
  created_by: number | null;
  created_by_user: {
    user_id: number,
    first_name: string | null,
    last_name: string | null,
    email: string | null
  } | null
}

export interface EquipmentGeofenceEventListResponseDto {
  events: EquipmentGeofenceEventResponseDto[];
  meta: {
    total: number,
    page: number,
    perPage: number,
    pageCount: number
  }
}
