import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { PrescriptionsRepository } from './prescriptions.repository';

@Injectable()
export class PrescriptionsService {
  constructor(private readonly prescriptionsRepository: PrescriptionsRepository) {}

  async create(createPrescriptionDto: CreatePrescriptionDto, doctorId: string) {
    try {
      // 验证药品存在性和可用性
      await this.validateMedicines(createPrescriptionDto.medicines);
      
      // 创建处方
      const prescription = await this.prescriptionsRepository.create({
        ...createPrescriptionDto,
        doctorId,
        status: 'draft', // 默认为草稿状态
        createdAt: new Date(),
        updatedAt: new Date()
      });

      return {
        success: true,
        data: prescription,
        message: '处方创建成功'
      };
    } catch (error) {
      throw new Error(`创建处方失败: ${error.message}`);
    }
  }

  async findAll(doctorId: string, options: { page?: number; limit?: number }) {
    try {
      const { page = 1, limit = 20 } = options;
      const prescriptions = await this.prescriptionsRepository.findByDoctor(
        doctorId,
        page,
        limit
      );

      return {
        success: true,
        data: prescriptions.data,
        pagination: {
          page,
          limit,
          total: prescriptions.total,
          totalPages: Math.ceil(prescriptions.total / limit)
        }
      };
    } catch (error) {
      throw new Error(`获取处方列表失败: ${error.message}`);
    }
  }

  async findOne(id: string, doctorId: string) {
    try {
      const prescription = await this.prescriptionsRepository.findById(id);
      
      if (!prescription) {
        throw new NotFoundException('处方不存在');
      }

      // 验证权限：只有处方的医生可以查看
      if (prescription.doctorId !== doctorId) {
        throw new ForbiddenException('无权访问此处方');
      }

      return {
        success: true,
        data: prescription
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new Error(`获取处方详情失败: ${error.message}`);
    }
  }

  async update(id: string, updatePrescriptionDto: Partial<CreatePrescriptionDto>, doctorId: string) {
    try {
      // 验证处方存在和权限
      const existingPrescription = await this.findOne(id, doctorId);
      
      // 如果更新药品信息，需要重新验证
      if (updatePrescriptionDto.medicines) {
        await this.validateMedicines(updatePrescriptionDto.medicines);
      }

      const updatedPrescription = await this.prescriptionsRepository.update(id, {
        ...updatePrescriptionDto,
        updatedAt: new Date()
      });

      return {
        success: true,
        data: updatedPrescription,
        message: '处方更新成功'
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new Error(`更新处方失败: ${error.message}`);
    }
  }

  async remove(id: string, doctorId: string) {
    try {
      // 验证处方存在和权限
      await this.findOne(id, doctorId);
      
      await this.prescriptionsRepository.delete(id);

      return {
        success: true,
        message: '处方删除成功'
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new Error(`删除处方失败: ${error.message}`);
    }
  }

  private async validateMedicines(medicines: any[]) {
    // TODO: 实现药品验证逻辑
    // 1. 检查药品ID是否存在
    // 2. 检查药品是否可用
    // 3. 验证用量是否合理
    
    // 临时实现：基本验证
    if (!medicines || medicines.length === 0) {
      throw new Error('处方必须包含至少一种药品');
    }

    for (const medicine of medicines) {
      if (!medicine.medicineId || !medicine.dosage || !medicine.frequency) {
        throw new Error('药品信息不完整：缺少药品ID、用量或频次');
      }
    }

    return true;
  }
} 