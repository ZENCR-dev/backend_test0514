import {
  Injectable,
  NestMiddleware,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { Request, Response, NextFunction } from "express";

interface IdempotencyRecord {
  response: any;
  timestamp: number;
  processing: boolean;
}

@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  private readonly cache = new Map<string, IdempotencyRecord>();
  private readonly TTL = 24 * 60 * 60 * 1000; // 24小时 TTL
  private readonly PROCESSING_TIMEOUT = 60 * 1000; // 60秒处理超时

  use(req: Request, res: Response, next: NextFunction): void {
    // 仅对POST、PUT、PATCH请求启用幂等性检查
    if (!["POST", "PUT", "PATCH"].includes(req.method)) {
      return next();
    }

    const idempotencyKey = req.headers["idempotency-key"] as string;

    if (!idempotencyKey) {
      return next();
    }

    // 验证幂等性键格式（UUID v4格式）
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(idempotencyKey)) {
      throw new BadRequestException(
        "Invalid idempotency key format. Must be a valid UUID v4.",
      );
    }

    const cacheKey = `${req.method}:${req.path}:${idempotencyKey}`;
    const now = Date.now();

    // 清理过期记录
    this.cleanupExpiredRecords(now);

    const existing = this.cache.get(cacheKey);

    if (existing) {
      // 检查是否正在处理中
      if (existing.processing) {
        // 检查处理超时
        if (now - existing.timestamp > this.PROCESSING_TIMEOUT) {
          this.cache.delete(cacheKey);
          return next();
        }
        throw new ConflictException(
          "Request is currently being processed. Please try again later.",
        );
      }

      // 返回缓存的响应
      res.status(200).json({
        ...existing.response,
        _idempotent: true,
        _cached_at: new Date(existing.timestamp).toISOString(),
      });
      return;
    }

    // 标记为处理中
    this.cache.set(cacheKey, {
      response: null,
      timestamp: now,
      processing: true,
    });

    // 拦截响应
    const originalSend = res.send;
    const originalJson = res.json;

    let responseSent = false;

    const cacheResponse = (data: any, statusCode: number) => {
      if (!responseSent && statusCode >= 200 && statusCode < 300) {
        // 仅缓存成功响应
        this.cache.set(cacheKey, {
          response: data,
          timestamp: now,
          processing: false,
        });
      } else {
        // 失败则删除处理中标记
        this.cache.delete(cacheKey);
      }
      responseSent = true;
    };

    res.send = function (data: any) {
      cacheResponse(data, res.statusCode);
      return originalSend.call(this, data);
    };

    res.json = function (data: any) {
      cacheResponse(data, res.statusCode);
      return originalJson.call(this, data);
    };

    // 处理请求错误或超时
    res.on("close", () => {
      if (!responseSent) {
        this.cache.delete(cacheKey);
      }
    });

    res.on("error", () => {
      this.cache.delete(cacheKey);
    });

    next();
  }

  private cleanupExpiredRecords(now: number): void {
    for (const [key, record] of this.cache.entries()) {
      if (now - record.timestamp > this.TTL) {
        this.cache.delete(key);
      }
    }
  }

  // 测试用途：清理缓存
  clearCache(): void {
    this.cache.clear();
  }

  // 测试用途：获取缓存大小
  getCacheSize(): number {
    return this.cache.size;
  }
}
