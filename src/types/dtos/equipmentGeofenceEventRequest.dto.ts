export interface GetEquipmentGeofenceEventsByUserParams {
  user_id: string
}

export interface GetEquipmentGeofenceEventsByUserQuery {
  page?: number;
  perPage?: number;
  sort?: string;
  event_type?: string;
  event_detail?: string;
  unit_number?: string;
  equipment_type?: string;
  event_date?: string;
  event_start_date?: string;
  event_end_date?: string;
  account_name?: string;
  account_number?: string;
  geofence_name?: string
}
