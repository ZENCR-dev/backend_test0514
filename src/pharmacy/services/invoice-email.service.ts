import { Injectable, BadRequestException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { InvoicePdfService, InvoicePdfResult } from "./invoice-pdf.service";
import { NewZealandInvoiceData } from "./invoice-withdrawal.service";

export interface EmailRecipient {
  email: string;
  name?: string;
  type: "primary" | "cc" | "bcc";
}

export interface InvoiceEmailRequest {
  invoiceData: NewZealandInvoiceData;
  recipients: EmailRecipient[];
  subject?: string;
  customMessage?: string;
  attachPdf: boolean;
  sendCopy?: boolean;
  priority?: "high" | "normal" | "low";
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  recipients: string[];
  sentAt: Date;
  pdfAttached: boolean;
  errorMessage?: string;
}

@Injectable()
export class InvoiceEmailService {
  private readonly logger = new Logger(InvoiceEmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private configService: ConfigService,
    private invoicePdfService: InvoicePdfService,
  ) {
    this.initializeTransporter();
  }

  /**
   * Send Invoice Email with PDF Attachment
   */
  async sendInvoiceEmail(
    request: InvoiceEmailRequest,
  ): Promise<EmailSendResult> {
    if (!this.transporter) {
      throw new BadRequestException("邮件服务未配置");
    }

    try {
      let pdfAttachment = null;
      let pdfResult: InvoicePdfResult | null = null;

      // Generate PDF if requested
      if (request.attachPdf) {
        pdfResult = await this.invoicePdfService.generateInvoicePdf(
          request.invoiceData,
        );

        if (pdfResult.success && pdfResult.pdfBuffer) {
          pdfAttachment = {
            filename: pdfResult.filename,
            content: pdfResult.pdfBuffer,
            contentType: "application/pdf",
          };
        }
      }

      // Prepare recipients
      const toRecipients = request.recipients
        .filter((r) => r.type === "primary")
        .map((r) => (r.name ? `"${r.name}" <${r.email}>` : r.email));

      const ccRecipients = request.recipients
        .filter((r) => r.type === "cc")
        .map((r) => (r.name ? `"${r.name}" <${r.email}>` : r.email));

      const bccRecipients = request.recipients
        .filter((r) => r.type === "bcc")
        .map((r) => (r.name ? `"${r.name}" <${r.email}>` : r.email));

      // Add admin copy if requested
      if (request.sendCopy) {
        const adminEmail = this.configService.get<string>("ADMIN_EMAIL");
        if (adminEmail) {
          bccRecipients.push(adminEmail);
        }
      }

      // Generate email content
      const emailHtml = this.generateInvoiceEmailHTML(
        request.invoiceData,
        request.customMessage,
      );
      const subject =
        request.subject || this.generateDefaultSubject(request.invoiceData);

      // Configure mail options
      const mailOptions: nodemailer.SendMailOptions = {
        from: {
          name: request.invoiceData.pharmacyDetails.name,
          address: this.configService.get<string>("EMAIL_USER"),
        },
        to: toRecipients,
        cc: ccRecipients.length > 0 ? ccRecipients : undefined,
        bcc: bccRecipients.length > 0 ? bccRecipients : undefined,
        subject,
        html: emailHtml,
        priority: request.priority || "normal",
        attachments: pdfAttachment ? [pdfAttachment] : undefined,
      };

      // Send email
      const result = await this.transporter.sendMail(mailOptions);

      this.logger.log(
        `Invoice email sent: ${request.invoiceData.invoiceNumber} to ${toRecipients.join(", ")}`,
      );

      return {
        success: true,
        messageId: result.messageId,
        recipients: [...toRecipients, ...ccRecipients],
        sentAt: new Date(),
        pdfAttached: !!pdfAttachment,
      };
    } catch (error) {
      this.logger.error(
        `Failed to send invoice email: ${error.message}`,
        error,
      );

      return {
        success: false,
        recipients: request.recipients.map((r) => r.email),
        sentAt: new Date(),
        pdfAttached: false,
        errorMessage: error.message,
      };
    }
  }

  /**
   * Send Invoice Status Update Email
   */
  async sendInvoiceStatusUpdate(
    invoiceData: NewZealandInvoiceData,
    status: "approved" | "rejected" | "paid",
    recipients: EmailRecipient[],
    notes?: string,
  ): Promise<EmailSendResult> {
    const subject = `Invoice ${invoiceData.invoiceNumber} - Status Update: ${status.toUpperCase()}`;
    const customMessage = this.generateStatusUpdateMessage(status, notes);

    return this.sendInvoiceEmail({
      invoiceData,
      recipients,
      subject,
      customMessage,
      attachPdf: status === "approved", // Only attach PDF for approved invoices
      sendCopy: true,
      priority: status === "rejected" ? "high" : "normal",
    });
  }

  /**
   * Send Payment Reminder Email
   */
  async sendPaymentReminder(
    invoiceData: NewZealandInvoiceData,
    recipients: EmailRecipient[],
    reminderType: "first" | "second" | "final",
  ): Promise<EmailSendResult> {
    const urgencyLevel = {
      first: "Friendly Reminder",
      second: "Second Notice",
      final: "Final Notice",
    };

    const subject = `${urgencyLevel[reminderType]}: Payment Due for Invoice ${invoiceData.invoiceNumber}`;
    const customMessage = this.generatePaymentReminderMessage(
      invoiceData,
      reminderType,
    );

    return this.sendInvoiceEmail({
      invoiceData,
      recipients,
      subject,
      customMessage,
      attachPdf: true,
      sendCopy: true,
      priority: reminderType === "final" ? "high" : "normal",
    });
  }

  /**
   * Initialize email transporter
   */
  private initializeTransporter() {
    const emailService = this.configService.get<string>("EMAIL_SERVICE");
    const emailUser = this.configService.get<string>("EMAIL_USER");
    const emailPassword = this.configService.get<string>("EMAIL_PASSWORD");

    if (!emailService || !emailUser || !emailPassword) {
      this.logger.warn("Email service not configured for invoice emails");
      return;
    }

    try {
      // For AWS SES configuration
      if (
        emailService.toLowerCase() === "ses" ||
        emailService.toLowerCase() === "aws-ses"
      ) {
        this.transporter = nodemailer.createTransport({
          host: this.configService.get<string>(
            "SES_HOST",
            "email-smtp.us-east-1.amazonaws.com",
          ),
          port: 587,
          secure: false,
          auth: {
            user: emailUser,
            pass: emailPassword,
          },
        });
      } else {
        // For other email services (Gmail, Outlook, etc.)
        this.transporter = nodemailer.createTransport({
          service: emailService,
          auth: {
            user: emailUser,
            pass: emailPassword,
          },
        });
      }

      this.logger.log("Invoice email service initialized successfully");
    } catch (error) {
      this.logger.error("Failed to initialize invoice email service", error);
    }
  }

  /**
   * Generate HTML email content for invoice
   */
  private generateInvoiceEmailHTML(
    invoiceData: NewZealandInvoiceData,
    customMessage?: string,
  ): string {
    const daysUntilDue = Math.ceil(
      (new Date(invoiceData.dueDate).getTime() - new Date().getTime()) /
        (1000 * 60 * 60 * 24),
    );

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice ${invoiceData.invoiceNumber}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .invoice-details { background-color: #e9ecef; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .amount { font-size: 24px; font-weight: bold; color: #28a745; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d; }
        .button { display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .urgent { color: #dc3545; font-weight: bold; }
        .due-date { color: ${daysUntilDue <= 5 ? "#dc3545" : "#28a745"}; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${invoiceData.pharmacyDetails.name}</h1>
            <h2>Tax Invoice</h2>
            <p><strong>Invoice Number:</strong> ${invoiceData.invoiceNumber}</p>
            <p><strong>Invoice Date:</strong> ${new Date(invoiceData.invoiceDate).toLocaleDateString()}</p>
        </div>

        ${customMessage ? `<div class="custom-message"><p>${customMessage}</p></div>` : ""}

        <p>Dear ${invoiceData.clientDetails.name},</p>
        
        <p>Please find attached your tax invoice for services rendered. Below are the invoice details:</p>

        <div class="invoice-details">
            <h3>Invoice Summary</h3>
            <p><strong>Subtotal:</strong> $${invoiceData.summary.subtotal.toFixed(2)} NZD</p>
            <p><strong>GST (${invoiceData.summary.gstRate * 100}%):</strong> $${invoiceData.summary.gstAmount.toFixed(2)} NZD</p>
            <p class="amount"><strong>Total Amount:</strong> $${invoiceData.summary.totalAmount.toFixed(2)} NZD</p>
            <p class="due-date"><strong>Due Date:</strong> ${new Date(invoiceData.dueDate).toLocaleDateString()}</p>
            ${daysUntilDue <= 5 ? '<p class="urgent">⚠️ This invoice is due soon!</p>' : ""}
        </div>

        <h3>Services Provided</h3>
        <ul>
            ${invoiceData.lineItems
              .map(
                (item) => `
                <li>${item.description} - $${item.totalAmount.toFixed(2)} NZD</li>
            `,
              )
              .join("")}
        </ul>

        <h3>Payment Terms</h3>
        <p>${invoiceData.paymentTerms}</p>

        <p>If you have any questions regarding this invoice, please don't hesitate to contact us.</p>

        <div class="footer">
            <p><strong>Contact Information:</strong></p>
            <p>${invoiceData.pharmacyDetails.name}</p>
            <p>${
              typeof invoiceData.pharmacyDetails.address === "string"
                ? invoiceData.pharmacyDetails.address
                : Object.values(invoiceData.pharmacyDetails.address).join(", ")
            }</p>
            ${
              invoiceData.pharmacyDetails.contact
                ? `
                <p>Phone: ${invoiceData.pharmacyDetails.contact.phone || "N/A"}</p>
                <p>Email: ${invoiceData.pharmacyDetails.contact.email || "N/A"}</p>
            `
                : ""
            }
            
            <hr style="margin: 20px 0;">
            <p><strong>Tax Compliance Information:</strong></p>
            <p>GST Number: ${invoiceData.pharmacyDetails.gstNumber}</p>
            ${invoiceData.pharmacyDetails.nzbn ? `<p>NZBN: ${invoiceData.pharmacyDetails.nzbn}</p>` : ""}
            <p>This invoice complies with New Zealand IRD requirements.</p>
            
            <p style="margin-top: 20px; font-size: 11px;">
                This is an automated message. Please do not reply to this email.
                Generated: ${new Date().toLocaleString()}
            </p>
        </div>
    </div>
</body>
</html>
    `;
  }

  /**
   * Generate default email subject
   */
  private generateDefaultSubject(invoiceData: NewZealandInvoiceData): string {
    return `Tax Invoice ${invoiceData.invoiceNumber} from ${invoiceData.pharmacyDetails.name}`;
  }

  /**
   * Generate status update message
   */
  private generateStatusUpdateMessage(status: string, notes?: string): string {
    const messages = {
      approved:
        "Great news! Your invoice has been approved and payment processing has begun.",
      rejected:
        "Your invoice has been rejected for review. Please see the notes below and resubmit if necessary.",
      paid: "Thank you! Your invoice has been paid successfully.",
    };

    let message =
      messages[status] || `Your invoice status has been updated to: ${status}`;

    if (notes) {
      message += `\n\nAdditional Notes:\n${notes}`;
    }

    return message;
  }

  /**
   * Generate payment reminder message
   */
  private generatePaymentReminderMessage(
    invoiceData: NewZealandInvoiceData,
    reminderType: "first" | "second" | "final",
  ): string {
    const daysOverdue = Math.ceil(
      (new Date().getTime() - new Date(invoiceData.dueDate).getTime()) /
        (1000 * 60 * 60 * 24),
    );

    const messages = {
      first: `This is a friendly reminder that payment for this invoice was due ${daysOverdue} days ago. Please arrange payment at your earliest convenience.`,
      second: `This is a second notice that payment for this invoice is now ${daysOverdue} days overdue. Please contact us to arrange immediate payment.`,
      final: `FINAL NOTICE: This invoice is now ${daysOverdue} days overdue. Immediate payment is required to avoid further action.`,
    };

    return messages[reminderType];
  }

  /**
   * Test email configuration
   */
  async testEmailConnection(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      this.logger.log("Invoice email service connection verified");
      return true;
    } catch (error) {
      this.logger.error("Invoice email service connection failed", error);
      return false;
    }
  }

  /**
   * Get email service configuration info
   */
  getEmailServiceInfo() {
    return {
      configured: !!this.transporter,
      service: this.configService.get<string>("EMAIL_SERVICE"),
      supportedFeatures: [
        "PDF Attachments",
        "Multiple Recipients",
        "CC/BCC Support",
        "HTML Templates",
        "Status Updates",
        "Payment Reminders",
        "Priority Levels",
      ],
      compliance: "Professional email standards",
    };
  }
}
