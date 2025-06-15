import { IsEnum, IsOptional, IsString, IsNumber, Min } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { OrderStatus } from "@prisma/client";

export class UpdateOrderStatusDto {
  @ApiProperty({
    description: "订单状态",
    enum: OrderStatus,
    example: OrderStatus.DRAFT,
    enumName: "OrderStatus",
  })
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @ApiPropertyOptional({
    description: "状态更新备注",
    example: "客户要求修改订单",
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description: "版本号（乐观锁）",
    example: 1,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  version: number;
}

export class UpdateOrderDto {
  @ApiPropertyOptional({ description: "订单备注", example: "更新后的备注信息" })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: "分配的药房ID", example: "cm123456789" })
  @IsOptional()
  @IsString()
  assignedPharmacyId?: string;

  @ApiProperty({
    description: "版本号（乐观锁）",
    example: 1,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  version: number;
}
