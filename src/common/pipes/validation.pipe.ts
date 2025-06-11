import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
  ValidationPipe as NestValidationPipe,
  Logger,
} from "@nestjs/common";
import { validate } from "class-validator";
import { plainToClass } from "class-transformer";

@Injectable()
export class CustomValidationPipe implements PipeTransform {
  private readonly logger = new Logger(CustomValidationPipe.name);

  async transform(value: any, metadata: ArgumentMetadata): Promise<any> {
    const { metatype } = metadata;

    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    const object = plainToClass(metatype, value);
    const errors = await validate(object, {
      whitelist: true, // 移除未定义的属性
      forbidNonWhitelisted: true, // 禁止非白名单属性
      transform: true, // 自动转换类型
      validateCustomDecorators: true, // 验证自定义装饰器
    });

    if (errors.length > 0) {
      const errorMessages = this.formatErrors(errors);
      this.logger.warn(`Validation failed: ${JSON.stringify(errorMessages)}`);

      throw new BadRequestException({
        message: "Validation failed",
        errors: errorMessages,
        statusCode: 400,
      });
    }

    return object;
  }

  private toValidate(metatype: any): boolean {
    const types = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  private formatErrors(errors: any[]): any[] {
    return errors.map((error) => ({
      property: error.property,
      value: error.value,
      constraints: error.constraints,
      children:
        error.children?.length > 0
          ? this.formatErrors(error.children)
          : undefined,
    }));
  }
}

/**
 * 预配置的验证管道实例
 */
export const validationPipeConfig = new NestValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  validateCustomDecorators: true,
  transformOptions: {
    enableImplicitConversion: true,
  },
  exceptionFactory: (errors) => {
    const formattedErrors = errors.map((error) => ({
      property: error.property,
      value: error.value,
      constraints: error.constraints,
    }));

    return new BadRequestException({
      message: "Validation failed",
      errors: formattedErrors,
      statusCode: 400,
    });
  },
});
