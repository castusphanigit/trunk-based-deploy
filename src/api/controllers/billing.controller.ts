import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { BillingService } from "../../services/billing.service";

interface InvoiceAllocation {
  invoiceId: number;
  amount: number
}

interface ApplyPaymentRequest extends Request {
  body: {
    invoiceAllocations: InvoiceAllocation[]
  }
}

export class BillingCtrl {
  private billingService: BillingService;

  constructor() {
    this.billingService = new BillingService();
  }

  public async getBillingSummary(req: Request, res: Response) {
    try {
      const accountId = parseInt(req.params.accountId);

      if (isNaN(accountId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid account ID",
        });
      }

      const summary = await this.billingService.getBillingSummary(accountId);

      res.status(200).json({
        success: true,
        message: "Billing summary retrieved successfully",
        data: summary,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error getting billing summary",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  public async applyPaymentToInvoices(req: ApplyPaymentRequest, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const paymentId = parseInt(req.params.paymentId);
      const { invoiceAllocations } = req.body;

      if (isNaN(paymentId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid payment ID",
        });
      }

      const result = await this.billingService.applyPaymentToInvoices(
        paymentId,
        invoiceAllocations
      );

      res.status(200).json({
        success: true,
        message: "Payment applied successfully",
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error applying payment to invoices",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  public async getAgingReport(req: Request, res: Response) {
    try {
      const accountId = parseInt(req.params.accountId);

      if (isNaN(accountId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid account ID",
        });
      }

      const report = await this.billingService.getAgingReport(accountId);

      res.status(200).json({
        success: true,
        message: "Aging report retrieved successfully",
        data: report,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error getting aging report",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
