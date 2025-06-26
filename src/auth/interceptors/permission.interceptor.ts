import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { Reflector } from "@nestjs/core";
import { PermissionService } from "../services/permission.service";
import {
  PERMISSION_METADATA_KEY,
  REQUIRE_OWNERSHIP_KEY,
  REQUIRE_CLINIC_MEMBERSHIP_KEY,
} from "../decorators/permissions.decorator";
import { Action, Resource } from "../interfaces/permission.interface";

@Injectable()
export class PermissionInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PermissionInterceptor.name);

  constructor(
    private reflector: Reflector,
    private permissionService: PermissionService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      tap(async () => {
        try {
          const permissions = this.reflector.getAllAndOverride<
            { action: Action; resource: Resource }[]
          >(PERMISSION_METADATA_KEY, [
            context.getHandler(),
            context.getClass(),
          ]);

          if (!permissions || permissions.length === 0) {
            return;
          }

          const request = context.switchToHttp().getRequest();
          const user = request.user;

          if (!user) {
            this.logger.warn("No user found in request for permission logging");
            return;
          }

          const requiresOwnership = this.reflector.getAllAndOverride<boolean>(
            REQUIRE_OWNERSHIP_KEY,
            [context.getHandler(), context.getClass()],
          );

          const requiresClinicMembership =
            this.reflector.getAllAndOverride<boolean>(
              REQUIRE_CLINIC_MEMBERSHIP_KEY,
              [context.getHandler(), context.getClass()],
            );

          // Extract resource information
          const resourceId = request.params?.id || request.query?.id;
          const resourceData = request.body;

          // Log the permission usage
          for (const permission of permissions) {
            const checkResult = await this.permissionService.checkPermission({
              user: {
                id: user.id,
                role: user.role,
              },
              action: permission.action,
              resource: permission.resource,
              resourceId,
              resourceData,
            });

            this.logger.log(
              `Permission check: User ${user.id} (${user.role}) - ${permission.action}:${permission.resource} - ${
                checkResult.allowed ? "ALLOWED" : "DENIED"
              } - ${checkResult.reason || "No reason provided"}`,
            );
          }
        } catch (error) {
          this.logger.error(
            "Error in permission interceptor:",
            error instanceof Error ? error.message : "Unknown error",
          );
        }
      }),
    );
  }

  private extractResourceInfo(request: any) {
    const resourceId = request.params?.id || request.query?.id;
    const resourceData = request.body;

    return {
      resourceId,
      resourceData,
    };
  }

  // Method for future permission caching
  private async shouldCachePermission(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    user: any,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    permission: { action: Action; resource: Resource },
  ): Promise<boolean> {
    // Implementation for permission caching logic
    // Currently returns false, but can be enhanced later
    return false;
  }

  // Method for permission analytics
  private logPermissionMetrics(
    user: any,

    permission: { action: Action; resource: Resource },

    allowed: boolean,

    responseTime: number,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const context = {
      userId: user.id,
      userRole: user.role,
      action: permission.action,
      resource: permission.resource,
      allowed,
      responseTime,
      timestamp: new Date().toISOString(),
    };

    // Future: Send to analytics service
    this.logger.debug("Permission metrics logged");
  }
}
