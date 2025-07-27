import { Injectable } from "@nestjs/common";
import * as crypto from "crypto";

export interface QRCodeData {
  prescriptionId: string;
  doctorId: string;
  issuedAt: string;
  expiresAt: string;
  verifyCode: string;
  signature: string;
}

@Injectable()
export class QRCodeService {
  private readonly secretKey =
    process.env.QR_CODE_SECRET || "default-secret-key";
  private readonly expirationHours = 72; // QR码有效期72小时

  /**
   * 生成处方QR码数据
   */
  generateQRCodeData(prescription: any): QRCodeData {
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(
      Date.now() + this.expirationHours * 60 * 60 * 1000,
    ).toISOString();
    const verifyCode = this.generateVerifyCode();

    const qrData: Omit<QRCodeData, "signature"> = {
      prescriptionId: prescription.prescriptionId,
      doctorId: prescription.doctorId,
      issuedAt,
      expiresAt,
      verifyCode,
    };

    const signature = this.generateSignature(qrData);

    return {
      ...qrData,
      signature,
    };
  }

  /**
   * 验证QR码数据的有效性
   */
  verifyQRCodeData(qrData: QRCodeData): { isValid: boolean; error?: string } {
    try {
      // 检查是否过期
      const now = new Date();
      const expiresAt = new Date(qrData.expiresAt);

      if (now > expiresAt) {
        return { isValid: false, error: "处方已过期" };
      }

      // 验证签名
      const { signature, ...dataWithoutSignature } = qrData;
      const expectedSignature = this.generateSignature(dataWithoutSignature);

      if (signature !== expectedSignature) {
        return { isValid: false, error: "处方验证失败，数据可能被篡改" };
      }

      return { isValid: true };
    } catch (_error) {
      return { isValid: false, error: "处方数据格式错误" };
    }
  }

  /**
   * 生成QR码字符串（用于前端QR码生成）
   */
  generateQRCodeString(qrData: QRCodeData): string {
    const baseUrl = process.env.APP_BASE_URL || "https://tcm-prescription.nz";
    const encodedData = Buffer.from(JSON.stringify(qrData)).toString(
      "base64url",
    );
    return `${baseUrl}/verify?data=${encodedData}`;
  }

  /**
   * 从QR码字符串解析数据
   */
  parseQRCodeString(qrCodeString: string): QRCodeData | null {
    try {
      const url = new URL(qrCodeString);
      const encodedData = url.searchParams.get("data");

      if (!encodedData) {
        return null;
      }

      const jsonString = Buffer.from(encodedData, "base64url").toString();
      return JSON.parse(jsonString) as QRCodeData;
    } catch (_error) {
      return null;
    }
  }

  /**
   * 生成验证码
   */
  private generateVerifyCode(): string {
    return crypto.randomBytes(4).toString("hex").toUpperCase();
  }

  /**
   * 生成数字签名
   */
  private generateSignature(data: Omit<QRCodeData, "signature">): string {
    const dataString = JSON.stringify(data, Object.keys(data).sort());
    return crypto
      .createHmac("sha256", this.secretKey)
      .update(dataString)
      .digest("hex");
  }

  /**
   * 更新处方的QR码数据
   */
  updatePrescriptionQRCode(prescription: any): any {
    const qrData = this.generateQRCodeData(prescription);
    const qrCodeString = this.generateQRCodeString(qrData);

    return {
      ...prescription,
      qrCodeData: JSON.stringify(qrData),
      qrCodeString,
    };
  }
}
