import { SetMetadata } from "@nestjs/common";

export const API_VERSION_KEY = "api-version";

/**
 * API版本装饰器
 * @param version API版本号，例如 '1' 或 '2'
 */
export const ApiVersion = (version: string) =>
  SetMetadata(API_VERSION_KEY, version);
