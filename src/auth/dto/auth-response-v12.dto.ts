import { ApiProperty } from "@nestjs/swagger";

export class UserResponseV12Dto {
  @ApiProperty({ description: "用户ID" })
  id: string;

  @ApiProperty({ description: "用户邮箱" })
  email: string;

  @ApiProperty({ description: "用户姓名" })
  name: string;

  @ApiProperty({
    description: "用户角色",
    enum: ["admin", "practitioner", "pharmacy_operator", "patient"],
  })
  role: string;
}

export class AuthResponseDataV12Dto {
  @ApiProperty({ description: "JWT 访问令牌" })
  accessToken: string;

  @ApiProperty({ description: "JWT 刷新令牌" })
  refreshToken: string;

  @ApiProperty({ description: "用户信息", type: UserResponseV12Dto })
  user: UserResponseV12Dto;
}

export class MetaResponseDto {
  @ApiProperty({
    description: "响应时间戳",
    example: "2025-06-18T01:00:00.000Z",
  })
  timestamp: string;
}

export class ApiResponseV12Dto<T = any> {
  @ApiProperty({ description: "请求是否成功" })
  success: boolean;

  @ApiProperty({ description: "响应数据", required: false })
  data?: T;

  @ApiProperty({ description: "错误信息", required: false })
  error?: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
  };

  @ApiProperty({
    description: "元数据",
    type: MetaResponseDto,
    required: false,
  })
  meta?: MetaResponseDto;
}

export class LoginResponseV12Dto extends ApiResponseV12Dto<AuthResponseDataV12Dto> {
  @ApiProperty({ description: "认证响应数据", type: AuthResponseDataV12Dto })
  data: AuthResponseDataV12Dto;

  @ApiProperty({ description: "元数据", type: MetaResponseDto })
  meta: MetaResponseDto;
}

export class RefreshResponseV12Dto extends ApiResponseV12Dto<{
  accessToken: string;
}> {
  @ApiProperty({ description: "刷新令牌响应数据" })
  data: {
    accessToken: string;
  };

  @ApiProperty({ description: "元数据", type: MetaResponseDto })
  meta: MetaResponseDto;
}
