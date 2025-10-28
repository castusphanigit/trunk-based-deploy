import { PDFTemplates } from './pdfGenerator';
import { InvoiceResponsePayload } from '../types/dtos/invoice.dto';
import { PaymentResponsePayload } from '../types/dtos/payment.dto';

/**
 * @deprecated Use PDFTemplates from pdfGenerator.ts instead
 * This class is maintained for backward compatibility
 */
export class PDFExporter {
  public async generateInvoicePDF(invoice: InvoiceResponsePayload): Promise<Buffer> {
    return PDFTemplates.generateInvoice(invoice);
  }

  public async generatePaymentReceiptPDF(payment: PaymentResponsePayload): Promise<Buffer> {
    return PDFTemplates.generatePaymentReceipt(payment);
  }
}