import { Injectable, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as AWS from "aws-sdk";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class FileUploadService {
  private s3: AWS.S3;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    // 初始化AWS S3配置
    this.s3 = new AWS.S3({
      accessKeyId: this.configService.get("AWS_ACCESS_KEY_ID"),
      secretAccessKey: this.configService.get("AWS_SECRET_ACCESS_KEY"),
      region: this.configService.get("AWS_REGION", "ap-southeast-2"),
    });

    this.bucketName = this.configService.get(
      "AWS_S3_BUCKET",
      "nztcm-pharmacy-files",
    );
  }

  /**
   * 上传文件到S3
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: string = "general",
  ): Promise<string> {
    try {
      // 1. 验证文件
      this.validateFile(file);

      // 2. 处理图片（压缩和格式转换）
      const processedBuffer = await this.processImage(file.buffer);

      // 3. 生成唯一文件名
      const fileExtension = this.getFileExtension(file.originalname);
      const fileName = `${folder}/${uuidv4()}.${fileExtension}`;

      // 4. 上传到S3
      const uploadParams: AWS.S3.PutObjectRequest = {
        Bucket: this.bucketName,
        Key: fileName,
        Body: processedBuffer,
        ContentType: file.mimetype,
        ACL: "private", // 私有访问，需要签名URL
        Metadata: {
          originalName: file.originalname,
          uploadedAt: new Date().toISOString(),
        },
      };

      const result = await this.s3.upload(uploadParams).promise();

      return result.Location;
    } catch (error) {
      throw new BadRequestException(`文件上传失败: ${error.message}`);
    }
  }

  /**
   * 生成预签名URL用于临时访问
   */
  async getSignedUrl(
    fileKey: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: fileKey,
        Expires: expiresIn,
      };

      return this.s3.getSignedUrl("getObject", params);
    } catch (error) {
      throw new BadRequestException(`生成访问链接失败: ${error.message}`);
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(fileKey: string): Promise<void> {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: fileKey,
      };

      await this.s3.deleteObject(params).promise();
    } catch (error) {
      console.error("删除文件失败:", error);
      // 删除失败不抛出异常，避免影响主流程
    }
  }

  /**
   * 批量删除文件
   */
  async deleteFiles(fileKeys: string[]): Promise<void> {
    try {
      if (fileKeys.length === 0) return;

      const params = {
        Bucket: this.bucketName,
        Delete: {
          Objects: fileKeys.map((key) => ({ Key: key })),
          Quiet: true,
        },
      };

      await this.s3.deleteObjects(params).promise();
    } catch (error) {
      console.error("批量删除文件失败:", error);
    }
  }

  /**
   * 验证文件
   */
  private validateFile(file: Express.Multer.File): void {
    // 检查文件大小（最大5MB）
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new BadRequestException("文件大小不能超过5MB");
    }

    // 检查文件类型
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException("只支持JPEG、PNG格式的图片文件");
    }

    // 检查文件名
    if (!file.originalname) {
      throw new BadRequestException("文件名不能为空");
    }
  }

  /**
   * 处理图片（压缩和优化）
   */
  private async processImage(buffer: Buffer): Promise<Buffer> {
    try {
      return await sharp(buffer)
        .resize(1920, 1080, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({
          quality: 85,
          progressive: true,
        })
        .toBuffer();
    } catch (error) {
      // 如果图片处理失败，返回原始buffer
      console.error("图片处理失败，使用原始文件:", error);
      return buffer;
    }
  }

  /**
   * 获取文件扩展名
   */
  private getFileExtension(filename: string): string {
    const parts = filename.split(".");
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "jpg";
  }

  /**
   * 从URL提取文件Key
   */
  extractFileKey(fileUrl: string): string {
    try {
      const url = new URL(fileUrl);
      return url.pathname.substring(1); // 移除开头的 '/'
    } catch (error) {
      throw new BadRequestException("无效的文件URL");
    }
  }

  /**
   * 验证文件是否存在
   */
  async fileExists(fileKey: string): Promise<boolean> {
    try {
      await this.s3
        .headObject({
          Bucket: this.bucketName,
          Key: fileKey,
        })
        .promise();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取文件元数据
   */
  async getFileMetadata(fileKey: string) {
    try {
      const result = await this.s3
        .headObject({
          Bucket: this.bucketName,
          Key: fileKey,
        })
        .promise();

      return {
        size: result.ContentLength,
        contentType: result.ContentType,
        lastModified: result.LastModified,
        metadata: result.Metadata,
      };
    } catch (error) {
      throw new BadRequestException("获取文件信息失败");
    }
  }
}
