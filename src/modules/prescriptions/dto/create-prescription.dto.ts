// 📋 创建处方DTO - DAY 3联调准备
// 新西兰中医药电子处方平台

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
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
  MaxLength,
} from "class-validator";

export enum PrescriptionStatus {
  DRAFT = "draft", // 草稿
  ISSUED = "issued", // 已开具
  DISPENSED = "dispensed", // 已配药
  COMPLETED = "completed", // 已完成
}

export class PatientInfoDto {
  @ApiProperty({ description: "患者姓名" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: "患者年龄" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  age?: number;

  @ApiPropertyOptional({ description: "患者性别" })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ description: "患者联系电话" })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: "患者症状描述" })
  @IsOptional()
  @IsString()
  symptoms?: string;

  @ApiPropertyOptional({ description: "诊断信息" })
  @IsOptional()
  @IsString()
  diagnosis?: string;
}

export class PrescriptionMedicineDto {
  @ApiProperty({ description: "药品ID" })
  @IsString()
  @IsNotEmpty()
  medicineId: string;

  @ApiProperty({ description: "药品数量" })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ description: "用药说明" })
  @IsString()
  @IsNotEmpty()
  dosageInstructions: string;

  @ApiPropertyOptional({ description: "药品备注" })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreatePrescriptionDto {
  @ApiProperty({ description: "患者信息", type: PatientInfoDto })
  @ValidateNested()
  @Type(() => PatientInfoDto)
  patientInfo: PatientInfoDto;

  @ApiProperty({ description: "处方药品列表", type: [PrescriptionMedicineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionMedicineDto)
  medicines: PrescriptionMedicineDto[];

  @ApiPropertyOptional({ description: "处方备注" })
  @IsOptional()
  @IsString()
  notes?: string;
}
