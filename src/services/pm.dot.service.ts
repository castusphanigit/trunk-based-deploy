import { getPagination } from "../utils/pagination";
import prisma from "../config/database.config";

import type {
  PMsByAccountsQuery,
  PMScheduleDetail,
  DOTInspectionFilterQuery,
  CombinedRecordsQuery,
  CombinedRecord,
  PMsByEquipmentQuery,
} from "../types/dtos/pm.dto";
import { flattenObject } from "../utils/flatten";
import { buildOrderByFromSort } from "../utils/sort";

import { DOT_INSPECTION_SORT_FIELDS } from "../types/sorts/sortTypes";
import { ExcelExporter } from "../utils/excelUtils";
import { Prisma } from "@prisma/client";

import { ColumnDefinition } from "../types/common/request.types";

// Type aliases for better code organization
interface TelematicsData {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  latitude: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  longitude: any;
  address: string | null;
  motion_status: string | null;
}

// Define the type for a preventive maintenance schedule
interface PMScheduleWithRelations {
  pm_schedule_id: number;
  pm_task_description: string;
  frequency_interval: number;
  frequency_type: string;
  type: string | null;
  status: string;
  equipment: {
    equipment_id: number;
    unit_number: string;
    equipment_type_lookup_ref: { equipment_type: string } | null;
  } | null;
  facility_lookup: {
    facility_code: string;
    facility_name: string;
  };
  preventive_maintenance_events: {
    pm_event_id: number;
    performed_date: Date | null;
    next_due_date: Date | null;
    status: string;
  }[];
}

type FlattenedPM = Record<string, unknown>;

interface PMScheduleWithEvents {
  pm_schedule_id: number;
  pm_task_description: string;
  frequency_interval: number;
  frequency_type: string;
  type: string | null;
  status: string;
  equipment_id: number | null;
  equipment: {
    equipment_id: number;
    unit_number: string;
    equipment_type_lookup_ref: { equipment_type: string } | null;
  } | null;
  facility_lookup: {
    facility_code: string;
    facility_name: string;
  };
  account: {
    account_id: number;
    account_name: string | null;
  };
  preventive_maintenance_events: {
    pm_event_id: number;
    performed_date: Date | null;
    next_due_date: Date | null;
    status: string;
  }[];
}

interface DOTInspectionWithRelations {
  dot_inspection_id: number;
  equipment_id: number | null;
  account_id: number;
  schedule_agreement_id: number | null;
  inspection_date: Date | null;
  inspector_name: string | null;
  inspection_result: string | null;
  notes: string | null;
  next_inspection_due: Date | null;
  valid_through: Date | null;
  compliance: string | null;
  created_at: Date | null;
  updated_at: Date | null;
  status: string | null;
  type: string | null;
  equipment: {
    unit_number: string | null;
    equipment_type_lookup_ref: { equipment_type: string } | null;
  } | null;
  dot_inspection_violation: {
    dot_inspection_violation_id: number;
    violation_code: string | null;
    description: string | null;
    severity_level: string | null;
    corrective_action_taken: string | null;
  }[];
}

// Type alias for date parameter
type DateInput = string | null | undefined;

export class PmService {
  private hasPMFilters(query: CombinedRecordsQuery): boolean {
    return Boolean(
      query.type ??
        query.pm_task_description ??
        query.frequency_interval ??
        query.frequency_type ??
        query.status ??
        query.facility_code ??
        query.facility_name ??
        query.lastEvent_performed_date ??
        query.nextEvent_next_due_date ??
        query.equipment_id ??
        query.unit_number ??
        query.equipment_type
    );
  }

  private buildFacilityFilter(query: CombinedRecordsQuery) {
    if (!query.facility_code && !query.facility_name) return {};

    return {
      facility_lookup: {
        ...(query.facility_code && {
          facility_code: {
            contains: query.facility_code,
            mode: "insensitive" as const,
          },
        }),
        ...(query.facility_name && {
          facility_name: {
            contains: query.facility_name,
            mode: "insensitive" as const,
          },
        }),
      },
    };
  }

  private buildEventDateFilter(
    dateField: string,
    dateValue: string | undefined
  ) {
    if (!dateValue) return {};

    return {
      preventive_maintenance_events: {
        some: {
          [dateField]: {
            gte: new Date(dateValue + "T00:00:00.000Z"),
            lte: new Date(dateValue + "T23:59:59.999Z"),
          },
        },
      },
    };
  }

  private buildEquipmentFilter(query: CombinedRecordsQuery) {
    if (!query.equipment_id && !query.unit_number && !query.equipment_type)
      return {};

    return {
      equipment: {
        ...(query.equipment_id && {
          equipment_id: query.equipment_id,
        }),
        ...(query.unit_number && {
          unit_number: {
            contains: query.unit_number,
            mode: "insensitive" as const,
          },
        }),
        ...(query.equipment_type && {
          equipment_type_lookup_ref: {
            equipment_type: {
              contains: query.equipment_type,
              mode: "insensitive" as const,
            },
          },
        }),
      },
    };
  }

  private buildPMFilters(
    query: CombinedRecordsQuery,
    accountIds: number[],
    excludedPmIds: number[]
  ): Prisma.preventive_maintenance_scheduleWhereInput {
    const applyPMFilters = this.hasPMFilters(query);

    return {
      account_id: { in: accountIds },
      ...(excludedPmIds.length > 0 && {
        NOT: { pm_schedule_id: { in: excludedPmIds } },
      }),
      ...(applyPMFilters && {
        ...(query.type && {
          type: {
            contains: query.type,
            mode: "insensitive",
          },
        }),
        ...(query.pm_task_description && {
          pm_task_description: {
            contains: query.pm_task_description,
            mode: "insensitive",
          },
        }),
        ...(query.frequency_interval && {
          frequency_interval: query.frequency_interval,
        }),
        ...(query.frequency_type && {
          frequency_type: {
            equals: query.frequency_type,
            mode: "insensitive",
          },
        }),
        ...(query.status &&
          query.status !== "All" && {
            status: {
              contains: query.status,
              mode: Prisma.QueryMode.insensitive,
            },
          }),
        ...this.buildFacilityFilter(query),
        ...this.buildEventDateFilter(
          "performed_date",
          query.lastEvent_performed_date
        ),
        ...this.buildEventDateFilter(
          "next_due_date",
          query.nextEvent_next_due_date
        ),
        ...this.buildEquipmentFilter(query),
      }),
    };
  }

  private hasDOTFilters(query: CombinedRecordsQuery): boolean {
    return Boolean(
      query.inspection_result ??
        query.inspector_name ??
        query.notes ??
        query.unit_number ??
        query.inspection_status ??
        query.compliance ??
        query.inspection_date ??
        query.valid_through ??
        query.next_inspection_due ??
        query.violation_code ??
        query.severity_level ??
        query.equipment_type
    );
  }

  private buildDOTDateFilter(dateField: string, dateValue: string | undefined) {
    if (!dateValue) return {};

    return {
      [dateField]: {
        gte: new Date(dateValue + "T00:00:00.000Z"),
        lte: new Date(dateValue + "T23:59:59.999Z"),
      },
    };
  }

