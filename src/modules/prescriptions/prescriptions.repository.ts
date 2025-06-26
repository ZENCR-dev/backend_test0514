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
  clinicId: string;
  patientInfo: {
    name: string;
    age?: number;
    gender?: string;
    phone?: string;
    symptoms?: string;
    diagnosis?: string;
  };
  medicines: Array<{
    medicineId: string;
    quantity: number;
    dosageInstructions: string;
    notes?: string;
  }>;
  notes?: string;
}

@Injectable()
export class PrescriptionsRepository {
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
        totalAmount += Number(medicineData.basePrice) * medicine.quantity;
      }
    }

    // 创建Order作为处方主体
    const order = await this.prisma.order.create({
      data: {
        platformOrderId: `${PRESCRIPTION_ID_PREFIX}-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        practitionerId: data.doctorId,
        clinicId: data.clinicId,
        patientInfo: data.patientInfo,
        status: PRESCRIPTION_STATUS.DRAFT,
        totalAmount: totalAmount,
        paymentStatus: PAYMENT_STATUS.PENDING,
        notes: data.notes,
        items: {
          create: data.medicines.map((medicine) => {
            const medicineData = medicineMap.get(medicine.medicineId);
            const unitPrice = Number(medicineData.basePrice);
            const totalPrice = unitPrice * medicine.quantity;
            return {
              medicineId: medicine.medicineId,
              quantity: medicine.quantity,
              unitPrice: unitPrice,
              totalPrice: totalPrice,
              dosageInstructions: medicine.dosageInstructions,
              notes: medicine.notes,
              medicineSnapshot: {
                id: medicineData.id,
                name: medicineData.name,
                chineseName: medicineData.chineseName,
                englishName: medicineData.englishName,
                sku: medicineData.sku,
                unit: medicineData.unit,
                basePrice: medicineData.basePrice,
                category: medicineData.category,
              },
            };
          }),
        },
      },
      include: {
        items: {
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
        clinic: {
          select: {
            id: true,
            name: true,
            licenseNumber: true,
          },
        },
      },
    });

    // 价格和药品快照已在创建时设置，无需后续更新

    return this.findById(order.id);
  }

  async findByDoctor(doctorId: string, page: number, limit: number) {
    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          practitionerId: doctorId,
          // 只查询处方相关的订单（可以通过状态或其他字段区分）
        },
        include: {
          items: {
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
          clinic: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({
        where: {
          practitionerId: doctorId,
        },
      }),
    ]);

    return {
      data: orders.map((order) => this.transformOrderToPrescription(order)),
      total,
    };
  }

  async findById(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
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
        clinic: {
          select: {
            id: true,
            name: true,
            licenseNumber: true,
          },
        },
      },
    });

    if (!order) {
      return null;
    }

    return this.transformOrderToPrescription(order);
  }

  async update(id: string, data: Partial<CreatePrescriptionData>) {
    const existingOrder = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existingOrder) {
      throw new NotFoundException(ERROR_MESSAGES.PRESCRIPTION_NOT_FOUND);
    }

    // 更新基本信息
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (data.patientInfo) {
      updateData.patientInfo = data.patientInfo;
    }

    if (data.notes) {
      updateData.notes = data.notes;
    }

    // 如果更新了药品信息，需要重新计算总价并更新OrderItem
    if (data.medicines) {
      // 删除旧的OrderItem
      await this.prisma.orderItem.deleteMany({
        where: { orderId: id },
      });

      // 计算新的总价
      let totalAmount = 0;
      for (const medicine of data.medicines) {
        const medicineData = await this.prisma.medicine.findUnique({
          where: { id: medicine.medicineId },
          select: { basePrice: true },
        });
        if (medicineData) {
          totalAmount += Number(medicineData.basePrice) * medicine.quantity;
        }
      }

      updateData.totalAmount = totalAmount;
    }

    // 更新Order
    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: updateData,
    });

    // 如果更新了药品信息，创建新的OrderItem
    if (data.medicines) {
      for (const medicine of data.medicines) {
        const medicineData = await this.prisma.medicine.findUnique({
          where: { id: medicine.medicineId },
        });

        if (medicineData) {
          await this.prisma.orderItem.create({
            data: {
              orderId: id,
              medicineId: medicine.medicineId,
              quantity: medicine.quantity,
              unitPrice: medicineData.basePrice,
              totalPrice: Number(medicineData.basePrice) * medicine.quantity,
              dosageInstructions: medicine.dosageInstructions,
              notes: medicine.notes,
              medicineSnapshot: {
                id: medicineData.id,
                name: medicineData.name,
                chineseName: medicineData.chineseName,
                englishName: medicineData.englishName,
                sku: medicineData.sku,
                unit: medicineData.unit,
                basePrice: medicineData.basePrice,
                category: medicineData.category,
              },
            },
          });
        }
      }
    }

    return this.findById(id);
  }

  async delete(id: string) {
    const existingOrder = await this.prisma.order.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      throw new NotFoundException(ERROR_MESSAGES.PRESCRIPTION_NOT_FOUND);
    }

    // 级联删除OrderItem和Order
    await this.prisma.order.delete({
      where: { id },
    });

    return { success: true };
  }

  async updateStatus(id: string, status: string) {
    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: {
        status: status as any,
        updatedAt: new Date(),
      },
    });

    return this.findById(id);
  }

  private transformOrderToPrescription(order: any) {
    return {
      id: order.id,
      prescriptionId: order.platformOrderId,
      doctorId: order.practitionerId,
      clinicId: order.clinicId,
      patientInfo: order.patientInfo,
      status: order.status,
      totalAmount: order.totalAmount,
      notes: order.notes,
      qrCodeData: order.qrCodeData,
      medicines:
        order.items?.map((item: any) => ({
          medicineId: item.medicineId,
          medicineName: item.medicine?.name || item.medicineSnapshot?.name,
          chineseName:
            item.medicine?.chineseName || item.medicineSnapshot?.chineseName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          dosageInstructions: item.dosageInstructions,
          notes: item.notes,
          unit: item.medicine?.unit || item.medicineSnapshot?.unit,
        })) || [],
      practitioner: order.practitioner,
      clinic: order.clinic,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}
