import { IsString, IsOptional, IsNotEmpty, IsIn } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { validateSync, ValidationError } from 'class-validator';

export class EnvironmentVariables {
  @IsString()
  @IsIn(['development', 'test', 'staging', 'production'])
  NODE_ENV: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsString()
  @IsNotEmpty()
  SUPABASE_URL: string;

  @IsString()
  @IsNotEmpty()
  SUPABASE_ANON_KEY: string;

  @IsString()
  @IsOptional() // 在 Week 1 可选，Week 2 后必需
  JWT_SECRET?: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN?: string;

  @IsString()
  @IsOptional()
  BCRYPT_SALT_ROUNDS?: string;

  // Phase 1 Week 5 必需配置
  @IsString()
  @IsOptional() // 在支付功能开发前可选
  STRIPE_SECRET_KEY?: string;

  // Phase 1 Week 8 必需配置  
  @IsString()
  @IsOptional() // 在通知功能开发前可选
  SENDGRID_API_KEY?: string;

  // Phase 2 配置
  @IsString()
  @IsOptional()
  MAPBOX_ACCESS_TOKEN?: string;

  @IsString()
  @IsOptional()
  SENTRY_DSN?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });
  
  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  
  return validatedConfig;
} 