  private buildDOTFilters(
    query: CombinedRecordsQuery,
    accountIds: number[],
    excludedDotIds: number[]
  ): Prisma.dot_inspectionWhereInput {
    const applyDOTFilters = this.hasDOTFilters(query);

    return {
      account_id: { in: accountIds },
      ...(excludedDotIds.length > 0 && {
        NOT: { dot_inspection_id: { in: excludedDotIds } },
      }),
      ...(applyDOTFilters && {
        ...(query.inspection_result && {
          inspection_result: {
            contains: query.inspection_result,
            mode: "insensitive",
          },
        }),
        ...(query.inspector_name && {
          inspector_name: {
            contains: query.inspector_name,
            mode: "insensitive",
          },
        }),
        ...(query.notes && {
          notes: {
            contains: query.notes,
            mode: "insensitive",
          },
        }),
        ...(query.status &&
          query.status !== "All" && {
            status: {
              contains: query.status,
              mode: Prisma.QueryMode.insensitive,
            },
          }),
        ...(query.inspection_status && {
          status: {
            contains: query.inspection_status,
            mode: "insensitive",
          },
        }),
        ...(query.type && {
          type: {
            contains: query.type,
            mode: "insensitive",
          },
        }),
        ...(query.compliance && {
          compliance: {
            contains: query.compliance,
            mode: "insensitive",
          },
        }),
        ...this.buildDOTDateFilter("inspection_date", query.inspection_date),
        ...this.buildDOTDateFilter("valid_through", query.valid_through),
        ...this.buildDOTDateFilter(
          "next_inspection_due",
          query.next_inspection_due
        ),
        ...this.buildEquipmentFilter(query),
        ...(query.violation_code || query.severity_level
          ? {
              dot_inspection_violation: {
                some: {
                  ...(query.violation_code && {
                    violation_code: {
                      contains: query.violation_code,
                      mode: "insensitive" as const,
                    },
                  }),
                  ...(query.severity_level && {
                    severity_level: {
                      contains: query.severity_level,
                      mode: "insensitive" as const,
                    },
                  }),
                },
              },
            }
          : {}),
      }),
    };
  }

  private async getLatestServiceRequestsForEquipment(
    equipmentIds: number[]
  ): Promise<
    Record<
      number,
      {
        service_request_id: number;
        workorder_id?: number;
        workorder_ref_id?: string;
      }
    >
  > {
    if (equipmentIds.length === 0) return {};

    const serviceRequests = await prisma.service_request.findMany({
      where: {
        equipment_id: { in: equipmentIds },
      },
      select: {
        service_request_id: true,
        equipment_id: true,
        created_at: true,
        workorder: {
          select: {
            workorder_id: true,
            workorder_ref_id: true,
          },
        },
      },
      orderBy: [{ equipment_id: "asc" }, { service_request_id: "desc" }],
    });

    return serviceRequests.reduce<
      Record<
        number,
        {
          service_request_id: number;
          workorder_id?: number;
          workorder_ref_id?: string;
        }
      >
    >((acc, req) => {
      if (req.equipment_id) {
        const hasWorkorder = req.workorder.length > 0;
        const currentEquipment = acc[req.equipment_id];

        if (
          !currentEquipment ||
          (!currentEquipment.workorder_id && hasWorkorder)
        ) {
          acc[req.equipment_id] = {
            service_request_id: req.service_request_id,
            workorder_id: req.workorder[0]?.workorder_id ?? undefined,
            workorder_ref_id: req.workorder[0]?.workorder_ref_id ?? undefined,
          };
        }
      }
      return acc;
    }, {});
  }

  private calculateCounts(
    pmData: Record<string, unknown>[],
    dotData: Record<string, unknown>[],
    totalPMCount: number,
    totalDOTCount: number
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const parseDate = (date: DateInput) =>
      typeof date === "string" ? new Date(date) : null;

    return {
      pm: {
        totalUnits: totalPMCount,
        unitsComingDue: pmData.filter((u) => {
          const nextDue = parseDate(u.nextEvent_next_due_date as DateInput);
          return nextDue !== null && nextDue <= today;
        }).length,
        unitsOverdue: pmData.filter((u) => {
          const nextDue = parseDate(u.nextEvent_next_due_date as DateInput);
          return nextDue !== null && nextDue < today;
        }).length,
        unitsRecentlyCompleted: pmData.filter((u) => {
          const lastPerformed = parseDate(
            u.lastEvent_performed_date as DateInput
          );
          return (
            lastPerformed !== null &&
            lastPerformed >=
              new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
          );
        }).length,
      },
      dot: {
        totalInspections: totalDOTCount,
        failedInspections: dotData.filter((d) => {
          const result = d.inspection_result as DateInput;
          return (
            result !== null &&
            ["FAIL", "FAILED", "FAILURE"].includes((result ?? "").toUpperCase())
          );
        }).length,
        unitsDueForInspection: dotData.filter((d) => {
          const nextDue = parseDate(d.next_inspection_due as DateInput);
          return nextDue !== null && nextDue <= today;
        }).length,
        unitsWithExpiredPermits: dotData.filter((d) => {
          const nextDue = parseDate(d.next_inspection_due as DateInput);
          return nextDue !== null && nextDue < today;
        }).length,
      },
    };
  }

  private parseExcludedIds(query: CombinedRecordsQuery): {
    pm: number[];
    dot: number[];
  } {
    const excludedPmIds: number[] = (() => {
      if (!query.excludedIds?.pm) return [];
      if (Array.isArray(query.excludedIds.pm)) {
        return query.excludedIds.pm.map(Number).filter(Boolean);
      }
      if (typeof query.excludedIds.pm === "string") {
        return query.excludedIds.pm
          .split(",")
          .map((id: string) => Number(id.trim()))
          .filter(Boolean);
      }
      return [];
    })();

    const excludedDotIds: number[] = (() => {
      if (!query.excludedIds?.dot) return [];
      if (Array.isArray(query.excludedIds.dot)) {
        return query.excludedIds.dot.map(Number).filter(Boolean);
      }
      if (typeof query.excludedIds.dot === "string") {
        return query.excludedIds.dot
          .split(",")
          .map((id: string) => Number(id.trim()))
          .filter(Boolean);
      }
      return [];
    })();

    return { pm: excludedPmIds, dot: excludedDotIds };
  }

