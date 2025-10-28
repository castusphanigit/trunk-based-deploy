// services/globalSearchService.ts
import prisma from "../config/database.config";
import { Prisma } from "@prisma/client";
import { getPagination, PaginationParams } from "../utils/pagination";

/* eslint-disable @stylistic/ts/member-delimiter-style */

interface SearchResult {
  id: number;
  type: string;
  title: string;
  subtitle: string;
  description: string;
  route: string;
  account_id?: number;
  account_name?: string;
}

interface AccountFilter {
  account_id?: { in: number[] };
}

export class GlobalSearchService {
  public async performGlobalSearch(
    query: string,
    accountIds: number[] = [],
    paginationParams: PaginationParams = {}
  ): Promise<{
    results: SearchResult[];
    query: string;
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  }> {
    try {
      const { page, perPage, skip, take } = getPagination(paginationParams);

      // Build base where condition for account filtering
      const accountFilter =
        accountIds.length > 0
          ? {
              account_id: { in: accountIds },
            }
          : {};

      // Perform parallel searches across all relevant tables
      const [
        equipmentResults,
        permitResults,
        workorderResults,
        ersResults,
        accountResults,
        invoiceResults,
      ] = await Promise.all([
        this.searchEquipment(query, accountIds),
        this.searchPermits(query, accountFilter),
        this.searchWorkorders(query, accountFilter),
        this.searchERS(query, accountFilter),
        this.searchAccounts(query, accountIds),
        this.searchInvoices(query, accountIds), // Add invoice search
      ]);

      // Combine and format results
      const allResults = [
        ...equipmentResults,
        ...permitResults,
        ...workorderResults,
        ...ersResults,
        ...accountResults,
        ...invoiceResults,
      ];

      // Apply pagination to combined results
      const total = allResults.length;
      const totalPages = Math.ceil(total / perPage);
      const results = allResults.slice(skip, skip + take);

      return {
        results,
        query,
        total,
        page,
        perPage,
        totalPages,
      };
    } catch (error) {
      throw new Error(`Global search failed: ${error}`);
    }
  }

  private async searchEquipment(
    query: string,
    accountIds: number[]
  ): Promise<SearchResult[]> {
    // Search equipment through equipment_assignment -> equipment_type_allocation -> account
    const equipment = await prisma.equipment.findMany({
      where: {
        AND: [
          {
            OR: [
              { vin: { contains: query, mode: "insensitive" } },
              {
                customer_unit_number: { contains: query, mode: "insensitive" },
              },
              { unit_number: { contains: query, mode: "insensitive" } },
            ],
          },
          { is_deleted: false },
          // Filter by account through equipment_assignment
          accountIds.length > 0
            ? {
                equipment_assignment: {
                  some: {
                    equipment_type_allocation_ref: {
                      account_id: { in: accountIds },
                    },
                  },
                },
              }
            : {},
        ],
      },
      include: {
        equipment_assignment: {
          include: {
            equipment_type_allocation_ref: {
              include: {
                account: {
                  select: { account_id: true, account_name: true },
                },
              },
            },
          },
        },
      },
      take: 10,
    });

    return equipment.map((item) => ({
      id: item.equipment_id,
      type: "equipment",
      title: item.unit_number,
      subtitle: item.vin ?? item.customer_unit_number ?? "No VIN",
      description: item.description,
      route: `/equipment/${item.equipment_id}`,
      account_id:
        item.equipment_assignment[0]?.equipment_type_allocation_ref?.account_id,
      account_name:
        item.equipment_assignment[0]?.equipment_type_allocation_ref?.account
          ?.account_name ?? undefined,
    }));
  }

