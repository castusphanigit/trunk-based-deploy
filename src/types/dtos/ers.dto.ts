export interface GetERSParams {
  account_ids?: number[] | 'all';
  ers_id?: number[];
  downloadAll?: boolean;
  ers_ref_id?: string;
  equipment_id?: number;
  location?: string;
  created_at?: string;
  ers_end_date?: string;
  event_type?: string;
  ers_service_level?: string;
  ers_status?: string;
  hide_completed?: string;
  completed?: string;
  unit_number?: string;
  customer_unit_number?: string;
  account_number?: string;
  account_name?: string;
  account?: string;
  customer_po?: string;
  vmrs_code?: string;
  vmrsCodes?: string;
  workorder_ref_id?: string;
  page?: number;
  perPage?: number;
  sort?: string
}

export interface GetERSDetailsParams {
  page?: number;
  perPage?: number;
  account_id?: number;
  equipment_id?: number;
  ers_id?: number
}