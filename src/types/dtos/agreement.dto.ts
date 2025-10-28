export interface GetLeaseAgreementsParams {
  account_ids?: number[] | "all";
  account_number?: string;
  downloadAll?: boolean;
  equipment_id?: number[];
  account_name?: string;
  account?: string;
  contract_start_date?: string;
  contract_end_date?: string;
  agreement_type?: string;
  unit_number?: string;
  contract_panel_type?: string;
  contract_created_at?: string;
  description?: string;
  facility?: string;
  status?: string;
  schedule_agreement_id?: number;
  schedule_agreement_ref?: string;
  agreement_po?: string;
  page?: number;
  perPage?: number;
  sort?: string;
}

export interface EquipmentReadingDTO {
  equipment_reading: number;
  reading_type: string;
}

export interface EquipmentRefDTO {
  equipment_id: number;
  unit_number: string;
  equipment_reading: EquipmentReadingDTO | null;
}

export interface EquipmentAssignmentDTO {
  equipment_ref: EquipmentRefDTO;
}

export interface EquipmentTypeAllocationDTO {
  equipment_assignment: EquipmentAssignmentDTO[];
}

export interface ScheduleAgreementLineItemDTO {
  equipment_type_allocation: EquipmentTypeAllocationDTO[];
}

export interface InvoiceHistoryItemDTO {
  invoice: string;
  account: string;
  date: string;
  amount: number;
  status: string;
  po: string;
}

export interface InvoiceHistoryDTO {
  invoices: InvoiceHistoryItemDTO[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface LeaseAgreementDetailsDTO {
  schedule_agreement_id: number;
  masterAgreement: string;
  facility: string;
  contractType: string;
  lineItems: ScheduleAgreementLineItemDTO[];
  schedule_agreement_attachments: [];
  invoiceHistory?: InvoiceHistoryDTO;
  daily_rate?: number | null;
  weekly_rate?: number | null;
  monthly_rate?: number | null;
  billing_info?: string | null;
  contract_type_description?: string | null;
  non_cancellable_months?: number | null;
  unit_of_measurement?: string | null;
  contract_panel_type?: string | null;
}

export interface AttachmentInput {
  url: string;
  mime_type: string;
  document_category_type: string;
  name: string;
  description: string;
}

// export interface AgreementRowKey = keyof AgreementRow ?? "sno";
// types/dtos/agreement.dto.ts
export interface AgreementRow {
  equipment_id?: number;
  unit_number?: string;
  description?: string;
  schedule_agreement_id: number;
  schedule_agreement_ref?: string | null;
  agreement_type?: string;
  account_number?: string | null;
  account_name?: string | null;
  lease_po?: string | null;
  agreement_po?: string | null;
  contract_created_at?: Date | null;
  status?: string;
  start_date?: Date | null;
  termination_date?: Date | null;
  facility?: string;
}

export type AgreementRowKey = keyof AgreementRow | "sno";

export interface RequestedColumn {
  label: string;
  field: AgreementRowKey;
  maxWidth?: number;
}

export interface ColumnDefinition {
  label: string;
  field: AgreementRowKey;
  maxWidth?: number;
}
