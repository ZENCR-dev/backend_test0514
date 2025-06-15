import { IsOptional, IsString, IsEnum, IsDateString, IsNumber, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';

export class QueryOrderDto {
  @ApiPropertyOptional({ description: '医生ID', example: 'cm123456789' })
  @IsOptional()
  @IsString()
  practitionerId?: string;

  @ApiPropertyOptional({ description: '诊所ID', example: 'cm123456789' })
  @IsOptional()
  @IsString()
  clinicId?: string;

  @ApiPropertyOptional({ 
    description: '订单状态', 
    enum: OrderStatus,
    example: OrderStatus.DRAFT
  })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ description: '患者ID', example: 'cm123456789' })
  @IsOptional()
  @IsString()
  patientId?: string;

  @ApiPropertyOptional({ description: '分配的药房ID', example: 'cm123456789' })
  @IsOptional()
  @IsString()
  assignedPharmacyId?: string;

  @ApiPropertyOptional({ 
    description: '开始日期', 
    example: '2025-06-01T00:00:00.000Z' 
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ 
    description: '结束日期', 
    example: '2025-06-30T23:59:59.999Z' 
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ 
    description: '页码', 
    example: 1, 
    minimum: 1,
    default: 1
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ 
    description: '每页数量', 
    example: 20, 
    minimum: 1, 
    maximum: 100,
    default: 20
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ 
    description: '排序字段', 
    example: 'createdAt',
    enum: ['createdAt', 'updatedAt', 'totalAmount', 'status', 'platformOrderId']
  })
  @IsOptional()
  @IsString()
  @IsIn(['createdAt', 'updatedAt', 'totalAmount', 'status', 'platformOrderId'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ 
    description: '排序方向', 
    example: 'desc',
    enum: ['asc', 'desc']
  })
  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
} 