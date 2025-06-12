import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
  IsEnum,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { AccountStatus } from "@prisma/client";

// 使用Prisma生成的AccountStatus枚举，与Schema保持一致
// AccountStatus: { active, suspended, frozen }

export class CreateClinicAccountDto {
  @ApiProperty({
    description: "关联的诊所ID",
    example: "clinic-uuid-123",
  })
  @IsString()
  @IsNotEmpty()
  clinicId: string;

  @ApiPropertyOptional({
    description: "初始预付款金额",
    example: 1000.0,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  initialPrepaidAmount?: number;

  @ApiPropertyOptional({
    description: "信用额度",
    example: 5000.0,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  creditLimit?: number;

  @ApiPropertyOptional({
    description: "账户状态",
    enum: AccountStatus,
    example: AccountStatus.active,
  })
  @IsOptional()
  @IsEnum(AccountStatus)
  status?: AccountStatus;

  @ApiPropertyOptional({
    description: "备注信息",
    example: "特殊协议客户，享受优惠费率",
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
