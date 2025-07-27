import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Decimal } from "@prisma/client/runtime/library";
import { PrescriptionsService } from "../prescriptions.service";
import { PaymentService } from "../../../payment/services/payment.service";
import { PractitionerAccountService } from "../../../practitioner-account/services/practitioner-account.service";

/**
 * 处方支付服务
 *
 * 职责范围：
 * - 处方余额支付流程
 * - 处方Stripe支付流程
 * - 处方支付状态管理
 * - 支付事件发布
 */
@Injectable()
export class PrescriptionPaymentService {
  private readonly logger = new Logger(PrescriptionPaymentService.name);

  constructor(
    private readonly prescriptionsService: PrescriptionsService,
    private readonly paymentService: PaymentService,
    private readonly practitionerAccountService: PractitionerAccountService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 使用余额支付处方
   * @param prescriptionId 处方ID
   * @param practitionerId 医师ID
   * @returns 支付结果
   */
  async payWithBalance(prescriptionId: string, practitionerId: string) {
    this.logger.log(
      `Processing balance payment for prescription ${prescriptionId}`,
    );

    try {
      // 1. 验证处方
      const prescriptionResult = await this.prescriptionsService.findOne(
        prescriptionId,
        practitionerId,
      );
      const prescription = prescriptionResult.data;

      // 2. 检查处方所有权（处方结构使用doctorId字段）
      if (prescription.doctorId !== practitionerId) {
        throw new BadRequestException("无权限操作此处方");
      }

      // 3. 检查处方状态
      if (
        prescription.status !== "DRAFT" &&
        prescription.status !== "created"
      ) {
        throw new BadRequestException("处方状态不允许支付");
      }

      // 4. 检查余额
      const balance =
        await this.practitionerAccountService.getBalance(practitionerId);
      const totalAvailable = balance.balance.add(balance.availableCredit);
      const totalAmount = new Decimal(prescription.totalAmount || 0);

      if (totalAvailable.lt(totalAmount)) {
        throw new BadRequestException(
          `余额不足。当前可用金额: ${totalAvailable.toFixed(2)}, 需要: ${totalAmount.toFixed(2)}`,
        );
      }

      // 5. 执行扣款
      const idempotencyKey = `prescription_${prescriptionId}_${Date.now()}`;

      const deductionResult =
        await this.paymentService.deductFromPractitionerAccount({
          practitionerId,
          amount: totalAmount,
          orderId: prescriptionId,
          description: `处方支付: ${prescriptionId}`,
          idempotencyKey,
        });

      // 6. 检查扣款结果
      if (deductionResult.status === "insufficient_funds") {
        throw new BadRequestException("余额不足，扣款失败");
      }

      if (deductionResult.status !== "success") {
        throw new InternalServerErrorException("扣款失败，请重试");
      }

      // 7. 更新处方状态
      const updateResult = await this.prescriptionsService.updateStatus(
        prescriptionId,
        "PAID",
        practitionerId,
      );

      // 8. 发送支付完成事件
      this.eventEmitter.emit("prescription.payment.completed", {
        prescriptionId,
        practitionerId,
        status: "paid",
        paymentMethod: "balance",
        amount: totalAmount.toNumber(),
        timestamp: new Date().toISOString(),
      });

      this.logger.log(
        `Balance payment completed for prescription ${prescriptionId}`,
      );

      return {
        success: true,
        data: {
          ...updateResult.data,
          paymentMethod: "balance",
          transactionId: deductionResult.transactionId,
          remainingBalance: deductionResult.remainingBalance,
        },
        message: "余额支付成功",
      };
    } catch (error) {
      this.logger.error(
        `Balance payment failed for prescription ${prescriptionId}:`,
        error,
      );

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(`支付失败: ${error.message}`);
    }
  }

  /**
   * 使用Stripe支付处方
   * @param prescriptionId 处方ID
   * @param practitionerId 医师ID
   * @returns 支付意图结果
   */
  async payWithStripe(prescriptionId: string, practitionerId: string) {
    this.logger.log(
      `Creating Stripe payment intent for prescription ${prescriptionId}`,
    );

    try {
      // 1. 验证处方
      const prescriptionResult = await this.prescriptionsService.findOne(
        prescriptionId,
        practitionerId,
      );
      const prescription = prescriptionResult.data;

      // 2. 检查处方所有权
      if (prescription.doctorId !== practitionerId) {
        throw new BadRequestException("无权限操作此处方");
      }

      // 3. 检查处方状态
      if (
        prescription.status !== "DRAFT" &&
        prescription.status !== "created"
      ) {
        throw new BadRequestException("处方状态不允许支付");
      }

      // 4. 创建Stripe支付意图
      const totalAmount = new Decimal(prescription.totalAmount || 0);
      const paymentIntent = await this.paymentService.createPaymentIntent({
        amount: totalAmount,
        practitionerId,
        orderId: prescriptionId,
        currency: "NZD",
        metadata: {
          type: "prescription_payment",
          prescriptionId,
        },
      });

      this.logger.log(
        `Stripe payment intent created for prescription ${prescriptionId}: ${paymentIntent.id}`,
      );

      return {
        success: true,
        data: {
          prescriptionId,
          paymentIntentId: paymentIntent.id,
          clientSecret: paymentIntent.clientSecret,
          amount: totalAmount.toNumber(),
          currency: "NZD",
          status: paymentIntent.status,
        },
        message: "Stripe支付意图创建成功",
      };
    } catch (error) {
      this.logger.error(
        `Stripe payment intent creation failed for prescription ${prescriptionId}:`,
        error,
      );

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        `创建支付意图失败: ${error.message}`,
      );
    }
  }

