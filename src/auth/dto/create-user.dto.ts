import {
  IsEmail,
  IsString,
  MinLength,
  IsEnum,
  IsOptional,
  IsJSON,
} from "class-validator";
import { UserRole } from "@prisma/client";
import { ApiProperty } from "@nestjs/swagger";

export class CreateUserDto {
  @ApiProperty({ example: "test@example.com" })
  @IsEmail()
  email: string;

  @ApiProperty({ example: "password123" })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ enum: UserRole, example: UserRole.patient })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiProperty({ example: "John Doe" })
  @IsString()
  fullName: string;

  @ApiProperty({ example: "1234567890" })
  @IsString()
  phone: string;

  @ApiProperty({ example: "LIC12345", required: false })
  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @ApiProperty({
    example: '{"street":"123 Main St","city":"Anytown"}',
    required: false,
  })
  @IsOptional()
  @IsJSON()
  address?: string;
}
