import { IsNotEmpty, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class RefreshTokenDto {
  @ApiProperty({
    description: "RefreshToken 用于获取新的 accessToken",
    example: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2",
  })
  @IsNotEmpty({ message: "RefreshToken 不能为空" })
  @IsString({ message: "RefreshToken 必须是字符串" })
  refreshToken: string;
}