  /**
   * 更新处方支付状态
   * @param prescriptionId 处方ID
   * @param status 新状态
   * @returns 更新结果
   */
  async updatePrescriptionPaymentStatus(
    prescriptionId: string,
    status: string,
  ) {
    this.logger.log(
      `Updating prescription payment status: ${prescriptionId} -> ${status}`,
    );

    try {
      // 首先获取处方以获取医师ID
      const prescriptionResult = await this.prescriptionsService.findOne(
        prescriptionId,
        "system",
      );
      const prescription = prescriptionResult.data;

      // 更新状态
      const updateResult = await this.prescriptionsService.updateStatus(
        prescriptionId,
        status,
        prescription.doctorId,
      );

      this.logger.log(
        `Prescription payment status updated: ${prescriptionId} -> ${status}`,
      );

      return updateResult;
    } catch (error) {
      this.logger.error(
        `Failed to update prescription payment status ${prescriptionId}:`,
        error,
      );

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        `更新支付状态失败: ${error.message}`,
      );
    }
  }

  /**
   * 获取处方支付状态
   * @param prescriptionId 处方ID
   * @param practitionerId 医师ID
   * @returns 支付状态信息
   */
  async getPaymentStatus(prescriptionId: string, practitionerId: string) {
    this.logger.log(
      `Getting payment status for prescription ${prescriptionId}`,
    );

    try {
      // 获取处方信息
      const prescriptionResult = await this.prescriptionsService.findOne(
        prescriptionId,
        practitionerId,
      );
      const prescription = prescriptionResult.data;

      return {
        success: true,
        data: {
          prescriptionId,
          status: prescription.status,
          totalAmount: prescription.totalAmount || 0,
          currency: "NZD",
          createdAt: prescription.createdAt,
          updatedAt: prescription.updatedAt,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get payment status for prescription ${prescriptionId}:`,
        error,
      );

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        `获取支付状态失败: ${error.message}`,
      );
    }
  }

  /**
   * 处理支付成功事件（由Webhook或其他支付确认触发）
   * @param prescriptionId 处方ID
   * @param paymentIntentId 支付意图ID
   * @param practitionerId 医师ID
   */
  async handlePaymentSuccess(
    prescriptionId: string,
    paymentIntentId: string,
    practitionerId: string,
  ) {
    this.logger.log(
      `Processing payment success for prescription ${prescriptionId}`,
    );

    try {
      // 更新处方状态为已支付
      await this.updatePrescriptionPaymentStatus(prescriptionId, "PAID");

      // 发送支付完成事件
      this.eventEmitter.emit("prescription.payment.completed", {
        prescriptionId,
        practitionerId,
        paymentIntentId,
        status: "paid",
        paymentMethod: "stripe",
        timestamp: new Date().toISOString(),
      });

      this.logger.log(
        `Payment success processed for prescription ${prescriptionId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process payment success for prescription ${prescriptionId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * 处理支付失败事件
   * @param prescriptionId 处方ID
   * @param paymentIntentId 支付意图ID
   * @param practitionerId 医师ID
   * @param failureReason 失败原因
   */
  async handlePaymentFailure(
    prescriptionId: string,
    paymentIntentId: string,
    practitionerId: string,
    failureReason: string,
  ) {
    this.logger.log(
      `Processing payment failure for prescription ${prescriptionId}: ${failureReason}`,
    );

    try {
      // 发送支付失败事件
      this.eventEmitter.emit("prescription.payment.failed", {
        prescriptionId,
        practitionerId,
        paymentIntentId,
        status: "failed",
        paymentMethod: "stripe",
        failureReason,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(
        `Payment failure processed for prescription ${prescriptionId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process payment failure for prescription ${prescriptionId}:`,
        error,
      );
      throw error;
    }
  }
}
