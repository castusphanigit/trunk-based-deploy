import { Request, Response } from "express";
import { validationResult } from "express-validator";
// services
import { InvoiceServices } from "../../services/invoices.service";
// types
import {
  InvoiceRequestPayload,
  InvoiceUpdatePayload,
} from "src/types/dtos/invoice.dto";
import { ColumnDefinition } from "src/types/common/request.types";

export class InvoiceCtrl {
  private readonly invoiceService: InvoiceServices;

  public constructor() {
    this.invoiceService = new InvoiceServices();
  }

  private handleError(res: Response, message: string, error: unknown): void {
    res.status(500).json({
      success: false,
      message,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  public async getAllInvoices(req: Request, res: Response) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const result = await this.invoiceService.getAllInvoices(req.query);

      return res.status(200).json({
        success: true,
        message: "Invoices retrieved successfully",
        data: result,
      });
    } catch (error) {
      this.handleError(res, "Error getting invoices", error);
    }
  }

  public async getInvoiceById(req: Request, res: Response) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const invoice = await this.invoiceService.getInvoiceById(
        parseInt(req.params.id)
      );

      if (!invoice) {
        return res.status(404).json({
          success: false,
          message: "Invoice not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Invoice retrieved successfully",
        data: invoice,
      });
    } catch (error) {
      this.handleError(res, "Error getting invoice", error);
    }
  }

  public async getInvoicesByAccountId(req: Request, res: Response) {
    try {
      const accountId = parseInt(req.params.accountId);

      if (isNaN(accountId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid account ID",
        });
      }

      const invoices = await this.invoiceService.getInvoicesByAccountId(
        accountId
      );

      return res.status(200).json({
        success: true,
        message: "Invoices retrieved successfully",
        data: invoices,
      });
    } catch (error) {
      this.handleError(res, "Error getting invoices by account ID", error);
    }
  }

  public async createInvoice(req: Request, res: Response) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const invoiceData = req.body as InvoiceRequestPayload;
      const newInvoice = await this.invoiceService.createInvoice(invoiceData);

      return res.status(201).json({
        success: true,
        message: "Invoice created successfully",
        data: newInvoice,
      });
    } catch (error) {
      this.handleError(res, "Error creating invoice", error);
    }
  }

  public async updateInvoice(req: Request, res: Response) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const invoiceData = req.body as InvoiceUpdatePayload;
      const updatedInvoice = await this.invoiceService.updateInvoice(
        parseInt(req.params.id),
        invoiceData
      );

      return res.status(200).json({
        success: true,
        message: "Invoice updated successfully",
        data: updatedInvoice,
      });
    } catch (error) {
      this.handleError(res, "Error updating invoice", error);
    }
  }

  public async deleteInvoice(req: Request, res: Response) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const deletedInvoice = await this.invoiceService.deleteInvoice(
        parseInt(req.params.id)
      );

      return res.status(200).json({
        success: true,
        message: "Invoice deleted successfully",
        data: deletedInvoice,
      });
    } catch (error) {
      this.handleError(res, "Error deleting invoice", error);
    }
  }

  public async getInvoiceStats(req: Request, res: Response) {
    try {
      const { accountIds } = req.query;
      const stats = await this.invoiceService.getInvoiceStats(
        accountIds as string | string[]
      );

      return res.status(200).json({
        success: true,
        message: "Invoice stats retrieved successfully",
        data: stats,
      });
    } catch (error) {
      this.handleError(res, "Error getting invoice stats", error);
    }
  }

  public async exportInvoices(req: Request, res: Response) {
    try {
      const { filters, columns } = req.body as {
        filters: Record<string, unknown>;
        columns: ColumnDefinition[];
      };

      if (!columns || !Array.isArray(columns)) {
        return res.status(400).json({
          success: false,
          message: "Columns are required",
        });
      }

      const { buffer, filename } = await this.invoiceService.exportInvoices(
        filters ?? {},
        columns
      );

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.setHeader("Content-Length", buffer.length);

      return res.send(buffer);
    } catch (error) {
      this.handleError(res, "Error exporting invoices", error);
    }
  }

  public async exportInvoicePDF(req: Request, res: Response) {
    try {
      const invoiceId = parseInt(req.params.id);

      if (isNaN(invoiceId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid invoice ID",
        });
      }

      const { buffer, filename } = await this.invoiceService.exportInvoicePDF(
        invoiceId
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.setHeader("Content-Length", buffer.length);

      return res.send(buffer);
    } catch (error) {
      this.handleError(res, "Error exporting invoice PDF", error);
    }
  }

  public async payNow(req: Request, res: Response) {
    try {
      const invoiceId = parseInt(req.params.id);
      const paymentData = req.body as {
        paymentId: string;
        paymentMethod: string;
        payerName: string;
        payerEntity?: string;
        paymentAmount: number;
      };

      if (isNaN(invoiceId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid invoice ID",
        });
      }

      const payment = await this.invoiceService.payNow(invoiceId, paymentData);

      return res.status(200).json({
        success: true,
        message: "Payment processed successfully",
        data: payment,
      });
    } catch (error) {
      this.handleError(res, "Error processing payment", error);
    }
  }

  public async getCreditInvoices(req: Request, res: Response) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const result = await this.invoiceService.getCreditInvoices(req.query);

      return res.status(200).json({
        success: true,
        message: "Credit invoices retrieved successfully",
        data: result,
      });
    } catch (error) {
      this.handleError(res, "Error getting credit invoices", error);
    }
  }
}
