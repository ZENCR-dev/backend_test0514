import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  ForbiddenException,
} from "@nestjs/common";
import { Observable, throwError } from "rxjs";
import { tap, catchError } from "rxjs/operators";
import { Reflector } from "@nestjs/core";
import { PermissionService } from "../services/permission.service";
import {
  PERMISSION_METADATA_KEY,
  REQUIRE_OWNERSHIP_KEY,
  REQUIRE_CLINIC_MEMBERSHIP_KEY,
} from "../decorators/permissions.decorator";
import {
  Permission,
  Action,
  Resource,
} from "../interfaces/permission.interface";

@Injectable()
export class PermissionInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PermissionInterceptor.name);

  constructor(
    private reflector: Reflector,
    private permissionService: PermissionService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const startTime = Date.now();

    // 记录权限检查开始
    this.logPermissionCheck(context, user, "START");

    return next.handle().pipe(
      tap((data) => {
        // 记录成功的权限检查
        const duration = Date.now() - startTime;
        this.logPermissionCheck(context, user, "SUCCESS", duration);

        // 可以在这里进行响应数据的过滤（基于用户权限）
        return this.filterResponseData(data, user, context);
      }),
      catchError((error) => {
        // 记录失败的权限检查
        const duration = Date.now() - startTime;
        this.logPermissionCheck(
          context,
          user,
          "ERROR",
          duration,
          error.message,
        );
        return throwError(() => error);
      }),
    );
  }

  /**
   * 记录权限检查日志
   */
  private logPermissionCheck(
    context: ExecutionContext,
    user: any,
    status: "START" | "SUCCESS" | "ERROR",
    duration?: number,
    errorMessage?: string,
  ): void {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.url;
    const userId = user?.id || "anonymous";
    const userRole = user?.role || "unknown";

    // 获取权限元数据
    const permissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSION_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requireOwnership = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_OWNERSHIP_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requireClinicMembership = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_CLINIC_MEMBERSHIP_KEY,
      [context.getHandler(), context.getClass()],
    );

    const logData = {
      status,
      method,
      url,
      userId,
      userRole,
      permissions: permissions?.map((p) => `${p.action}:${p.resource}`) || [],
      requireOwnership,
      requireClinicMembership,
      duration,
      errorMessage,
    };

    switch (status) {
      case "START":
        this.logger.debug(
          `Permission check started: ${method} ${url}`,
          logData,
        );
        break;
      case "SUCCESS":
        this.logger.log(
          `Permission check completed: ${method} ${url} (${duration}ms)`,
          logData,
        );
        break;
      case "ERROR":
        this.logger.error(
          `Permission check failed: ${method} ${url} (${duration}ms) - ${errorMessage}`,
          logData,
        );
        break;
    }
  }

  /**
   * 根据用户权限过滤响应数据
   */
  private async filterResponseData(
    data: any,
    user: any,
    context: ExecutionContext,
  ): Promise<any> {
    if (!data || !user) {
      return data;
    }

    try {
      // 如果是数组数据，过滤每个项目
      if (Array.isArray(data)) {
        const filteredData = [];
        for (const item of data) {
          const filteredItem = await this.filterSingleItem(item, user);
          if (filteredItem) {
            filteredData.push(filteredItem);
          }
        }
        return filteredData;
      }

      // 如果是单个对象，直接过滤
      return await this.filterSingleItem(data, user);
    } catch (error) {
      this.logger.error(
        `Error filtering response data: ${error.message}`,
        error.stack,
      );
      return data; // 发生错误时返回原始数据
    }
  }

  /**
   * 过滤单个数据项
   */
  private async filterSingleItem(item: any, user: any): Promise<any> {
    if (!item || typeof item !== "object") {
      return item;
    }

    // 检查用户是否有权限查看这个项目
    if (item.userId && item.userId !== user.id) {
      // 如果项目有用户ID且不是当前用户的，检查是否有权限查看
      const hasPermission = await this.permissionService.hasPermission(
        user,
        Action.READ,
        this.getResourceType(item),
        item.id,
        item,
      );

      if (!hasPermission) {
        return null; // 没有权限则返回null（会被过滤掉）
      }
    }

    // 过滤敏感字段
    return this.filterSensitiveFields(item, user);
  }

  /**
   * 过滤敏感字段
   */
  private filterSensitiveFields(item: any, user: any): any {
    const filtered = { ...item };

    // 根据用户角色决定是否显示敏感字段
    const isAdmin = user.role === "admin";
    const isOwner = item.userId === user.id;

    // 如果不是管理员也不是所有者，移除敏感字段
    if (!isAdmin && !isOwner) {
      // 移除常见的敏感字段
      delete filtered.password;
      delete filtered.email; // 根据业务需求决定
      delete filtered.phone; // 根据业务需求决定
      delete filtered.internalNotes;
      delete filtered.privateData;
    }

    // 总是移除密码字段
    delete filtered.password;

    return filtered;
  }

  /**
   * 根据数据项推断资源类型
   */
  private getResourceType(item: any): Resource {
    // 根据项目的字段来推断资源类型
    if (item.prescriptionId || item.medicineId) {
      return Resource.PRESCRIPTION;
    }
    if (item.clinicId) {
      return Resource.CLINIC;
    }
    if (item.userId || item.email) {
      return Resource.USER;
    }
    if (item.fullName || item.phone) {
      return Resource.USER_PROFILE;
    }

    return Resource.ALL; // 默认资源类型
  }
}