  private buildPMsByAccountsFilters(
    query: PMsByAccountsQuery,
    accountIds: number[]
  ): Prisma.preventive_maintenance_scheduleWhereInput {
    return {
      account_id: { in: accountIds },
      ...(query.type && {
        type: { contains: query.type, mode: "insensitive" },
      }),
      ...(query.pm_task_description && {
        pm_task_description: {
          contains: query.pm_task_description,
          mode: "insensitive",
        },
      }),
      ...(query.frequency_interval && {
        frequency_interval: query.frequency_interval,
      }),
      ...(query.frequency_type && {
        frequency_type: {
          equals: query.frequency_type,
          mode: "insensitive",
        },
      }),
      ...(query.status &&
        query.status !== "All" && {
          status: {
            contains: query.status,
            mode: Prisma.QueryMode.insensitive,
          },
        }),
      ...(query.equipment_id || query.unit_number || query.equipment_type
        ? {
            equipment: {
              ...(query.equipment_id && {
                equipment_id: query.equipment_id,
              }),
              ...(query.unit_number && {
                unit_number: {
                  contains: query.unit_number,
                  mode: "insensitive" as const,
                },
              }),
              ...(query.equipment_type && {
                equipment_type_lookup_ref: {
                  equipment_type: {
                    contains: query.equipment_type,
                    mode: "insensitive" as const,
                  },
                },
              }),
            },
          }
        : {}),
      ...(query.facility_code || query.facility_name
        ? {
            facility_lookup: {
              ...(query.facility_code && {
                facility_code: {
                  contains: query.facility_code,
                  mode: "insensitive" as const,
                },
              }),
              ...(query.facility_name && {
                facility_name: {
                  contains: query.facility_name,
                  mode: "insensitive" as const,
                },
              }),
            },
          }
        : {}),
    };
  }

  public async getPMsByAccounts(query: PMsByAccountsQuery) {
    const accountIdsParam = query.accountIds;
    const {
      page,
      perPage,
      skip: defaultSkip,
      take: defaultTake,
    } = getPagination(query);
    const take = query.fetchAll ? undefined : defaultTake;
    const skip = query.fetchAll ? undefined : defaultSkip;

    if (!accountIdsParam) throw new Error("MISSING_ACCOUNT_IDS");

    const accountIds = String(accountIdsParam)
      .split(",")
      .map((id) => Number(id.trim()))
      .filter((id) => Number.isFinite(id));

    if (!accountIds.length) throw new Error("INVALID_ACCOUNT_IDS");

    // Build filters
    const filters = this.buildPMsByAccountsFilters(query, accountIds);

    // Todays date for queries
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Counts and data in parallel
    const [
      totalUnits,
      unitsComingDue,
      unitsOverdue,
      unitsRecentlyCompleted,
      pmSchedules,
    ] = await Promise.all([
      prisma.preventive_maintenance_schedule.count({ where: filters }),

      prisma.preventive_maintenance_schedule.count({
        where: {
          ...filters,
          preventive_maintenance_events: {
            some: { status: "SCHEDULED", next_due_date: { lte: today } },
          },
        },
      }),

      prisma.preventive_maintenance_schedule.count({
        where: {
          ...filters,
          preventive_maintenance_events: {
            some: { status: "SCHEDULED", next_due_date: { lt: today } },
          },
        },
      }),

      (async () => {
        const since = new Date();
        since.setDate(today.getDate() - 30);
        return prisma.preventive_maintenance_schedule.count({
          where: {
            ...filters,
            preventive_maintenance_events: {
              some: { status: "COMPLETED", performed_date: { gte: since } },
            },
          },
        });
      })(),

      prisma.preventive_maintenance_schedule.findMany({
        where: filters,
        skip,
        take,
        select: {
          pm_schedule_id: true,
          pm_task_description: true,
          frequency_interval: true,
          frequency_type: true,
          type: true,
          status: true,
          equipment: {
            select: {
              equipment_id: true,
              unit_number: true,
              equipment_type_lookup_ref: { select: { equipment_type: true } },
            },
          },
          facility_lookup: {
            select: { facility_code: true, facility_name: true },
          },
          preventive_maintenance_events: {
            select: {
              pm_event_id: true,
              performed_date: true,
              next_due_date: true,
              status: true,
            },
            // orderBy: { performed_date: "desc" },
          },
        },
        orderBy: { pm_schedule_id: "desc" },
      }),
    ]);

    // Flatten and transform
    const flattenedTransformed = pmSchedules.map(
      (schedule: PMScheduleWithRelations) => {
        const events = schedule.preventive_maintenance_events;

        const lastEvent =
          events.find((ev) => ev.status === "COMPLETED") ?? null;

        const nextEvent =
          [...events].reverse().find((ev) => ev.status === "SCHEDULED") ?? null;

        return flattenObject({
          pm_schedule_id: schedule.pm_schedule_id,
          pm_task_description: schedule.pm_task_description,
          frequency_interval: schedule.frequency_interval,
          frequency_type: schedule.frequency_type,
          type: schedule.type,
          status: schedule.status,
          equipment: schedule.equipment,
          facility_lookup: schedule.facility_lookup,
          lastEvent_performed_date:
            lastEvent?.performed_date?.toISOString() ?? null,
          lastEvent_status: lastEvent?.status ?? null,
          nextEvent_next_due_date:
            nextEvent?.next_due_date?.toISOString() ?? null,
          nextEvent_status: nextEvent?.status ?? null,
        });
      }
    );

    return {
      data: flattenedTransformed,
      totalUnits,
      page,
      perPage,
      counts: {
        totalUnits,
        unitsComingDue,
        unitsOverdue,
        unitsRecentlyCompleted,
      },
    };
  }

  private buildDOTInspectionsByAccountsEquipmentFilter(
    query: DOTInspectionFilterQuery
  ) {
    if (!query.equipment_id && !query.unit_number && !query.equipment_type)
      return {};

    return {
      equipment: {
        ...(query.equipment_id && {
          equipment_id: Number(query.equipment_id),
        }),
        ...(query.unit_number && {
          unit_number: {
            contains: query.unit_number,
            mode: "insensitive" as const,
          },
        }),
        ...(query.equipment_type && {
          equipment_type_lookup_ref: {
            equipment_type: {
              contains: query.equipment_type,
              mode: "insensitive" as const,
            },
          },
        }),
      },
    };
  }

  private buildDOTInspectionsByAccountsViolationFilter(
    query: DOTInspectionFilterQuery
  ) {
    if (!query.violation_code && !query.severity_level) return {};

    return {
      dot_inspection_violation: {
        some: {
          ...(query.violation_code && {
            violation_code: {
              contains: query.violation_code,
              mode: "insensitive" as const,
            },
          }),
          ...(query.severity_level && {
            severity_level: {
              contains: query.severity_level,
              mode: "insensitive" as const,
            },
          }),
        },
      },
    };
  }

  private buildDOTInspectionsByAccountsFilters(
    query: DOTInspectionFilterQuery,
    accountIds: number[]
  ): Prisma.dot_inspectionWhereInput {
    return {
      account_id: { in: accountIds },
      ...(query.inspection_result && {
        inspection_result: {
          contains: query.inspection_result,
          mode: "insensitive",
        },
      }),
      ...(query.inspector_name && {
        inspector_name: {
          contains: query.inspector_name,
          mode: "insensitive",
        },
      }),
      ...(query.notes && {
        notes: { contains: query.notes, mode: "insensitive" },
      }),
      ...(query.status &&
        query.status !== "All" && {
          status: {
            contains: query.status,
            mode: Prisma.QueryMode.insensitive,
          },
        }),
      ...(query.type && {
        type: { contains: query.type, mode: "insensitive" },
      }),
      ...(query.compliance && {
        compliance: { contains: query.compliance, mode: "insensitive" },
      }),
      ...this.buildDOTDateFilter("inspection_date", query.inspection_date),
      ...this.buildDOTDateFilter("valid_through", query.valid_through),
      ...this.buildDOTDateFilter(
        "next_inspection_due",
        query.next_inspection_due
      ),
      ...this.buildDOTInspectionsByAccountsEquipmentFilter(query),
      ...this.buildDOTInspectionsByAccountsViolationFilter(query),
    };
  }

