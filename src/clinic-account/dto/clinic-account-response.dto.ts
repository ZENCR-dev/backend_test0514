import { ApiProperty } from '@nestjs/swagger';
import { AccountStatus } from '@prisma/client';

export class ClinicAccountResponseDto {
  @ApiProperty({
    description: '账户ID',
    example: 'account-uuid-123',
  })
  id: string;

  @ApiProperty({
    description: '诊所名称',
    example: '新西兰中医诊所',
  })
  clinicName: string;

  @ApiProperty({
    description: '关联的诊所ID',
    example: 'clinic-uuid-123',
  })
  clinicId: string;

  @ApiProperty({
    description: '预付款余额',
    example: 800.50,
  })
  prepaidBalance: number;

  @ApiProperty({
    description: '信用额度',
    example: 5000.00,
  })
  creditLimit: number;

  @ApiProperty({
    description: '可用总额度',
    example: 5800.50,
  })
  availableBalance: number;

  @ApiProperty({
    description: '账户状态',
    enum: AccountStatus,
    example: AccountStatus.active,
  })
  status: AccountStatus;

  @ApiProperty({
    description: '版本号（用于乐观锁）',
    example: 1,
  })
  version: number;

  @ApiProperty({
    description: '备注信息',
    example: '特殊协议客户',
  })
  notes?: string;

  @ApiProperty({
    description: '创建时间',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: '更新时间',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;
}

export class ClinicAccountListResponseDto {
  @ApiProperty({
    description: '诊所账户列表',
    type: [ClinicAccountResponseDto],
  })
  data: ClinicAccountResponseDto[];

  @ApiProperty({
    description: '分页信息',
    example: {
      total: 100,
      page: 1,
      limit: 10,
      totalPages: 10,
    },
  })
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class BalanceResponseDto {
  @ApiProperty({
    description: '账户ID',
    example: 'account-uuid-123',
  })
  accountId: string;

  @ApiProperty({
    description: '预付款余额',
    example: 800.50,
  })
  prepaidBalance: number;

  @ApiProperty({
    description: '信用额度',
    example: 5000.00,
  })
  creditLimit: number;

  @ApiProperty({
    description: '可用总额度',
    example: 5800.50,
  })
  availableBalance: number;

  @ApiProperty({
    description: '账户状态',
    enum: AccountStatus,
    example: AccountStatus.active,
  })
  status: AccountStatus;

  @ApiProperty({
    description: '查询时间',
    example: '2024-01-01T00:00:00.000Z',
  })
  queriedAt: Date;
} 