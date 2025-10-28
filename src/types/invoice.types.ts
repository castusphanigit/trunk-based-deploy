export interface InvoiceFilters {
  account_id?: number;
  dateFrom?: Date;
  dateTo?: Date;
  dueDateFrom?: Date;
  dueDateTo?: Date;
  status?: "PAID" | "UNPAID" | "OVERDUE" | "PARTIAL";
  minAmount?: number;
  maxAmount?: number
}

export interface InvoiceSortOptions {
  field: "date" | "dueDate" | "totalAmount" | "invoiceNumber" | "createdAt";
  order: "asc" | "desc"
}

export interface InvoiceStats {
  totalInvoices: number;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  overdueAmount: number
}

export enum InvoiceStatus {
  PAID = "PAID",
  UNPAID = "UNPAID",
  OVERDUE = "OVERDUE",
  PARTIAL = "PARTIAL",
}

export enum PaymentMethod {
  CREDIT_CARD = "Credit Card",
  BANK_TRANSFER = "Bank Transfer",
  CHECK = "Check",
  CASH = "Cash",
  ACH = "ACH",
  WIRE_TRANSFER = "Wire Transfer",
}
