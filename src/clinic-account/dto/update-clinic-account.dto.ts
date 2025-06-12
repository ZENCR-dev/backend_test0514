import { PartialType } from "@nestjs/swagger";
import { CreateClinicAccountDto } from "./create-clinic-account.dto";
import { IsOptional, IsString, IsNumber, Min } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";

export class UpdateClinicAccountDto extends PartialType(
  CreateClinicAccountDto,
) {
  @ApiPropertyOptional({
    description: "更新信用额度",
    example: 10000.0,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  creditLimit?: number;
}
