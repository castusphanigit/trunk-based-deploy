export interface PaymentFilters {
  account_id?: number;
  paymentDateFrom?: Date;
  paymentDateTo?: Date;
  paymentMethod?: string;
  minAmount?: number;
  maxAmount?: number;
  payerName?: string
}

export interface PaymentSortOptions {
  field: "paymentDate" | "paymentAmount" | "payerName" | "createdAt";
  order: "asc" | "desc"
}

export interface PaymentStats {
  totalPayments: number;
  totalAmount: number;
  averagePayment: number;
  paymentsByMethod: Record<string, number>
}

export enum PaymentStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}
