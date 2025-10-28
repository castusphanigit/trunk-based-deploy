// src/types/dtos/delivery-method-response.dto.ts
export interface DeliveryMethodResponseDTO {
  delivery_id: number;
  method_type: string;
  status: string;
  created_at: Date;
  created_by: number | null
}
