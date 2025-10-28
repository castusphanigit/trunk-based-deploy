export interface CreateAlertCategoryRequestDto {
  category_name: string;   // required
  status: string;          // required, e.g., "ACTIVE" / "INACTIVE"
  created_by?: number;     // optional
  updated_by?: number    // optional
}