  public async getDOTInspectionsByAccounts(query: DOTInspectionFilterQuery) {
    const accountIdsParam = query.accountIds;
    const {
      page,
      perPage,
      skip: defaultSkip,
      take: defaultTake,
    } = getPagination(query);
    const take = query.fetchAll ? undefined : defaultTake;
    const skip = query.fetchAll ? undefined : defaultSkip;

    if (!accountIdsParam) throw new Error("MISSING_ACCOUNT_IDS");

    const accountIds = accountIdsParam
      .split(",")
      .map((id) => Number(id.trim()))
      .filter((id) => Number.isFinite(id));

    if (!accountIds.length) throw new Error("INVALID_ACCOUNT_IDS");

    // ----------------------------
    // Build filters
    // ----------------------------
    const filters = this.buildDOTInspectionsByAccountsFilters(
      query,
      accountIds
    );

    // ----------------------------
    // Today's date
    // ----------------------------
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ----------------------------
    // Counts & Data
    // ----------------------------
    const orderBy = buildOrderByFromSort(
      query.sort,
      DOT_INSPECTION_SORT_FIELDS,
      "dot_inspection_id"
    );

    const [
      totalInspections,
      failedInspections,
      unitsDueForInspection,
      unitsWithExpiredPermits,
      inspections,
    ] = await Promise.all([
      prisma.dot_inspection.count({ where: filters }),
      prisma.dot_inspection.count({
        where: {
          ...filters,
          inspection_result: { in: ["FAIL", "FAILED", "FAILURE"] },
        },
      }),
      prisma.dot_inspection.count({
        where: { ...filters, next_inspection_due: { lte: today } },
      }),
      prisma.dot_inspection.count({
        where: { ...filters, next_inspection_due: { lt: today } },
      }),
      prisma.dot_inspection.findMany({
        where: filters,
        skip,
        take,
        orderBy,
        select: {
          dot_inspection_id: true,
          equipment_id: true,
          account_id: true,
          schedule_agreement_id: true,
          inspection_date: true,
          inspector_name: true,
          inspection_result: true,
          notes: true,
          next_inspection_due: true,
          valid_through: true,
          compliance: true,
          created_at: true,
          updated_at: true,
          status: true,
          type: true,
          equipment: {
            select: {
              unit_number: true,
              equipment_type_lookup_ref: { select: { equipment_type: true } },
            },
          },
          dot_inspection_violation: {
            select: {
              dot_inspection_violation_id: true,
              violation_code: true,
              description: true,
              severity_level: true,
              corrective_action_taken: true,
            },
          },
        },
      }),
    ]);

    // ----------------------------
    // Transform data
    // ----------------------------
    const transformed: Record<string, unknown>[] = inspections.map((insp) =>
      flattenObject({
        dot_inspection_id: insp.dot_inspection_id,
        equipment_id: insp.equipment_id,
        account_id: insp.account_id,
        schedule_agreement_id: insp.schedule_agreement_id,
        inspection_date: insp.inspection_date?.toISOString() ?? null,
        inspector_name: insp.inspector_name,
        inspection_result: insp.inspection_result,
        notes: insp.notes,
        status: insp.status,
        valid_through: insp.valid_through?.toISOString() ?? null,
        compliance: insp.compliance,
        next_inspection_due: insp.next_inspection_due?.toISOString() ?? null,
        created_at: insp.created_at?.toISOString() ?? null,
        updated_at: insp.updated_at?.toISOString() ?? null,
        equipment: insp.equipment,
        dot_inspection_violation: insp.dot_inspection_violation,
        type: insp.type,
      })
    );

    return {
      data: transformed,
      meta: {
        totalInspections,
        page,
        perPage,
        counts: {
          totalInspections,
          failedInspections,
          unitsDueForInspection,
          unitsWithExpiredPermits,
        },
      },
    };
  }

  private determineQueryTables(query: CombinedRecordsQuery): {
    shouldQueryPM: boolean;
    shouldQueryDOT: boolean;
  } {
    const hasPMFilters = this.hasPMFilters(query);
    const hasDOTFilters = this.hasDOTFilters(query);

    // If recordType is specified, use it to determine which tables to query
    if (query.recordType) {
      const shouldQueryPM =
        query.recordType === "PM" || query.recordType === "pm";
      const shouldQueryDOT =
        query.recordType === "DOT" || query.recordType === "dot";
      return { shouldQueryPM, shouldQueryDOT };
    }

    // If no specific filters, query both tables
    const shouldQueryPM = !hasDOTFilters || hasPMFilters;
    const shouldQueryDOT = !hasPMFilters || hasDOTFilters;

    return { shouldQueryPM, shouldQueryDOT };
  }

  private buildCombinedPMFilters(
    query: CombinedRecordsQuery,
    accountIds: number[]
  ): Prisma.preventive_maintenance_scheduleWhereInput {
    return {
      account_id: { in: accountIds },
      ...(query.type && {
        type: { contains: query.type, mode: "insensitive" },
      }),
      ...(query.pm_task_description && {
        pm_task_description: {
          contains: query.pm_task_description,
          mode: "insensitive",
        },
      }),
      ...(query.frequency_interval && {
        frequency_interval: query.frequency_interval,
      }),
      ...(query.frequency_type && {
        frequency_type: { equals: query.frequency_type, mode: "insensitive" },
      }),
      ...(query.status &&
        query.status !== "All" && {
          status: {
            contains: query.status,
            mode: Prisma.QueryMode.insensitive,
          },
        }),
      ...this.buildFacilityFilter(query),
      ...this.buildEventDateFilter(
        "performed_date",
        query.lastEvent_performed_date
      ),
      ...this.buildEventDateFilter(
        "next_due_date",
        query.nextEvent_next_due_date
      ),
      ...this.buildEquipmentFilter(query),
    };
  }

  private buildCombinedDOTFilters(
    query: CombinedRecordsQuery,
    accountIds: number[]
  ): Prisma.dot_inspectionWhereInput {
    return {
      account_id: { in: accountIds },
      ...(query.inspection_result && {
        inspection_result: {
          contains: query.inspection_result,
          mode: "insensitive",
        },
      }),
      ...(query.inspector_name && {
        inspector_name: { contains: query.inspector_name, mode: "insensitive" },
      }),
      ...(query.notes && {
        notes: { contains: query.notes, mode: "insensitive" },
      }),
      ...(query.status &&
        query.status !== "All" && {
          status: {
            contains: query.status,
            mode: Prisma.QueryMode.insensitive,
          },
        }),
      ...(query.inspection_status && {
        status: { contains: query.inspection_status, mode: "insensitive" },
      }),
      ...(query.type && {
        type: { contains: query.type, mode: "insensitive" },
      }),

      // FIXED: properly handle compliance filter
      ...(query.compliance && {
        compliance: {
          contains: query.compliance,
          mode: "insensitive",
        },
      }),

      ...this.buildDOTDateFilter("inspection_date", query.inspection_date),
      ...this.buildDOTDateFilter("valid_through", query.valid_through),
      ...this.buildDOTDateFilter(
        "next_inspection_due",
        query.next_inspection_due
      ),
      ...this.buildEquipmentFilter(query),
      ...(query.violation_code || query.severity_level
        ? {
            dot_inspection_violation: {
              some: {
                ...(query.violation_code && {
                  violation_code: {
                    contains: query.violation_code,
                    mode: "insensitive" as const,
                  },
                }),
                ...(query.severity_level && {
                  severity_level: {
                    contains: query.severity_level,
                    mode: "insensitive" as const,
                  },
                }),
              },
            },
          }
        : {}),
    };
  }

