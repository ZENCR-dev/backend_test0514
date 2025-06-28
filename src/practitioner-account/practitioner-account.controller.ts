import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PractitionerAccountService } from './services/practitioner-account.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/**
 * 医师个人账户控制器
 * 
 * 提供医师个人账户相关的API端点：
 * - 账户余额查询
 * - 交易历史查询
 * - 账户状态管理
 */
@ApiTags('practitioner-accounts')
@Controller('api/v1/practitioner-accounts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PractitionerAccountController {
  private readonly logger = new Logger(PractitionerAccountController.name);

  constructor(
    private readonly practitionerAccountService: PractitionerAccountService,
  ) {}

  /**
   * 获取当前医师的账户余额
   */
  @Get('balance')
  @ApiOperation({ summary: '获取医师账户余额' })
  @ApiResponse({ status: 200, description: '成功获取账户余额' })
  @ApiResponse({ status: 404, description: '账户不存在' })
  async getBalance(@CurrentUser() user: any) {
    this.logger.log(`Getting balance for practitioner ${user.id}`);
    
    // TODO: 实现余额查询API
    throw new Error("API not implemented");
  }

  /**
   * 获取当前医师的交易历史
   */
  @Get('transactions')
  @ApiOperation({ summary: '获取医师账户交易历史' })
  @ApiResponse({ status: 200, description: '成功获取交易历史' })
  async getTransactionHistory(
    @CurrentUser() user: any,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    this.logger.log(`Getting transaction history for practitioner ${user.id}`);
    
    // TODO: 实现交易历史查询API
    throw new Error("API not implemented");
  }

  /**
   * 获取当前医师的账户信息
   */
  @Get('info')
  @ApiOperation({ summary: '获取医师账户信息' })
  @ApiResponse({ status: 200, description: '成功获取账户信息' })
  @ApiResponse({ status: 404, description: '账户不存在' })
  async getAccountInfo(@CurrentUser() user: any) {
    this.logger.log(`Getting account info for practitioner ${user.id}`);
    
    // TODO: 实现账户信息查询API
    throw new Error("API not implemented");
  }
} 
