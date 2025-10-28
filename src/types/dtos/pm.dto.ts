export interface PMsByAccountsQuery {
  accountIds: number[];
  page?: number;
  perPage?: number;
  type?: string;
  pm_task_description?: string;
  frequency_interval?: number;
  frequency_type?: string;
  status?: string;
  equipment_id?: number;
  unit_number?: string;
  equipment_type?: string;
  facility_code?: string;
  facility_name?: string;
  fetchAll?: boolean
}

// Query for fetching PMs by a single equipment
export interface PMsByEquipmentQuery {
  equipmentId: number | string;
  page?: number;
  perPage?: number;
  type?: string;
  pm_task_description?: string;
  frequency_interval?: number;
  frequency_type?: string;
  status?: string;
  unit_number?: string;
  equipment_type?: string;
  facility_code?: string;
  facility_name?: string;
  fetchAll?: boolean
}

// Nested type definitions for PM Schedule Detail
export interface PMPartUsed {
  part_name: string;
  part_quantity?: number;
  part_cost?: number
}

export interface PMEvent {
  pm_event_id: number;
  performed_date?: string | null;
  next_due_date?: string | null;
  work_performed?: string | null;
  location?: string | null;
  vendor_technician?: string | null;
  time_taken?: string | null;
  status: string;
  notes?: string | null;
  pm_parts_used: PMPartUsed[]
}

export interface EquipmentGPSLocation {
  latitude?: number | null;
  longitude?: number | null;
  location?: string | null;
  motion_status?: string | null
}

export interface EquipmentTypeLookupRef {
  equipment_type?: string | null
}

export interface Equipment {
  equipment_id: number;
  unit_number?: string | null;
  equipment_type_lookup_ref: EquipmentTypeLookupRef;
  current_equipment_gps_location?: EquipmentGPSLocation | null
}

export interface Account {
  account_id: number;
  account_name: string
}

export interface FacilityLookup {
  facility_code?: string | null;
  facility_name?: string | null
}

// Main return type for the service
// export interface PMScheduleDetail {
//   pmScheduleId: number;
//   pmType?: string | null;
//   taskDescription?: string | null;
//   frequency: string;
//   scheduleStatus?: string | null;
//   comments?: string | null;
//   account: Account;
//   equipment: Equipment;
//   facility: FacilityLookup;
//   timeline: Array<{
//     pmEventId: number;
//     performedDate?: string | null;
//     dueDate?: string | null;
//     status?: string | null;
//     notes?: string | null;
//   }>;
//   serviceHistory: Array<{
//     pmEventId: number;
//     performedDate?: string | null;
//     dueDate?: string | null;
//     workPerformed?: string | null;
//     location?: string | null;
//     vendorTechnician?: string | null;
//     timeTaken?: string | null;
//     status?: string | null;
//     notes?: string | null;
//     partsReplaced?: PMPartUsed[];
//   }>;
// }

export interface PMScheduleDetail {
  pmScheduleId: number;
  pmType: string | null;
  taskDescription: string;
  frequency: string;
  scheduleStatus: string;
  comments: string | null;
  account: { account_id: number, account_name: string };
  equipment: {
    equipment_id: number,
    unit_number: string,
    equipment_type_lookup_ref: { equipment_type: string },
    telematics: {
      latitude: number | null,
      longitude: number | null,
      address: string | null,
      motion_status: string | null
    } | null
  } | null;
  facility: { facility_code: string, facility_name: string } | null;
  timeline: Record<string, unknown>[];
  serviceHistory: Record<string, unknown>[]
}

// Preventive maintenance event
export interface PreventiveMaintenanceEvent {
  pm_event_id: number;
  performed_date: Date | null;
  next_due_date: Date | null;
  work_performed: string | null;
  location: string | null;
  vendor_technician: string | null;
  time_taken: string | null;
  status: string;
  notes: string | null;
  pm_parts_used: PMPartUsed[]
}

// types/request.types.ts
export interface DOTInspectionFilterQuery {
  accountIds: string;
  inspection_result?: string;
  inspector_name?: string;
  notes?: string;
  status?: string;
  type?: string;

  inspection_date?: string;
  next_inspection_due?: string;

  equipment_id?: string;
  unit_number?: string;
  equipment_type?: string;
  violation_code?: string;
  severity_level?: string;
  sort?: string;
  fetchAll?: string;
  page?: string;
  perPage?: string;
  compliance?: string;
  valid_through?: string
}

// types/request.types.ts

export interface CombinedRecordsQuery {
  accountIds: string;
  pm_type?: string;
  pm_task_description?: string;
  frequency_interval?: number;
  frequency_type?: string;
  status?: string;
  facility_code?: string;
  facility_name?: string;
  equipment_id?: number;
  unit_number?: string;
  equipment_type?: string;
  inspection_result?: string;
  inspector_name?: string;
  notes?: string;
  inspection_status?: string;
  type?: string;
  compliance?: string;

  violation_code?: string;
  severity_level?: string;
  valid_through?: string;
  sort?: string;
  page?: number;
  perPage?: number;
  skip?: number;
  take?: number;
  next_inspection_due?: string;
  inspection_date?: string;
  lastEvent_performed_date?: string;
  nextEvent_next_due_date?: string;
  excludedIds?: {
    pm?: string | string[] | number[],
    dot?: string | string[] | number[]
  };
  [key: string]: unknown
}

export interface FlattenedPM {
  pm_schedule_id: number;
  pm_task_description: string;
  type: string;
  status: string;
  frequency_interval: number;
  frequency_type: string;
  equipment: {
    equipment_id: number,
    unit_number: string,
    equipment_type_lookup_ref?: { equipment_type: string }
  } | null;
  facility_lookup: { facility_code: string, facility_name: string } | null;
  lastEvent_performed_date?: string | null;
  nextEvent_next_due_date?: string | null;
  recordType: "PM"
}

export interface FlattenedDOT {
  dot_inspection_id: number;
  equipment_id: number;
  account_id: number;
  schedule_agreement_id?: number | null;
  inspection_date?: string | null;
  inspector_name?: string | null;
  inspection_result?: string | null;
  notes?: string | null;
  status?: string | null;
  valid_through?: string | null;
  compliance?: string | null;
  next_inspection_due?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  equipment: {
    unit_number: string,
    equipment_type_lookup_ref?: { equipment_type: string }
  } | null;
  dot_inspection_violation: [];
  type?: string | null;
  recordType: "DOT"
}

interface DotViolation {
  violation_code: string;
  description: string;
  severity_level?: string;
  corrective_action_taken?: string
}

export interface CombinedRecord {
  recordType: string;
  // PM fields
  pm_schedule_id?: number;
  pm_task_description?: string;
  type?: string;
  status?: string;
  frequency_interval?: number;
  frequency_type?: string;
  lastEvent_performed_date?: string | null;
  nextEvent_next_due_date?: string | null;

  // DOT fields
  dot_inspection_id?: number;
  equipment_id?: number;
  account_id?: number;
  schedule_agreement_id?: number;
  inspection_date?: string | null;
  inspector_name?: string;
  inspection_result?: string;
  notes?: string;
  valid_through?: string | null;
  compliance?: string;
  next_inspection_due?: string | null;
  created_at?: string | null;
  updated_at?: string | null;

  // Flattened equipment fields
  equipment_unit_number?: string;
  equipment_equipment_type_lookup_ref_equipment_type?: string;

  // Flattened facility fields
  facility_lookup_facility_name?: string;
  facility_lookup_facility_code?: string;

  // DOT violations
  dot_inspection_violation?: DotViolation[];

  // Allow any other properties
  [key: string]: unknown
}