  private async fetchCombinedData(params: {
    shouldQueryPM: boolean;
    shouldQueryDOT: boolean;
    pmFilters: Prisma.preventive_maintenance_scheduleWhereInput;
    dotFilters: Prisma.dot_inspectionWhereInput;
    skip: number;
    pmTake: number;
    dotTake: number;
    query: CombinedRecordsQuery;
  }) {
    const {
      shouldQueryPM,
      shouldQueryDOT,
      pmFilters,
      dotFilters,
      skip,
      pmTake,
      dotTake,
      query,
    } = params;

    console.log(shouldQueryPM, shouldQueryDOT);

    const pmPromise = shouldQueryPM
      ? prisma.preventive_maintenance_schedule.findMany({
          where: pmFilters,
          skip,
          take: pmTake,
          orderBy: { pm_schedule_id: "desc" },
          include: {
            equipment: {
              select: {
                equipment_id: true,
                unit_number: true,
                equipment_type_lookup_ref: { select: { equipment_type: true } },
              },
            },
            facility_lookup: {
              select: { facility_code: true, facility_name: true },
            },
            account: {
              select: {
                account_id: true,
                account_number: true,
                account_name: true,
              },
            },
            preventive_maintenance_events: {
              select: {
                pm_event_id: true,
                performed_date: true,
                next_due_date: true,
                status: true,
              },
            },
          },
        })
      : Promise.resolve([]);

    const dotPromise = shouldQueryDOT
      ? prisma.dot_inspection.findMany({
          where: dotFilters,
          skip,
          take: dotTake,
          orderBy: buildOrderByFromSort(
            query.sort,
            DOT_INSPECTION_SORT_FIELDS,
            "dot_inspection_id"
          ),
          select: {
            dot_inspection_id: true,
            equipment_id: true,
            account_id: true,
            schedule_agreement_id: true,
            inspection_date: true,
            inspector_name: true,
            inspection_result: true,
            notes: true,
            next_inspection_due: true,
            valid_through: true,
            compliance: true,
            created_at: true,
            updated_at: true,
            status: true,
            type: true,
            equipment: {
              select: {
                unit_number: true,
                equipment_type_lookup_ref: { select: { equipment_type: true } },
              },
            },
            dot_inspection_violation: {
              select: {
                dot_inspection_violation_id: true,
                violation_code: true,
                description: true,
                severity_level: true,
                corrective_action_taken: true,
              },
            },
          },
        })
      : Promise.resolve([]);

    const pmCountPromise = shouldQueryPM
      ? prisma.preventive_maintenance_schedule.count({ where: pmFilters })
      : Promise.resolve(0);

    const dotCountPromise = shouldQueryDOT
      ? prisma.dot_inspection.count({ where: dotFilters })
      : Promise.resolve(0);

    return Promise.all([
      pmPromise,
      dotPromise,
      pmCountPromise,
      dotCountPromise,
    ]);
  }

  private transformPMData(
    pmSchedules: PMScheduleWithEvents[],
    latestServiceRequests: Record<
      number,
      {
        service_request_id: number;
        workorder_id?: number;
        workorder_ref_id?: string;
      }
    >
  ): (FlattenedPM & {
    service_request_id?: number;
    workorder_id?: number;
    workorder_ref_id?: string;
  })[] {
    return pmSchedules.map((s) => {
      const lastEvent =
        s.preventive_maintenance_events.find(
          (ev) => ev.status === "COMPLETED"
        ) ?? null;
      const nextEvent =
        [...s.preventive_maintenance_events]
          .reverse()
          .find((ev) => ev.status === "SCHEDULED") ?? null;

      const serviceInfo = s.equipment_id
        ? latestServiceRequests[s.equipment_id]
        : undefined;

      return {
        ...flattenObject({
          pm_schedule_id: s.pm_schedule_id,
          pm_task_description: s.pm_task_description,
          type: s.type,
          status: s.status,
          frequency_interval: s.frequency_interval,
          frequency_type: s.frequency_type,
          equipment: s.equipment,
          facility_lookup: s.facility_lookup,
          account: s.account,
          service_request_id: serviceInfo?.service_request_id ?? null,
          workorder_id: serviceInfo?.workorder_id ?? null,
          workorder_ref_id: serviceInfo?.workorder_ref_id ?? null,
          lastEvent_performed_date:
            lastEvent?.performed_date?.toISOString() ?? null,
          nextEvent_next_due_date:
            nextEvent?.next_due_date?.toISOString() ?? null,
        }),
        recordType: "PM",
      };
    });
  }

  private transformDOTData(
    dotInspections: DOTInspectionWithRelations[]
  ): CombinedRecord[] {
    return dotInspections.map((i) => ({
      ...flattenObject({
        dot_inspection_id: i.dot_inspection_id,
        equipment_id: i.equipment_id,
        account_id: i.account_id,
        schedule_agreement_id: i.schedule_agreement_id,
        inspection_date: i.inspection_date?.toISOString() ?? null,
        inspector_name: i.inspector_name,
        inspection_result: i.inspection_result,
        notes: i.notes,
        status: i.status,
        valid_through: i.valid_through?.toISOString() ?? null,
        compliance: i.compliance,
        next_inspection_due: i.next_inspection_due?.toISOString() ?? null,
        created_at: i.created_at?.toISOString() ?? null,
        updated_at: i.updated_at?.toISOString() ?? null,
        equipment: i.equipment,
        dot_inspection_violation: i.dot_inspection_violation,
        type: i.type,
      }),
      recordType: "DOT",
    }));
  }

