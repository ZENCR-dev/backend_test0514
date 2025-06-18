import { MedicineDto } from "./dto/medicine.dto";
import {
  MedicineResponseV12Dto,
  ApiResponseV12Dto,
} from "./dto/medicine-response-v12.dto";

/**
 * 转换为 v1.2 API 响应格式 - 药品列表响应
 */
export function transformToMedicineResponseV12(
  data: MedicineDto[],
  total: number,
  page: number,
  limit: number,
  totalPages: number,
): MedicineResponseV12Dto {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    },
  };
}

/**
 * 创建错误响应 - v1.2格式
 */
export function createMedicineErrorResponseV12(
  code: string,
  message: string,
  details?: any,
): ApiResponseV12Dto<never> {
  return {
    success: false,
    error: {
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
}
