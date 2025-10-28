import prisma from "../config/database.config";
import { getPagination } from "../utils/pagination";
import { buildOrderByFromSort } from "../utils/sort";
import { INVOICE_SORT_FIELDS } from "../types/sorts/sortTypes";
// -- models --
import { Invoice, Prisma, InvoiceType } from "@prisma/client";
import {
  InvoiceRequestPayload,
  InvoiceUpdatePayload,
  InvoiceResponsePayload,
  CreditInvoiceResponsePayload,
  CreditInvoicesQueryParams,
  CreditInvoicesResponse,
} from "../types/dtos/invoice.dto";
import { InvoiceHistoryItemDTO } from "../types/dtos/agreement.dto";
import {
  InvoicesFilterQuery,
  ColumnDefinition,
} from "../types/common/request.types";
import { ExcelExporter } from "../utils/excelUtils";
import { PDFTemplates } from "../utils/pdfGenerator";

export class InvoiceServices {
  private handleServiceError(operation: string, error: unknown): never {
    throw new Error(
      `Failed to ${operation}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }

  // create Invoice Service
  public async createInvoice(
    data: InvoiceRequestPayload
  ): Promise<InvoiceResponsePayload> {
    try {
      // Validate account exists
      const account = await prisma.account.findUnique({
        where: { account_id: data.account_id },
      });

      if (!account) {
        throw new Error(`Account with ID ${data.account_id} not found`);
      }

      // Check if invoice number already exists
      const existingInvoice = await prisma.invoice.findUnique({
        where: { invoiceNumber: data.invoiceNumber },
      });

      if (existingInvoice) {
        throw new Error(
          `Invoice with number ${data.invoiceNumber} already exists`
        );
      }

      // Validate equipment if provided
      if (data.equipmentIds && data.equipmentIds.length > 0) {
        const equipment = await prisma.equipment.findMany({
          where: { equipment_id: { in: data.equipmentIds } },
        });

        if (equipment.length !== data.equipmentIds.length) {
          throw new Error("One or more equipment IDs are invalid");
        }
      }

      const { invoiceItems, equipmentIds, ...invoiceData } = data;

      const invoice = await prisma.invoice.create({
        data: {
          ...invoiceData,
          date: new Date(invoiceData.date),
          dueDate: new Date(invoiceData.dueDate),
          billingPeriod_start: new Date(invoiceData.billingPeriod_start),
          billingPeriod_end: new Date(invoiceData.billingPeriod_end),
          invoiceItems: invoiceItems
            ? {
                create: invoiceItems.map((item) => ({
                  item_description: item.item_description,
                  quantity: item.quantity,
                  rate: item.rate,
                  amount: item.amount,
                })),
              }
            : undefined,
          invoiceEquipments: equipmentIds
            ? {
                create: equipmentIds.map((equipment_id) => ({
                  equipment_id,
                })),
              }
            : undefined,
        },
        include: {
          invoiceItems: true,
          invoiceEquipments: {
            include: {
              equipment: {
                select: {
                  equipment_id: true,
                  unit_number: true,
                  description: true,
                  customer_unit_number: true,
                },
              },
            },
          },
        },
      });

      return invoice;
    } catch (error) {
      throw new Error(
        `Failed to create invoice: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // get Invoice by ID Service
  public async getInvoiceById(
    id: number
  ): Promise<InvoiceResponsePayload | null> {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id },
        include: {
          invoiceItems: true,
          invoiceEquipments: {
            include: {
              equipment: {
                select: {
                  equipment_id: true,
                  unit_number: true,
                  description: true,
                  customer_unit_number: true,
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
          workorder: {
            include: {
              vmrsCodes: {
                include: {
                  vmrs_Lookup: true,
                },
              },
            },
          },
        },
      });

      if (!invoice) {
        return null;
      }

      // Transform the response to include vmrsCodes in the expected format
      const response: InvoiceResponsePayload = {
        ...invoice,
      };

      return response;
    } catch (error) {
      throw new Error(
        `Failed to get invoice: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // get Invoice by Account Id Service
  public async getInvoicesByAccountId(
    account_id: number
  ): Promise<InvoiceResponsePayload[]> {
    try {
      return await prisma.invoice.findMany({
        where: { account_id },
        include: {
          invoiceItems: true,
          invoiceEquipments: {
            include: {
              equipment: {
                select: {
                  equipment_id: true,
                  unit_number: true,
                  description: true,
                  customer_unit_number: true,
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
        `Failed to get invoices by account ID: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // get Invoice by Account Id with Pagination and Sorting Service
  public async getInvoicesByAccountIdWithPagination(
    account_id: number,
    query: {
      page?: number;
      perPage?: number;
      sort?: string;
      status?: string;
      invoiceType?: string;
      dateFrom?: string;
      dateTo?: string;
    } = {}
  ): Promise<{
    invoices: InvoiceHistoryItemDTO[];
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  }> {
    try {
      const {
        page = 1,
        perPage = 10,
        sort,
        status,
        invoiceType,
        dateFrom,
        dateTo,
      } = query;
      const skip = (page - 1) * perPage;
      const take = perPage;

      // Build filters
      const filters: Prisma.InvoiceWhereInput = {
        account_id,
        ...(status && {
          status: {
            contains: status,
            mode: Prisma.QueryMode.insensitive,
          },
        }),
        ...(invoiceType && {
          invoiceType: invoiceType as InvoiceType,
        }),
        ...(dateFrom && {
          date: {
            gte: new Date(dateFrom),
          },
        }),
        ...(dateTo && {
          date: {
            lte: new Date(dateTo),
          },
        }),
      };

      // Build order by clause
      const orderBy = buildOrderByFromSort(sort, INVOICE_SORT_FIELDS, "date");

      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          skip,
          take,
          where: filters,
          orderBy,
          select: {
            id: true,
            invoiceNumber: true,
            date: true,
            totalAmount: true,
            status: true,
            account: {
              select: {
                account_id: true,
                account_name: true,
                account_number: true,
              },
            },
          },
        }),
        prisma.invoice.count({ where: filters }),
      ]);

      // Transform invoices to match the table structure
      const transformedInvoices = invoices.map((invoice) => ({
        invoice: invoice.invoiceNumber,
        account: `${invoice.account.account_name}, ${invoice.account.account_number}`,
        date: invoice.date.toISOString().split("T")[0], // Format as YYYY-MM-DD
        amount: invoice.totalAmount,
        status: invoice.status ?? "ACTIVE",
        po: "Manual", // Placeholder - you can modify this based on your business logic
      }));

      const totalPages = Math.ceil(total / perPage);

      return {
        invoices: transformedInvoices,
        total,
        page,
        perPage,
        totalPages,
      };
    } catch (error) {
      throw new Error(
        `Failed to get invoices by account ID with pagination: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // get All Invoices Service with filtering, sorting, and pagination
  public async getAllInvoices(query: InvoicesFilterQuery): Promise<{
    invoices: InvoiceResponsePayload[];
    total: number;
    page: number;
    perPage: number;
  }> {
    try {
      const { page, perPage, skip, take } = getPagination(query);

      // Build filters
      const filters: Prisma.InvoiceWhereInput = {
        ...(query.invoiceNumber && {
          invoiceNumber: {
            contains: query.invoiceNumber,
            mode: Prisma.QueryMode.insensitive,
          },
        }),
        ...(query.status && {
          status: {
            contains: query.status,
            mode: Prisma.QueryMode.insensitive,
          },
        }),
        ...(query.invoiceDate && {
          date: new Date(query.invoiceDate),
        }),
        ...(query.dueDate && {
          dueDate: new Date(query.dueDate),
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
        ...(query.invoiceType && {
          invoiceType: query.invoiceType as InvoiceType,
        }),
      };

      const orderBy = buildOrderByFromSort(
        query.sort,
        INVOICE_SORT_FIELDS,
        "id"
      );

      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          skip,
          take,
          where: filters,
          orderBy,
          include: {
            invoiceItems: true,
            // invoiceEquipments: {
            //   include: {
            //     equipment: {
            //       select: {
            //         equipment_id: true,
            //         unit_number: true,
            //         description: true,
            //         customer_unit_number: true,
            //       },
            //     },
            //   },
            // },
            account: {
              select: {
                account_id: true,
                account_name: true,
                account_number: true,
              },
            },
            _count: {
              select: {
                invoiceEquipments: true,
              },
            },
          },
        }),
        prisma.invoice.count({ where: filters }),
      ]);

      return {
        invoices,
        total,
        page,
        perPage,
      };
    } catch (error) {
      throw new Error(
        `Failed to get all invoices: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Helper method to validate invoice number uniqueness
  private async validateInvoiceNumberUniqueness(
    invoiceNumber: string,
    currentInvoiceId: number
  ): Promise<void> {
    const duplicateInvoice = await prisma.invoice.findUnique({
      where: { invoiceNumber },
    });

    if (duplicateInvoice && duplicateInvoice.id !== currentInvoiceId) {
      throw new Error(`Invoice with number ${invoiceNumber} already exists`);
    }
  }

  // Helper method to validate equipment IDs
  private async validateEquipmentIds(equipmentIds: number[]): Promise<void> {
    const equipment = await prisma.equipment.findMany({
      where: { equipment_id: { in: equipmentIds } },
    });

    if (equipment.length !== equipmentIds.length) {
      throw new Error("One or more equipment IDs are invalid");
    }
  }

  // Helper method to prepare update data with date conversion
  private prepareUpdateData(
    data: InvoiceUpdatePayload
  ): Partial<InvoiceRequestPayload> {
    const { ...invoiceData } = data;
    const updateData: Partial<InvoiceRequestPayload> = { ...invoiceData };

    if (updateData.date) {
      updateData.date = new Date(updateData.date);
    }
    if (updateData.dueDate) {
      updateData.dueDate = new Date(updateData.dueDate);
    }
    if (updateData.billingPeriod_start) {
      updateData.billingPeriod_start = new Date(updateData.billingPeriod_start);
    }
    if (updateData.billingPeriod_end) {
      updateData.billingPeriod_end = new Date(updateData.billingPeriod_end);
    }

    return updateData;
  }

  // update Invoice Service
  public async updateInvoice(
    id: number,
    data: InvoiceUpdatePayload
  ): Promise<InvoiceResponsePayload> {
    try {
      // Check if invoice exists
      const existingInvoice = await prisma.invoice.findUnique({
        where: { id },
      });

      if (!existingInvoice) {
        throw new Error(`Invoice with ID ${id} not found`);
      }

      // If updating invoice number, check for duplicates
      if (
        data.invoiceNumber &&
        data.invoiceNumber !== existingInvoice.invoiceNumber
      ) {
        await this.validateInvoiceNumberUniqueness(data.invoiceNumber, id);
      }

      // Validate equipment if provided
      if (data.equipmentIds && data.equipmentIds.length > 0) {
        await this.validateEquipmentIds(data.equipmentIds);
      }

      const { invoiceItems, equipmentIds } = data;
      const updateData = this.prepareUpdateData(data);

      const invoice = await prisma.invoice.update({
        where: { id },
        data: {
          ...updateData,
          invoiceItems: invoiceItems
            ? {
                deleteMany: {},
                create: invoiceItems.map((item) => ({
                  item_description: item.item_description,
                  quantity: item.quantity,
                  rate: item.rate,
                  amount: item.amount,
                })),
              }
            : undefined,
          invoiceEquipments: equipmentIds
            ? {
                deleteMany: {},
                create: equipmentIds.map((equipment_id) => ({
                  equipment_id,
                })),
              }
            : undefined,
        },
        include: {
          invoiceItems: true,
          invoiceEquipments: {
            include: {
              equipment: {
                select: {
                  equipment_id: true,
                  unit_number: true,
                  description: true,
                  customer_unit_number: true,
                },
              },
            },
          },
        },
      });

      return invoice;
    } catch (error) {
      throw new Error(
        `Failed to update invoice: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // delete Invoice Service
  public async deleteInvoice(id: number): Promise<Invoice> {
    try {
      // Check if invoice exists
      const existingInvoice = await prisma.invoice.findUnique({
        where: { id },
      });

      if (!existingInvoice) {
        throw new Error(`Invoice with ID ${id} not found`);
      }

      // Check if invoice has associated payments
      const paymentInvoices = await prisma.paymentInvoice.findMany({
        where: { invoiceId: id },
      });

      if (paymentInvoices.length > 0) {
        throw new Error(
          `Cannot delete invoice with ID ${id} as it has associated payments`
        );
      }

      return await prisma.invoice.delete({
        where: { id },
      });
    } catch (error) {
      throw new Error(
        `Failed to delete invoice: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Check if invoice number exists
  public async invoiceNumberExists(
    invoiceNumber: string,
    excludeId?: number
  ): Promise<boolean> {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { invoiceNumber },
      });

      return invoice !== null && (excludeId ? invoice.id !== excludeId : true);
    } catch (error) {
      throw new Error(
        `Failed to check invoice number: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Get invoice stats with optional account filtering
  public async getInvoiceStats(
    accountIds?: number[] | string | string[]
  ): Promise<{
    totalAccountsDue: number;
    currentInvoices: number;
    pastDueInvoices: number;
    pastDueInvoicesCount: number;
    pastView30Days: number;
    pastView30DaysCount: number;
  }> {
    try {
      const today = new Date();
      const thirtyDaysAgo = new Date(
        today.getTime() - 30 * 24 * 60 * 60 * 1000
      );

      // Parse accountIds parameter
      let accountIdsArray: number[] = [];
      if (accountIds) {
        if (Array.isArray(accountIds)) {
          // Handle array case (could be string[] or number[])
          accountIdsArray = accountIds.map((id) => Number(id));
        } else if (typeof accountIds === "string") {
          // Handle string case (comma-separated values)
          accountIdsArray = accountIds
            .split(",")
            .map((id) => Number(id.trim()));
        }
      }

      // Build account filter
      const accountFilter =
        accountIdsArray.length > 0
          ? {
              account_id: {
                in: accountIdsArray,
              },
            }
          : {};

      const [
        totalDue,
        currentCount,
        pastDue,
        pastDueCount,
        past30Days,
        past30DaysCount,
      ] = await Promise.all([
        // Total amount due
        prisma.invoice.aggregate({
          _sum: { balanceDue: true },
          where: {
            balanceDue: { gt: 0 },
            ...accountFilter,
          },
        }),
        // Current invoices count
        prisma.invoice.count({
          where: accountFilter,
        }),
        // Past due amount
        prisma.invoice.aggregate({
          _sum: { balanceDue: true },
          where: {
            dueDate: { lt: today },
            balanceDue: { gt: 0 },
            ...accountFilter,
          },
        }),
        // Past due count
        prisma.invoice.count({
          where: {
            dueDate: { lt: today },
            balanceDue: { gt: 0 },
            ...accountFilter,
          },
        }),
        // 30+ days past due amount
        prisma.invoice.aggregate({
          _sum: { balanceDue: true },
          where: {
            dueDate: { lt: thirtyDaysAgo },
            balanceDue: { gt: 0 },
            ...accountFilter,
          },
        }),
        // 30+ days past due count
        prisma.invoice.count({
          where: {
            dueDate: { lt: thirtyDaysAgo },
            balanceDue: { gt: 0 },
            ...accountFilter,
          },
        }),
      ]);

      return {
        totalAccountsDue: totalDue._sum.balanceDue ?? 0,
        currentInvoices: currentCount,
        pastDueInvoices: pastDue._sum.balanceDue ?? 0,
        pastDueInvoicesCount: pastDueCount,
        pastView30Days: past30Days._sum.balanceDue ?? 0,
        pastView30DaysCount: past30DaysCount,
      };
    } catch (error) {
      throw new Error(
        `Failed to get invoice stats: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Helper method to build export filters
  private buildExportFilters(
    query: InvoicesFilterQuery
  ): Prisma.InvoiceWhereInput {
    return {
      ...(query.invoiceNumber && {
        invoiceNumber: {
          contains: query.invoiceNumber,
          mode: Prisma.QueryMode.insensitive,
        },
      }),
      ...(query.invoiceDate && {
        date: new Date(query.invoiceDate),
      }),
      ...(query.dueDate && {
        dueDate: new Date(query.dueDate),
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
      ...(query.invoiceType && {
        invoiceType: query.invoiceType as InvoiceType,
      }),
      ...(query.excludedIds && {
        id: {
          notIn: Array.isArray(query.excludedIds)
            ? query.excludedIds.map((id) => Number(id))
            : query.excludedIds
                .split(",")
                .map((id: string) => Number(id.trim())),
        },
      }),
    };
  }

  // Helper method to create Excel column definitions
  private createExcelColumns(columns: ColumnDefinition[]) {
    return columns.map(({ label, field }) => {
      switch (field) {
        case "sno":
          return { header: label, key: field, width: 8 };
        case "date":
        case "dueDate":
          return {
            header: label,
            key: field,
            width: 15,
            formatter: (val: unknown) => {
              if (val instanceof Date) {
                return val.toLocaleDateString();
              }
              return val ? new Date(val as string).toLocaleDateString() : "N/A";
            },
          };
        case "totalAmount":
        case "balanceDue":
        case "item_quantity":
        case "item_rate":
        case "item_amount":
          return {
            header: label,
            key: field,
            width: 15,
            style: { numFmt: "$#,##0.00" },
            formatter: (val: unknown) => {
              const numVal = val as number;
              return numVal ?? 0;
            },
          };
        case "invoiceEquipments":
          return {
            header: label,
            key: field,
            width: 15,
            style: { numFmt: "0" },
            formatter: (val: unknown) => {
              const numVal = val as number;
              return numVal ?? 0;
            },
          };
        default:
          return { header: label, key: field, width: 20 };
      }
    });
  }

  // Helper method to format data for Excel
  private formatDataForExcel(
    flattenedData: Record<string, unknown>[],
    columns: ColumnDefinition[]
  ) {
    return flattenedData.map((item, index) => {
      const row: Record<string, unknown> = {};

      columns.forEach(({ field }) => {
        if (field === "sno") {
          row[field] = index + 1;
        } else if (field in item) {
          const value = item[field];
          row[field] = value ?? "";
        } else {
          row[field] = "";
        }
      });
      return row;
    });
  }

  // Export invoices
  public async exportInvoices(
    query: InvoicesFilterQuery,
    columns: ColumnDefinition[]
  ): Promise<{ buffer: Buffer; filename: string }> {
    try {
      const filters = this.buildExportFilters(query);
      const orderBy = buildOrderByFromSort(
        query.sort,
        INVOICE_SORT_FIELDS,
        "id"
      );

      const invoices = await prisma.invoice.findMany({
        where: filters,
        orderBy,
        include: {
          invoiceItems: true,
          account: {
            select: {
              account_id: true,
              account_name: true,
              account_number: true,
            },
          },
          _count: {
            select: {
              invoiceEquipments: true,
            },
          },
        },
      });

      const flattenedData = invoices.map((invoice) => ({
        sno: 0,
        invoice_id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        date: invoice.date,
        dueDate: invoice.dueDate,
        invoiceType: invoice.invoiceType,
        totalAmount: invoice.totalAmount,
        balanceDue: invoice.balanceDue,
        account_name: invoice.account?.account_name,
        account_number: invoice.account?.account_number,
        invoiceEquipments: invoice._count.invoiceEquipments,
      }));

      const excelColumns = this.createExcelColumns(columns);
      const formattedData = this.formatDataForExcel(flattenedData, columns);

      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, -5);
      const filename = `invoices_export_${timestamp}.xlsx`;

      const exporter = new ExcelExporter();
      exporter.generateWorkbook({
        sheetName: "Invoices Export",
        columns: excelColumns,
        data: formattedData,
        filename,
      });

      const buffer = await exporter.writeToBuffer();

      return { buffer, filename };
    } catch (error) {
      throw new Error(
        `Failed to export invoices: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Export invoice as PDF
  public async exportInvoicePDF(
    id: number
  ): Promise<{ buffer: Buffer; filename: string }> {
    try {
      const invoice = await this.getInvoiceById(id);
      if (!invoice) {
        throw new Error(`Invoice with ID ${id} not found`);
      }

      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, -5);
      const filename = `invoice_${invoice.invoiceNumber}_${timestamp}.pdf`;

      const buffer = await PDFTemplates.generateInvoice(invoice);

      return { buffer, filename };
    } catch (error) {
      throw new Error(
        `Failed to export invoice PDF: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Helper method to build credit invoice filters
  private buildCreditInvoiceFilters(
    query: CreditInvoicesQueryParams
  ): Prisma.credit_invoiceWhereInput {
    const { accountIds, creditInvoiceNumber, accountNumber, dateFrom, dateTo } =
      query;

    // Parse accountIds parameter
    let accountIdsArray: number[] = [];
    if (accountIds) {
      if (Array.isArray(accountIds)) {
        accountIdsArray = accountIds.map((id: string | number) => Number(id));
      } else if (typeof accountIds === "string") {
        accountIdsArray = accountIds
          .split(",")
          .map((id: string) => Number(id.trim()));
      }
    }

    return {
      ...(accountIdsArray.length > 0 && {
        account_id: { in: accountIdsArray },
      }),
      ...(creditInvoiceNumber && {
        credit_invoice_number: {
          contains: creditInvoiceNumber,
          mode: Prisma.QueryMode.insensitive,
        },
      }),
      ...(accountNumber && {
        account: {
          account_number: {
            contains: accountNumber,
            mode: Prisma.QueryMode.insensitive,
          },
        },
      }),
      ...(dateFrom && {
        credit_date: { gte: new Date(dateFrom) },
      }),
      ...(dateTo && {
        credit_date: { lte: new Date(dateTo) },
      }),
    };
  }

  // Get Credit Invoices Service with filtering, sorting, and pagination
  public async getCreditInvoices(
    query: CreditInvoicesQueryParams = {}
  ): Promise<CreditInvoicesResponse> {
    try {
      const { page = 1, perPage = 10, sort } = query;
      const skip = (page - 1) * perPage;
      const take = perPage;

      const filters = this.buildCreditInvoiceFilters(query);

      // Build order by clause
      const orderBy: Prisma.credit_invoiceOrderByWithRelationInput = {};
      if (sort) {
        const [field, direction] = sort.split(":");
        const validFields = [
          "credit_date",
          "credit_invoice_number",
          "credit_amount",
        ];
        const validDirections = ["asc", "desc"];

        if (
          validFields.includes(field) &&
          validDirections.includes(direction)
        ) {
          (orderBy as Record<string, unknown>)[field] = direction as
            | "asc"
            | "desc";
        }
      } else {
        orderBy.credit_date = "desc";
      }

      const [creditInvoices, total] = await Promise.all([
        prisma.credit_invoice.findMany({
          skip,
          take,
          where: filters,
          orderBy,
          select: {
            credit_date: true,
            credit_invoice_number: true,
            credit_amount: true,
            account: {
              select: {
                account_number: true,
              },
            },
          },
        }),
        prisma.credit_invoice.count({ where: filters }),
      ]);

      // Transform data to match the required format
      const transformedCreditInvoices: CreditInvoiceResponsePayload[] =
        creditInvoices.map((invoice) => ({
          date: invoice.credit_date.toISOString().split("T")[0], // Format as YYYY-MM-DD
          invoiceNumber: invoice.credit_invoice_number,
          accountNumber: invoice.account.account_number ?? "",
          balanceDue: invoice.credit_amount,
        }));

      const totalPages = Math.ceil(total / perPage);

      return {
        creditInvoices: transformedCreditInvoices,
        total,
        page,
        perPage,
        totalPages,
      };
    } catch (error) {
      throw new Error(
        `Failed to get credit invoices: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Pay Now functionality
  public async payNow(
    invoiceId: number,
    paymentData: {
      paymentId: string;
      paymentMethod: string;
      payerName: string;
      payerEntity?: string;
      paymentAmount: number;
    }
  ): Promise<Record<string, unknown>> {
    try {
      const invoice = await this.getInvoiceById(invoiceId);
      if (!invoice) {
        throw new Error(`Invoice with ID ${invoiceId} not found`);
      }

      if (invoice.balanceDue <= 0) {
        throw new Error(`Invoice ${invoice.invoiceNumber} is already paid`);
      }

      // Create payment record
      const payment = await prisma.payment.create({
        data: {
          paymentId: paymentData.paymentId,
          paymentDate: new Date(),
          paymentMethod: paymentData.paymentMethod,
          payerName: paymentData.payerName,
          payerEntity: paymentData.payerEntity ?? paymentData.payerName,
          invoicePayments: 1,
          invoiceCredits: 0,
          paymentAmount: paymentData.paymentAmount,
          account_id: invoice.account_id,
          paymentInvoices: {
            create: {
              invoiceId: invoiceId,
              account_id: invoice.account_id,
            },
          },
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

      // Update invoice balance
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          amountPaid: { increment: paymentData.paymentAmount },
          balanceDue: { decrement: paymentData.paymentAmount },
        },
      });

      return payment;
    } catch (error) {
      this.handleServiceError("process payment", error);
    }
  }
}