  public async getCombinedRecords(query: CombinedRecordsQuery) {
    const accountIdsParam = query.accountIds;
    const { page, perPage, skip } = getPagination(query);

    if (!accountIdsParam) throw new Error("MISSING_ACCOUNT_IDS");

    const accountIds = accountIdsParam
      .split(",")
      .map((id) => Number(id.trim()))
      .filter((id) => Number.isFinite(id));

    if (!accountIds.length) throw new Error("INVALID_ACCOUNT_IDS");

    const { shouldQueryPM, shouldQueryDOT } = this.determineQueryTables(query);
    const pmFilters = this.buildCombinedPMFilters(query, accountIds);
    const dotFilters = this.buildCombinedDOTFilters(query, accountIds);

    let pmTake: number;
    let dotTake: number;

    if (shouldQueryPM && shouldQueryDOT) {
      // Both queries are needed, split the perPage equally
      pmTake = Math.floor(perPage / 2);
      dotTake = perPage - pmTake;
    } else if (shouldQueryPM && !shouldQueryDOT) {
      // Only PM query is needed, use full perPage
      pmTake = perPage;
      dotTake = 0;
    } else if (!shouldQueryPM && shouldQueryDOT) {
      // Only DOT query is needed, use full perPage
      pmTake = 0;
      dotTake = perPage;
    } else {
      // Neither query is needed (edge case)
      pmTake = 0;
      dotTake = 0;
    }

    const [pmSchedules, dotInspections, totalPMCount, totalDOTCount] =
      await this.fetchCombinedData({
        shouldQueryPM,
        shouldQueryDOT,
        pmFilters,
        dotFilters,
        skip,
        pmTake,
        dotTake,
        query,
      });

    const pmEquipmentIds = pmSchedules
      .map((s) => s.equipment_id)
      .filter((id): id is number => id !== null);

    const latestServiceRequests =
      await this.getLatestServiceRequestsForEquipment(pmEquipmentIds);

    const pmData = this.transformPMData(pmSchedules, latestServiceRequests);
    const dotData = this.transformDOTData(dotInspections);
    const combinedData = [...pmData, ...dotData];
    const counts = this.calculateCounts(
      pmData,
      dotData,
      totalPMCount,
      totalDOTCount
    );

    return {
      data: combinedData,
      page,
      perPage,
      totalPM: totalPMCount,
      totalDOT: totalDOTCount,
      totalRecords: totalPMCount + totalDOTCount,
      counts,
    };
  }

  private buildPMScheduleSelect() {
    return {
      pm_schedule_id: true,
      type: true,
      pm_task_description: true,
      frequency_interval: true,
      frequency_type: true,
      status: true,
      comments: true,
      account: { select: { account_id: true, account_name: true } },
      equipment: {
        select: {
          equipment_id: true,
          unit_number: true,
          equipment_type_lookup_ref: { select: { equipment_type: true } },
          telematics: {
            select: {
              latitude: true,
              longitude: true,
              address: true,
              motion_status: true,
            },
          },
        },
      },
      facility_lookup: {
        select: { facility_code: true, facility_name: true },
      },
      preventive_maintenance_events: {
        select: {
          pm_event_id: true,
          performed_date: true,
          next_due_date: true,
          work_performed: true,
          location: true,
          vendor_technician: true,
          time_taken: true,
          status: true,
          notes: true,
          pm_parts_used: {
            select: {
              part_name: true,
              part_quantity: true,
              part_cost: true,
            },
            orderBy: { part_name: "asc" as const },
          },
        },
        orderBy: { performed_date: "asc" as const },
      },
    };
  }

  private transformTelematics(telematics: TelematicsData | null | undefined) {
    if (!telematics) return null;

    return {
      latitude: telematics.latitude ? Number(telematics.latitude) : null,
      longitude: telematics.longitude ? Number(telematics.longitude) : null,
      address: telematics?.address ?? "",
      motion_status: telematics?.motion_status ?? "",
    };
  }

  private buildTimeline(
    events: {
      pm_event_id: number;
      performed_date: Date | null;
      next_due_date: Date | null;
      status: string;
      notes: string | null;
    }[]
  ) {
    return events.map((ev) => ({
      pmEventId: ev.pm_event_id,
      performedDate: ev.performed_date ? ev.performed_date.toISOString() : null,
      dueDate: ev.next_due_date ? ev.next_due_date.toISOString() : null,
      status: ev.status,
      notes: ev.notes,
    }));
  }

  private buildServiceHistory(
    events: {
      pm_event_id: number;
      performed_date: Date | null;
      next_due_date: Date | null;
      status: string;
      work_performed: string | null;
      location: string | null;
      vendor_technician: string | null;
      time_taken: number | null;
      notes: string | null;
      pm_parts_used: {
        part_name: string | null;
        part_quantity: number | null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        part_cost: any;
      }[];
    }[]
  ) {
    return events
      .filter((ev) => ev.status !== "SCHEDULED")
      .sort((a, b) => {
        const timeA = a.performed_date ? a.performed_date.getTime() : 0;
        const timeB = b.performed_date ? b.performed_date.getTime() : 0;
        return timeB - timeA;
      })
      .map((ev) => ({
        pmEventId: ev.pm_event_id,
        performedDate: ev.performed_date
          ? ev.performed_date.toISOString()
          : null,
        dueDate: ev.next_due_date ? ev.next_due_date.toISOString() : null,
        workPerformed: ev.work_performed,
        location: ev.location,
        vendorTechnician: ev.vendor_technician,
        timeTaken: ev.time_taken?.toString() ?? null,
        status: ev.status,
        notes: ev.notes,
        partsReplaced: ev.pm_parts_used.map(
          (p: {
            part_name: string | null;
            part_quantity: number | null;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            part_cost: any;
          }) => ({
            ...p,
            part_cost: p.part_cost ? Number(p.part_cost) : null,
          })
        ),
      }));
  }

  public async getPMScheduleDetail(
    pmScheduleId: number
  ): Promise<PMScheduleDetail> {
    const schedule = await prisma.preventive_maintenance_schedule.findUnique({
      where: { pm_schedule_id: pmScheduleId },
      select: this.buildPMScheduleSelect(),
    });

    if (!schedule) {
      throw new Error("NO_PM_SCHEDULE_FOUND");
    }

    const telematics = this.transformTelematics(schedule.equipment?.telematics);
    const timeline = this.buildTimeline(schedule.preventive_maintenance_events);
    const serviceHistory = this.buildServiceHistory(
      schedule.preventive_maintenance_events
    );

    return {
      pmScheduleId: schedule.pm_schedule_id,
      pmType: schedule.type,
      taskDescription: schedule.pm_task_description ?? "",
      frequency: `${schedule.frequency_interval} ${schedule.frequency_type}`,
      scheduleStatus: schedule.status,
      comments: schedule.comments,
      account: {
        account_id: schedule.account.account_id,
        account_name: schedule.account.account_name ?? "",
      },
      equipment: schedule.equipment
        ? {
            equipment_id: schedule.equipment.equipment_id,
            unit_number: schedule.equipment.unit_number,
            equipment_type_lookup_ref: schedule.equipment
              .equipment_type_lookup_ref ?? {
              equipment_type: "",
            },
            telematics,
          }
        : null,
      facility: schedule.facility_lookup ?? null,
      timeline,
      serviceHistory,
    };
  }

  public async getDOTInspectionById(dotInspectionId: number) {
    return prisma.dot_inspection.findUnique({
      where: { dot_inspection_id: dotInspectionId },
      select: {
        dot_inspection_id: true,
        equipment_id: true,
        account_id: true,
        schedule_agreement_id: true,
        inspection_date: true,
        inspector_name: true,
        inspection_result: true,
        notes: true,
        next_inspection_due: true,
        valid_through: true,
        compliance: true,
        created_at: true,
        updated_at: true,
        status: true,
        equipment: {
          select: {
            unit_number: true,
            equipment_type_lookup_ref: { select: { equipment_type: true } },
          },
        },
        dot_inspection_violation: {
          select: {
            dot_inspection_violation_id: true,
            violation_code: true,
            description: true,
            severity_level: true,
            corrective_action_taken: true,
          },
          orderBy: { dot_inspection_violation_id: "asc" },
        },
      },
    });
  }

