export interface DashboardMetricsResponseDTO {
  success: boolean;
  data: {
    total_units_in_lease: number,
    total_ers_open: number,
    total_service_request_open: number,
    total_units_in_rent: number,
    total_work_orders_open: number,
    total_work_orders_closed: number,
    total_ers_closed: number,
    total_invoice_amount: number,
    invoices_paid: number,
    invoices_overdue: number
  };
  timestamp: string
}
