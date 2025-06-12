import { IsOptional, IsString, IsNumber, Min, IsEnum } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { AccountStatus } from "@prisma/client";

export class QueryClinicAccountDto {
  @ApiPropertyOptional({
    description: "页码",
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: "每页数量",
    example: 10,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: "按诊所名称搜索",
    example: "中医",
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: "按状态筛选",
    enum: AccountStatus,
    example: AccountStatus.active,
  })
  @IsOptional()
  @IsEnum(AccountStatus)
  status?: AccountStatus;

  @ApiPropertyOptional({
    description: "按诊所ID筛选",
    example: "clinic-uuid-123",
  })
  @IsOptional()
  @IsString()
  clinicId?: string;

  @ApiPropertyOptional({
    description: "排序字段",
    example: "createdAt",
  })
  @IsOptional()
  @IsString()
  sortBy?: string = "createdAt";

  @ApiPropertyOptional({
    description: "排序方向",
    example: "desc",
    enum: ["asc", "desc"],
  })
  @IsOptional()
  @IsString()
  sortOrder?: "asc" | "desc" = "desc";
}
