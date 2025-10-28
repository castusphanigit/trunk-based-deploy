// configs/accountSortFields.ts
import { SortFieldMap } from "../../utils/sort";

export const ACCOUNT_SORT_FIELDS: SortFieldMap = {
  account_id: "account_id",
  account_name: "account_name",
  account_number: "account_number",
  legacy_account_number: "legacy_account_number",
  account_type: "account_type",
  status: "status",
  number_of_users: "number_of_users",
  created_at: "created_at",
  updated_at: "updated_at",
  customer_name: { customer: { customer_name: "asc" } },
  country_name: { country_lookup_ref: { country_name: "asc" } },
  facility: "facility",
};

export const USER_SORT_FIELDS: SortFieldMap = {
  user_id: "user_id",
  customer_id: "customer_id",
  user_role_id: "user_role_id",
  country_lookup_id: "country_lookup_id",
  assigned_account_ids: "assigned_account_ids",
  first_name: "first_name",
  last_name: "last_name",
  email: "email",
  phone_number: "phone_number",
  designation: "designation",
  avatar: "avatar",
  auth_0_reference_id: "auth_0_reference_id",
  auth0_role_id: "auth0_role_id",
  status: "status",
  is_customer_user: "is_customer_user",
  first_active: "first_active",
  last_active: "last_active",
  created_at: "created_at",
  created_by: "created_by",
  updated_at: "updated_at",
  updated_by: "updated_by",
  auth0_customer_id: "auth0_customer_id",
  permissions: "permissions",

  name: "name",
};

export const CUSTOMER_SORT_FIELDS: SortFieldMap = {
  customer_id: "customer_id",
  customer_name: "customer_name",
  customer_class: "customer_class",
  status: "status",
  reference_number: "reference_number",
  sold_by_salesperson_id: "sold_by_salesperson_id",
  created_at: "created_at",
  updated_at: "updated_at",
};

export const USER_ROLE_SORT_FIELDS: SortFieldMap = {
  user_role_id: "user_role_id",
  customer_id: "customer_id",
  name: "name",
  description: "description",
  auth0_role_id: "auth0_role_id",
  auth0_role_name: "auth0_role_name",
  created_at: "created_at",
  created_by: "created_by",
  updated_by: "updated_by",
};

export const GEOFENCE_SORT_FIELDS = {
  geofence_account_id: "geofence_account_id",
  assets_in_geofence: "assets_in_geofence",
  geofence_name: "geofence_name",
  geofence_shape: "shape_type", // field name adjusted as per DB
  center_lat: "center_lat",
  center_lng: "center_lng",
  radius_meters: "radius_meters",
  owner: "owner",
  description: "description",
  geofence_location: "geofence_location",
  status: "status",
  created_by: "created_by",
  updated_by: "updated_by",

  //  created_by user details
  created_by_user_first_name: { created_by_user: { first_name: "first_name" } },
  created_by_user_last_name: { created_by_user: { last_name: "last_name" } },
  created_by_user_email: { created_by_user: { email: "email" } },

  //  updated_by user details
  updated_by_user_first_name: { updated_by_user: { first_name: "first_name" } },
  updated_by_user_last_name: { updated_by_user: { last_name: "last_name" } },
  updated_by_user_email: { updated_by_user: { email: "email" } },

  //  tags and events
  tag_name: { tag_lookup: { tag_name: "tag_name" } },

  created_at: "created_at",
  updated_at: "updated_at",
  account_name: { account_ids: { account_name: "account_name" } },
  account_number: { account_ids: { account_number: "account_number" } },
};

export const TELEMATICS_ALERT_SORT_FIELDS: SortFieldMap = {
  geofence_alert_id: "geofence_alert_id",
  alert_name: "alert_name", //  Alert Name
  status: "status", //  Status
  event_duration: "event_duration",
  between_hours_from: "between_hours_from",
  between_hours_to: "between_hours_to",
  start_date: "start_date",
  end_date: "end_date",

  created_at: "created_at", //  Created Date
  updated_at: "updated_at", //  Updated Date

  // Relations
  customer: { customer: { customer_name: "customer_name" } },
  created_by: { created_by_user: { first_name: "first_name" } }, //  Created By
  updated_by: { updated_by_user: { first_name: "first_name" } }, //  Updated By

  // For Delivery Method: join on lookup
  delivery_method: { delivery_method_lookup: { method_type: "method_type" } }, //  Delivery Method
  delivery_frequency: "delivery_frequency",

  // FOR EVENTS
  event: { alert_type: { event_name: "event_name" } }, // use relation name alert_type
  // FOR CATEGORIES
  category: { alert_category: { category_name: "category_name" } }, // use relation name alert_category
};

