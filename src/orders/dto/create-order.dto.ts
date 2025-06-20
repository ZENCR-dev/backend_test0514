import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsNotEmpty,
  Max,
  IsObject,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateOrderItemDto {
  @ApiProperty({ description: "药品ID", example: "cm123456789" })
  @IsString()
  @IsNotEmpty()
  medicineId: string;

  @ApiProperty({ description: "数量", example: 10, minimum: 1, maximum: 1000 })
  @IsNumber()
  @Min(1)
  @Max(1000)
  quantity: number;

  @ApiProperty({ description: "单价", example: 12.5, minimum: 0 })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiPropertyOptional({
    description: "用药说明",
    example: "每日三次，饭后服用",
  })
  @IsOptional()
  @IsString()
  dosageInstructions?: string;

  @ApiPropertyOptional({ description: "备注", example: "特殊处理要求" })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateOrderDto {
  @ApiProperty({ description: "医生ID", example: "cm123456789" })
  @IsString()
  @IsNotEmpty()
  practitionerId: string;

  @ApiPropertyOptional({ description: "患者ID", example: "cm123456789" })
  @IsOptional()
  @IsString()
  patientId?: string;

  @ApiProperty({ description: "诊所ID", example: "cm123456789" })
  @IsString()
  @IsNotEmpty()
  clinicId: string;

  @ApiProperty({
    description: "患者信息",
    example: {
      name: "张三",
      phone: "021-12345678",
      address: "上海市浦东新区",
    },
  })
  @IsObject()
  @IsNotEmpty()
  patientInfo: any;

  @ApiProperty({ description: "订单总金额", example: 125.5, minimum: 0 })
  @IsNumber()
  @Min(0)
  totalAmount: number;

  @ApiProperty({
    description: "订单项目列表",
    type: [CreateOrderItemDto],
    example: [
      {
        medicineId: "cm123456789",
        quantity: 10,
        unitPrice: 12.5,
        dosageInstructions: "每日三次，饭后服用",
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @ApiPropertyOptional({ description: "订单备注", example: "加急处理" })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: "幂等性键，防止重复创建",
    example: "order_20250614_123456",
  })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
