export class MedicineDto {
  id: string;
  name: string;
  chineseName: string | null;
  englishName: string | null;
  pinyinName: string | null;
  sku: string;
  description: string | null;
  category: string | null;
  unit: string;
  requiresPrescription: boolean;
  basePrice: number; // Prisma Decimal is serialized as number
  metadata: any; // JsonValue type from Prisma
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export class FindMedicinesResponseDto {
  data: MedicineDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
