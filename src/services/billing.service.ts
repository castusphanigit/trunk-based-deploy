import prisma from "../config/database.config";
import { InvoiceServices } from "./invoices.service";
import { PaymentService } from "./payments.service";

export class BillingService {
  private invoiceService: InvoiceServices;
  private paymentService: PaymentService;

  constructor() {
    this.invoiceService = new InvoiceServices();
    this.paymentService = new PaymentService();
  }

  // Get billing summary for an account
  public async getBillingSummary(accountId: number) {
    try {
      const [invoices, payments] = await Promise.all([
        this.invoiceService.getInvoicesByAccountId(accountId),
        this.paymentService.getPaymentsByAccountId(accountId),
      ]);

      const totalInvoiced = invoices.reduce(
        (sum, invoice) => sum + invoice.totalAmount,
        0
      );
      const totalPaid = payments.reduce(
        (sum, payment) => sum + payment.paymentAmount,
        0
      );
      const totalOutstanding = invoices.reduce(
        (sum, invoice) => sum + invoice.balanceDue,
        0
      );

      const overdueInvoices = invoices.filter(
        (invoice) =>
          new Date(invoice.dueDate) < new Date() && invoice.balanceDue > 0
      );
      const totalOverdue = overdueInvoices.reduce(
        (sum, invoice) => sum + invoice.balanceDue,
        0
      );

      return {
        accountId,
        summary: {
          totalInvoices: invoices.length,
          totalPayments: payments.length,
          totalInvoiced,
          totalPaid,
          totalOutstanding,
          totalOverdue,
          overdueInvoicesCount: overdueInvoices.length,
        },
        recentInvoices: invoices.slice(0, 5),
        recentPayments: payments.slice(0, 5),
      };
    } catch (error) {
      throw new Error(
        `Failed to get billing summary: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Apply payment to invoices
  public async applyPaymentToInvoices(
    paymentId: number,
    invoiceAllocations: { invoiceId: number, amount: number }[]
  ) {
    try {
      const payment = await this.paymentService.getPaymentById(paymentId);
      if (!payment) {
        throw new Error(`Payment with ID ${paymentId} not found`);
      }

      const totalAllocation = invoiceAllocations.reduce(
        (sum, allocation) => sum + allocation.amount,
        0
      );
      if (totalAllocation > payment.paymentAmount) {
        throw new Error("Total allocation exceeds payment amount");
      }

      // Update invoices with payment allocations
      const updatePromises = invoiceAllocations.map(async (allocation) => {
        const invoice = await this.invoiceService.getInvoiceById(
          allocation.invoiceId
        );
        if (!invoice) {
          throw new Error(`Invoice with ID ${allocation.invoiceId} not found`);
        }

        const newAmountPaid = invoice.amountPaid + allocation.amount;
        const newBalanceDue = invoice.totalAmount - newAmountPaid;

        return this.invoiceService.updateInvoice(allocation.invoiceId, {
          amountPaid: newAmountPaid,
          balanceDue: Math.max(0, newBalanceDue),
        });
      });

      await Promise.all(updatePromises);

      // Create payment-invoice relationships
      const paymentInvoicePromises = invoiceAllocations.map((allocation) =>
        prisma.paymentInvoice.create({
          data: {
            paymentId,
            invoiceId: allocation.invoiceId,
            account_id: payment.account_id,
          },
        })
      );

      await Promise.all(paymentInvoicePromises);

      return {
        success: true,
        message: "Payment applied to invoices successfully",
        paymentId,
        allocations: invoiceAllocations,
      };
    } catch (error) {
      throw new Error(
        `Failed to apply payment to invoices: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Get aging report for an account
  public async getAgingReport(accountId: number) {
    try {
      const invoices = await this.invoiceService.getInvoicesByAccountId(
        accountId
      );
      const currentDate = new Date();

      const aging = {
        current: 0, // 0-30 days
        days31to60: 0, // 31-60 days
        days61to90: 0, // 61-90 days
        over90: 0, // Over 90 days
      };

      invoices.forEach((invoice) => {
        if (invoice.balanceDue > 0) {
          const daysPastDue = Math.floor(
            (currentDate.getTime() - new Date(invoice.dueDate).getTime()) /
              (1000 * 60 * 60 * 24)
          );

          if (daysPastDue <= 30) {
            aging.current += invoice.balanceDue;
          } else if (daysPastDue <= 60) {
            aging.days31to60 += invoice.balanceDue;
          } else if (daysPastDue <= 90) {
            aging.days61to90 += invoice.balanceDue;
          } else {
            aging.over90 += invoice.balanceDue;
          }
        }
      });

      return {
        accountId,
        aging,
        totalOutstanding:
          aging.current + aging.days31to60 + aging.days61to90 + aging.over90,
      };
    } catch (error) {
      throw new Error(
        `Failed to get aging report: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}
