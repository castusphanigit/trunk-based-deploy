/**
 * Dashboard Service
 *
 * Handles business logic for dashboard-related operations including:
 * - Fetching dashboard metrics and KPIs
 * - Managing VMRS (Vehicle Maintenance Reporting Standards) data
 * - Processing maintenance and repair analytics
 * - Generating compliance and performance reports
 *
 * Security considerations:
 * - Input validation and sanitization
 * - SQL injection prevention through Prisma ORM
 * - Data access authorization checks
 * - Performance optimization for large datasets
 *
 * @author Rajeswari
 * @version 1.0.0
 */

import { createErrorWithMessage } from "../utils/responseUtils";
import prisma from "../config/database.config";
import { DashboardMetricsResponseDTO } from "../types/dtos/dashboard.dto";

// Type definitions for VMRS metrics
interface VmrsRequestData {
  account_ids?: number[];
  year?: number;
  start_date?: string;
  end_date?: string;
  vmrs_codes?: number[]
}

interface DateFilter {
  gte?: Date;
  lte?: Date
}

interface WorkorderData {
  workorder_part_cost: unknown;
  workorder_labour_cost: unknown;
  workorder: {
    created_at: Date
  }
}

interface VmrsData {
  vmrs_code: string;
  vmrs_description: string | null;
  workorders: WorkorderData[]
}

interface EquipmentSpendData {
  equipment_id: number;
  unit_number: string;
  service_requests: {
    workorder: {
      vmrsCodes: {
        workorder_part_cost: unknown,
        workorder_labour_cost: unknown
      }[]
    }[]
  }[]
}

interface ServiceRequestData {
  workorder: {
    vmrsCodes: {
      workorder_part_cost: unknown,
      workorder_labour_cost: unknown
    }[]
  }[]
}

/**
 * Service class for dashboard operations
 * Provides methods for fetching metrics, VMRS data, and analytics
 */
