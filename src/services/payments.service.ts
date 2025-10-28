/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unnecessary-type-conversion */
import prisma from "../config/database.config";
import { getPagination } from "../utils/pagination";
import { buildOrderByFromSort } from "../utils/sort";
import { PAYMENT_SORT_FIELDS } from "../types/sorts/sortTypes";
// -- models --
import { Payment, Prisma } from "@prisma/client";
import {
  PaymentRequestPayload,
  PaymentUpdatePayload,
  PaymentResponsePayload,
} from "../types/dtos/payment.dto";
import {
  PaymentsFilterQuery,
  ColumnDefinition,
} from "../types/common/request.types";
import { ExcelExporter } from "../utils/excelUtils";
import { PDFTemplates } from "../utils/pdfGenerator";

// Types for payment data
interface PaymentWithRelations {
  id: number;
  paymentId: string;
  paymentDate: Date;
  paymentMethod: string;
  payerName: string;
  payerEntity: string | null;
  paymentAmount: number;
  status: string | null;
  currency_type: string | null;
  invoicePayments: number;
  invoiceCredits: number;
  createdAt: Date;
  updatedAt: Date;
  account_id: number;
  paymentInvoices: {
    invoice: {
      id: number,
      invoiceNumber: string,
      totalAmount: number,
      balanceDue: number
    }
  }[];
  account: {
    account_id: number,
    account_name: string | null,
    account_number: string | null
  }
}

interface TransformedPayment {
  PaymentDate: Date;
  PaymentMethod: string;
  TotalPaid: number;
  AmountPaid: number;
  DueBalance: number;
  InvoiceAppliedTo: string;
  id: number;
  paymentId: string;
  payerName: string;
  payerEntity: string | null;
  status: string | null;
  currency_type: string | null;
  invoicePayments: number;
  invoiceCredits: number;
  createdAt: Date;
  updatedAt: Date;
  account_id: number;
  account: {
    account_id: number,
    account_name: string | null,
    account_number: string | null
  };
  _totalInvoiceAmount: number;
  _dueBalance: number
}

interface ExportPaymentData {
  id: number;
  paymentId: string;
  paymentDate: Date;
  paymentMethod: string;
  payerName: string;
  payerEntity: string | null;
  paymentAmount: number;
  status: string | null;
  account?: {
    account_id: number,
    account_name: string | null,
    account_number: string | null
  };
  paymentInvoices: {
    invoice: {
      id: number,
      invoiceNumber: string,
      totalAmount: number,
      balanceDue: number
    }
  }[];
  currency_type: string | null;
  invoicePayments: number;
  invoiceCredits: number;
  createdAt: Date;
  updatedAt: Date;
  _totalInvoiceAmount: number;
  _dueBalance: number;
  _invoicesAppliedTo: string
}

interface FlattenedPaymentData {
  payment_id: number;
  paymentId: string;
  paymentDate: Date;
  paymentMethod: string;
  payerName: string;
  payerEntity: string | null;
  paymentAmount: number;
  status: string | null;
  account_name?: string | null;
  account_number?: string | null;
  TotalPaid: number;
  AmountPaid: number;
  DueBalance: number;
  InvoiceAppliedTo: string;
  currency_type: string | null;
  invoicePayments: number;
  invoiceCredits: number;
  createdAt: Date;
  updatedAt: Date;
  invoice_sequence: number;
  linked_invoice_number: string;
  linked_invoice_amount: number;
  linked_invoice_balance: number
}

interface ExcelColumnConfig {
  header: string;
  key: string;
  width: number;
  formatter?: (val: unknown) => string
}

