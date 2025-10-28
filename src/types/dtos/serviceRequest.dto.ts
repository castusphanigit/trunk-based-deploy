import { Prisma } from "@prisma/client";

// Type aliases for better readability and SonarQube compliance
type IdType = number | string;
type NullableString = string | null;
type NullableId = number | string | null;
type DateOrString = Date | string;
type BooleanOrString = boolean | string;
type DecimalOrStringOrNumber = Prisma.Decimal | string | number | null;

// Update the interface to match your Prisma schema
export interface CreateServiceRequestInput {
  service_request_id?: number;
  account_id: IdType;
  equipment_id?: NullableId;
  non_ten_unit_number?: NullableString;
  non_ten_unit_company?: NullableString;
  non_ten_carrier?: NullableString;
  non_ten_vin_number?: NullableString;
  service_urgency_lookup_id: IdType;
  service_urgency_type_lookup_id?: NullableId;
  service_issues_lookup_ids?: number[] | string;
  emergency_contact_date?: DateOrString | null;
  service_type_repairedby_date?: DateOrString | null;
  service_type_repairedfrom_date?: DateOrString | null;
  unit_street?: NullableString;
  unit_city?: NullableString;
  unit_state?: NullableString;
  unit_zipcode?: NullableString;
  location_nick_name?: NullableString;
  issue_description?: NullableString;
  tire_size_lookup_id?: NullableId;
  other_type_size?: NullableString;
  saved_location_id?: NullableId;
  attachment_ids?: number[];
  is_loaded: BooleanOrString;
  is_hazardous: BooleanOrString;
  is_driver_available: BooleanOrString;
  driver_name?: NullableString;
  driver_phone_number?: NullableString;
  primary_contact_name: string;
  primary_contact_method?: Prisma.JsonValue;
  primary_contact_phonenumber: string;
  primary_contact_email: string;
  secondary_contact_name?: NullableString;
  secondary_contact_method?: Prisma.JsonValue;
  secondary_contact_phonenumber?: NullableString;
  secondary_contact_email?: NullableString;
  to_save_location: BooleanOrString;
  is_gps_location?: BooleanOrString;
  latitude?: DecimalOrStringOrNumber;
  longitude?: DecimalOrStringOrNumber;
  address?: NullableString;
  facility_lookup_id?: NullableId;
  created_by: IdType;
  created_at?: DateOrString;
  files?: string;
  is_request_pickup?: BooleanOrString;
  location_notes?: NullableString;
  po_reference_number?: NullableString
}
