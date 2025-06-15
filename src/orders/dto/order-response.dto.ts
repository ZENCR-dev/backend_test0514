import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';

export class OrderItemResponseDto {
  @ApiProperty({ description: '订单项目ID', example: 'cm123456789' })
  id: string;

  @ApiProperty({ description: '药品ID', example: 'cm123456789' })
  medicineId: string;

  @ApiProperty({ description: '药品快照信息' })
  medicineSnapshot: any;

  @ApiProperty({ description: '数量', example: 10 })
  quantity: number;

  @ApiProperty({ description: '单价', example: 12.50 })
  unitPrice: number;

  @ApiProperty({ description: '总价', example: 125.00 })
  totalPrice: number;

  @ApiPropertyOptional({ description: '用药说明', example: '每日三次，饭后服用' })
  dosageInstructions?: string;

  @ApiPropertyOptional({ description: '备注', example: '特殊处理要求' })
  notes?: string;

  @ApiProperty({ description: '创建时间', example: '2025-06-14T10:30:00.000Z' })
  createdAt: Date;
}

export class OrderResponseDto {
  @ApiProperty({ description: '订单ID', example: 'cm123456789' })
  id: string;

  @ApiProperty({ description: '平台订单号', example: 'ORD20250614001' })
  platformOrderId: string;

  @ApiProperty({ description: '医生ID', example: 'cm123456789' })
  practitionerId: string;

  @ApiPropertyOptional({ description: '患者ID', example: 'cm123456789' })
  patientId?: string;

  @ApiProperty({ description: '诊所ID', example: 'cm123456789' })
  clinicId: string;

  @ApiProperty({ description: '患者信息' })
  patientInfo: any;

  @ApiProperty({ 
    description: '订单状态', 
    enum: OrderStatus,
    example: OrderStatus.DRAFT
  })
  status: OrderStatus;

  @ApiProperty({ description: '订单总金额', example: 125.50 })
  totalAmount: number;

  @ApiPropertyOptional({ description: '支付状态', example: 'pending' })
  paymentStatus?: string;

  @ApiPropertyOptional({ description: '支付方式', example: 'clinic_account' })
  paymentMethod?: string;

  @ApiPropertyOptional({ description: '分配的药房ID', example: 'cm123456789' })
  assignedPharmacyId?: string;

  @ApiPropertyOptional({ description: '配药时间', example: '2025-06-14T15:30:00.000Z' })
  dispensedAt?: Date;

  @ApiPropertyOptional({ description: '完成时间', example: '2025-06-14T16:00:00.000Z' })
  completedAt?: Date;

  @ApiPropertyOptional({ description: 'QR码数据', example: 'qr_data_string' })
  qrCodeData?: string;

  @ApiPropertyOptional({ description: 'PDF文件URL', example: 'https://example.com/order.pdf' })
  pdfUrl?: string;

  @ApiPropertyOptional({ description: '订单备注', example: '加急处理' })
  notes?: string;

  @ApiProperty({ description: '版本号', example: 1 })
  version: number;

  @ApiPropertyOptional({ description: '幂等性键', example: 'order_20250614_123456' })
  idempotencyKey?: string;

  @ApiPropertyOptional({ description: '过期时间', example: '2025-06-21T10:30:00.000Z' })
  expiresAt?: Date;

  @ApiProperty({ description: '创建时间', example: '2025-06-14T10:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间', example: '2025-06-14T10:30:00.000Z' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: '订单项目列表', type: [OrderItemResponseDto] })
  items?: OrderItemResponseDto[];
}

export class PaginatedOrderResponseDto {
  @ApiProperty({ description: '订单列表', type: [OrderResponseDto] })
  data: OrderResponseDto[];

  @ApiProperty({ description: '总记录数', example: 100 })
  total: number;

  @ApiProperty({ description: '当前页码', example: 1 })
  page: number;

  @ApiProperty({ description: '每页数量', example: 20 })
  limit: number;

  @ApiProperty({ description: '总页数', example: 5 })
  totalPages: number;
} 