import { IsNumber, Min, Max, IsString, IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class RechargeDto {
  @ApiProperty({
    description: "充值金额（新西兰元）",
    example: 100,
    minimum: 10,
    maximum: 10000,
  })
  @IsNumber()
  @Min(10, { message: "充值金额不能少于10元" })
  @Max(10000, { message: "充值金额不能超过10000元" })
  amount: number;

  @ApiProperty({
    description: "货币类型",
    example: "NZD",
    default: "NZD",
    required: false,
  })
  @IsString()
  @IsOptional()
  currency?: string = "NZD";
}
