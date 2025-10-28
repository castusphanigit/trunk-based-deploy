

export interface GeofenceAccountResponseDto {
  id: number;
  geofence_name: string | null;
  geofence_shape: string | null;
  assets_in_geofence: number | null;
  zoom_level: number | null;
  center_lat: number | null;
  center_lng: number | null;
  radius_meters: number | null;
  owner: string | null;
  description: string | null;
  geofence_location: string | null;
  status: string | null; // 🔥 allow null
  created_by: number | null;
  created_by_user?: {
    first_name?: string | null,
    last_name?: string | null,
    email?: string | null
  } | null;
  updated_by?: string | number | null; // 🔥 allow both
  updated_by_user?: {
    first_name?: string | null,
    last_name?: string | null,
    email?: string | null
  } | null;
  tag_name?: string | null;

  accounts: {
    account_id: number,
    account_name?: string | null,
    account_number?: string | null
  }[];
  created_at?: Date | null;
  updated_at?: Date | null
}