export class PaymentService {
  public async createPayment(
    data: PaymentRequestPayload
  ): Promise<PaymentResponsePayload> {
    try {
      // Validate account exists
      const account = await prisma.account.findUnique({
        where: { account_id: data.account_id },
      });

      if (!account) {
        throw new Error(`Account with ID ${data.account_id} not found`);
      }

      // Check if payment ID already exists
      const existingPayment = await prisma.payment.findUnique({
        where: { paymentId: data.paymentId },
      });

      if (existingPayment) {
        throw new Error(`Payment with ID ${data.paymentId} already exists`);
      }

      // Validate invoices if provided
      if (data.invoiceIds && data.invoiceIds.length > 0) {
        const invoices = await prisma.invoice.findMany({
          where: {
            id: { in: data.invoiceIds },
            account_id: data.account_id,
          },
        });

        if (invoices.length !== data.invoiceIds.length) {
          throw new Error(
            "One or more invoice IDs are invalid or don't belong to the specified account"
          );
        }
      }

      const { invoiceIds, ...paymentData } = data;

      const payment = await prisma.payment.create({
        data: {
          ...paymentData,
          paymentDate: new Date(paymentData.paymentDate),
          paymentInvoices: invoiceIds
            ? {
                create: invoiceIds.map((invoiceId) => ({
                  invoiceId,
                  account_id: data.account_id,
                })),
              }
            : undefined,
        },
        include: {
          paymentInvoices: {
            include: {
              invoice: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  totalAmount: true,
                  balanceDue: true,
                },
              },
            },
          },
        },
      });