export class DashboardService {
  /**
   * Fetches comprehensive dashboard metrics for specified accounts
   *
   * @param accountIds - Array of account IDs to fetch metrics for
   * @returns Promise containing dashboard metrics including unit counts, work orders, invoices, etc.
   *
   * @throws {Error} When database query fails or invalid parameters provided
   *
   * @example
   * ```typescript
   * const metrics = await dashboardService.getDashboardMetrics([1, 2, 3]);
   * console.log(metrics.data.total_units_in_lease);
   * ```
   */
  public async getDashboardMetrics(
    accountIds: number[]
  ): Promise<DashboardMetricsResponseDTO> {
    try {
      // --- Account filter helper for equipment_ref/service_request ---
      const withAccountFilter = (
        field: "equipment_ref" | "service_request"
      ) => {
        if (field === "equipment_ref") {
          return {
            equipment_ref: {
              equipment_assignment: {
                some: {
                  equipment_type_allocation_ref: {
                    account_id: { in: accountIds },
                  },
                },
              },
            },
          };
        }

        if (field === "service_request") {
          return {
            service_request: {
              equipment_ref: {
                equipment_assignment: {
                  some: {
                    equipment_type_allocation_ref: {
                      account_id: { in: accountIds },
                    },
                  },
                },
              },
            },
          };
        }

        return {};
      };

      const [
        totalUnitsInLease,
        totalERSOpen,
        totalServiceRequestOpen,
        totalUnitsInRent,
        totalWorkOrdersOpen,
        totalWorkOrdersClosed,
        totalERSClosed,
        totalInvoiceAmount,
        invoicesPaid,
        invoicesOverdue,
      ] = await Promise.all([
        // --- Total Units in Lease (contract_panel_type = "L") ---
        prisma.equipment.count({
          where: {
            is_deleted: false,
            equipment_assignment: {
              some: {
                equipment_type_allocation_ref: {
                  account_id: { in: accountIds },
                  schedule_agreement_line_item_ref: {
                    schedule_agreement_ref: {
                      contract_type_lookup_ref: {
                        contract_panel_type: "L",
                      },
                    },
                  },
                },
              },
            },
          },
        }),

        // --- Total ERS Open ---
        prisma.ers.count({
          where: {
            ers_status: "inprogress",
            ...withAccountFilter("service_request"),
          },
        }),

        // --- Total Service Requests Open ---
        prisma.service_request.count({
          where: {
            workorder: { none: { workorder_status: "completed" } },
            ers: { none: { ers_status: "completed" } },
            ...withAccountFilter("equipment_ref"),
          },
        }),

        // --- Total Units in Rent (contract_panel_type = "R") ---
        prisma.equipment.count({
          where: {
            is_deleted: false,
            equipment_assignment: {
              some: {
                equipment_type_allocation_ref: {
                  account_id: { in: accountIds },
                  schedule_agreement_line_item_ref: {
                    schedule_agreement_ref: {
                      contract_type_lookup_ref: {
                        contract_panel_type: "R",
                      },
                    },
                  },
                },
              },
            },
          },
        }),

        // --- Total Work Orders Open ---
        prisma.workorder.count({
          where: {
            workorder_status: "inprogress",
            ...withAccountFilter("service_request"),
          },
        }),

        // --- Total Work Orders Closed ---
        prisma.workorder.count({
          where: {
            workorder_status: "completed",
            ...withAccountFilter("service_request"),
          },
        }),

        // --- Total ERS Closed ---
        prisma.ers.count({
          where: {
            ers_status: "completed",
            ...withAccountFilter("service_request"),
          },
        }),

        // --- Total Invoice Count ---
        prisma.invoice.count({
          where: {
            account_id: { in: accountIds },
          },
        }),

        // --- Invoices Paid (balanceDue = 0) ---
        prisma.invoice.count({
          where: {
            account_id: { in: accountIds },
            balanceDue: 0,
          },
        }),

        // --- Invoices Overdue (balanceDue > 0 and past dueDate) ---
        prisma.invoice.count({
          where: {
            account_id: { in: accountIds },
            balanceDue: { gt: 0 },
            dueDate: { lt: new Date() },
          },
        }),
      ]);

      return {
        success: true,
        data: {
          total_units_in_lease: totalUnitsInLease,
          total_ers_open: totalERSOpen,
          total_service_request_open: totalServiceRequestOpen,
          total_units_in_rent: totalUnitsInRent,
          total_work_orders_open: totalWorkOrdersOpen,
          total_work_orders_closed: totalWorkOrdersClosed,
          total_ers_closed: totalERSClosed,
          total_invoice_amount: totalInvoiceAmount,
          invoices_paid: invoicesPaid,
          invoices_overdue: invoicesOverdue,
        },
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new Error("Failed to fetch dashboard metrics");
    }
  }

  /**
   * Fetches VMRS (Vehicle Maintenance Reporting Standards) metrics and analytics
   *
   * @param accountIds - Array of account IDs to fetch metrics for
   * @param year - Optional year to filter data (overrides start_date and end_date)
   * @param filters - Optional filters for date range and VMRS codes
   * @param filters.start_date - Optional start date for filtering (format: YYYY-MM-DD)
   * @param filters.end_date - Optional end date for filtering (format: YYYY-MM-DD)
   * @param filters.vmrs_codes - Optional array of VMRS codes to filter by
   * @returns Promise containing VMRS analytics including repair counts, costs, and compliance data
   *
   * @throws {Error} When accountIds are missing or database query fails
   *
   * @example
   * ```typescript
   * const vmrsMetrics = await dashboardService.getVmrsMetrics(
   *   [1, 2, 3],
   *   2024,
   *   { vmrs_codes: [100, 200] }
   * );
   * ```
   */
  public async getVmrsMetrics(
    accountIds: number[],
    year?: number,
    filters?: {
      start_date?: string,
      end_date?: string,
      vmrs_codes?: number[]
    }
  ): Promise<{
    success: boolean,
    data: {
      repair_count_by_vmrs: {
        vmrs_code: string,
        vmrs_description: string | null,
        repair_count: number
      }[],
      average_cost_by_vmrs: {
        vmrs_code: string,
        vmrs_description: string | null,
        average_cost: number
      }[],
      total_spend_by_vmrs: {
        vmrs_code: string,
        vmrs_description: string | null,
        total_spend: number
      }[],
      spend_range_by_vmrs_category: {
        range: string,
        vmrs: {
          vmrs_code: string,
          vmrs_description: string | null,
          total_spend: number
        }[]
      }[],
      monthly_costs: {
        month: string,
        month_number: number,
        total_cost: number
      }[],
      monthly_maintenance_cost: {
        month: string,
        month_number: number,
        total_cost: number
      }[],
      highest_mr_spend_by_unit: {
        unit_number: string,
        total_spend: number
      }[],
      trailer_pm_compliance: {
        past_due_units: number,
        expiring_units: number,
        current_30_days_units: number
      }
    },
    timestamp: string
  }> {
    if (!accountIds?.length) throw new Error("accountIds are required");

    const { start_date, end_date, vmrs_codes } = this.prepareVmrsFilters(filters, year);
    const dateFilter = this.buildDateFilter(start_date, end_date);
    const vmrsData = await this.fetchVmrsData(accountIds, vmrs_codes, dateFilter);

    const repairCounts = this.calculateRepairCounts(vmrsData);
    const averageCosts = this.calculateAverageCosts(vmrsData);
    const totalSpends = this.calculateTotalSpends(vmrsData);
    const spendRanges = this.categorizeSpendRanges(totalSpends);
    const monthlyCosts = this.calculateMonthlyCosts(vmrsData);
    const monthlyMaintenanceCosts = this.calculateMonthlyMaintenanceCosts(vmrsData);
    const highestSpendByUnit = await this.calculateHighestSpendByUnit(accountIds, dateFilter);
    const pmCompliance = await this.calculatePmCompliance(accountIds);

    return {
      success: true,
      data: {
        repair_count_by_vmrs: repairCounts,
        average_cost_by_vmrs: averageCosts,
        total_spend_by_vmrs: totalSpends,
        spend_range_by_vmrs_category: spendRanges,
        monthly_costs: monthlyCosts,
        monthly_maintenance_cost: monthlyMaintenanceCosts,
        highest_mr_spend_by_unit: highestSpendByUnit,
        trailer_pm_compliance: pmCompliance,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Prepares VMRS filters and handles year override
   */
  private prepareVmrsFilters(filters: VmrsRequestData | undefined, year?: number) {
    let { start_date, end_date } = filters ?? {};
    const { vmrs_codes } = filters ?? {};

    if (year) {
      start_date = `${year}-01-01`;
      end_date = `${year}-12-31`;
    }

    return { start_date, end_date, vmrs_codes };
  }

  /**
   * Builds date filter object for database queries
   */
  private buildDateFilter(start_date?: string, end_date?: string): DateFilter {
    const dateFilter: DateFilter = {};
    if (start_date) dateFilter.gte = new Date(start_date);
    if (end_date) dateFilter.lte = new Date(end_date);
    return dateFilter;
  }

  /**
   * Fetches VMRS data with related workorders
   */
  private async fetchVmrsData(accountIds: number[], vmrs_codes?: number[], dateFilter?: DateFilter): Promise<VmrsData[]> {
    return await prisma.vmrs_Lookup.findMany({
      where: vmrs_codes ? { vmrs_id: { in: vmrs_codes } } : {},
      include: {
        workorders: {
          where: {
            workorder: {
              service_request: { account_id: { in: accountIds } },
              ...(dateFilter && (dateFilter.gte || dateFilter.lte) ? { created_at: dateFilter } : {}),
            },
          },
          select: {
            workorder_part_cost: true,
            workorder_labour_cost: true,
            workorder: { select: { created_at: true } },
          },
        },
      },
    });
  }

  /**
   * Calculates repair counts by VMRS
   */
  private calculateRepairCounts(vmrsData: VmrsData[]) {
    return vmrsData.map((vmrs) => ({
      vmrs_code: vmrs.vmrs_code,
      vmrs_description: vmrs.vmrs_description,
      repair_count: vmrs.workorders.length,
    }));
  }

  /**
   * Calculates average costs by VMRS
   */
  private calculateAverageCosts(vmrsData: VmrsData[]) {
    return vmrsData.map((vmrs) => {
      const totalCost = this.calculateTotalWorkorderCost(vmrs.workorders);
      const avgCost = vmrs.workorders.length ? totalCost / vmrs.workorders.length : 0;
      return {
        vmrs_code: vmrs.vmrs_code,
        vmrs_description: vmrs.vmrs_description,
        average_cost: parseFloat(avgCost.toFixed(2)),
      };
    });
  }

  /**
   * Calculates total spends by VMRS
   */
  private calculateTotalSpends(vmrsData: VmrsData[]) {
    return vmrsData.map((vmrs) => {
      const totalSpend = this.calculateTotalWorkorderCost(vmrs.workorders);
      return {
        vmrs_code: vmrs.vmrs_code,
        vmrs_description: vmrs.vmrs_description,
        total_spend: parseFloat(totalSpend.toFixed(2)),
      };
    });
  }

  /**
   * Calculates total cost for workorders
   */
  private calculateTotalWorkorderCost(workorders: WorkorderData[]): number {
    return workorders.reduce(
      (sum, w) => sum + Number(w.workorder_part_cost ?? 0) + Number(w.workorder_labour_cost ?? 0),
      0
    );
  }

  /**
   * Categorizes VMRS by spend ranges
   */
  private categorizeSpendRanges(totalSpends: ReturnType<typeof this.calculateTotalSpends>) {
    const spendRanges = {
      "< $500": [] as typeof totalSpends,
      "$500-$1000": [] as typeof totalSpends,
      "> $1000": [] as typeof totalSpends,
    };

    totalSpends.forEach((vmrs) => {
      if (vmrs.total_spend < 500) {
        spendRanges["< $500"].push(vmrs);
      } else if (vmrs.total_spend >= 500 && vmrs.total_spend <= 1000) {
        spendRanges["$500-$1000"].push(vmrs);
      } else {
        spendRanges["> $1000"].push(vmrs);
      }
    });

    return Object.entries(spendRanges).map(([range, vmrs]) => ({ range, vmrs }));
  }

  /**
   * Calculates monthly costs
   */
  private calculateMonthlyCosts(vmrsData: VmrsData[]) {
    const allMonths = this.getAllMonths();
    const monthlyMap = new Map<number, number>();

    vmrsData.forEach((vmrs) => {
      vmrs.workorders.forEach((wo) => {
        const month = wo.workorder.created_at.getMonth() + 1;
        const current = monthlyMap.get(month) ?? 0;
        const cost = Number(wo.workorder_part_cost ?? 0) + Number(wo.workorder_labour_cost ?? 0);
        monthlyMap.set(month, current + cost);
      });
    });

    return allMonths.map((m) => ({
      month: m.month,
      month_number: m.month_number,
      total_cost: parseFloat((monthlyMap.get(m.month_number) ?? 0).toFixed(2)),
    }));
  }

  /**
   * Calculates monthly maintenance costs (only part costs)
   */
  private calculateMonthlyMaintenanceCosts(vmrsData: VmrsData[]) {
    const allMonths = this.getAllMonths();
    const monthlyMaintenanceMap = new Map<number, number>();

    vmrsData.forEach((vmrs) => {
      vmrs.workorders.forEach((wo) => {
        const month = wo.workorder.created_at.getMonth() + 1;
        const current = monthlyMaintenanceMap.get(month) ?? 0;
        monthlyMaintenanceMap.set(month, current + Number(wo.workorder_part_cost ?? 0));
      });
    });

    return allMonths.map((m) => ({
      month: m.month,
      month_number: m.month_number,
      total_cost: parseFloat((monthlyMaintenanceMap.get(m.month_number) ?? 0).toFixed(2)),
    }));
  }

  /**
   * Gets all months configuration
   */
  private getAllMonths() {
    return [
      { month: "Jan", month_number: 1 },
      { month: "Feb", month_number: 2 },
      { month: "Mar", month_number: 3 },
      { month: "Apr", month_number: 4 },
      { month: "May", month_number: 5 },
      { month: "Jun", month_number: 6 },
      { month: "Jul", month_number: 7 },
      { month: "Aug", month_number: 8 },
      { month: "Sep", month_number: 9 },
      { month: "Oct", month_number: 10 },
      { month: "Nov", month_number: 11 },
      { month: "Dec", month_number: 12 },
    ];
  }

  /**
   * Calculates highest maintenance and repair spend by unit
   */
  private async calculateHighestSpendByUnit(accountIds: number[], dateFilter: DateFilter) {
    const equipmentSpendData = await this.fetchEquipmentSpendData(accountIds, dateFilter);
    const equipmentSpendMap = this.calculateEquipmentSpendMap(equipmentSpendData);

    return Array.from(equipmentSpendMap.entries())
      .map(([unit_number, total_spend]) => ({
        unit_number,
        total_spend: parseFloat(total_spend.toFixed(2)),
      }))
      .sort((a, b) => b.total_spend - a.total_spend)
      .slice(0, 5);
  }

  /**
   * Fetches equipment spend data
   */
  private async fetchEquipmentSpendData(accountIds: number[], dateFilter: DateFilter): Promise<EquipmentSpendData[]> {
    return await prisma.equipment.findMany({
      where: {
        equipment_assignment: {
          some: {
            equipment_type_allocation_ref: {
              account_id: { in: accountIds },
            },
          },
        },
        service_requests: {
          some: {
            workorder: {
              some: {
                vmrsCodes: { some: {} },
                ...(dateFilter.gte || dateFilter.lte ? { created_at: dateFilter } : {}),
              },
            },
          },
        },
      },
      select: {
        equipment_id: true,
        unit_number: true,
        service_requests: {
          where: {
            workorder: {
              some: {
                vmrsCodes: { some: {} },
                ...(dateFilter.gte || dateFilter.lte ? { created_at: dateFilter } : {}),
              },
            },
          },
          select: {
            workorder: {
              where: {
                ...(dateFilter.gte || dateFilter.lte ? { created_at: dateFilter } : {}),
              },
              select: {
                vmrsCodes: {
                  select: {
                    workorder_part_cost: true,
                    workorder_labour_cost: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  /**
   * Calculates equipment spend map
   */
  private calculateEquipmentSpendMap(equipmentSpendData: EquipmentSpendData[]): Map<string, number> {
    const equipmentSpendMap = new Map<string, number>();

    equipmentSpendData.forEach((equipment) => {
      const totalSpend = equipment.service_requests.reduce((total: number, sr) => {
        return total + this.calculateServiceRequestCost(sr);
      }, 0);

      if (totalSpend > 0) {
        equipmentSpendMap.set(equipment.unit_number, totalSpend);
      }
    });

    return equipmentSpendMap;
  }

  /**
   * Calculates service request cost
   */
  private calculateServiceRequestCost(serviceRequest: ServiceRequestData): number {
    return serviceRequest.workorder.reduce((total: number, wo) => {
      return total + this.calculateWorkOrderCost(wo);
    }, 0);
  }

  /**
   * Calculates work order cost
   */
  private calculateWorkOrderCost(workorder: { vmrsCodes: { workorder_part_cost: unknown, workorder_labour_cost: unknown }[] }): number {
    return workorder.vmrsCodes.reduce((total: number, vmrs) => {
      return total + this.calculateVmrsCost(vmrs);
    }, 0);
  }

  /**
   * Calculates VMRS cost
   */
  private calculateVmrsCost(vmrs: { workorder_part_cost: unknown, workorder_labour_cost: unknown }): number {
    return Number(vmrs.workorder_part_cost ?? 0) + Number(vmrs.workorder_labour_cost ?? 0);
  }

  /**
   * Calculates PM compliance metrics
   */
  private async calculatePmCompliance(accountIds: number[]) {
    const now = new Date();
    const next30Days = new Date();
    next30Days.setDate(now.getDate() + 30);

    const [pastDueUnits, expiringUnits, current30DaysUnits] = await Promise.all([
      this.getPastDueUnits(accountIds, now),
      this.getExpiringUnits(accountIds, now, next30Days),
      this.getCurrent30DaysUnits(accountIds, next30Days),
    ]);

    return {
      past_due_units: pastDueUnits.length,
      expiring_units: expiringUnits.length,
      current_30_days_units: current30DaysUnits.length,
    };
  }

  /**
   * Gets past due units
   */
  private async getPastDueUnits(accountIds: number[], now: Date) {
    const pmPastDue = await prisma.preventive_maintenance_event.findMany({
      where: {
        next_due_date: { lt: now },
        equipment: {
          equipment_assignment: {
            some: {
              equipment_type_allocation_ref: {
                account_id: { in: accountIds },
              },
            },
          },
        },
      },
      select: {
        equipment: { select: { unit_number: true } },
      },
    });

    return pmPastDue
      .map((p) => p.equipment?.unit_number)
      .filter((unitNumber): unitNumber is string => Boolean(unitNumber));
  }

  /**
   * Gets expiring units
   */
  private async getExpiringUnits(accountIds: number[], now: Date, next30Days: Date) {
    const expiringInspections = await prisma.dot_inspection.findMany({
      where: {
        valid_through: { lte: next30Days, gte: now },
        equipment: {
          equipment_assignment: {
            some: {
              equipment_type_allocation_ref: {
                account_id: { in: accountIds },
              },
            },
          },
        },
      },
      select: {
        equipment: { select: { unit_number: true } },
      },
    });

    return expiringInspections
      .map((d) => d.equipment?.unit_number)
      .filter((unitNumber): unitNumber is string => Boolean(unitNumber));
  }

  /**
   * Gets current 30+ days units
   */
  private async getCurrent30DaysUnits(accountIds: number[], next30Days: Date) {
    const pmCurrent30Days = await prisma.preventive_maintenance_event.findMany({
      where: {
        next_due_date: { gte: next30Days },
        equipment: {
          equipment_assignment: {
            some: {
              equipment_type_allocation_ref: {
                account_id: { in: accountIds },
              },
            },
          },
        },
      },
      select: {
        equipment: { select: { unit_number: true } },
      },
    });

    return pmCurrent30Days
      .map((p) => p.equipment?.unit_number)
      .filter((unitNumber): unitNumber is string => Boolean(unitNumber));
  }

  /**
   * Fetches the complete VMRS lookup list for dropdowns and selections
   *
   * @returns Promise containing array of VMRS lookup records with ID, code, and description
   *
   * @throws {Error} When no VMRS records found or database query fails
   *
   * @example
   * ```typescript
   * const vmrsList = await dashboardService.getVmrsLookupList();
   * console.log(vmrsList[0].vmrs_code); // "100"
   * ```
   */
  public async getVmrsLookupList() {
    try {
      const vmrsList = await prisma.vmrs_Lookup.findMany({
        select: {
          vmrs_id: true,
          vmrs_code: true,
          vmrs_description: true,
        },
        orderBy: {
          vmrs_code: "asc",
        },
      });

      if (!vmrsList || vmrsList.length === 0) {
        throw createErrorWithMessage("No VMRS lookup records found", "");
      }

      return vmrsList;
    } catch (error: unknown) {
      throw createErrorWithMessage(
        "Failed to retrieve VMRS lookup list",
        error
      );
    }
  }

  /**
   * Fetches the list of quick links for dashboard navigation
   *
   * @returns Promise containing array of quick link records
   *
   * @throws {Error} When no quick links found or database query fails
   *
   * @example
   * ```typescript
   * const quickLinks = await dashboardService.getTenQuickLinks();
   * console.log(quickLinks.length); // Number of available quick links
   * ```
   */
  public async getTenQuickLinks() {
    try {
      const quickLinksList = await prisma.ten_quick_link.findMany();

      if (!quickLinksList || quickLinksList.length === 0) {
        throw createErrorWithMessage("No ten quick links records found", "");
      }

      return quickLinksList;
    } catch (error: unknown) {
      throw createErrorWithMessage(
        "Failed to retrieve ten quick links list",
        error
      );
    }
  }
}