// Sorting map for workorders
export const WORKORDER_SORT_FIELDS: SortFieldMap = {
  workorder_id: "workorder_id",
  equipment_id: { service_request: { equipment_id: "equipment_id" } },
  technician_name: "technician_name",
  assigned_date: "workorder_assigned_date",
  workorder_eta: "workorder_eta",
  priority_start: "workorder_priority_start_date",
  priority_end: "workorder_priority_end_date",
  workorder_status: "workorder_status",
  workorder_ref_id: "workorder_ref_id",
  invoice_number: { Invoice: { invoiceNumber: "invoiceNumber" } },
  customer_po: {
    service_request: { account: { customer: { customer_po: "customer_po" } } },
  },
  created_at: "created_at",
  workorder_end_date: "workorder_end_date",
  workorder_start_date: "workorder_start_date",
  invoice_date: { Invoice: { date: "date" } },
  invoice_total_amount: { Invoice: { totalAmount: "totalAmount" } },

  //Virtual/computed fields
  priority_range: "_inMemoryPriorityRangeSort",
  account_id: { service_request: { account_id: "account_id" } },
};

export const FLEET_LIST_VIEW_SORT_FIELDS: SortFieldMap = {
  equipment_id: { equipment_ref: { equipment_id: "equipment_id" } },
  activationDate: "activation_date",
  deactivationDate: "deactivation_date",
  driver_name: "_inMemoryDriverNameSort",
  unitNumber: { equipment_ref: { unit_number: "unit_number" } },
  customerUnitNumber: {
    equipment_ref: { customer_unit_number: "customer_unit_number" },
  },
  status: { equipment_ref: { status: "status" } },
  vin: { equipment_ref: { vin: "vin" } },
  make: { equipment_ref: { oem_make_model_ref: { make: "make" } } },
  model: { equipment_ref: { oem_make_model_ref: { model: "model" } } },
  year: { equipment_ref: { oem_make_model_ref: { year: "year" } } },
  length: { equipment_ref: { length: "length" } },
  doorType: { equipment_ref: { door_type: "doorType" } },
  wallType: { equipment_ref: { wall_type: "wallType" } },
  breakType: { equipment_ref: { brake_type: "brake_type" } },
  color: { equipment_ref: { color: "color" } },
  liftGate: { equipment_ref: { liftgate: "liftgate" } },
  domicile: { equipment_ref: { domicile: "domicile" } },
  tenBranch: { equipment_ref: { ten_branch: "ten_branch" } },
  lastPmDate: { equipment_ref: { last_pm_date: "last_pm_date" } },
  nextPmDue: { equipment_ref: { next_pm_due: "next_pm_due" } },
  dotCviStatus: { equipment_ref: { dot_cvi_status: "dot_cvi_status" } },
  dotCviExpire: "_inMemoryDotCviExpireSort", // from dot_inspection relation
  lastReeferPmDate: {
    equipment_ref: { last_reefer_pm_date: "last_reefer_pm_date" },
  },
  nextReeferPmDue: {
    equipment_ref: { next_reefer_pm_due: "next_reefer_pm_due" },
  },
  lastMrDate: { equipment_ref: { last_mr_date: "last_mr_date" } },
  reeferMakeType: { equipment_ref: { reefer_make_type: "reefer_make_type" } },
  reeferSerial: { equipment_ref: { reefer_serial: "reefer_serial" } },
  liftGateSerial: { equipment_ref: { liftgate_serial: "liftgate_serial" } },
  trailerHeight: { equipment_ref: { trailer_height: "trailer_height" } },
  trailerWidth: { equipment_ref: { trailer_width: "trailer_width" } },
  trailerLength: { equipment_ref: { trailer_length: "trailer_length" } },
  dateInService: { equipment_ref: { date_in_service: "date_in_service" } },
  tireSize: { equipment_ref: { tire_size: "tire_size" } },
  floorType: { equipment_ref: { floor_type: "floorType" } },
  roofType: { equipment_ref: { roof_type: "roofType" } },
  rimType: { equipment_ref: { rim_type: "rimType" } },
  vendorName: "_inMemoryVendorNameSort", // nested vendor
  equipmentType: {
    equipment_ref: {
      equipment_type_lookup_ref: { equipment_type: "equipment_type" },
    },
  },
  accountNumber: {
    equipment_type_allocation_ref: {
      account: { account_number: "account_number" },
    },
  },
  accountName: {
    equipment_type_allocation_ref: {
      account: { account_name: "account_name" },
    },
  },
  contractStartDate: "_inMemoryContractStartDateSort", // from masterAgreement
  contractEndDate: "_inMemoryContractEndDateSort", // from schedule
  contractTermType: "_inMemoryContractTermTypeSort",
  agreementType: "_inMemoryAgreementTypeSort",
  licensePlateNumber: {
    equipment_ref: {
      equipment_permit: { license_plate_number: "license_plate_number" },
    },
  },
  licensePlateState: {
    equipment_ref: {
      equipment_permit: { license_plate_state: "license_plate_state" },
    },
  },
  url: "_inMemoryUrlSort",
  mimeType: "_inMemoryMimeTypeSort",
  equipmentLoadStatus: "_inMemoryEquipmentLoadStatusSort", // load status is nested
  equipmentLoadDate: "_inMemoryEquipmentLoadDateSort",
  equipmentUnloadDate: "_inMemoryEquipmentUnloadDateSort",
  arrivalTime: "_inMemoryArrivalTimeSort", // derived from last_gps_update
  motionStatus: "_inMemoryMotionStatusSort", // GPS relation
  alarmCodeStatus: "_inMemoryAlarmCodeStatusSort", // derived
  latitude: "_inMemoryLatitudeSort",
  longitude: "_inMemoryLongitudeSort",
  lastGpsUpdate: "_inMemoryLastGpsUpdateSort",
};

