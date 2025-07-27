import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsNumber,
  IsPositive,
  IsOptional,
  IsBoolean,
  IsDateString,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { IsAtLeastDaysFromNow } from "../../common/validators/date.validator";

export class PriceListItemDto {
  @ApiProperty({
    description: "药品ID",
    example: "med_123",
  })
  @IsString({ message: "药品ID必须是字符串" })
  @IsNotEmpty({ message: "药品ID不能为空" })
  medicineId: string;

  @ApiProperty({
    description: "单价（NZD）",
    example: 1.5,
    minimum: 0.01,
    maximum: 1000,
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: "单价必须是数字（最多2位小数）" },
  )
  @IsPositive({ message: "单价必须大于0" })
  unitPrice: number;

  @ApiProperty({
    description: "是否有库存",
    example: true,
  })
  @IsBoolean({ message: "库存状态必须是布尔值" })
  inStock: boolean;

  @ApiProperty({
    description: "备注信息",
    example: "优质药材",
    required: false,
    maxLength: 200,
  })
  @IsOptional()
  @IsString({ message: "备注必须是字符串" })
  notes?: string;
}

export class PriceListUploadDto {
  @ApiProperty({
    description: "生效日期（必须至少7天后，YYYY-MM-DD格式）",
    example: "2024-02-01",
  })
  @IsDateString({}, { message: "生效日期格式无效，请使用YYYY-MM-DD格式" })
  @IsAtLeastDaysFromNow(7, {
    message: "生效日期必须至少是提交日期的7天后",
  })
  effectiveDate: string;

  @ApiProperty({
    description: "价目表项目列表",
    type: [PriceListItemDto],
  })
  @IsArray({ message: "价目表项目必须是数组" })
  @ValidateNested({ each: true })
  @Type(() => PriceListItemDto)
  items: PriceListItemDto[];

  @ApiProperty({
    description: "备注信息",
    example: "2024年第一季度价目表",
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString({ message: "备注必须是字符串" })
  notes?: string;
}

export class PriceListHistoryQueryDto {
  @ApiProperty({
    description: "价目表状态",
    example: "pending_approval",
    enum: ["pending_approval", "active", "rejected", "expired"],
    required: false,
  })
  @IsOptional()
  @IsString({ message: "状态必须是字符串" })
  status?: "pending_approval" | "active" | "rejected" | "expired";

  @ApiProperty({
    description: "页码",
    example: 1,
    minimum: 1,
    maximum: 1000,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: "页码必须是数字" })
  page?: number = 1;

  @ApiProperty({
    description: "每页数量",
    example: 20,
    minimum: 1,
    maximum: 100,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: "每页数量必须是数字" })
  limit?: number = 20;
}

export class UpdateStockDto {
  @ApiProperty({
    description: "是否有库存",
    example: true,
  })
  @IsBoolean({ message: "库存状态必须是布尔值" })
  inStock: boolean;

  @ApiProperty({
    description: "备注信息",
    example: "临时缺货",
    required: false,
    maxLength: 200,
  })
  @IsOptional()
  @IsString({ message: "备注必须是字符串" })
  notes?: string;
}