  private async fetchDownloadData(
    shouldQueryPM: boolean,
    shouldQueryDOT: boolean,
    pmFilters: Prisma.preventive_maintenance_scheduleWhereInput,
    dotFilters: Prisma.dot_inspectionWhereInput
  ) {
    const pmPromise = shouldQueryPM
      ? prisma.preventive_maintenance_schedule.findMany({
          where: pmFilters,
          include: {
            equipment: {
              select: {
                equipment_id: true,
                unit_number: true,
                equipment_type_lookup_ref: {
                  select: { equipment_type: true },
                },
              },
            },
            facility_lookup: {
              select: { facility_code: true, facility_name: true },
            },
            account: {
              select: {
                account_id: true,
                account_name: true,
              },
            },
            preventive_maintenance_events: {
              select: {
                pm_event_id: true,
                performed_date: true,
                next_due_date: true,
                status: true,
              },
            },
          },
        })
      : Promise.resolve([]);

    const dotPromise = shouldQueryDOT
      ? prisma.dot_inspection.findMany({
          where: dotFilters,
          select: {
            dot_inspection_id: true,
            equipment_id: true,
            account_id: true,
            schedule_agreement_id: true,
            inspection_date: true,
            inspector_name: true,
            inspection_result: true,
            notes: true,
            next_inspection_due: true,
            valid_through: true,
            compliance: true,
            created_at: true,
            updated_at: true,
            status: true,
            type: true,
            equipment: {
              select: {
                unit_number: true,
                equipment_type_lookup_ref: {
                  select: { equipment_type: true },
                },
              },
            },
            dot_inspection_violation: {
              select: {
                dot_inspection_violation_id: true,
                violation_code: true,
                description: true,
                severity_level: true,
                corrective_action_taken: true,
              },
            },
          },
        })
      : Promise.resolve([]);

    return Promise.all([pmPromise, dotPromise]);
  }

  private transformDownloadPMData(
    pmSchedules: PMScheduleWithEvents[]
  ): CombinedRecord[] {
    return pmSchedules.map((s) => {
      const lastEvent =
        s.preventive_maintenance_events.find(
          (ev) => ev.status === "COMPLETED"
        ) ?? null;
      const nextEvent =
        [...s.preventive_maintenance_events]
          .reverse()
          .find((ev) => ev.status === "SCHEDULED") ?? null;

      return {
        ...flattenObject({
          pm_schedule_id: s.pm_schedule_id,
          pm_task_description: s.pm_task_description,
          type: s.type,
          status: s.status,
          frequency_interval: s.frequency_interval,
          frequency_type: s.frequency_type,
          equipment: s.equipment,
          facility_lookup: s.facility_lookup,
          lastEvent_performed_date:
            lastEvent?.performed_date?.toISOString() ?? null,
          nextEvent_next_due_date:
            nextEvent?.next_due_date?.toISOString() ?? null,
        }),
        recordType: "PM",
      };
    });
  }

  private generateFilename(
    shouldQueryPM: boolean,
    shouldQueryDOT: boolean
  ): string {
    let filenameBase = "records";
    if (shouldQueryPM && !shouldQueryDOT) filenameBase = "pm_records";
    if (shouldQueryDOT && !shouldQueryPM) filenameBase = "dot_records";
    if (shouldQueryPM && shouldQueryDOT) filenameBase = "combined_records";

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    return `${filenameBase}_${timestamp}.xlsx`;
  }

  private buildExcelColumns(requestedColumns: ColumnDefinition[]) {
    return requestedColumns.map(({ label, field }) => {
      switch (field) {
        case "sno":
          return { header: label, key: field, width: 8 };
        case "recordType":
          return { header: label, key: field, width: 10 };
        case "lastEvent_performed_date":
        case "nextEvent_next_due_date":
        case "inspection_date":
        case "valid_through":
        case "next_inspection_due":
        case "created_at":
        case "updated_at":
          return {
            header: label,
            key: field,
            width: 20,
            formatter: (val: unknown) =>
              val ? new Date(val as string).toLocaleString() : "N/A",
          };
        case "compliance":
          return {
            header: label,
            key: field,
            width: 15,
            formatter: (val: unknown) =>
              val && typeof val === "string" ? `${val}%` : "N/A",
          };
        default:
          return { header: label, key: field, width: 20 };
      }
    });
  }

  private formatViolationData(record: CombinedRecord): string {
    if (record.recordType === "DOT" && record.dot_inspection_violation) {
      const violations = record.dot_inspection_violation;
      return violations.length > 0
        ? violations
            .map((v) => `${v.violation_code}: ${v.description}`)
            .join("; ")
        : "No Violations";
    }
    return "N/A";
  }

  private formatEquipmentData(record: CombinedRecord, field: string): string {
    switch (field) {
      case "equipment_unit_number":
        return record.equipment_unit_number ?? "N/A";
      case "equipment_equipment_type_lookup_ref_equipment_type":
        return (
          record.equipment_equipment_type_lookup_ref_equipment_type ?? "N/A"
        );
      default:
        return "N/A";
    }
  }

  private formatFacilityData(record: CombinedRecord, field: string): string {
    switch (field) {
      case "facility_facility_name":
        return record.facility_lookup_facility_name ?? "N/A";
      case "facility_facility_code":
        return record.facility_lookup_facility_code ?? "N/A";
      default:
        return "N/A";
    }
  }

  private formatFieldValue(
    record: CombinedRecord,
    field: string,
    index: number,
    skip: number
  ): unknown {
    switch (field) {
      case "sno":
        return index + 1 + (skip || 0);
      case "equipment_unit_number":
      case "equipment_equipment_type_lookup_ref_equipment_type":
        return this.formatEquipmentData(record, field);
      case "facility_facility_name":
      case "facility_facility_code":
        return this.formatFacilityData(record, field);
      case "dot_inspection_violation":
        return this.formatViolationData(record);
      default:
        return field in record ? record[field] ?? "" : "";
    }
  }

  private formatExcelData(
    combinedData: CombinedRecord[],
    requestedColumns: ColumnDefinition[],
    skip: number
  ) {
    return combinedData.map((record: CombinedRecord, index) => {
      const row: Record<string, unknown> = {};

      requestedColumns.forEach(({ field }) => {
        row[field] = this.formatFieldValue(record, field, index, skip);
      });

      return row;
    });
  }

