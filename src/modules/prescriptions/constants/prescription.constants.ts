// 处方状态常量
export const PRESCRIPTION_STATUS = {
  DRAFT: "DRAFT",
  ISSUED: "ISSUED",
  PAID: "PAID",
  DISPENSED: "DISPENSED",
  FULFILLED: "FULFILLED",
  CANCELLED: "CANCELLED",
} as const;

// 支付状态常量
export const PAYMENT_STATUS = {
  PENDING: "pending",
  PAID: "paid",
  FAILED: "failed",
  REFUNDED: "refunded",
} as const;

// 分页默认值
export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

// 药品状态常量
export const MEDICINE_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  DISCONTINUED: "discontinued",
} as const;

// 处方ID前缀
export const PRESCRIPTION_ID_PREFIX = "RX";

// 错误消息常量
export const ERROR_MESSAGES = {
  PRESCRIPTION_NOT_FOUND: "处方不存在",
  INVALID_MEDICINE_IDS: "包含无效或已停用的药品ID",
  DUPLICATE_MEDICINES: "处方中包含重复的药品",
  INSUFFICIENT_PERMISSIONS: "无权访问此处方",
  CREATION_FAILED: "创建处方失败",
  UPDATE_FAILED: "更新处方失败",
  DELETE_FAILED: "删除处方失败",
} as const;

// 验证规则常量
export const VALIDATION_RULES = {
  MIN_QUANTITY: 1,
  MAX_QUANTITY: 999,
  MAX_PATIENT_NAME_LENGTH: 50,
  MAX_NOTES_LENGTH: 500,
  MAX_DOSAGE_INSTRUCTIONS_LENGTH: 200,
} as const;

// 类型导出
export type PrescriptionStatus =
  (typeof PRESCRIPTION_STATUS)[keyof typeof PRESCRIPTION_STATUS];
export type PaymentStatus =
  (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];
export type MedicineStatus =
  (typeof MEDICINE_STATUS)[keyof typeof MEDICINE_STATUS];
