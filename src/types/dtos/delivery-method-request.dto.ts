// src/types/dtos/delivery-method-request.dto.ts
export interface CreateDeliveryMethodRequestDTO {
  method_type: string;
  status?: string;
  created_by?: number | null
}

export interface UpdateDeliveryMethodRequestDTO {
  method_type?: string;
  status?: string;
  created_by?: number | null
}

export interface FetchDeliveryMethodsRequestDTO {
  method_type?: string;
  status?: string;
  created_by?: number
}

export interface GetDeliveryMethodByIdRequestDTO {
  id: number
}
