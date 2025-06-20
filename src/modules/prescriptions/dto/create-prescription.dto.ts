// 📋 创建处方DTO - DAY 3联调准备
// 新西兰中医药电子处方平台

import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { 
  IsNotEmpty, 
  IsString, 
  IsArray, 
  ValidateNested, 
  IsOptional, 
  IsNumber, 
  Min, 
  IsEnum,
  ArrayMinSize,
  MaxLength
} from 'class-validator';

export enum PrescriptionStatus {
  DRAFT = 'draft',           // 草稿
  SUBMITTED = 'submitted',   // 已提交
  APPROVED = 'approved',     // 已审批
  DISPENSED = 'dispensed',   // 已配药
  COMPLETED = 'completed'    // 已完成
}

export class PrescriptionMedicineDto {
  @ApiProperty({ 
    description: '药品SKU',
    example: 'ZHDD'
  })
  @IsNotEmpty({ message: '药品SKU不能为空' })
  @IsString({ message: '药品SKU必须是字符串' })
  sku: string;

  @ApiProperty({ 
    description: '药品用量',
    example: 15.5
  })
  @IsNotEmpty({ message: '药品用量不能为空' })
  @IsNumber({}, { message: '药品用量必须是数字' })
  @Min(0.1, { message: '药品用量必须大于0.1' })
  quantity: number;

  @ApiProperty({ 
    description: '用法用量说明',
    example: '每日3次，每次5g，温水送服'
  })
  @IsOptional()
  @IsString({ message: '用法用量说明必须是字符串' })
  @MaxLength(200, { message: '用法用量说明不能超过200字符' })
  dosageInstructions?: string;

  @ApiProperty({ 
    description: '备注',
    example: '空腹服用效果更佳'
  })
  @IsOptional()
  @IsString({ message: '备注必须是字符串' })
  @MaxLength(100, { message: '备注不能超过100字符' })
  notes?: string;
}

export class CreatePrescriptionDto {
  @ApiProperty({ 
    description: '患者姓名',
    example: '张三'
  })
  @IsNotEmpty({ message: '患者姓名不能为空' })
  @IsString({ message: '患者姓名必须是字符串' })
  @MaxLength(50, { message: '患者姓名不能超过50字符' })
  patientName: string;

  @ApiProperty({ 
    description: '患者年龄',
    example: 35
  })
  @IsNotEmpty({ message: '患者年龄不能为空' })
  @IsNumber({}, { message: '患者年龄必须是数字' })
  @Min(1, { message: '患者年龄必须大于0' })
  patientAge: number;

  @ApiProperty({ 
    description: '患者联系电话',
    example: '+64-21-123-4567'
  })
  @IsOptional()
  @IsString({ message: '患者联系电话必须是字符串' })
  @MaxLength(20, { message: '联系电话不能超过20字符' })
  patientPhone?: string;

  @ApiProperty({ 
    description: '诊断结果',
    example: '感冒风寒，气虚体弱'
  })
  @IsNotEmpty({ message: '诊断结果不能为空' })
  @IsString({ message: '诊断结果必须是字符串' })
  @MaxLength(200, { message: '诊断结果不能超过200字符' })
  diagnosis: string;

  @ApiProperty({ 
    description: '处方状态',
    enum: PrescriptionStatus,
    example: PrescriptionStatus.DRAFT
  })
  @IsOptional()
  @IsEnum(PrescriptionStatus, { message: '处方状态值无效' })
  status?: PrescriptionStatus = PrescriptionStatus.DRAFT;

  @ApiProperty({ 
    description: '处方药品列表',
    type: [PrescriptionMedicineDto],
    example: [
      {
        sku: 'ZHDD',
        quantity: 15.5,
        dosageInstructions: '每日3次，每次5g，温水送服',
        notes: '空腹服用'
      }
    ]
  })
  @IsArray({ message: '处方药品列表必须是数组' })
  @ArrayMinSize(1, { message: '处方必须包含至少1种药品' })
  @ValidateNested({ each: true })
  @Type(() => PrescriptionMedicineDto)
  medicines: PrescriptionMedicineDto[];

  @ApiProperty({ 
    description: '医生备注',
    example: '建议患者多休息，避免辛辣食物'
  })
  @IsOptional()
  @IsString({ message: '医生备注必须是字符串' })
  @MaxLength(500, { message: '医生备注不能超过500字符' })
  doctorNotes?: string;

  @ApiProperty({ 
    description: '处方有效期(天)',
    example: 30
  })
  @IsOptional()
  @IsNumber({}, { message: '处方有效期必须是数字' })
  @Min(1, { message: '处方有效期必须至少1天' })
  validityDays?: number = 30;
} 