// Sorting map for ers
export const ERS_SORT_FIELDS: SortFieldMap = {
  ers_id: "ers_id",
  ers_ref_id: "ers_ref_id",
  created_at: "created_at",
  ers_end_date: "ers_end_date",
  ers_service_level: "ers_service_level",
  ers_status: "ers_status",
  location: "location",
  event_type: "_inMemoryEventTypeSort",

  // Relations
  account_id: { service_request: { account_id: "account_id" } },
  equipment_id: { service_request: { equipment_id: "equipment_id" } },
  unit_number: {
    service_request: { equipment_ref: { unit_number: "unit_number" } },
  },
  customer_unit_number: {
    service_request: {
      equipment_ref: { customer_unit_number: "customer_unit_number" },
    },
  },
  account_number: {
    service_request: { account: { account_number: "account_number" } },
  },
  account_name: {
    service_request: { account: { account_name: "account_name" } },
  },
  customer_po: {
    service_request: { account: { customer: { customer_po: "customer_po" } } },
  },
  workorder_ref_id: { workorder: { workorder_ref_id: "workorder_ref_id" } },
  // location: { service_request: { location_line1: "location_line1" } },
};

export const LEASE_AGREEMENT_SORT_FIELDS: SortFieldMap = {
  schedule_number: "schedule_agreement_id",
  schedule_agreement_ref: "schedule_agreement_ref",
  agreement_po: "agreement_po",
  account_number: "_inMemoryAccountNumberSort",
  account_name: "_inMemoryAccountNameSort",
  lease_po: { contract_type_lookup_ref: { contract_panel_type: "asc" } },
  contract_created_at: { contract_type_lookup_ref: { created_at: "asc" } },
  status: { schedule_agreement_status_lookup: { field_code: "asc" } },
  start_date: "effective_date",
  termination_date: "termination_date",
  facility: { facility_lookup_ref: { facility_code: "facility" } },

  // special in-memory sorting
  unit_number: "_inMemoryUnitNumberSort",
  description: "_inMemoryDescriptionSort",
  schedule_agreement_ref_sort: "_inMemoryScheduleAgreementRefSort",
  agreement_po_sort: "_inMemoryAgreementPoSort",
};

export const EQUIPMENT_GEOFENCE_EVENT_SORT_FIELDS: SortFieldMap = {
  event_type: "event_type",
  event_detail: "event_detail",
  unit: { equipment: { unit_number: "unit_number" } },
  equipment_type: {
    equipment: {
      equipment_type_lookup_ref: { equipment_type: "equipment_type" },
    },
  },
  event_date: "event_time",
  account_name: { account: { account_name: "account_name" } },
  account_number: { account: { account_number: "account_number" } },
  geofence_name: { geofence_account: { geofence_name: "geofence_name" } },
};

export const SERVICE_REQUEST_SORT_FIELDS: SortFieldMap = {
  service_request_id: "service_request_id",
  submitted_on: "created_at",
  created_at: "created_at",
  equipment_id: "equipment_id",
  created_by: "created_by",
  unit_street: "unit_street",
  unit_city: "unit_city",
  unit_state: "unit_state",

  // Computed/derived fields that need in-memory sorting
  trailer: { _inMemoryTrailerSort: "asc" },
  submitted_by: { _inMemorySubmittedBySort: "asc" },
  issue: { _inMemoryIssueSort: "asc" },
  repaired_by: { _inMemoryRepairedBySort: "asc" },
  location: { _inMemoryLocationSort: "asc" },
};

