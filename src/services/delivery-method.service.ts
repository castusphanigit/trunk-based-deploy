// src/services/delivery-method.service.ts
import prisma from "../config/database.config";
import {
  CreateDeliveryMethodRequestDTO,
  UpdateDeliveryMethodRequestDTO,
  FetchDeliveryMethodsRequestDTO,
  GetDeliveryMethodByIdRequestDTO,
} from "../types/dtos/delivery-method-request.dto";
import { DeliveryMethodResponseDTO } from "../types/dtos/delivery-method-response.dto";

export class DeliveryMethodService {
 public async createDeliveryMethod(
    dto: CreateDeliveryMethodRequestDTO
  ): Promise<DeliveryMethodResponseDTO> {
    return prisma.delivery_method_lookup.create({
      data: {
        method_type: dto.method_type,
        status: dto.status ?? "ACTIVE",
        created_by: dto.created_by ?? null,
      },
      select: {
        delivery_id: true,
        method_type: true,
        status: true,
        created_at: true,
        created_by: true,
      },
    });
  }

  public async fetchDeliveryMethods(
    dto: FetchDeliveryMethodsRequestDTO
  ): Promise<DeliveryMethodResponseDTO[]> {
    const filters: Record<string, unknown> = {
      ...(dto.method_type && {
        method_type: { contains: String(dto.method_type), mode: "insensitive" },
      }),
      ...(dto.status && {
        status: { contains: String(dto.status), mode: "insensitive" },
      }),
      ...(dto.created_by && { created_by: dto.created_by }),
    };

    return prisma.delivery_method_lookup.findMany({
      where: filters,
      orderBy: { delivery_id: "asc" },
      select: {
        delivery_id: true,
        method_type: true,
        status: true,
        created_at: true,
        created_by: true,
      },
    });
  }

  public async getDeliveryMethodById(
    dto: GetDeliveryMethodByIdRequestDTO
  ): Promise<DeliveryMethodResponseDTO | null> {
    return prisma.delivery_method_lookup.findUnique({
      where: { delivery_id: dto.id },
      select: {
        delivery_id: true,
        method_type: true,
        status: true,
        created_at: true,
        created_by: true,
      },
    });
  }

  public async updateDeliveryMethod(
    id: number,
    dto: UpdateDeliveryMethodRequestDTO
  ): Promise<DeliveryMethodResponseDTO> {
    return prisma.delivery_method_lookup.update({
      where: { delivery_id: id },
      data: {
        ...(dto.method_type && { method_type: dto.method_type }),
        ...(dto.status && { status: dto.status }),
        ...(dto.created_by && { created_by: dto.created_by }),
      },
      select: {
        delivery_id: true,
        method_type: true,
        status: true,
        created_at: true,
        created_by: true,
      },
    });
  }
}
