import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ClinicAccountService } from './services/clinic-account.service';
import { CreateClinicAccountDto } from './dto/create-clinic-account.dto';
import { UpdateClinicAccountDto } from './dto/update-clinic-account.dto';
import { QueryClinicAccountDto } from './dto/query-clinic-account.dto';
import {
  ClinicAccountResponseDto,
  ClinicAccountListResponseDto,
  BalanceResponseDto,
} from './dto/clinic-account-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('clinic-accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/clinic-accounts')
export class ClinicAccountController {
  constructor(private readonly clinicAccountService: ClinicAccountService) {}

  @Post()
  @Roles(UserRole.admin)
  @ApiOperation({ summary: '创建诊所账户' })
  @ApiResponse({
    status: 201,
    description: '诊所账户创建成功',
    type: ClinicAccountResponseDto,
  })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  create(@Body() createClinicAccountDto: CreateClinicAccountDto): Promise<ClinicAccountResponseDto> {
    return this.clinicAccountService.create(createClinicAccountDto);
  }

  @Get()
  @Roles(UserRole.admin, UserRole.practitioner)
  @ApiOperation({ summary: '获取诊所账户列表' })
  @ApiResponse({
    status: 200,
    description: '获取诊所账户列表成功',
    type: ClinicAccountListResponseDto,
  })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  findAll(
    @Query() query: QueryClinicAccountDto,
    @Request() req,
  ): Promise<ClinicAccountListResponseDto> {
    const { user } = req;
    return this.clinicAccountService.findAll(query, user?.sub, user?.role);
  }

  @Get(':id')
  @Roles(UserRole.admin, UserRole.practitioner)
  @ApiOperation({ summary: '获取诊所账户详情' })
  @ApiResponse({
    status: 200,
    description: '获取诊所账户详情成功',
    type: ClinicAccountResponseDto,
  })
  @ApiResponse({ status: 404, description: '诊所账户不存在' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  findOne(@Param('id') id: string): Promise<ClinicAccountResponseDto> {
    return this.clinicAccountService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.admin, UserRole.practitioner)
  @ApiOperation({ summary: '更新诊所账户' })
  @ApiResponse({
    status: 200,
    description: '诊所账户更新成功',
    type: ClinicAccountResponseDto,
  })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 404, description: '诊所账户不存在' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  update(
    @Param('id') id: string,
    @Body() updateClinicAccountDto: UpdateClinicAccountDto,
  ): Promise<ClinicAccountResponseDto> {
    return this.clinicAccountService.update(id, updateClinicAccountDto);
  }

  @Delete(':id')
  @Roles(UserRole.admin)
  @ApiOperation({ summary: '删除诊所账户' })
  @ApiResponse({ status: 200, description: '诊所账户删除成功' })
  @ApiResponse({ status: 404, description: '诊所账户不存在' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  remove(@Param('id') id: string): Promise<{ message: string }> {
    return this.clinicAccountService.remove(id);
  }

  @Get(':id/balance')
  @Roles(UserRole.admin, UserRole.practitioner)
  @ApiOperation({ summary: '获取诊所账户余额' })
  @ApiResponse({
    status: 200,
    description: '获取账户余额成功',
    type: BalanceResponseDto,
  })
  @ApiResponse({ status: 404, description: '诊所账户不存在' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  getBalance(@Param('id') id: string, @Request() req): Promise<BalanceResponseDto> {
    const { user } = req;
    return this.clinicAccountService.getBalance(id, user?.sub, user?.role);
  }
} 