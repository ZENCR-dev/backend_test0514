import { IsOptional, IsString, IsInt, Min, Max, IsIn } from "class-validator";
import { Transform } from "class-transformer";

export class FindMedicinesDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value.trim())
  @IsIn([
    "name",
    "pinyinName",
    "category",
    "createdAt",
    "updatedAt",
    "basePrice",
  ])
  sortBy?: string = "name";

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value.trim().toLowerCase())
  @IsIn(["asc", "desc"])
  sortOrder?: "asc" | "desc" = "asc";
}