export const PM_DOT_SORT_FIELDS: SortFieldMap = {
  // --- Common fields ---
  recordType: "recordType",
  unit_number: "unit_number",
  equipment_type: "equipment_type",

  // --- Preventive Maintenance Schedule fields ---
  pm_schedule_id: "pm_schedule_id",
  pm_task_description: "pm_task_description",
  frequency_interval: "frequency_interval",
  frequency_type: "frequency_type",
  type: "type",
  status: "status",

  // Last Event
  lastEvent_pm_event_id: "lastEvent_pm_event_id",
  lastEvent_performed_date: "lastEvent_performed_date",
  lastEvent_next_due_date: "lastEvent_next_due_date",
  lastEvent_status: "lastEvent_status",

  // Next Event
  nextEvent_pm_event_id: "nextEvent_pm_event_id",
  nextEvent_performed_date: "nextEvent_performed_date",
  nextEvent_next_due_date: "nextEvent_next_due_date",
  nextEvent_status: "nextEvent_status",

  // --- DOT Inspection fields ---
  dot_inspection_id: "dot_inspection_id",
  equipment_id: "equipment_id",
  account_id: "account_id",
  schedule_agreement_id: "schedule_agreement_id",
  inspection_date: "inspection_date",
  inspector_name: "inspector_name",
  inspection_result: "inspection_result",
  notes: "notes",
  nextInspectionDue: "nextInspectionDue",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  valid_through: "valid_through",
  compliance: "compliance",
  next_inspection_due: "next_inspection_due",
  created_at: "created_at",
  updated_at: "updated_at",
  equipment: "equipment",
};

export const DOT_INSPECTION_SORT_FIELDS: SortFieldMap = {
  dot_inspection_id: "dot_inspection_id",
  inspection_date: "inspection_date",
  inspector_name: "inspector_name",
  inspection_result: "inspection_result",
  notes: "notes",
  next_inspection_due: "next_inspection_due",
  valid_through: "valid_through",
  compliance: "compliance",
  created_at: "created_at",
  updated_at: "updated_at",
  status: "status",

  // relations
  account_id: "account_id",
  equipment_id: "equipment_id",
  schedule_agreement_id: "schedule_agreement_id",

  // nested sort fields
  unit_number: { equipment: { unit_number: "unit_number" } },
  equipment_type: {
    equipment: {
      equipment_type_lookup_ref: { equipment_type: "equipment_type" },
    },
  },
  account_name: { account: { account_name: "account_name" } },
  account_number: { account: { account_number: "account_number" } },
};

export const ACTIVITY_FEED_SORT_FIELDS = {
  activity_feed_id: "activity_feed_id",
  event_time: "event_time",
  created_at: "created_at",
  updated_at: "updated_at",
  unit_number: { equipment: { unit_number: "unit_number" } },
  equipment_type: {
    equipment: {
      equipment_type_lookup_ref: { equipment_type: "equipment_type" },
    },
  },

  account_name: { account: { account_name: "account_name" } },
  account_number: { account: { account_number: "account_number" } },
  customer_name: { customer: { customer_name: "customer_name" } },
  geofence_name: { geofence: { geofence_name: "geofence_name" } },
  alert_name: { telematic_alert: { alert_name: "alert_name" } },
  event_name: { alert_type: { event_name: "event_name" } },
};

export const INVOICE_SORT_FIELDS: SortFieldMap = {
  id: "id",
  invoiceNumber: "invoiceNumber",
  invoiceDate: "date",
  date: "date",
  dueDate: "dueDate",
  invoiceType: "invoiceType",
  billingPeriod_start: "billingPeriod_start",
  billingPeriod_end: "billingPeriod_end",
  billingAddress: "billingAddress",
  contactInfo: "contactInfo",
  taxId: "taxId",
  description: "description",
  quantity: "quantity",
  rate: "rate",
  subTotal: "subTotal",
  taxes: "taxes",
  discounts: "discounts",
  credits: "credits",
  totalAmount: "totalAmount",
  amountPaid: "amountPaid",
  balanceDue: "balanceDue",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  account_id: "account_id",
  accountId: "account_id",
  account_name: { account: { account_name: "account_name" } },
  account_number: { account: { account_number: "account_number" } },
};

export const PAYMENT_SORT_FIELDS: SortFieldMap = {
  id: "id",
  paymentId: "paymentId",
  paymentDate: "paymentDate",
  paymentMethod: "paymentMethod",
  payerName: "payerName",
  payerEntity: "payerEntity",
  invoicePayments: "invoicePayments",
  invoiceCredits: "invoiceCredits",
  paymentAmount: "paymentAmount",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  account_id: "account_id",
  account_name: { account: { account_name: "account_name" } },
  account_number: { account: { account_number: "account_number" } },
  TotalPaid: "paymentAmount", // TotalPaid maps to paymentAmount field
  AmountPaid: "paymentAmount", // AmountPaid also maps to paymentAmount field
  DueBalance: "paymentAmount",
};
