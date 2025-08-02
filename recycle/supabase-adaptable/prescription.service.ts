/**
 * 🔄 后端代码复用资产 - Prescription Management Service
 * 原项目: B2B2C中医处方履约平台
 * 复用等级: 二级复用 (70% 复用价值)
 * 迁移目标: Supabase Edge Functions + RLS策略
 * 适配要求: 替换Prisma为Supabase Client，保留核心业务逻辑
 * 测试覆盖: 单元测试覆盖率>80%
 * 
 * @migration Supabase-First架构适配
 * @security RLS策略集成要求 - 处方数据隔离策略
 * @performance Edge Functions优化建议 - 处方查询缓存
 */

// 核心处方业务类型定义 - 可直接复用
export interface CreatePrescriptionDto {
  medicines: Array<{
    medicineId: string;
    weight: number;
    notes: string;
  }>;
  copies: number; // 帖数
  notes?: string;
}

export interface PrescriptionDto {
  id: string;
  doctorId: string;
  medicines: Array<{
    medicineId: string;
    medicineName?: string;
    weight: number;
    notes: string;
  }>;
  copies: number;
  notes?: string;
  status: string;
  totalAmount?: number;
  createdAt: Date;
  updatedAt: Date;
  qrCodeData?: string;
  qrCodeString?: string;
}

