import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from "@nestjs/common";
import { UserService } from "./user.service";
import { UpdateUserDto } from "./dto/update-user.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Action, Resource } from "../auth/interfaces/permission.interface";
import {
  RequirePermissions,
  AdminOrOwner,
} from "../auth/decorators/permissions.decorator";
import { FindAllUsersDto } from "./dto/find-all-users.dto";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

@ApiTags("Users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("users")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @RequirePermissions({ action: Action.MANAGE, resource: Resource.USER })
  @ApiOperation({ summary: "Get all users (Admin only)" })
  @ApiResponse({ status: 200, description: "Return all users." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  findAll(@Query() query: FindAllUsersDto) {
    return this.userService.findAll(query);
  }

  @Get(":id")
  @AdminOrOwner(Resource.USER, Action.READ)
  @ApiOperation({ summary: "Get user by ID" })
  @ApiResponse({ status: 200, description: "Return user." })
  @ApiResponse({ status: 404, description: "User not found." })
  findOne(@Param("id") id: string) {
    return this.userService.findOne(id);
  }

  @Patch(":id")
  @AdminOrOwner(Resource.USER, Action.UPDATE)
  @ApiOperation({ summary: "Update user" })
  @ApiResponse({ status: 200, description: "User updated." })
  @ApiResponse({ status: 404, description: "User not found." })
  update(@Param("id") id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(id, updateUserDto);
  }

  @Delete(":id")
  @RequirePermissions({ action: Action.DELETE, resource: Resource.USER })
  @ApiOperation({ summary: "Delete user (Admin only)" })
  @ApiResponse({ status: 200, description: "User deleted." })
  @ApiResponse({ status: 404, description: "User not found." })
  remove(@Param("id") id: string) {
    return this.userService.remove(id);
  }
}
