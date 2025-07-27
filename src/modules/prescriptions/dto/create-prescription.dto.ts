// 📋 创建处方DTO - 隐私合规版本 (MVP 2.1+)
// 新西兰中医药电子处方平台 - 无患者信息版本

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
  ArrayMinSize,
  MaxLength,
} from "class-validator";

export class PrescriptionMedicineDto {
  @ApiProperty({ description: "药品ID" })
  @IsString()
  @IsNotEmpty()
  medicineId: string;

  @ApiProperty({ description: "单味药克重", example: 15 })
  @IsNumber()
  @Min(0.1)
  weight: number;

  @ApiProperty({ description: "用药说明" })
  @IsString()
  @IsNotEmpty()
  notes: string;

  @ApiPropertyOptional({ description: "单味药备注" })
  @IsOptional()
  @IsString()
  additionalNotes?: string;
}

export class CreatePrescriptionDto {
  @ApiProperty({ description: "处方药品列表", type: [PrescriptionMedicineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PrescriptionMedicineDto)
  medicines: PrescriptionMedicineDto[];

  @ApiProperty({ description: "帖数", example: 7 })
  @IsNumber()
  @Min(1)
  copies: number;

  @ApiPropertyOptional({ description: "处方备注" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
