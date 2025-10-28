export interface GetListViewParams {
  account_ids: number[] | "all";
  equipment_id?: number[];
  downloadAll?: boolean;
  equipmentId?: number | string;
  serviceRequestId?: number;
  page?: number;
  perPage?: number;
  vin?: string;
  licensePlateNumber?: string;
  motionStatus?: string;
  lastGpsUpdate?: string;
  equipmentType?: string;
  location?: string;
  model?: string;
  customerUnitNumber?: string;
  year?: string;
  lastGpsCoordinates?: string;
  unitNumber?: string;
  telematicDeviceId?: string;
  breakType?: string;
  color?: string;
  liftGate?: string;
  tenBranch?: string;
  dotCviStatus?: string;
  dotCviExpire?: string;
  trailerHeight?: string;
  trailerWidth?: string;
  trailerLength?: string;
  tireSize?: string;
  roofType?: string;
  floorType?: string;
  rimType?: string;
  status?: string;
  make?: string;
  latitude?: string;
  longitude?: string;
  account?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  agreementType?: string;
  equipmentLoadStatus?: string;
  alarmCodeStatus?: string;
  accountNumber?: string;
  accountName?: string;
  vendorName?: string;
  doorType?: string;
  wallType?: string;
  arrivalTime?: string;
  activationDate?: string;
  deactivationDate?: string;
  dateInService?: string;
  lastPmDate?: string;
  nextPmDue?: string;
  lastMrDate?: string;
  lastReeferPmDate?: string;
  nextReeferPmDue?: string;
  reeferMakeType?: string;
  reeferSerial?: string;
  liftGateSerial?: string;
  contractTermType?: string;
  equipmentLoadDate?: string;
  equipmentUnloadDate?: string;
  filterBy?: string;
  sort?: string;
  ersStatus?: string
}

export interface EquipmentCountsParams {
  accountIds: number[];
  page: number;
  perPage: number;
  filterBy?: string
}

export interface GetEquipmentDetailsParams {
  accountId: number;
  equipmentId: number
}

export interface DownloadListViewParams {
  account_ids: number[];
  page?: number;
  perPage?: number;
  equipment_id?: number | string;
  vin?: string;
  license_plate_number?: string;
  motion_status?: string;
  last_gps_update?: string;
  equipment_type?: string;
  location?: string;
  model?: string;
  customer_unit_number?: string;
  year?: string;
  last_gps_coordinates?: string;
  unit_number?: string;
  break_type?: string;
  color?: string;
  lift_gate?: string;
  ten_branch?: string;
  dot_cvi_status?: string;
  trailer_height?: string;
  trailer_width?: string;
  trailer_length?: string;
  tire_size?: string;
  roof_type?: string;
  floor_type?: string;
  rim_type?: string;
  status?: string;
  make?: string;
  latitude?: string;
  longitude?: string;
  account?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  agreement_type?: string;
  equipment_load_status?: string
}
export interface GetTelematicDetailsParams {
  unitNumber: string;
  page?: number;
  perPage?: number
}

//sortFields
export const SORTABLE_FIELDS = [
  "equipment_id",
  "activation_date",
  "deactivation_date",
  "driver_name",
  "unit_number",
  "customer_unit_number",
  "status",
  "vin",
  "permit",
  "make",
  "model",
  "year",
  "length",
  "door_type",
  "wall_type",
  "break_type",
  "color",
  "lift_gate",
  "domicile",
  "ten_branch",
  "lastPmDate",
  "nextPmDue",
  "dot_cvi_status",
  "dotCviExpire",
  "lastReeferPmDate",
  "nextReeferPmDue",
  "lastMRDate",
  "reeferMakeType",
  "reeferSerial",
  "trailer_height",
  "trailer_width",
  "trailer_length",
  "tire_size",
  "roof_type",
  "floor_type",
  "rim_type",
  "dateInService",
  "vendor_name",
  "equipment_type",
  "account_id",
  "account_number",
  "account_name",
  "account",
  "rate",
  "fixedRate",
  "variableRate",
  "estimatedMiles",
  "estimatedHours",
  "contractStartDate",
  "contractEndDate",
  "contractTermType",
  "licensePlateNumber",
  "licensePlateState",
  "url",
  "mimeType",
  "agreementType",
  "current_equipment_gps_location_id",
  "latitude",
  "longitude",
  "last_gps_coordinates",
  "location",
  "motion_status",
  "alarm_code_status",
  "arrival_time",
  "last_gps_update",
  "created_by",
  "equipment_load_status",
] as const;

export type SortField = (typeof SORTABLE_FIELDS)[number];

export interface TelematicsRecord {
  vendor_id: string;
  vendor_name: string;
  unit_number: string;
  vin_trailer_serial_number: string;
  latitude: number;
  longitude: number;
  heading?: string | number;
  address: string;
  speed: number;
  additional_sensors: Record<string, unknown>;
  reading_timestamp: string | Date;
  recived_timestamp: string | Date;
  vendor_timestamp: string | Date;
  equipment_status: string;
  mileage: number;
  engine_hours: number;
  gps_battery: number;
  gps_owner: string;
  message_id: string;
  gps_id: string
}

/**
 * Interface for gate inspection record
 */
export interface GateInspectionRecord {
  equipment_has_gateinspection_id: number;
  equipment_id: number;
  inspection_date: Date;
  location?: string;
  direction?: string;
  reason?: string;
  status?: string;
  notes?: string;
  created_at: Date;
  created_by?: number;
  updated_at?: Date;
  updated_by?: number;
  attachments?: GateInspectionAttachment[];
  direction_lookup?: {
    field_code: string,
    short_description: string,
    long_description?: string
  };
  reason_lookup?: {
    field_code: string,
    short_description: string,
    long_description?: string
  };
  status_lookup?: {
    field_code: string,
    short_description: string,
    long_description?: string
  }
}

/**
 * Interface for gate inspection attachment
 */
export interface GateInspectionAttachment {
  gateinspection_has_attachment_id: number;
  equipment_has_gateinspection_id: number;
  attachment_id: number;
  date_uploaded?: Date;
  expiration_date?: Date;
  created_at: Date;
  created_by?: number;
  attachment: {
    attachment_id: number,
    name?: string,
    description?: string,
    url?: string,
    mime_type?: string,
    document_category_type: string,
    date_uploaded?: Date,
    expiration_date?: Date
  }
}

/**
 * Interface for paginated gate inspection data
 */
export interface PaginatedGateInspections {
  data: GateInspectionRecord[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number
}
