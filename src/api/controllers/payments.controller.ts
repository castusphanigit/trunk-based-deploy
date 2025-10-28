/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Request, Response } from "express";
import { validationResult } from "express-validator";
// services
import { PaymentService } from "../../services/payments.service";
// types
import {
  PaymentRequestPayload,
  PaymentUpdatePayload,
} from "src/types/dtos/payment.dto";
import { ColumnDefinition } from "src/types/common/request.types";

export class PaymentCtrl {
  private readonly paymentService: PaymentService;

  public constructor() {
    this.paymentService = new PaymentService();
  }

  public async createPayment(req: Request, res: Response) {
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

      const paymentData = req.body as PaymentRequestPayload;
      const payment = await this.paymentService.createPayment(paymentData);

      return res.status(201).json({
        success: true,
        message: "Payment created successfully",
        data: payment,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error creating payment",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  public async getPaymentById(req: Request, res: Response) {
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

      const payment = await this.paymentService.getPaymentById(
        parseInt(req.params.id)
      );

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: "Payment not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Payment retrieved successfully",
        data: payment,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error getting payment",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  public async getPayments(req: Request, res: Response) {
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

      const result = await this.paymentService.getPayments(req.query);

      return res.status(200).json({
        success: true,
        message: "Payments retrieved successfully",
        data: result,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error getting payments",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  public async getPaymentsByAccountId(req: Request, res: Response) {
    try {
      const accountId = parseInt(req.params.accountId);

      if (isNaN(accountId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid account ID",
        });
      }

      const payments = await this.paymentService.getPaymentsByAccountId(
        accountId
      );

      return res.status(200).json({
        success: true,
        message: "Payments retrieved successfully",
        data: payments,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error getting payments by account ID",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  public async updatePayment(req: Request, res: Response) {
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

      const paymentData = req.body as PaymentUpdatePayload;
      const payment = await this.paymentService.updatePayment(
        parseInt(req.params.id),
        paymentData
      );

      return res.status(200).json({
        success: true,
        message: "Payment updated successfully",
        data: payment,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error updating payment",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  public async deletePayment(req: Request, res: Response) {
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

      const payment = await this.paymentService.deletePayment(
        parseInt(req.params.id)
      );

      return res.status(200).json({
        success: true,
        message: "Payment deleted successfully",
        data: payment,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error deleting payment",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  public async exportPayments(req: Request, res: Response) {
    try {
      const { filters, columns } = req.body as {
        filters: any,
        columns: ColumnDefinition[]
      };

      if (!columns || !Array.isArray(columns)) {
        return res.status(400).json({
          success: false,
          message: "Columns are required",
        });
      }

      const { buffer, filename } = await this.paymentService.exportPayments(
        filters ?? {},
        columns
      );

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", buffer.length);

      return res.send(buffer);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error exporting payments",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  public async exportPaymentReceiptPDF(req: Request, res: Response) {
    try {
      const paymentId = parseInt(req.params.id);
      
      if (isNaN(paymentId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid payment ID",
        });
      }

      const { buffer, filename } = await this.paymentService.exportPaymentReceiptPDF(paymentId);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", buffer.length);

      return res.send(buffer);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error exporting payment receipt PDF",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
