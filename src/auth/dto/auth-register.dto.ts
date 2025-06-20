import {
  IsEmail,
  IsString,
  MinLength,
  IsEnum,
  IsOptional,
  IsNotEmpty,
  IsJSON,
} from 'class-validator';
import { UserRole } from '@prisma/client';

export class AuthRegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
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
  licenseNumber?: string; // For practitioner role

  @IsJSON()
  @IsOptional()
  address?: string; // For practitioner or pharmacy_operator

  @IsString()
  @IsOptional()
  referralCode?: string; // For practitioner
}