  private async searchPermits(
    query: string,
    accountFilter: AccountFilter
  ): Promise<SearchResult[]> {
    const permits = await prisma.equipment_permit.findMany({
      where: {
        AND: [
          {
            license_plate_number: { contains: query, mode: "insensitive" },
          },
          { is_deleted: false },
          // Filter by account through equipment -> equipment_assignment
          {
            equipment_ref: {
              equipment_assignment: {
                some: {
                  equipment_type_allocation_ref: {
                    account_id: accountFilter.account_id,
                  },
                },
              },
            },
          },
        ],
      },
      include: {
        equipment_ref: {
          include: {
            equipment_assignment: {
              include: {
                equipment_type_allocation_ref: {
                  include: {
                    account: {
                      select: { account_id: true, account_name: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      take: 10,
    });

    return permits.map((item) => ({
      id: item.equipment_permit_id,
      type: "permit",
      title: item.license_plate_number ?? "No License Plate",
      subtitle: `State: ${item.license_plate_state ?? "N/A"}`,
      description: `Equipment: ${item.equipment_ref.unit_number}`,
      route: `/equipment/${item.equipment_id}/permit`,
      account_id:
        item.equipment_ref.equipment_assignment[0]
          ?.equipment_type_allocation_ref?.account_id,
      account_name:
        item.equipment_ref.equipment_assignment[0]
          ?.equipment_type_allocation_ref?.account?.account_name ?? undefined,
    }));
  }

  private async searchWorkorders(
    query: string,
    accountFilter: AccountFilter
  ): Promise<SearchResult[]> {
    const workorders = await prisma.workorder.findMany({
      where: {
        AND: [
          {
            workorder_ref_id: { contains: query, mode: "insensitive" },
          },
          // Filter by account through service_request
          {
            service_request: {
              account_id: accountFilter.account_id,
            },
          },
        ],
      },
      include: {
        service_request: {
          include: {
            account: {
              select: { account_id: true, account_name: true },
            },
          },
        },
      },
      take: 10,
    });

    return workorders.map((item) => ({
      id: item.workorder_id,
      type: "workorder",
      title: item.workorder_ref_id ?? "No Reference ID",
      subtitle: `Status: ${item.workorder_status ?? "N/A"}`,
      description: item.workorder_description,
      route: `/workorders/${item.workorder_id}`,
      account_id: item.service_request.account_id,
      account_name: item.service_request.account?.account_name ?? undefined,
    }));
  }

  private async searchERS(
    query: string,
    accountFilter: AccountFilter
  ): Promise<SearchResult[]> {
    const ers = await prisma.ers.findMany({
      where: {
        AND: [
          {
            ers_ref_id: { contains: query, mode: "insensitive" },
          },
          // Filter by account through service_request
          {
            service_request: {
              account_id: accountFilter.account_id,
            },
          },
        ],
      },
      include: {
        service_request: {
          include: {
            account: {
              select: { account_id: true, account_name: true },
            },
          },
        },
      },
      take: 10,
    });

    return ers.map((item) => ({
      id: item.ers_id,
      type: "ers",
      title: item.ers_ref_id ?? "No Reference ID",
      subtitle: `Status: ${item.ers_status ?? "N/A"}`,
      description: item.ers_description,
      route: `/ers/${item.ers_id}`,
      account_id: item.service_request.account_id,
      account_name: item.service_request.account?.account_name ?? undefined,
    }));
  }

  private async searchAccounts(
    query: string,
    accountIds: number[]
  ): Promise<SearchResult[]> {
    const whereCondition: Prisma.accountWhereInput = {
      is_deleted: false,
      OR: [
        { account_name: { contains: query, mode: "insensitive" } },
        { account_number: { contains: query, mode: "insensitive" } },
        { legacy_account_number: { contains: query, mode: "insensitive" } },
      ],
    };

    // If specific account IDs are provided, filter by them
    if (accountIds.length > 0) {
      whereCondition.account_id = { in: accountIds };
    }

    const accounts = await prisma.account.findMany({
      where: whereCondition,
      take: 10,
    });

    return accounts.map((item) => ({
      id: item.account_id,
      type: "account",
      title: item.account_name ?? "No Account Name",
      subtitle: `Account #: ${item.account_number ?? "N/A"}`,
      description: `Legacy: ${item.legacy_account_number ?? "N/A"}`,
      route: `/accounts/${item.account_id}`,
      account_id: item.account_id,
      account_name: item.account_name ?? undefined,
    }));
  }

  private async searchInvoices(
    query: string,
    accountIds: number[]
  ): Promise<SearchResult[]> {
    const whereCondition: Prisma.InvoiceWhereInput = {
      invoiceNumber: { contains: query, mode: "insensitive" },
    };

    // If specific account IDs are provided, filter by them
    if (accountIds.length > 0) {
      whereCondition.account_id = { in: accountIds };
    }

    const invoices = await prisma.invoice.findMany({
      where: whereCondition,
      include: {
        account: {
          select: { account_id: true, account_name: true },
        },
      },
      take: 10,
    });

    return invoices.map((item) => ({
      id: item.id,
      type: "invoice",
      title: item.invoiceNumber ?? "No Invoice Number",
      subtitle: `Date: ${item.date?.toISOString().split("T")[0] ?? "N/A"}`,
      description: `Total: $${item.totalAmount ?? 0}`,
      route: `/invoices/${item.id}`,
      account_id: item.account_id,
      account_name: item.account?.account_name ?? undefined,
    }));
  }
}

export const globalSearchService = new GlobalSearchService();