      return payment;
    } catch (error) {
      throw new Error(
        `Failed to create payment: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  public async getPaymentById(
    id: number
  ): Promise<PaymentResponsePayload | null> {
    try {
      return await prisma.payment.findUnique({
        where: { id },
        include: {
          paymentInvoices: {
            include: {
              invoice: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  totalAmount: true,
                  balanceDue: true,
                },
              },
            },
          },
          account: {
            select: {
              account_id: true,
              account_name: true,
              account_number: true,
            },
          },
        },
      });
    } catch (error) {
      throw new Error(
        `Failed to get payment: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }



  public async getPayments(query: PaymentsFilterQuery): Promise<{
    payments: TransformedPayment[],
    total: number,
    page: number,
    perPage: number
  }> {
    try {
      const { page, perPage, skip, take } = getPagination(query);
      const filters = this.buildPaymentFilters(query);
      const isDueBalanceSort = this.isDueBalanceSortRequested(query.sort);
      const orderBy = this.buildOrderBy(query.sort, isDueBalanceSort);

      const [payments, total] = await this.fetchPaymentsWithFilters(filters, orderBy, skip, take);
      const transformedPayments = this.transformPayments(payments);
      const finalPayments = this.applySortingAndPagination(transformedPayments, query.sort, isDueBalanceSort, skip, take);
      const cleanPayments = this.cleanPaymentData(finalPayments);

      return {
        payments: cleanPayments,
        total: isDueBalanceSort ? transformedPayments.length : total,
        page,
        perPage,
      };
    } catch (error) {
      throw new Error(
        `Failed to get payments: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  private buildPaymentFilters(query: PaymentsFilterQuery): Prisma.PaymentWhereInput {
    return {
      ...(query.paymentId && {
        paymentId: {
          contains: String(query.paymentId),
          mode: Prisma.QueryMode.insensitive,
        },
      }),
      ...(query.paymentDate && {
        paymentDate: new Date(query.paymentDate),
      }),
      ...(query.paymentMethod && {
        paymentMethod: {
          contains: String(query.paymentMethod),
          mode: Prisma.QueryMode.insensitive,
        },
      }),
      ...(query.status && {
        status: {
          contains: String(query.status),
          mode: Prisma.QueryMode.insensitive,
        },
      }),
      ...(query.accountIds && {
        account_id: {
          in: Array.isArray(query.accountIds)
            ? query.accountIds.map((id) => Number(id))
            : query.accountIds
                .split(",")
                .map((id: string) => Number(id.trim())),
        },
      }),
      ...(query.invoices && {
        paymentInvoices: {
          some: {
            invoiceId: Number(query.invoices),
          },
        },
      }),
    };
  }

  private isDueBalanceSortRequested(sort?: string): boolean {
    return !!(sort && (
      sort.includes("DueBalance") ||
      sort.includes("DueBalance:asc") ||
      sort.includes("DueBalance:desc")
    ));
  }

  private buildOrderBy(sort?: string, isDueBalanceSort?: boolean): any[] | undefined {
    if (isDueBalanceSort) {
      return undefined;
    }
    return buildOrderByFromSort(sort, PAYMENT_SORT_FIELDS, "id");
  }

  private async fetchPaymentsWithFilters(
    filters: Prisma.PaymentWhereInput,
    orderBy: any[] | undefined,
    skip: number,
    take: number
  ): Promise<[PaymentWithRelations[], number]> {
    return Promise.all([
      prisma.payment.findMany({
        skip,
        take,
        where: filters,
        orderBy,
        include: {
          paymentInvoices: {
            include: {
              invoice: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  totalAmount: true,
                  balanceDue: true,
                },
              },
            },
          },
          account: {
            select: {
              account_id: true,
              account_name: true,
              account_number: true,
            },
          },
        },
      }),
      prisma.payment.count({ where: filters }),
    ]);
  }

  private transformPayments(payments: PaymentWithRelations[]): TransformedPayment[] {
    return payments.map((payment) => {
      const totalInvoiceAmount = payment.paymentInvoices.reduce(
        (sum: number, pi) => sum + Number(pi.invoice.totalAmount),
        0
      );
      const dueBalance = totalInvoiceAmount - Number(payment.paymentAmount);
      const invoicesAppliedTo = payment.paymentInvoices
        .map((pi) => pi.invoice.invoiceNumber)
        .join(", ");

      return {
        PaymentDate: payment.paymentDate,
        PaymentMethod: payment.paymentMethod,
        TotalPaid: payment.paymentAmount,
        AmountPaid: payment.paymentAmount,
        DueBalance: dueBalance,
        InvoiceAppliedTo: invoicesAppliedTo,
        id: payment.id,
        paymentId: payment.paymentId,
        payerName: payment.payerName,
        payerEntity: payment.payerEntity,
        status: payment.status,
        currency_type: payment.currency_type,
        invoicePayments: payment.invoicePayments,
        invoiceCredits: payment.invoiceCredits,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
        account_id: payment.account_id,
        account: payment.account as {
          account_id: number,
          account_name: string | null,
          account_number: string | null
        },
        _totalInvoiceAmount: totalInvoiceAmount,
        _dueBalance: dueBalance,
      };
    });
  }

  private applySortingAndPagination(
    transformedPayments: TransformedPayment[],
    sort?: string,
    isDueBalanceSort?: boolean,
    skip?: number,
    take?: number
  ): TransformedPayment[] {
    let finalPayments = transformedPayments;
    
    if (isDueBalanceSort) {
      const sortFunction = (a: TransformedPayment, b: TransformedPayment) => {
        const aValue = a._dueBalance;
        const bValue = b._dueBalance;
        return sort?.includes("desc") ? bValue - aValue : aValue - bValue;
      };
      finalPayments = [...transformedPayments].sort(sortFunction);

      if (skip !== undefined && take !== undefined) {
        finalPayments = finalPayments.slice(skip, skip + take);
      }
    }

    return finalPayments;
  }

  private cleanPaymentData(payments: TransformedPayment[]): TransformedPayment[] {
    return payments.map(({ ...payment }) => payment);
  }

  public async getPaymentsByAccountId(
    account_id: number
  ): Promise<PaymentResponsePayload[]> {
    try {
      return await prisma.payment.findMany({
        where: { account_id },
        include: {
          paymentInvoices: {
            include: {
              invoice: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  totalAmount: true,
                  balanceDue: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    } catch (error) {
      throw new Error(
        `Failed to get payments by account ID: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  public async updatePayment(
    id: number,
    data: PaymentUpdatePayload
  ): Promise<PaymentResponsePayload> {
    try {
      // Check if payment exists
      const existingPayment = await prisma.payment.findUnique({
        where: { id },
      });

      if (!existingPayment) {
        throw new Error(`Payment with ID ${id} not found`);
      }

      // If updating payment ID, check for duplicates
      if (data.paymentId && data.paymentId !== existingPayment.paymentId) {
        const duplicatePayment = await prisma.payment.findUnique({
          where: { paymentId: data.paymentId },
        });

        if (duplicatePayment) {
          throw new Error(`Payment with ID ${data.paymentId} already exists`);
        }
      }

      // Validate invoices if provided
      if (data.invoiceIds && data.invoiceIds.length > 0) {
        const invoices = await prisma.invoice.findMany({
          where: {
            id: { in: data.invoiceIds },
            account_id: existingPayment.account_id,
          },
        });

        if (invoices.length !== data.invoiceIds.length) {
          throw new Error(
            "One or more invoice IDs are invalid or don't belong to the payment's account"
          );
        }
      }

      const { invoiceIds, ...paymentData } = data;

      // Prepare update data with proper date conversion
      const updateData: Partial<PaymentRequestPayload> = { ...paymentData };
      if (updateData.paymentDate) {
        updateData.paymentDate = new Date(updateData.paymentDate);
      }

      const payment = await prisma.payment.update({
        where: { id },
        data: {
          ...updateData,
          paymentInvoices: invoiceIds
            ? {
                deleteMany: {},
                create: invoiceIds.map((invoiceId) => ({
                  invoiceId,
                  account_id: existingPayment.account_id,
                })),
              }
            : undefined,
        },
        include: {
          paymentInvoices: {
            include: {
              invoice: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  totalAmount: true,
                  balanceDue: true,
                },
              },
            },
          },
        },
      });

      return payment;
    } catch (error) {
      throw new Error(
        `Failed to update payment: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  public async deletePayment(id: number): Promise<Payment> {
    try {
      // Check if payment exists
      const existingPayment = await prisma.payment.findUnique({
        where: { id },
      });

      if (!existingPayment) {
        throw new Error(`Payment with ID ${id} not found`);
      }

      return await prisma.payment.delete({
        where: { id },
      });
    } catch (error) {
      throw new Error(
        `Failed to delete payment: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Check if payment ID exists
  public async paymentIdExists(
    paymentId: string,
    excludeId?: number
  ): Promise<boolean> {
    try {
      const payment = await prisma.payment.findUnique({
        where: { paymentId },
      });

      return payment !== null && (excludeId ? payment.id !== excludeId : true);
    } catch (error) {
      throw new Error(
        `Failed to check payment ID: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }


  public async exportPayments(
    query: PaymentsFilterQuery,
    columns: ColumnDefinition[]
  ): Promise<{ buffer: Buffer, filename: string }> {
    try {
      const filters = this.buildExportFilters(query);
      const { isDueBalanceSort, orderBy } = this.determineSortingStrategy(query);
      const payments = await this.fetchPaymentsForExport(filters, orderBy);
      const transformedPayments = this.transformPaymentsForExport(payments);
      const finalPayments = this.applyDueBalanceSorting(transformedPayments, query.sort, isDueBalanceSort);
      const flattenedData = this.flattenPaymentsForExport(finalPayments);
      const excelColumns = this.buildExcelColumns(columns);
      const formattedData = this.formatDataForExcel(flattenedData, columns);
      const { buffer, filename } = await this.generateExcelFile(excelColumns, formattedData);

      return { buffer, filename };
    } catch (error) {
      throw new Error(
        `Failed to export payments: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  private buildExportFilters(query: PaymentsFilterQuery): Prisma.PaymentWhereInput {
    return {
      ...(query.paymentId && {
        paymentId: {
          contains: String(query.paymentId),
          mode: Prisma.QueryMode.insensitive,
        },
      }),
      ...(query.paymentDate && {
        paymentDate: new Date(query.paymentDate),
      }),
      ...(query.status && {
        status: {
          contains: String(query.status),
          mode: Prisma.QueryMode.insensitive,
        },
      }),
      ...(query.paymentMethod && {
        paymentMethod: {
          contains: String(query.paymentMethod),
          mode: Prisma.QueryMode.insensitive,
        },
      }),
      ...(query.accountIds && {
        account_id: {
          in: Array.isArray(query.accountIds)
            ? query.accountIds.map((id) => Number(id))
            : query.accountIds
                .split(",")
                .map((id: string) => Number(id.trim())),
        },
      }),
      ...(query.invoices && {
        paymentInvoices: {
          some: {
            invoiceId: Number(query.invoices),
          },
        },
      }),
    };
  }

  private determineSortingStrategy(query: PaymentsFilterQuery): { isDueBalanceSort: boolean, orderBy: any[] | undefined } {
    const isDueBalanceSort = !!(
      query.sort &&
      (query.sort.includes("DueBalance") ||
        query.sort.includes("DueBalance:asc") ||
        query.sort.includes("DueBalance:desc"))
    );

    const orderBy = isDueBalanceSort
      ? undefined
      : buildOrderByFromSort(query.sort, PAYMENT_SORT_FIELDS, "id");

    return { isDueBalanceSort, orderBy };
  }

  private async fetchPaymentsForExport(
    filters: Prisma.PaymentWhereInput,
    orderBy: any[] | undefined
  ): Promise<PaymentWithRelations[]> {
    return await prisma.payment.findMany({
      where: filters,
      orderBy,
      include: {
        paymentInvoices: {
          include: {
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
                totalAmount: true,
                balanceDue: true,
              },
            },
          },
        },
        account: {
          select: {
            account_id: true,
            account_name: true,
            account_number: true,
          },
        },
      },
    });
  }

  private transformPaymentsForExport(payments: PaymentWithRelations[]): ExportPaymentData[] {
    return payments.map((payment) => {
      const totalInvoiceAmount = payment.paymentInvoices.reduce(
        (sum, pi) => sum + Number(pi.invoice.totalAmount),
        0
      );
      const dueBalance = totalInvoiceAmount - Number(payment.paymentAmount);
      const invoicesAppliedTo = payment.paymentInvoices
        .map((pi) => pi.invoice.invoiceNumber)
        .join(", ");

      return {
        ...payment,
        _totalInvoiceAmount: totalInvoiceAmount,
        _dueBalance: dueBalance,
        _invoicesAppliedTo: invoicesAppliedTo,
      };
    });
  }

  private applyDueBalanceSorting(
    transformedPayments: ExportPaymentData[],
    sort?: string,
    isDueBalanceSort?: boolean
  ): ExportPaymentData[] {
    if (!isDueBalanceSort) {
      return transformedPayments;
    }

    const getDueBalance = (item: ExportPaymentData): number => {
      return item._dueBalance || 0;
    };
    
    const sortFunction = (a: ExportPaymentData, b: ExportPaymentData) => {
      const aValue = getDueBalance(a);
      const bValue = getDueBalance(b);
      return sort?.includes("desc") ? bValue - aValue : aValue - bValue;
    };

    return [...transformedPayments].sort(sortFunction);
  }

  private flattenPaymentsForExport(finalPayments: ExportPaymentData[]): FlattenedPaymentData[] {
    return finalPayments.flatMap((payment) => {
      const basePayment = {
        payment_id: payment.id,
        paymentId: payment.paymentId,
        paymentDate: payment.paymentDate,
        paymentMethod: payment.paymentMethod,
        payerName: payment.payerName,
        payerEntity: payment.payerEntity,
        paymentAmount: payment.paymentAmount,
        status: payment.status,
        account_name: payment.account?.account_name,
        account_number: payment.account?.account_number,
        TotalPaid: payment.paymentAmount,
        AmountPaid: payment.paymentAmount,
        DueBalance: payment._dueBalance,
        InvoiceAppliedTo: payment._invoicesAppliedTo,
        currency_type: payment.currency_type,
        invoicePayments: payment.invoicePayments,
        invoiceCredits: payment.invoiceCredits,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
      };

      if (payment.paymentInvoices.length > 0) {
        return payment.paymentInvoices.map((pi, index: number) => ({
          ...basePayment,
          invoice_sequence: index + 1,
          linked_invoice_number: pi.invoice.invoiceNumber,
          linked_invoice_amount: pi.invoice.totalAmount,
          linked_invoice_balance: pi.invoice.balanceDue,
        }));
      }

      return [
        {
          ...basePayment,
          invoice_sequence: 0,
          linked_invoice_number: "No invoices linked",
          linked_invoice_amount: 0,
          linked_invoice_balance: 0,
        },
      ];
    });
  }

  private buildExcelColumns(columns: ColumnDefinition[]): ExcelColumnConfig[] {
    return columns.map(({ label, field }) => {
      switch (field) {
        case "sno":
          return { header: label, key: field, width: 8 };
        case "paymentDate":
        case "PaymentDate":
          return {
            header: label,
            key: field,
            width: 15,
            formatter: (val: unknown) =>
              val ? new Date(val as Date).toLocaleDateString() : "N/A",
          };
        case "TotalPaid":
        case "AmountPaid":
        case "DueBalance":
        case "paymentAmount":
          return {
            header: label,
            key: field,
            width: 15,
            formatter: (val: unknown) =>
              val !== undefined && val !== null
                ? `$${(val as number).toFixed(2)}`
                : "$0.00",
          };
        case "InvoiceAppliedTo":
          return { header: label, key: field, width: 30 };
        default:
          return { header: label, key: field, width: 20 };
      }
    });
  }

  private formatDataForExcel(flattenedData: FlattenedPaymentData[], columns: ColumnDefinition[]): Record<string, unknown>[] {
    return flattenedData.map((item, index) => {
      const row: Record<string, unknown> = {};
      columns.forEach(({ field }) => {
        if (field === "sno") {
          row[field] = index + 1;
        } else if (field in item) {
          const actualField = this.mapExportField(field);
          row[field] = item[actualField as keyof FlattenedPaymentData] ?? "";
        } else {
          row[field] = "";
        }
      });
      return row;
    });
  }

  private async generateExcelFile(excelColumns: ExcelColumnConfig[], formattedData: Record<string, unknown>[]): Promise<{ buffer: Buffer, filename: string }> {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    const filename = `payments_export_${timestamp}.xlsx`;

    const exporter = new ExcelExporter();
    exporter.generateWorkbook({
      sheetName: "Payments Export",
      columns: excelColumns,
      data: formattedData,
      filename,
    });

    const buffer = await exporter.writeToBuffer();

    return { buffer, filename };
  }

  // Helper method to map export field names to actual data fields
  private mapExportField(field: string): string {
    const fieldMap: Record<string, string> = {
      TotalPaid: "TotalPaid",
      AmountPaid: "AmountPaid",
      DueBalance: "DueBalance",
      InvoiceAppliedTo: "InvoiceAppliedTo",
      PaymentDate: "paymentDate",
      PaymentMethod: "paymentMethod",
    };

    return fieldMap[field] || field;
  }

  // Export payment receipt as PDF
  public async exportPaymentReceiptPDF(
    id: number
  ): Promise<{ buffer: Buffer, filename: string }> {
    try {
      const payment = await this.getPaymentById(id);
      if (!payment) {
        throw new Error(`Payment with ID ${id} not found`);
      }

      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, -5);
      const filename = `payment_receipt_${payment.paymentId}_${timestamp}.pdf`;

      const buffer = await PDFTemplates.generatePaymentReceipt(payment)

      return { buffer, filename };
    } catch (error) {
      throw new Error(
        `Failed to export payment receipt PDF: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}
