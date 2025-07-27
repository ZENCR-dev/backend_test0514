import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { AppService } from "./app.service";

@ApiTags("系统")
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: "系统根路径" })
  @ApiResponse({ status: 200, description: "系统运行正常" })
  getHello(): object {
    return {
      success: true,
      data: {
        message: this.appService.getHello(),
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        environment: process.env.NODE_ENV || "development",
      },
      meta: {
        uptime: process.uptime(),
        nodeVersion: process.version,
      },
    };
  }

  @Get("health")
  @ApiOperation({ summary: "健康检查" })
  @ApiResponse({ status: 200, description: "服务健康状态" })
  getHealth(): object {
    return {
      success: true,
      data: {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: "1.0.0",
      },
      message: "Service is healthy",
    };
  }
}
