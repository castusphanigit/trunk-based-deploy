import { Payment, PaymentInvoice } from "@prisma/client";

export interface PaymentRequestPayload {
  paymentId: string;
  paymentDate: Date;
  paymentMethod: string;
  payerName: string;
  payerEntity?: string;
  invoicePayments: number;
  invoiceCredits: number;
  paymentAmount: number;
  account_id: number;
  invoiceIds?: number[] // For linking to invoices
}

export interface PaymentUpdatePayload {
  paymentId?: string;
  paymentDate?: Date;
  paymentMethod?: string;
  payerName?: string;
  payerEntity?: string;
  invoicePayments?: number;
  invoiceCredits?: number;
  paymentAmount?: number;
  invoiceIds?: number[]
}

export interface PaymentResponsePayload extends Payment {
  paymentInvoices?: (PaymentInvoice & {
    invoice: {
      id: number,
      invoiceNumber: string,
      totalAmount: number,
      balanceDue: number
    }
  })[];
  account?: {
    account_id: number,
    account_name: string | null,
    account_number: string | null
  }
}

export interface PaymentInvoiceRequestPayload {
  paymentId: number;
  invoiceId: number;
  account_id: number
}