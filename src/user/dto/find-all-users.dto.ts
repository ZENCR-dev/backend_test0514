import { IsOptional, IsString, IsEnum } from "class-validator";
import { UserStatus } from "@prisma/client";

export class FindAllUsersDto {
  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
