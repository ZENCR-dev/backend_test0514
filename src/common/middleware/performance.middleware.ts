// 自动生成的性能监控中间件 - DAY 3专用
import { Injectable, NestMiddleware, Logger } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";

@Injectable()
export class PerformanceMiddleware implements NestMiddleware {
  private readonly logger = new Logger("PerformanceMonitor");
  private readonly metrics = new Map<string, number[]>();

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const route = `${req.method} ${req.route?.path || req.path}`;

    // 特别关注DAY 3关键API
    const isMonitoredRoute = [
      "/api/v1/medicines",
      "/api/v1/medicines/search",
      "/api/v1/prescriptions",
    ].some((path) => req.path.startsWith(path));

    res.on("finish", () => {
      const responseTime = Date.now() - startTime;

      // 记录性能指标
      if (!this.metrics.has(route)) {
        this.metrics.set(route, []);
      }
      this.metrics.get(route)!.push(responseTime);

      // DAY 3关键路径特殊监控
      if (isMonitoredRoute) {
        const logLevel = responseTime > 500 ? "warn" : "log";
        this.logger[logLevel](
          `DAY3-MONITOR: ${route} - ${responseTime}ms - Status: ${res.statusCode}`,
        );

        // 性能阈值告警
        if (responseTime > 1000) {
          this.logger.error(
            `🚨 PERFORMANCE ALERT: ${route} exceeded 1000ms (${responseTime}ms)`,
          );
        }
      }

      // 每分钟输出统计
      this.outputMetrics();
    });

    next();
  }

  private outputMetrics() {
    // 简单的性能统计输出
    setInterval(() => {
      for (const [route, times] of this.metrics.entries()) {
        if (times.length > 0) {
          const avg = times.reduce((a, b) => a + b, 0) / times.length;
          const max = Math.max(...times);
          this.logger.log(
            `📊 ${route}: avg=${avg.toFixed(2)}ms, max=${max}ms, count=${times.length}`,
          );
          times.length = 0; // 清空数据
        }
      }
    }, 60000);
  }
}
