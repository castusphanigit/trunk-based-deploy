export interface GetWorkordersParams {
  account_ids?: number[] | 'all';
  workorder_id?: string | number[];
  downloadAll?: boolean;
  workorder_ref_id?: string;
  equipment_id?: string;
  technician_name?: string;
  workorder_status?: string;
  priority_start?: string;
  priority_end?: string;
  priority_range?: string;
  assigned_date?: string;
  workorder_eta?: string;
  unit_number?: string;
  customer_unit_number?: string;
  account_number?: string;
  account_name?: string;
  account?: string;
  vmrs_code?: string;
  invoice_number?: string;
  customer_po?: string;
  created_at?: string;
  workorder_end_date?: string;
  workorder_start_date?: string;
  invoice_date?: string;
  invoice_total_amount?: string;
  page?: number;
  perPage?: number;
  sort?: string
}

export interface GetWorkordersDetailsParams {
  account_id: number;
  equipment_id: number;
  service_request_id: number;
  page?: number;
  perPage?: number
}

export interface Column {
  label: string;
  field: string
}

export interface DownloadQuery {
  account_ids: "all" | number[];
  downloadAll: boolean;
  workorder_id?: number[];
  technician_name?: string;
  status?: string;
  workorder_status?: string;
  assigned_date_from?: string;
  assigned_date_to?: string;
  workorder_eta_from?: string;
  workorder_eta_to?: string;
  priority_range?: string;
  sort?: string
}