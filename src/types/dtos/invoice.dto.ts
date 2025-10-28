import {
  Invoice,
  Invoice_Items,
  InvoiceEquipment,
  InvoiceType,
} from "@prisma/client";

export interface InvoiceRequestPayload {
  invoiceNumber: string;
  date: Date | string;
  dueDate: Date | string;
  billingPeriod_start: Date | string;
  billingPeriod_end: Date | string;
  billingAddress: string;
  contactInfo: string;
  taxId: string;
  invoiceType?: InvoiceType;
  description: string;
  quantity: number;
  rate: number;
  subTotal: number;
  taxes: number;
  discounts: number;
  credits: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  account_id: number;
  equipmentIds?: number[];
  invoiceItems?: InvoiceItemRequestPayload[];
}

export interface InvoiceItemRequestPayload {
  item_description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface InvoiceUpdatePayload {
  invoiceNumber?: string;
  date?: Date | string;
  dueDate?: Date | string;
  billingPeriod_start?: Date | string;
  billingPeriod_end?: Date | string;
  billingAddress?: string;
  contactInfo?: string;
  taxId?: string;
  invoiceType?: InvoiceType;
  description?: string;
  quantity?: number;
  rate?: number;
  subTotal?: number;
  taxes?: number;
  discounts?: number;
  credits?: number;
  totalAmount?: number;
  amountPaid?: number;
  balanceDue?: number;
  equipmentIds?: number[];
  invoiceItems?: InvoiceItemRequestPayload[];
}

export interface InvoiceResponsePayload extends Invoice {
  invoiceItems?: Invoice_Items[];
  invoiceEquipments?: (InvoiceEquipment & {
    equipment: {
      equipment_id: number;
      unit_number: string;
      description: string;
      customer_unit_number: string | null;
    };
  })[];
  account?: {
    account_id: number;
    account_name: string | null;
    account_number: string | null;
  };
  vmrsCodes?: {
    workorder_id: number;
    vmrs_id: number;
    workorder_part_cost: string | null;
    workorder_labour_cost: string | null;
    workorder_totalCost: string | null;
    part_description: string | null;
    line: number | null;
    is_billable: boolean;
    created_at: Date;
    created_by: number | null;
    updated_at: Date | null;
    updated_by: number | null;
    vmrs_Lookup: {
      vmrs_id: number;
      vmrs_code: string;
      labor_cost: string | null;
      part_cost: string | null;
      part_quantity: number | null;
      vmrs_description: string | null;
      created_at: Date;
      created_by: number | null;
      updated_at: Date | null;
      updated_by: number | null;
    };
  }[];
}

export interface CreditInvoiceResponsePayload {
  date: string; // Formatted as YYYY-MM-DD
  invoiceNumber: string;
  accountNumber: string;
  balanceDue: number;
}

export interface CreditInvoicesQueryParams {
  page?: number;
  perPage?: number;
  sort?: string; // "credit_date:asc", "credit_invoice_number:desc", "credit_amount:asc"
  accountIds?: string | string[];
  dateFrom?: string;
  dateTo?: string;
  creditInvoiceNumber?: string;
  accountNumber?: string;
}

export interface CreditInvoicesResponse {
  creditInvoices: CreditInvoiceResponsePayload[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}
