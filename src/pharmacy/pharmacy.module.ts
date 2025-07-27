import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { CommonModule } from "../common/common.module";
import { AuthModule } from "../auth/auth.module";
import { PrescriptionsModule } from "../modules/prescriptions/prescriptions.module";

// Controllers
import { PrescriptionScanController } from "./controllers/prescription-scan.controller";
import { FulfillmentController } from "./controllers/fulfillment.controller";
import { PurchaseOrderController } from "./controllers/purchase-order.controller";
import { PriceListController } from "./controllers/price-list.controller";
import { PharmacyAccountController } from "./controllers/pharmacy-account.controller";
import { InvoiceController } from "./controllers/invoice.controller";
// TestController已移除

// Services
import { PrescriptionScanService } from "./services/prescription-scan.service";
import { FulfillmentService } from "./services/fulfillment.service";
import { PurchaseOrderService } from "./services/purchase-order.service";
import { PriceListService } from "./services/price-list.service";
import { PharmacyAccountService } from "./services/pharmacy-account.service";
import { FileUploadService } from "./services/file-upload.service";
import { PrescriptionPurchaseOrderService } from "./services/prescription-purchase-order.service";
import { InvoiceWithdrawalService } from "./services/invoice-withdrawal.service";
import { InvoicePdfService } from "./services/invoice-pdf.service";
import { InvoiceEmailService } from "./services/invoice-email.service";

@Module({
  imports: [PrismaModule, CommonModule, AuthModule, PrescriptionsModule],
  controllers: [
    PrescriptionScanController,
    FulfillmentController,
    PurchaseOrderController,
    PriceListController,
    PharmacyAccountController,
    InvoiceController,
  ],
  providers: [
    PrescriptionScanService,
    FulfillmentService,
    PurchaseOrderService,
    PriceListService,
    PharmacyAccountService,
    FileUploadService,
    PrescriptionPurchaseOrderService,
    InvoiceWithdrawalService,
    InvoicePdfService,
    InvoiceEmailService,
  ],
  exports: [
    PrescriptionScanService,
    FulfillmentService,
    PurchaseOrderService,
    PriceListService,
    PharmacyAccountService,
    PrescriptionPurchaseOrderService,
    InvoiceWithdrawalService,
    InvoicePdfService,
    InvoiceEmailService,
  ],
})
export class PharmacyModule {}
