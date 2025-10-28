import prisma from "../config/database.config";
import { CreateAlertTypeLookupRequestDto } from "../types/dtos/alert.type.lookup.request.dto";
import { AlertTypeLookupResponseDto } from "../types/dtos/alert.type.lookup.response.dto";

export class AlertTypeLookupService {
  public async createAlertType(
    dto: CreateAlertTypeLookupRequestDto
  ): Promise<AlertTypeLookupResponseDto> {
    const result = await prisma.alert_type_lookup.create({
      data: {
        event_name: dto.event_name,
        event_type: dto.event_type,
        metric_value: dto.metric_value ?? 0,
        operation_type: dto.operation_type,
        status: dto.status ?? "ACTIVE",
        customer_id: dto.customer_id,
        alert_category_lookup_id: dto.alert_category_lookup_id,
        created_at: new Date(),
        updated_at: new Date(),
      },
      select: {
        alert_type_lookup_id: true,
        event_name: true,
        event_type: true,
        metric_value: true,
        operation_type: true,
        status: true,
        customer_id: true,
        alert_category_lookup_id: true,
        created_at: true,
        updated_at: true,
      },
    });

    return {
      ...result,
      metric_value: result.metric_value ?? 0,
    };
  }

  public async getAllAlertTypes(): Promise<AlertTypeLookupResponseDto[]> {
    const results = await prisma.alert_type_lookup.findMany({
      where: { status: { equals: "ACTIVE", mode: "insensitive" } },
      orderBy: { alert_type_lookup_id: "asc" },
      select: {
        alert_type_lookup_id: true,
        event_name: true,
        event_type: true,
        metric_value: true,
        operation_type: true,
        status: true,
        customer_id: true,
        alert_category_lookup_id: true,
        created_at: true,
        updated_at: true,
      },
    });

    return results.map((item) => ({
      ...item,
      metric_value: item.metric_value ?? 0,
    }));
  }

  public async getAlertTypesByCategoryId(
    categoryId: number
  ): Promise<AlertTypeLookupResponseDto[]> {
    const results = await prisma.alert_type_lookup.findMany({
      where: {
        alert_category_lookup_id: categoryId,
        status: { equals: "ACTIVE", mode: "insensitive" },
      },
      orderBy: { alert_type_lookup_id: "asc" },
      select: {
        alert_type_lookup_id: true,
        event_name: true,
        event_type: true,
        metric_value: true,
        operation_type: true,
        status: true,
        customer_id: true,
        alert_category_lookup_id: true,
        created_at: true,
        updated_at: true,
      },
    });
    return results.map((item) => ({
      ...item,
      metric_value: item.metric_value ?? 0,
    }));
  }
}
