import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { IsUUID } from "class-validator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { PriceListService } from "../services/price-list.service";
import { ApiResponse } from "../../common/dto/api-response.dto";
import {
  PriceListUploadDto,
  PriceListHistoryQueryDto,
  UpdateStockDto,
} from "../dto/price-list.dto";

@ApiTags("药房-价目表管理")
@Controller("pharmacy/price-lists")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("pharmacy_operator")
@ApiBearerAuth()
export class PriceListController {
  constructor(private readonly priceListService: PriceListService) {}

  @Post()
  @ApiOperation({ summary: "上传价目表" })
  @SwaggerApiResponse({
    status: 201,
    description: "价目表上传成功",
    type: ApiResponse,
  })
  @SwaggerApiResponse({
    status: 400,
    description: "生效日期不符合要求（必须至少7天后）或价目表数据无效",
  })
  async uploadPriceList(
    @Body() priceListData: PriceListUploadDto,
    @CurrentUser() user: any,
  ) {
    const pharmacyId = user.operatedPharmacy?.id;

    if (!pharmacyId) {
      throw new BadRequestException("无法确定药房信息");
    }

    // 额外的业务规则验证
    const effectiveDate = new Date(priceListData.effectiveDate);
    const now = new Date();
    const minDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    if (effectiveDate < minDate) {
      throw new BadRequestException(
        `生效日期必须至少是7天后。最早可设置日期：${minDate.toISOString().split("T")[0]}`,
      );
    }

    // 验证价目表项目唯一性
    const medicineIds = priceListData.items.map((item) => item.medicineId);
    const uniqueIds = new Set(medicineIds);
    if (medicineIds.length !== uniqueIds.size) {
      throw new BadRequestException("价目表中不能包含重复的药品");
    }

    // 验证价目表项目数量
    if (priceListData.items.length > 1000) {
      throw new BadRequestException("单次上传的价目表项目不能超过1000个");
    }

    return await this.priceListService.uploadPriceList(
      pharmacyId,
      priceListData,
    );
  }

  @Get("current")
  @ApiOperation({ summary: "获取当前生效的价目表" })
  @SwaggerApiResponse({
    status: 200,
    description: "获取成功",
    type: ApiResponse,
  })
  @SwaggerApiResponse({
    status: 404,
    description: "未找到生效的价目表",
  })
  async getCurrentPriceList(@CurrentUser() user: any) {
    const pharmacyId = user.operatedPharmacy?.id;

    if (!pharmacyId) {
      throw new BadRequestException("无法确定药房信息");
    }

    const result = await this.priceListService.getCurrentPriceList(pharmacyId);

    if (!result) {
      return {
        success: false,
        error: {
          code: "PRICE_LIST_NOT_FOUND",
          message: "未找到当前生效的价目表",
        },
      };
    }

    return result;
  }

  @Get("history")
  @ApiOperation({ summary: "获取价目表历史版本" })
  @SwaggerApiResponse({
    status: 200,
    description: "获取成功",
    type: ApiResponse,
  })
  async getPriceListHistory(
    @Query() query: PriceListHistoryQueryDto,
    @CurrentUser() user: any,
  ) {
    const pharmacyId = user.operatedPharmacy?.id;

    if (!pharmacyId) {
      throw new BadRequestException("无法确定药房信息");
    }

    return await this.priceListService.getPriceListHistory(pharmacyId, {
      status: query.status,
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 20,
    });
  }

  @Patch("items/:medicineId")
  @ApiOperation({ summary: "更新单个药品库存状态" })
  @ApiParam({
    name: "medicineId",
    description: "药品ID",
    example: "med_123",
  })
  @SwaggerApiResponse({
    status: 200,
    description: "更新成功",
    type: ApiResponse,
  })
  @SwaggerApiResponse({
    status: 400,
    description: "药品ID格式无效或参数验证失败",
  })
  @SwaggerApiResponse({
    status: 404,
    description: "药品在价目表中不存在",
  })
  async updateMedicineStock(
    @Param("medicineId") medicineId: string,
    @Body() updateData: UpdateStockDto,
    @CurrentUser() user: any,
  ) {
    const pharmacyId = user.operatedPharmacy?.id;

    if (!pharmacyId) {
      throw new BadRequestException("无法确定药房信息");
    }

    // 验证药品ID格式
    if (!medicineId || medicineId.trim().length === 0) {
      throw new BadRequestException("药品ID不能为空");
    }

    if (medicineId.length > 100) {
      throw new BadRequestException("药品ID长度不能超过100字符");
    }

    // 验证inStock字段
    if (updateData.inStock === undefined || updateData.inStock === null) {
      throw new BadRequestException("inStock字段是必需的，必须是true或false");
    }

    if (typeof updateData.inStock !== "boolean") {
      throw new BadRequestException("inStock字段必须是布尔值（true或false）");
    }

    // 验证备注长度
    if (updateData.notes && updateData.notes.length > 200) {
      throw new BadRequestException("备注长度不能超过200字符");
    }

    return await this.priceListService.updateMedicineStock(
      pharmacyId,
      medicineId,
      updateData,
    );
  }
}
