import { ApiProperty } from "@nestjs/swagger";
import { MedicineDto } from "./medicine.dto";

/**
 * 分页元数据 - v1.2格式
 */
export class MedicinePaginationMetaDto {
  @ApiProperty({ description: "总记录数", example: 100 })
  total: number;

  @ApiProperty({ description: "当前页码", example: 1 })
  page: number;

  @ApiProperty({ description: "每页记录数", example: 20 })
  limit: number;

  @ApiProperty({ description: "总页数", example: 5 })
  totalPages: number;
}

/**
 * v1.2 API响应基础结构
 */
export class ApiResponseV12Dto<T = any> {
  @ApiProperty({ description: "请求是否成功" })
  success: boolean;

  @ApiProperty({ description: "响应数据", required: false })
  data?: T;

  @ApiProperty({ description: "错误信息", required: false })
  error?: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
  };

  @ApiProperty({ description: "元数据", required: false })
  meta?: {
    timestamp: string;
    pagination?: MedicinePaginationMetaDto;
  };
}

/**
 * Medicine API v1.2响应格式
 */
export class MedicineResponseV12Dto extends ApiResponseV12Dto<MedicineDto[]> {
  @ApiProperty({ description: "药品数据列表", type: [MedicineDto] })
  data: MedicineDto[];

  @ApiProperty({
    description: "元数据",
    example: {
      timestamp: "2025-06-18T07:00:00.000Z",
      pagination: {
        total: 100,
        page: 1,
        limit: 20,
        totalPages: 5,
      },
    },
  })
  meta: {
    timestamp: string;
    pagination: MedicinePaginationMetaDto;
  };
}
