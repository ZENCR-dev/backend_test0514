import { IsNumber, Min, Max, IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";

export class TransactionQueryDto {
  @ApiProperty({
    description: "每页记录数",
    example: 50,
    minimum: 1,
    maximum: 200,
    required: false,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  @IsOptional()
  limit?: number = 50;

  @ApiProperty({
    description: "偏移量",
    example: 0,
    minimum: 0,
    required: false,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  offset?: number = 0;
}
