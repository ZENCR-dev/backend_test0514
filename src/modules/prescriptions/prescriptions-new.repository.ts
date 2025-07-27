import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
  PRESCRIPTION_STATUS,
  PAYMENT_STATUS,
  MEDICINE_STATUS,
  PRESCRIPTION_ID_PREFIX,
  ERROR_MESSAGES,
} from "./constants/prescription.constants";

interface CreatePrescriptionData {
  doctorId: string;
  medicines: Array<{
    medicineId: string;
    weight: number; // 单味药克重
    notes: string;
    additionalNotes?: string;
  }>;
  copies: number; // 帖数 - maps to database field
  notes?: string;
}

@Injectable()
export class PrescriptionsNewRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreatePrescriptionData) {
    // 批量验证药品并计算总价 (修复N+1查询问题)
    const medicineIds = data.medicines.map((m) => m.medicineId);
    const medicinesData = await this.prisma.medicine.findMany({
      where: {
        id: { in: medicineIds },
        status: MEDICINE_STATUS.ACTIVE, // 确保药品激活
      },
      select: {
        id: true,
        basePrice: true,
        name: true,
        chineseName: true,
        englishName: true,
        sku: true,
        unit: true,
        category: true,
      },
    });

    // 验证所有药品都存在且激活
    if (medicinesData.length !== data.medicines.length) {
      const foundIds = medicinesData.map((m) => m.id);
      const missingIds = medicineIds.filter((id) => !foundIds.includes(id));
      throw new BadRequestException(
        `${ERROR_MESSAGES.INVALID_MEDICINE_IDS}: ${missingIds.join(", ")}`,
      );
    }

    // 创建药品ID到数据的映射，便于快速查找
    const medicineMap = new Map(medicinesData.map((m) => [m.id, m]));

    // 检查重复药品
    const uniqueMedicineIds = new Set(medicineIds);
    if (uniqueMedicineIds.size !== medicineIds.length) {
      throw new BadRequestException(ERROR_MESSAGES.DUPLICATE_MEDICINES);
    }

    // 计算总价
    let totalAmount = 0;
    for (const medicine of data.medicines) {
      const medicineData = medicineMap.get(medicine.medicineId);
      if (medicineData) {
        totalAmount += Number(medicineData.basePrice) * medicine.weight;
      }
    }

    // 创建Prescription - 新的隐私合规架构
    const prescription = await this.prisma.prescription.create({
      data: {
        prescriptionId: `${PRESCRIPTION_ID_PREFIX}-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        doctorId: data.doctorId,
        copies: data.copies,
        status: PRESCRIPTION_STATUS.DRAFT,
        totalAmount: totalAmount,
        paymentStatus: PAYMENT_STATUS.PENDING,
        notes: data.notes,
        medicines: {
          create: data.medicines.map((medicine) => ({
            medicineId: medicine.medicineId,
            weight: medicine.weight,
            dosageInstructions: medicine.notes,
            notes: medicine.notes,
            additionalNotes: medicine.additionalNotes,
          })),
        },
      },
      include: {
        medicines: {
          include: {
            medicine: true,
          },
        },
        practitioner: {
          select: {
            id: true,
            profile: {
              select: {
                fullName: true,
                licenseNumber: true,
              },
            },
          },
        },
      },
    });

    return this.transformPrescriptionToResponse(prescription);
  }

  async findByDoctor(doctorId: string, page: number, limit: number) {
    const [prescriptions, total] = await Promise.all([
      this.prisma.prescription.findMany({
        where: {
          doctorId: doctorId,
        },
        include: {
          medicines: {
            include: {
              medicine: {
                select: {
                  id: true,
                  name: true,
                  chineseName: true,
                  unit: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.prescription.count({
        where: {
          doctorId: doctorId,
        },
      }),
    ]);

    return {
      data: prescriptions.map((prescription) =>
        this.transformPrescriptionToResponse(prescription),
      ),
      total,
    };
  }

  async findById(id: string) {
    const prescription = await this.prisma.prescription.findUnique({
      where: { id },
      include: {
        medicines: {
          include: {
            medicine: true,
          },
        },
        practitioner: {
          select: {
            id: true,
            profile: {
              select: {
                fullName: true,
                licenseNumber: true,
              },
            },
          },
        },
      },
    });

    if (!prescription) {
      return null;
    }

    return this.transformPrescriptionToResponse(prescription);
  }

  async update(id: string, data: Partial<CreatePrescriptionData>) {
    const existingPrescription = await this.prisma.prescription.findUnique({
      where: { id },
      include: { medicines: true },
    });

    if (!existingPrescription) {
      throw new NotFoundException(ERROR_MESSAGES.PRESCRIPTION_NOT_FOUND);
    }

    // 更新基本信息
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (data.copies !== undefined) {
      updateData.copies = data.copies;
    }

    if (data.notes) {
      updateData.notes = data.notes;
    }

    // 如果更新了药品信息，需要重新计算总价并更新PrescriptionMedicine
    if (data.medicines) {
      // 删除旧的PrescriptionMedicine
      await this.prisma.prescriptionMedicine.deleteMany({
        where: { prescriptionId: id },
      });

      // 计算新的总价
      let totalAmount = 0;
      for (const medicine of data.medicines) {
        const medicineData = await this.prisma.medicine.findUnique({
          where: { id: medicine.medicineId },
          select: { basePrice: true },
        });
        if (medicineData) {
          totalAmount += Number(medicineData.basePrice) * medicine.weight;
        }
      }

      updateData.totalAmount = totalAmount;
    }

    // 更新Prescription
    const updatedPrescription = await this.prisma.prescription.update({
      where: { id },
      data: updateData,
    });

    // 如果更新了药品信息，创建新的PrescriptionMedicine
    if (data.medicines) {
      for (const medicine of data.medicines) {
        await this.prisma.prescriptionMedicine.create({
          data: {
            prescriptionId: id,
            medicineId: medicine.medicineId,
            weight: medicine.weight,
            dosageInstructions: medicine.notes,
            notes: medicine.notes,
            additionalNotes: medicine.additionalNotes,
          },
        });
      }
    }

    return this.findById(id);
  }

  async updateStatus(id: string, status: string) {
    const prescription = await this.prisma.prescription.update({
      where: { id },
      data: {
        status,
        updatedAt: new Date(),
      },
    });

    return this.findById(prescription.id);
  }

  async delete(id: string) {
    // Prisma will cascade delete PrescriptionMedicine records
    await this.prisma.prescription.delete({
      where: { id },
    });
    return true;
  }

  private transformPrescriptionToResponse(prescription: any) {
    return {
      id: prescription.id,
      prescriptionId: prescription.prescriptionId,
      doctorId: prescription.doctorId,
      copies: prescription.copies, // 帖数
      status: prescription.status,
      totalAmount: prescription.totalAmount,
      paymentStatus: prescription.paymentStatus,
      paymentMethod: prescription.paymentMethod,
      notes: prescription.notes,
      qrCodeData: prescription.qrCodeData,
      expiresAt: prescription.expiresAt,
      version: prescription.version,
      createdAt: prescription.createdAt,
      updatedAt: prescription.updatedAt,
      medicines:
        prescription.medicines?.map((pm: any) => ({
          medicineId: pm.medicineId,
          weight: pm.weight,
          dosageInstructions: pm.dosageInstructions,
          notes: pm.notes,
          additionalNotes: pm.additionalNotes,
          medicine: pm.medicine,
        })) || [],
      practitioner: prescription.practitioner || null,
    };
  }
}
