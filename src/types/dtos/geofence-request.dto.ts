export interface GetGeofenceByUserIdParams {
  userId: string // from req.params
}
export interface GetGeofenceByCustIdParams {
  custId: string // from req.params
}

export interface GetGeofenceByUserIdQuery {
  page?: number | string;
  perPage?: number | string;
  sort?: string;

  // filters
  geofence_name?: string;
  description?: string;
  geofence_location?: string;
  geofence_shape?: string;
  // some endpoints use shape_type naming — accept both
  shape_type?: string;
  owner?: string;
  status?: string;
  tag_name?: string;

  // simplified
  created_by?: string;
  updated_by?: string;

  // New date filters
  created_from?: string; // ISO date string (e.g. "2025-09-01")
  created_to?: string;
  updated_from?: string;
  updated_to?: string;
  assets_in_geofence?: number;
  account_number?: string;

  // global search
  globalSearch?: string
}

export interface DownloadQueryDto {
  downloadAll: boolean;
  download_ids?: number[];
  [key: string]: unknown
}

export interface DownloadColumnDto {
  label: string;
  field: string;
  formatter?: (val: unknown) => unknown;
  width?: number
}

export interface DownloadGeofenceRequestDto {
  columns: DownloadColumnDto[];
  query: DownloadQueryDto
}

// Additional useful interfaces used by controllers/services for typing
export interface AccountDto {
  account_id: number;
  account_name?: string | null;
  account_number?: string | null
}

export interface GeofenceAccountResponseDto {
  id: number;
  geofence_name: string | null;
  assets_in_geofence?: number | null;
  zoom_level?: number | null;
  geofence_shape?: string | null;
  center_lat?: number | null;
  center_lng?: number | null;
  radius_meters?: number | null;
  owner?: string | null;
  description?: string | null;
  geofence_location?: string | null;
  status?: string | null;
  created_by?: number | null;
  created_by_user?: { first_name?: string | null, last_name?: string | null, email?: string | null } | null;
  updated_by?: number | null;
  updated_by_user?: { first_name?: string | null, last_name?: string | null, email?: string | null } | null;
  tag_name?: string | null;
  accounts: AccountDto[];
  created_at?: Date | null;
  updated_at?: Date | null
}