export interface PrescriptionQueryOptions {
  page?: number;
  limit?: number;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface PrescriptionResponse<T = PrescriptionDto> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PrescriptionListResponse {
  success: boolean;
  data: PrescriptionDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 数据库抽象接口 - Supabase适配点
export interface PrescriptionRepository {
  create(data: any): Promise<PrescriptionDto>;
  findById(id: string): Promise<PrescriptionDto | null>;
  findByDoctor(doctorId: string, page: number, limit: number): Promise<{
    data: PrescriptionDto[];
    total: number;
  }>;
  update(id: string, data: any): Promise<PrescriptionDto>;
  updateStatus(id: string, status: string): Promise<PrescriptionDto>;
  delete(id: string): Promise<void>;
  findWithFilters(doctorId: string, options: PrescriptionQueryOptions): Promise<{
    data: PrescriptionDto[];
    total: number;
  }>;
}

// QR码服务接口 - 服务依赖适配点
export interface QRCodeService {
  updatePrescriptionQRCode(prescription: any): any;
  parseQRCodeString(qrCodeString: string): any;
  verifyQRCodeData(qrData: any): { isValid: boolean; error?: string };
}

// 药品验证服务接口 - 服务依赖适配点
export interface MedicineValidationService {
  validateMedicines(medicines: any[]): Promise<boolean>;
  getMedicineInfo(medicineId: string): Promise<any>;
}

/**
 * 处方管理核心业务服务
 * 
 * 🚨 复用重点：
 * - 处方创建和验证逻辑 (100%复用)
 * - 权限控制和安全检查 (90%复用)
 * - 状态管理和生命周期 (100%复用)
 * - QR码集成逻辑 (100%复用)
 * 
 * Supabase迁移说明：
 * - 替换PrismaService为SupabaseClient
 * - 适配RLS策略进行数据隔离
 * - 保留所有业务验证逻辑
 * - 迁移到Edge Functions运行环境
 * 
 * ⚠️ 需要适配的部分：
 * - 数据库查询语法 (Prisma → Supabase)
 * - 事务处理机制
 * - 错误处理和异常类型
 * - 依赖注入和服务初始化
 */
export class PrescriptionService {
  constructor(
    private readonly prescriptionRepository: PrescriptionRepository,
    private readonly qrCodeService: QRCodeService,
    private readonly medicineValidationService: MedicineValidationService,
    private readonly logger: any = console
  ) {}

  /**
   * 🚨 核心业务逻辑：创建处方 - 100%复用
   * 
   * 关键功能：
   * - 输入参数验证
   * - 药品存在性验证
   * - 处方数据构建
   * - 隐私合规处理（无患者信息）
   */
  async create(createPrescriptionDto: CreatePrescriptionDto, doctorId: string): Promise<PrescriptionResponse> {
    try {
      // 🚨 核心验证逻辑：输入参数验证
      if (!doctorId) {
        throw new Error("医师ID不能为空");
      }

      if (!createPrescriptionDto.copies || createPrescriptionDto.copies <= 0) {
        throw new Error("帖数必须大于0");
      }

      // 🚨 核心验证逻辑：药品存在性和可用性验证
      await this.validateMedicines(createPrescriptionDto.medicines);

      // 🚨 核心数据构建：隐私合规版本，无患者信息
      const prescriptionData = {
        doctorId,
        medicines: createPrescriptionDto.medicines,
        copies: createPrescriptionDto.copies, // Direct mapping: copies → copies
        notes: createPrescriptionDto.notes,
        status: "DRAFT", // 默认状态
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // 创建处方
      const prescription = await this.prescriptionRepository.create(prescriptionData);

      this.logger.log(`Prescription created successfully: ${prescription.id}`);

      return {
        success: true,
        data: prescription,
        message: "处方创建成功",
      };
    } catch (error) {
      this.logger.error(`Failed to create prescription:`, error);
      throw new Error(`创建处方失败: ${error.message}`);
    }
  }

  /**
   * 🚨 核心业务逻辑：查询处方列表 - 100%复用
   * 
   * 关键功能：
   * - 分页查询支持
   * - 医师权限验证
   * - 数据格式化输出
   * - 性能优化查询
   */
  async findAll(doctorId: string, options: PrescriptionQueryOptions = {}): Promise<PrescriptionListResponse> {
    try {
      const { page = 1, limit = 20 } = options;
      
      // 🚨 核心查询逻辑：基于医师ID的权限过滤
      const prescriptions = await this.prescriptionRepository.findByDoctor(doctorId, page, limit);

      return {
        success: true,
        data: prescriptions.data,
        pagination: {
          page,
          limit,
          total: prescriptions.total,
          totalPages: Math.ceil(prescriptions.total / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get prescription list for doctor ${doctorId}:`, error);
      throw new Error(`获取处方列表失败: ${error.message}`);
    }
  }

  /**
   * 🚨 核心业务逻辑：查询单个处方 - 100%复用
   * 
   * 安全特性：
   * - 处方存在性验证
   * - 医师权限验证
   * - 数据完整性检查
   * - 错误处理机制
   */
  async findOne(id: string, doctorId: string): Promise<PrescriptionResponse> {
    try {
      // 🚨 输入验证
      if (!id || id.trim() === "" || !doctorId || doctorId.trim() === "") {
        throw new Error("处方ID和医师ID不能为空");
      }

      const prescription = await this.prescriptionRepository.findById(id);

      if (!prescription) {
        throw new Error("处方不存在");
      }

      // 🚨 核心权限验证：只有处方的医生可以查看
      if (prescription.doctorId !== doctorId) {
        throw new Error("无权访问此处方");
      }

      return {
        success: true,
        data: prescription,
      };
    } catch (error) {
      this.logger.error(`Failed to get prescription ${id}:`, error);
      
      if (error.message.includes("不存在") || error.message.includes("无权访问")) {
        throw error; // 重新抛出业务异常
      }
      
      throw new Error(`获取处方详情失败: ${error.message}`);
    }
  }

  /**
   * 🚨 核心业务逻辑：更新处方 - 100%复用
   * 
   * 关键功能：
   * - 权限验证和所有权检查
   * - 部分更新支持
   * - 药品信息重新验证
   * - 状态一致性维护
   */
  async update(
    id: string,
    updatePrescriptionDto: Partial<CreatePrescriptionDto>,
    doctorId: string,
  ): Promise<PrescriptionResponse> {
    try {
      // 🚨 验证处方存在和权限
      await this.findOne(id, doctorId);

      // 🚨 如果更新药品信息，需要重新验证
      if (updatePrescriptionDto.medicines) {
        await this.validateMedicines(updatePrescriptionDto.medicines);
      }

      // 🚨 构建更新数据
      const updateData: any = {
        updatedAt: new Date(),
      };

      if (updatePrescriptionDto.medicines) {
        updateData.medicines = updatePrescriptionDto.medicines;
      }

      if (updatePrescriptionDto.copies !== undefined && updatePrescriptionDto.copies !== null) {
        updateData.copies = updatePrescriptionDto.copies; // Direct mapping: copies → copies
      }

      if (updatePrescriptionDto.notes !== undefined && updatePrescriptionDto.notes !== null) {
        updateData.notes = updatePrescriptionDto.notes;
      }

      const updatedPrescription = await this.prescriptionRepository.update(id, updateData);

      this.logger.log(`Prescription updated successfully: ${id}`);

      return {
        success: true,
        data: updatedPrescription,
        message: "处方更新成功",
      };
    } catch (error) {
      this.logger.error(`Failed to update prescription ${id}:`, error);
      
      if (error.message.includes("不存在") || error.message.includes("无权访问")) {
        throw error;
      }
      
      throw new Error(`更新处方失败: ${error.message}`);
    }
  }

  /**
   * 🚨 核心业务逻辑：删除处方 - 100%复用
   * 
   * 安全特性：
   * - 权限验证和所有权检查
   * - 状态检查和业务规则验证
   * - 软删除或硬删除策略
   * - 审计日志记录
   */
  async remove(id: string, doctorId: string): Promise<PrescriptionResponse<null>> {
    try {
      // 🚨 验证处方存在和权限
      const existingPrescription = await this.findOne(id, doctorId);
      
      // 🚨 业务规则验证：某些状态的处方可能不允许删除
      if (existingPrescription.data.status === "PAID" || existingPrescription.data.status === "FULFILLED") {
        throw new Error("已支付或已完成的处方不能删除");
      }

      await this.prescriptionRepository.delete(id);

      this.logger.log(`Prescription deleted successfully: ${id}`);

      return {
        success: true,
        data: null,
        message: "处方删除成功",
      };
    } catch (error) {
      this.logger.error(`Failed to delete prescription ${id}:`, error);
      
      if (error.message.includes("不存在") || error.message.includes("无权访问") || error.message.includes("不能删除")) {
        throw error;
      }
      
      throw new Error(`删除处方失败: ${error.message}`);
    }
  }

  /**
   * 🚨 核心业务逻辑：开具处方 - 100%复用
   * 
   * 关键功能：
   * - 状态检查和转换
   * - QR码生成和集成
   * - 业务流程验证
   * - 数据完整性保证
   */
  async issuePrescription(id: string, doctorId: string): Promise<PrescriptionResponse> {
    try {
      // 🚨 验证处方存在和权限
      const result = await this.findOne(id, doctorId);
      const prescription = result.data;

      // 🚨 检查处方状态
      if (prescription.status !== "DRAFT") {
        throw new Error("只有草稿状态的处方才能开具");
      }

      // 🚨 QR码生成逻辑集成
      const prescriptionWithQR = this.qrCodeService.updatePrescriptionQRCode(prescription);

      // 🚨 更新处方状态为PAID（对应已开具）
      const updatedPrescription = await this.prescriptionRepository.updateStatus(id, "PAID");

      // 更新QR码数据到数据库
      if (prescriptionWithQR.qrCodeData) {
        await this.prescriptionRepository.update(id, {
          notes: `${prescription.notes || ""}\n[QR码已生成]`.trim(),
          qrCodeData: prescriptionWithQR.qrCodeData,
          qrCodeString: prescriptionWithQR.qrCodeString,
        });
      }

      this.logger.log(`Prescription issued successfully: ${id}`);

      return {
        success: true,
        data: {
          ...updatedPrescription,
          qrCodeString: prescriptionWithQR.qrCodeString,
        },
        message: "处方开具成功",
      };
    } catch (error) {
      this.logger.error(`Failed to issue prescription ${id}:`, error);
      
      if (error.message.includes("不存在") || error.message.includes("无权访问") || error.message.includes("只有草稿")) {
        throw error;
      }
      
      throw new Error(`开具处方失败: ${error.message}`);
    }
  }

  /**
   * 🚨 核心业务逻辑：验证处方 - 100%复用
   * 
   * 验证流程：
   * - QR码解析和验证
   * - 数字签名验证
   * - 处方存在性检查
   * - 过期时间验证
   */
  async verifyPrescription(qrCodeString: string): Promise<PrescriptionResponse<{
    prescription: PrescriptionDto;
    verificationInfo: any;
  }>> {
    try {
      // 🚨 解析QR码数据
      const qrData = this.qrCodeService.parseQRCodeString(qrCodeString);

      if (!qrData) {
        throw new Error("无效的QR码格式");
      }

      // 🚨 验证QR码数据
      const verification = this.qrCodeService.verifyQRCodeData(qrData);

      if (!verification.isValid) {
        throw new Error(verification.error || "处方验证失败");
      }

      // 🚨 查询处方详情
      const prescription = await this.prescriptionRepository.findById(qrData.prescriptionId);

      if (!prescription) {
        throw new Error("处方不存在");
      }

      this.logger.log(`Prescription verified successfully: ${qrData.prescriptionId}`);

      return {
        success: true,
        data: {
          prescription,
          verificationInfo: {
            issuedAt: qrData.issuedAt,
            expiresAt: qrData.expiresAt,
            verifyCode: qrData.verifyCode,
          },
        },
        message: "处方验证成功",
      };
    } catch (error) {
      this.logger.error(`Failed to verify prescription:`, error);
      throw new Error(`处方验证失败: ${error.message}`);
    }
  }

  /**
   * 🚨 核心业务逻辑：更新处方状态 - 100%复用
   * 
   * 状态管理功能：
   * - 状态转换验证
   * - 业务规则检查
   * - 权限验证支持
   * - 审计跟踪记录
   */
  async updateStatus(id: string, status: string, doctorId: string): Promise<PrescriptionResponse> {
    try {
      // 🚨 验证处方存在和权限
      await this.findOne(id, doctorId);

      // 🚨 状态转换业务规则验证
      const validStatuses = ["DRAFT", "PAID", "FULFILLED", "CANCELLED"];
      if (!validStatuses.includes(status)) {
        throw new Error(`无效的处方状态: ${status}`);
      }

      const updatedPrescription = await this.prescriptionRepository.updateStatus(id, status);

      this.logger.log(`Prescription status updated: ${id} -> ${status}`);

      return {
        success: true,
        data: updatedPrescription,
        message: "处方状态更新成功",
      };
    } catch (error) {
      this.logger.error(`Failed to update prescription status ${id}:`, error);
      
      if (error.message.includes("不存在") || error.message.includes("无权访问") || error.message.includes("无效的")) {
        throw error;
      }
      
      throw new Error(`更新处方状态失败: ${error.message}`);
    }
  }

  /**
   * 🚨 核心业务逻辑：高级查询处方 - 100%复用
   * 
   * 查询功能：
   * - 多条件筛选支持
   * - 日期范围查询
   * - 状态过滤
   * - 分页和排序
   */
  async findWithFilters(
    doctorId: string,
    options: PrescriptionQueryOptions
  ): Promise<PrescriptionListResponse> {
    try {
      const prescriptions = await this.prescriptionRepository.findWithFilters(doctorId, options);

      const { page = 1, limit = 20 } = options;

      return {
        success: true,
        data: prescriptions.data,
        pagination: {
          page,
          limit,
          total: prescriptions.total,
          totalPages: Math.ceil(prescriptions.total / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get filtered prescriptions for doctor ${doctorId}:`, error);
      throw new Error(`查询处方失败: ${error.message}`);
    }
  }

  /**
   * 🚨 私有方法：药品验证逻辑 - 100%复用
   * 
   * 验证规则：
   * - 药品列表非空验证
   * - 药品信息完整性检查
   * - 剂量合理性验证
   * - 药品存在性验证
   */
  private async validateMedicines(medicines: any[]): Promise<boolean> {
    // 🚨 基础验证
    if (!medicines || medicines.length === 0) {
      throw new Error("处方必须包含至少一种药品");
    }

    // 🚨 详细验证每种药品
    for (const medicine of medicines) {
      if (!medicine.medicineId || medicine.weight == null || !medicine.notes) {
        throw new Error("药品信息不完整：缺少药品ID、克重或用药说明");
      }

      if (medicine.weight <= 0) {
        throw new Error("药品克重必须大于0");
      }

      // 🚨 药品存在性验证（委托给专门的验证服务）
      try {
        await this.medicineValidationService.validateMedicines([medicine]);
      } catch (error) {
        throw new Error(`药品验证失败: ${error.message}`);
      }
    }

    return true;
  }
}

/**
 * Supabase适配器工厂
 * 
 * 使用方法：
 * ```typescript
 * import { createClient } from '@supabase/supabase-js'
 * 
 * const supabase = createClient(url, key)
 * const repository = createSupabasePrescriptionRepository(supabase)
 * const prescriptionService = new PrescriptionService(
 *   repository,
 *   qrCodeService,
 *   medicineValidationService
 * )
 * ```
 */
export function createSupabasePrescriptionRepository(supabaseClient: any): PrescriptionRepository {
  return {
    async create(data: any): Promise<PrescriptionDto> {
      const { data: result, error } = await supabaseClient
        .from('prescriptions')
        .insert({
          doctor_id: data.doctorId,
          medicines: data.medicines,
          copies: data.copies,
          notes: data.notes,
          status: data.status,
          created_at: data.createdAt,
          updated_at: data.updatedAt,
        })
        .select()
        .single();

      if (error) throw error;

      // 🚨 字段映射：snake_case → camelCase
      return {
        id: result.id,
        doctorId: result.doctor_id,
        medicines: result.medicines,
        copies: result.copies,
        notes: result.notes,
        status: result.status,
        totalAmount: result.total_amount,
        createdAt: new Date(result.created_at),
        updatedAt: new Date(result.updated_at),
        qrCodeData: result.qr_code_data,
        qrCodeString: result.qr_code_string,
      };
    },

    async findById(id: string): Promise<PrescriptionDto | null> {
      const { data, error } = await supabaseClient
        .from('prescriptions')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // No rows found
        throw error;
      }

      // 🚨 字段映射和类型转换
      return {
        id: data.id,
        doctorId: data.doctor_id,
        medicines: data.medicines,
        copies: data.copies,
        notes: data.notes,
        status: data.status,
        totalAmount: data.total_amount,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        qrCodeData: data.qr_code_data,
        qrCodeString: data.qr_code_string,
      };
    },

    async findByDoctor(doctorId: string, page: number, limit: number): Promise<{
      data: PrescriptionDto[];
      total: number;
    }> {
      const offset = (page - 1) * limit;

      // 🚨 RLS策略自动过滤：基于doctor_id的访问控制
      const [dataQuery, countQuery] = await Promise.all([
        supabaseClient
          .from('prescriptions')
          .select('*')
          .eq('doctor_id', doctorId)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1),
        
        supabaseClient
          .from('prescriptions')
          .select('*', { count: 'exact', head: true })
          .eq('doctor_id', doctorId)
      ]);

      if (dataQuery.error) throw dataQuery.error;
      if (countQuery.error) throw countQuery.error;

      const prescriptions = dataQuery.data.map(item => ({
        id: item.id,
        doctorId: item.doctor_id,
        medicines: item.medicines,
        copies: item.copies,
        notes: item.notes,
        status: item.status,
        totalAmount: item.total_amount,
        createdAt: new Date(item.created_at),
        updatedAt: new Date(item.updated_at),
        qrCodeData: item.qr_code_data,
        qrCodeString: item.qr_code_string,
      }));

      return {
        data: prescriptions,
        total: countQuery.count || 0,
      };
    },

    async update(id: string, data: any): Promise<PrescriptionDto> {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      // 🚨 字段映射：camelCase → snake_case
      if (data.medicines !== undefined) updateData.medicines = data.medicines;
      if (data.copies !== undefined) updateData.copies = data.copies;
      if (data.notes !== undefined) updateData.notes = data.notes;
      if (data.qrCodeData !== undefined) updateData.qr_code_data = data.qrCodeData;
      if (data.qrCodeString !== undefined) updateData.qr_code_string = data.qrCodeString;

      const { data: result, error } = await supabaseClient
        .from('prescriptions')
        .update(updateData)
        .eq('id', id)  
        .select()
        .single();

      if (error) throw error;

      return {
        id: result.id,
        doctorId: result.doctor_id,
        medicines: result.medicines,
        copies: result.copies,
        notes: result.notes,
        status: result.status,
        totalAmount: result.total_amount,
        createdAt: new Date(result.created_at),
        updatedAt: new Date(result.updated_at),
        qrCodeData: result.qr_code_data,
        qrCodeString: result.qr_code_string,
      };
    },

    async updateStatus(id: string, status: string): Promise<PrescriptionDto> {
      const { data: result, error } = await supabaseClient
        .from('prescriptions')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return {
        id: result.id,
        doctorId: result.doctor_id,
        medicines: result.medicines,
        copies: result.copies,
        notes: result.notes,
        status: result.status,
        totalAmount: result.total_amount,
        createdAt: new Date(result.created_at),
        updatedAt: new Date(result.updated_at),
        qrCodeData: result.qr_code_data,
        qrCodeString: result.qr_code_string,
      };
    },

    async delete(id: string): Promise<void> {
      const { error } = await supabaseClient
        .from('prescriptions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },

    async findWithFilters(doctorId: string, options: PrescriptionQueryOptions): Promise<{
      data: PrescriptionDto[];
      total: number;
    }> {
      const { page = 1, limit = 20, status, dateFrom, dateTo } = options;
      const offset = (page - 1) * limit;

      let query = supabaseClient
        .from('prescriptions')
        .select('*')
        .eq('doctor_id', doctorId);

      // 🚨 条件过滤器
      if (status) {
        query = query.eq('status', status);
      }

      if (dateFrom) {
        query = query.gte('created_at', dateFrom.toISOString());
      }

      if (dateTo) {
        query = query.lte('created_at', dateTo.toISOString());
      }

      // 分页和排序
      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // 同时获取总数
      let countQuery = supabaseClient
        .from('prescriptions')
        .select('*', { count: 'exact', head: true })
        .eq('doctor_id', doctorId);

      if (status) countQuery = countQuery.eq('status', status);
      if (dateFrom) countQuery = countQuery.gte('created_at', dateFrom.toISOString());
      if (dateTo) countQuery = countQuery.lte('created_at', dateTo.toISOString());

      const [dataResult, countResult] = await Promise.all([query, countQuery]);

      if (dataResult.error) throw dataResult.error;
      if (countResult.error) throw countResult.error;

      const prescriptions = dataResult.data.map(item => ({
        id: item.id,
        doctorId: item.doctor_id,
        medicines: item.medicines,
        copies: item.copies,
        notes: item.notes,
        status: item.status,
        totalAmount: item.total_amount,
        createdAt: new Date(item.created_at),
        updatedAt: new Date(item.updated_at),
        qrCodeData: item.qr_code_data,
        qrCodeString: item.qr_code_string,
      }));

      return {
        data: prescriptions,
        total: countResult.count || 0,
      };
    },
  };
}

/* 
 * ⚠️ Supabase迁移重点适配项：
 * 
 * 1. 数据库Schema适配：
 *    CREATE TABLE prescriptions (
 *      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *      doctor_id UUID NOT NULL REFERENCES auth.users(id),
 *      medicines JSONB NOT NULL,
 *      copies INTEGER NOT NULL CHECK (copies > 0),
 *      notes TEXT,
 *      status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
 *      total_amount DECIMAL(10,2),
 *      qr_code_data TEXT,
 *      qr_code_string TEXT,
 *      created_at TIMESTAMPTZ DEFAULT NOW(),
 *      updated_at TIMESTAMPTZ DEFAULT NOW()
 *    );
 * 
 * 2. RLS策略设置：
 *    -- 医师只能访问自己的处方
 *    CREATE POLICY "prescriptions_doctor_access" ON prescriptions
 *      FOR ALL USING (auth.uid() = doctor_id);
 *    
 *    -- 管理员可以访问所有处方
 *    CREATE POLICY "prescriptions_admin_access" ON prescriptions
 *      FOR ALL USING (
 *        auth.jwt() ->> 'role' = 'admin'
 *      );
 * 
 * 3. 索引优化：
 *    CREATE INDEX idx_prescriptions_doctor_id ON prescriptions(doctor_id);
 *    CREATE INDEX idx_prescriptions_status ON prescriptions(status);
 *    CREATE INDEX idx_prescriptions_created_at ON prescriptions(created_at);
 * 
 * 4. 触发器设置：
 *    -- 自动更新updated_at字段
 *    CREATE OR REPLACE FUNCTION update_updated_at_column()
 *    RETURNS TRIGGER AS $$
 *    BEGIN
 *        NEW.updated_at = NOW();
 *        RETURN NEW;
 *    END;
 *    $$ language 'plpgsql';
 *    
 *    CREATE TRIGGER update_prescriptions_updated_at 
 *      BEFORE UPDATE ON prescriptions 
 *      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
 * 
 * 5. 实时订阅：
 *    -- 设置实时更新订阅
 *    ALTER PUBLICATION supabase_realtime ADD TABLE prescriptions;
 * 
 * 6. 安全策略：
 *    -- 防止处方数据泄露
 *    -- 审计所有处方操作
 *    -- QR码数据加密存储
 * 
 * 7. 性能优化：
 *    -- 处方列表查询缓存
 *    -- 药品信息关联查询优化
 *    -- 大量处方数据分页优化
 */