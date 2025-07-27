import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Body,
  BadRequestException,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiConsumes,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { FulfillmentService } from "../services/fulfillment.service";
import { ApiResponse } from "../../common/dto/api-response.dto";
import {
  UploadFulfillmentDto,
  FulfillmentQueryDto,
} from "../dto/fulfillment.dto";

// 文件验证配置
const FILE_VALIDATION_OPTIONS = {
  validators: [
    new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
    new FileTypeValidator({ fileType: /(jpg|jpeg|png)$/i }),
  ],
  errorHttpStatusCode: 400,
};

@ApiTags("药房-履约凭证")
@Controller("pharmacy/fulfillments")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("pharmacy_operator")
@ApiBearerAuth()
export class FulfillmentController {
  constructor(private readonly fulfillmentService: FulfillmentService) {}

  @Post()
  @ApiOperation({ summary: "上传履约凭证" })
  @ApiConsumes("multipart/form-data")
  @SwaggerApiResponse({
    status: 201,
    description: "履约凭证上传成功",
    type: ApiResponse,
  })
  @SwaggerApiResponse({
    status: 400,
    description: "文件格式不正确、文件过大或参数验证失败",
  })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: "packagePhoto", maxCount: 1 },
      { name: "scalePhoto", maxCount: 1 },
    ]),
  )
  async uploadFulfillmentProof(
    @UploadedFiles(new ParseFilePipe(FILE_VALIDATION_OPTIONS))
    files: {
      packagePhoto?: Express.Multer.File[];
      scalePhoto?: Express.Multer.File[];
    },
    @Body() body: Partial<UploadFulfillmentDto>,
    @CurrentUser() user: any,
  ) {
    const pharmacyId = user.operatedPharmacy?.id;

    if (!pharmacyId) {
      throw new BadRequestException("无法确定药房信息");
    }

    // 验证必需的文件
    if (!files.packagePhoto || !files.scalePhoto) {
      throw new BadRequestException("必须上传药包照片和电子秤照片");
    }

    if (!files.packagePhoto[0] || !files.scalePhoto[0]) {
      throw new BadRequestException("文件上传失败，请重试");
    }

    const packagePhoto = files.packagePhoto[0];
    const scalePhoto = files.scalePhoto[0];

    // 额外的文件大小检查
    if (
      packagePhoto.size > 5 * 1024 * 1024 ||
      scalePhoto.size > 5 * 1024 * 1024
    ) {
      throw new BadRequestException("文件大小不能超过5MB");
    }

    // 验证必需的字段
    if (!body.orderId || !body.actualWeight) {
      throw new BadRequestException("缺少必需的字段：orderId 和 actualWeight");
    }

    // 验证重量值
    const actualWeight = Number(body.actualWeight);
    if (isNaN(actualWeight) || actualWeight <= 0 || actualWeight > 10000) {
      throw new BadRequestException("重量必须是0.1-10000克之间的有效数字");
    }

    // 验证备注长度
    if (body.notes && body.notes.length > 500) {
      throw new BadRequestException("备注长度不能超过500字符");
    }

    const fulfillmentData = {
      orderId: body.orderId,
      packagePhoto,
      scalePhoto,
      actualWeight,
      notes: body.notes,
    };

    return await this.fulfillmentService.uploadFulfillmentProof(
      pharmacyId,
      fulfillmentData,
    );
  }

  @Get()
  @ApiOperation({ summary: "获取履约记录列表" })
  @SwaggerApiResponse({
    status: 200,
    description: "获取成功",
    type: ApiResponse,
  })
  async getFulfillmentRecords(
    @Query() query: FulfillmentQueryDto,
    @CurrentUser() user: any,
  ) {
    const pharmacyId = user.operatedPharmacy?.id;

    if (!pharmacyId) {
      throw new BadRequestException("无法确定药房信息");
    }

    return await this.fulfillmentService.getFulfillmentRecords(pharmacyId, {
      status: query.status,
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 20,
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "获取履约记录详情" })
  @SwaggerApiResponse({
    status: 200,
    description: "获取成功",
    type: ApiResponse,
  })
  @SwaggerApiResponse({
    status: 404,
    description: "履约记录不存在",
  })
  async getFulfillmentDetail(
    @Param("id") fulfillmentId: string,
    @CurrentUser() user: any,
  ) {
    const pharmacyId = user.operatedPharmacy?.id;

    if (!pharmacyId) {
      throw new BadRequestException("无法确定药房信息");
    }

    return await this.fulfillmentService.getFulfillmentDetail(
      fulfillmentId,
      pharmacyId,
    );
  }
}
