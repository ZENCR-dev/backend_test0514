import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
  Max,
  IsPositive,
} from "class-validator";
import { Transform, Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";

export class UploadFulfillmentDto {
  @ApiProperty({
    description: "处方ID",
    example: "prescription_123",
  })
  @IsString({ message: "处方ID必须是字符串" })
  @IsNotEmpty({ message: "处方ID不能为空" })
  orderId: string;

  @ApiProperty({
    description: "实际重量（克）",
    example: 150.5,
    minimum: 0.1,
    maximum: 10000,
  })
  @Transform(({ value }) => {
    const num = Number(value);
    if (isNaN(num)) {
      throw new Error("重量必须是有效数字");
    }
    return num;
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: "重量必须是数字（最多2位小数）" },
  )
  @IsPositive({ message: "重量必须大于0" })
  @Min(0.1, { message: "重量不能小于0.1克" })
  @Max(10000, { message: "重量不能超过10000克" })
  actualWeight: number;

  @ApiProperty({
    description: "备注信息",
    example: "配药完成，重量准确",
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString({ message: "备注必须是字符串" })
  notes?: string;

  @ApiProperty({
    type: "string",
    format: "binary",
    description: "药包照片（JPEG/PNG，最大5MB）",
  })
  packagePhoto: Express.Multer.File;

  @ApiProperty({
    type: "string",
    format: "binary",
    description: "电子秤照片（JPEG/PNG，最大5MB）",
  })
  scalePhoto: Express.Multer.File;
}

export class FulfillmentQueryDto {
  @ApiProperty({
    description: "履约状态",
    example: "pending",
    enum: ["pending", "approved", "rejected"],
    required: false,
  })
  @IsOptional()
  @IsString({ message: "状态必须是字符串" })
  status?: "pending" | "approved" | "rejected";

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
  @Min(1, { message: "页码必须大于等于1" })
  @Max(1000, { message: "页码不能超过1000" })
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
  @Min(1, { message: "每页数量必须大于等于1" })
  @Max(100, { message: "每页数量不能超过100" })
  limit?: number = 20;
}
