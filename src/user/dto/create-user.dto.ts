import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsOptional,
  IsEnum,
  IsObject,
  IsJSON,
} from "class-validator";
import { UserRole } from "@prisma/client";

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6) // 密码至少6位
  password: string;

  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  licenseNumber?: string; // 医生执照号

  @IsJSON()
  @IsOptional()
  address?: string; // JSON格式的地址信息

  @IsString()
  @IsOptional()
  referralCode?: string; // 推荐码
}