  public async downloadCombinedRecords(
    query: CombinedRecordsQuery & { recordTypes?: string[] },
    requestedColumns: ColumnDefinition[]
  ): Promise<{ buffer: Buffer; filename: string }> {
    const { skip } = getPagination(query);

    if (!query.accountIds) throw new Error("MISSING_ACCOUNT_IDS");

    const { pm: excludedPmIds, dot: excludedDotIds } =
      this.parseExcludedIds(query);

    const accountIds = query.accountIds
      .split(",")
      .map((id) => Number(id.trim()))
      .filter((id) => Number.isFinite(id));

    if (!accountIds.length) throw new Error("INVALID_ACCOUNT_IDS");

    const requestedRecordTypes = query.recordTypes ?? ["PM", "DOT"];
    const shouldQueryPM = requestedRecordTypes.includes("PM");
    const shouldQueryDOT = requestedRecordTypes.includes("DOT");

    const pmFilters = this.buildPMFilters(query, accountIds, excludedPmIds);
    const dotFilters = this.buildDOTFilters(query, accountIds, excludedDotIds);

    const [pmSchedules, dotInspections] = await this.fetchDownloadData(
      shouldQueryPM,
      shouldQueryDOT,
      pmFilters,
      dotFilters
    );

    const pmData = shouldQueryPM
      ? this.transformDownloadPMData(pmSchedules)
      : [];
    const dotData = shouldQueryDOT ? this.transformDOTData(dotInspections) : [];
    const combinedData: CombinedRecord[] = [...pmData, ...dotData];

    const filename = this.generateFilename(shouldQueryPM, shouldQueryDOT);
    const columns = this.buildExcelColumns(requestedColumns);
    const formattedData = this.formatExcelData(
      combinedData,
      requestedColumns,
      skip
    );

    const exporter = new ExcelExporter();
    exporter.generateWorkbook({
      sheetName: filename.replace("_", " ").toUpperCase(),
      columns,
      data: formattedData,
      filename,
    });

    const buffer = await exporter.writeToBuffer();

    return { buffer, filename };
  }
  private buildPMsByEquipmentFilters(
    query: PMsByEquipmentQuery,
    equipmentId: number
  ) {
    return {
      equipment_id: equipmentId,
      ...(query.type && {
        type: { contains: query.type, mode: Prisma.QueryMode.insensitive },
      }),
      ...(query.pm_task_description && {
        pm_task_description: {
          contains: query.pm_task_description,
          mode: Prisma.QueryMode.insensitive,
        },
      }),
      ...(query.frequency_interval && {
        frequency_interval: query.frequency_interval,
      }),
      ...(query.frequency_type && {
        frequency_type: {
          equals: query.frequency_type,
          mode: Prisma.QueryMode.insensitive,
        },
      }),
      ...(query.status &&
        query.status !== "All" && {
          status: {
            contains: query.status,
            mode: Prisma.QueryMode.insensitive,
          },
        }),
      ...(query.unit_number || query.equipment_type
        ? {
            equipment: {
              ...(query.unit_number && {
                unit_number: {
                  contains: query.unit_number,
                  mode: Prisma.QueryMode.insensitive,
                },
              }),
              ...(query.equipment_type && {
                equipment_type_lookup_ref: {
                  equipment_type: {
                    contains: query.equipment_type,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              }),
            },
          }
        : {}),
      ...(query.facility_code || query.facility_name
        ? {
            facility_lookup: {
              ...(query.facility_code && {
                facility_code: {
                  contains: query.facility_code,
                  mode: Prisma.QueryMode.insensitive,
                },
              }),
              ...(query.facility_name && {
                facility_name: {
                  contains: query.facility_name,
                  mode: Prisma.QueryMode.insensitive,
                },
              }),
            },
          }
        : {}),
    };
  }

  private async fetchPMsByEquipmentCounts(
    filters: Prisma.preventive_maintenance_scheduleWhereInput,
    today: Date
  ) {
    const since = new Date();
    since.setDate(today.getDate() - 30);

    return Promise.all([
      prisma.preventive_maintenance_schedule.count({ where: filters }),
      prisma.preventive_maintenance_schedule.count({
        where: {
          ...filters,
          preventive_maintenance_events: {
            some: { status: "SCHEDULED", next_due_date: { lte: today } },
          },
        },
      }),
      prisma.preventive_maintenance_schedule.count({
        where: {
          ...filters,
          preventive_maintenance_events: {
            some: { status: "SCHEDULED", next_due_date: { lt: today } },
          },
        },
      }),
      prisma.preventive_maintenance_schedule.count({
        where: {
          ...filters,
          preventive_maintenance_events: {
            some: { status: "COMPLETED", performed_date: { gte: since } },
          },
        },
      }),
    ]);
  }

  private transformPMsByEquipmentData(pmSchedules: PMScheduleWithRelations[]) {
    return pmSchedules.map((schedule) => {
      const events = schedule.preventive_maintenance_events;
      const lastEvent = events.find((ev) => ev.status === "COMPLETED") ?? null;
      const nextEvent =
        [...events].reverse().find((ev) => ev.status === "SCHEDULED") ?? null;

      return flattenObject({
        pm_schedule_id: schedule.pm_schedule_id,
        pm_task_description: schedule.pm_task_description,
        frequency_interval: schedule.frequency_interval,
        frequency_type: schedule.frequency_type,
        type: schedule.type,
        status: schedule.status,
        equipment: schedule.equipment,
        facility_lookup: schedule.facility_lookup,
        lastEvent_performed_date:
          lastEvent?.performed_date?.toISOString() ?? null,
        lastEvent_status: lastEvent?.status ?? null,
        nextEvent_next_due_date:
          nextEvent?.next_due_date?.toISOString() ?? null,
        nextEvent_status: nextEvent?.status ?? null,
      });
    });
  }

  public async getPMsByEquipment(query: PMsByEquipmentQuery) {
    const equipmentIdParam = query.equipmentId;
    const {
      page,
      perPage,
      skip: defaultSkip,
      take: defaultTake,
    } = getPagination(query);
    const take = query.fetchAll ? undefined : defaultTake;
    const skip = query.fetchAll ? undefined : defaultSkip;

    if (!equipmentIdParam) throw new Error("MISSING_EQUIPMENT_ID");

    const equipmentId = Number(equipmentIdParam);
    if (!Number.isFinite(equipmentId)) throw new Error("INVALID_EQUIPMENT_ID");

    const filters = this.buildPMsByEquipmentFilters(query, equipmentId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [counts, pmSchedules] = await Promise.all([
      this.fetchPMsByEquipmentCounts(filters, today),
      prisma.preventive_maintenance_schedule.findMany({
        where: filters,
        skip,
        take,
        select: {
          pm_schedule_id: true,
          pm_task_description: true,
          frequency_interval: true,
          frequency_type: true,
          type: true,
          status: true,
          equipment: {
            select: {
              equipment_id: true,
              unit_number: true,
              equipment_type_lookup_ref: { select: { equipment_type: true } },
            },
          },
          facility_lookup: {
            select: { facility_code: true, facility_name: true },
          },
          preventive_maintenance_events: {
            select: {
              pm_event_id: true,
              performed_date: true,
              next_due_date: true,
              status: true,
            },
          },
        },
        orderBy: { pm_schedule_id: "desc" },
      }),
    ]);

    const [totalUnits, unitsComingDue, unitsOverdue, unitsRecentlyCompleted] =
      counts;

    const flattenedTransformed = this.transformPMsByEquipmentData(pmSchedules);

    return {
      data: flattenedTransformed,
      totalUnits,
      page,
      perPage,
      counts: {
        totalUnits,
        unitsComingDue,
        unitsOverdue,
        unitsRecentlyCompleted,
      },
    };
  }
}
