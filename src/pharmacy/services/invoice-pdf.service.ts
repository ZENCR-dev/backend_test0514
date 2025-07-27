import { Injectable, BadRequestException } from "@nestjs/common";
import * as puppeteer from "puppeteer";
import * as path from "path";
import * as fs from "fs/promises";
import { NewZealandInvoiceData } from "./invoice-withdrawal.service";

export interface PdfGenerationOptions {
  format: "A4" | "Letter";
  margin: {
    top: string;
    right: string;
    bottom: string;
    left: string;
  };
  displayHeaderFooter: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  printBackground: boolean;
}

export interface InvoicePdfResult {
  success: boolean;
  pdfBuffer?: Buffer;
  filename: string;
  size: number;
  generatedAt: Date;
  metadata?: {
    pageCount: number;
    format: string;
    compliance: string;
  };
}

@Injectable()
export class InvoicePdfService {
  private readonly DEFAULT_PDF_OPTIONS: PdfGenerationOptions = {
    format: "A4",
    margin: {
      top: "20mm",
      right: "15mm",
      bottom: "20mm",
      left: "15mm",
    },
    displayHeaderFooter: true,
    printBackground: true,
  };

  /**
   * Generate PDF from Invoice Data
   */
  async generateInvoicePdf(
    invoiceData: NewZealandInvoiceData,
    options?: Partial<PdfGenerationOptions>,
  ): Promise<InvoicePdfResult> {
    let browser: puppeteer.Browser | null = null;

    try {
      // Launch Puppeteer browser
      browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      });

      const page = await browser.newPage();

      // Generate HTML content
      const htmlContent = await this.generateInvoiceHTML(invoiceData);

      // Set page content
      await page.setContent(htmlContent, {
        waitUntil: "networkidle0",
      });

      // Configure PDF options
      const pdfOptions = {
        ...this.DEFAULT_PDF_OPTIONS,
        ...options,
        headerTemplate: this.generateHeaderTemplate(invoiceData),
        footerTemplate: this.generateFooterTemplate(),
      };

      // Generate PDF
      const pdfBuffer = await page.pdf(pdfOptions);

      const filename = `invoice_${invoiceData.invoiceNumber.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;

      return {
        success: true,
        pdfBuffer: Buffer.from(pdfBuffer),
        filename,
        size: pdfBuffer.length,
        generatedAt: new Date(),
        metadata: {
          pageCount: 1, // Could be calculated dynamically
          format: pdfOptions.format,
          compliance: "NZ_IRD_INVOICE_REQUIREMENTS",
        },
      };
    } catch (error) {
      throw new BadRequestException(`PDF生成失败: ${error.message}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Generate Invoice HTML Template
   */
  private async generateInvoiceHTML(
    invoiceData: NewZealandInvoiceData,
  ): Promise<string> {
    const styles = await this.generateInvoiceStyles();

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice ${invoiceData.invoiceNumber}</title>
    <style>${styles}</style>
</head>
<body>
    <div class="invoice-container">
        <!-- Header Section -->
        <div class="invoice-header">
            <div class="company-info">
                <h1 class="company-name">${invoiceData.pharmacyDetails.name}</h1>
                <div class="address">
                    ${this.formatAddress(invoiceData.pharmacyDetails.address)}
                </div>
                <div class="contact">
                    ${this.formatContact(invoiceData.pharmacyDetails.contact)}
                </div>
                ${
                  invoiceData.pharmacyDetails.gstNumber
                    ? `<div class="gst-number">GST Number: ${invoiceData.pharmacyDetails.gstNumber}</div>`
                    : ""
                }
                ${
                  invoiceData.pharmacyDetails.nzbn
                    ? `<div class="nzbn">NZBN: ${invoiceData.pharmacyDetails.nzbn}</div>`
                    : ""
                }
            </div>
            
            <div class="invoice-title">
                <h2>TAX INVOICE</h2>
                <div class="invoice-number">Invoice #${invoiceData.invoiceNumber}</div>
                <div class="invoice-date">Date: ${this.formatDate(invoiceData.invoiceDate)}</div>
                <div class="due-date">Due Date: ${this.formatDate(invoiceData.dueDate)}</div>
            </div>
        </div>

        <!-- Client Details -->
        <div class="client-section">
            <div class="bill-to">
                <h3>Bill To:</h3>
                <div class="client-name">${invoiceData.clientDetails.name}</div>
                ${
                  invoiceData.clientDetails.address
                    ? `<div class="client-address">${invoiceData.clientDetails.address}</div>`
                    : ""
                }
                ${
                  invoiceData.clientDetails.reference
                    ? `<div class="client-reference">Reference: ${invoiceData.clientDetails.reference}</div>`
                    : ""
                }
            </div>
        </div>

        <!-- Line Items Table -->
        <div class="items-section">
            <table class="items-table">
                <thead>
                    <tr>
                        <th class="line-no">#</th>
                        <th class="description">Description</th>
                        <th class="service-date">Service Date</th>
                        <th class="net-amount">Net Amount (NZD)</th>
                        <th class="gst-amount">GST (15%)</th>
                        <th class="total-amount">Total (NZD)</th>
                    </tr>
                </thead>
                <tbody>
                    ${invoiceData.lineItems
                      .map(
                        (item) => `
                        <tr>
                            <td class="line-no">${item.lineNumber}</td>
                            <td class="description">
                                <div class="main-desc">${item.description}</div>
                                <div class="po-ref">PO: ${item.poNumber}</div>
                                ${item.prescriptionId ? `<div class="prescription-ref">Prescription ID: ${item.prescriptionId}</div>` : ""}
                            </td>
                            <td class="service-date">${this.formatDate(item.serviceDate)}</td>
                            <td class="net-amount">$${item.netAmount.toFixed(2)}</td>
                            <td class="gst-amount">$${item.gstAmount.toFixed(2)}</td>
                            <td class="total-amount">$${item.totalAmount.toFixed(2)}</td>
                        </tr>
                    `,
                      )
                      .join("")}
                </tbody>
            </table>
        </div>

        <!-- Summary Section -->
        <div class="summary-section">
            <table class="summary-table">
                <tr>
                    <td class="summary-label">Subtotal (Net):</td>
                    <td class="summary-amount">$${invoiceData.summary.subtotal.toFixed(2)}</td>
                </tr>
                <tr>
                    <td class="summary-label">GST (${(invoiceData.summary.gstRate * 100).toFixed(1)}%):</td>
                    <td class="summary-amount">$${invoiceData.summary.gstAmount.toFixed(2)}</td>
                </tr>
                <tr class="total-row">
                    <td class="summary-label"><strong>Total Amount:</strong></td>
                    <td class="summary-amount"><strong>$${invoiceData.summary.totalAmount.toFixed(2)}</strong></td>
                </tr>
            </table>
        </div>

        <!-- Payment Terms -->
        <div class="payment-section">
            <h3>Payment Terms</h3>
            <p>${invoiceData.paymentTerms}</p>
        </div>

        <!-- Compliance Footer -->
        <div class="compliance-footer">
            <div class="compliance-info">
                <p><strong>New Zealand Tax Compliance:</strong></p>
                <ul>
                    <li>This is a Tax Invoice for GST purposes</li>
                    <li>GST Registration: ${invoiceData.pharmacyDetails.gstNumber}</li>
                    <li>Generated in compliance with IRD requirements</li>
                    <li>Generated: ${this.formatDateTime(invoiceData.compliance.generatedAt)}</li>
                </ul>
            </div>
        </div>
    </div>
</body>
</html>
    `;
  }

  /**
   * Generate CSS Styles for Invoice
   */
  private async generateInvoiceStyles(): Promise<string> {
    return `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Arial', 'Helvetica', sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: #333;
            background: white;
        }

        .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }

        .invoice-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #eee;
        }

        .company-name {
            font-size: 24px;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 10px;
        }

        .address, .contact {
            margin-bottom: 8px;
            color: #666;
        }

        .gst-number, .nzbn {
            font-weight: bold;
            color: #e74c3c;
            margin-top: 5px;
        }

        .invoice-title {
            text-align: right;
        }

        .invoice-title h2 {
            font-size: 28px;
            color: #2c3e50;
            margin-bottom: 10px;
        }

        .invoice-number {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 5px;
        }

        .invoice-date, .due-date {
            margin-bottom: 5px;
            color: #666;
        }

        .client-section {
            margin-bottom: 30px;
        }

        .bill-to h3 {
            font-size: 16px;
            margin-bottom: 10px;
            color: #2c3e50;
        }

        .client-name {
            font-weight: bold;
            font-size: 14px;
            margin-bottom: 5px;
        }

        .client-address, .client-reference {
            color: #666;
            margin-bottom: 3px;
        }

        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }

        .items-table th {
            background-color: #f8f9fa;
            padding: 12px 8px;
            text-align: left;
            border: 1px solid #dee2e6;
            font-weight: bold;
            font-size: 11px;
        }

        .items-table td {
            padding: 10px 8px;
            border: 1px solid #dee2e6;
            vertical-align: top;
        }

        .line-no {
            width: 40px;
            text-align: center;
        }

        .description {
            width: 40%;
        }

        .service-date {
            width: 100px;
            text-align: center;
        }

        .net-amount, .gst-amount, .total-amount {
            width: 100px;
            text-align: right;
        }

        .main-desc {
            font-weight: bold;
            margin-bottom: 5px;
        }

        .po-ref, .prescription-ref {
            font-size: 10px;
            color: #666;
            margin-bottom: 2px;
        }

        .summary-section {
            float: right;
            width: 300px;
            margin-bottom: 30px;
        }

        .summary-table {
            width: 100%;
            border-collapse: collapse;
        }

        .summary-table td {
            padding: 8px 12px;
            border-bottom: 1px solid #eee;
        }

        .summary-label {
            text-align: left;
        }

        .summary-amount {
            text-align: right;
            font-weight: bold;
        }

        .total-row {
            border-top: 2px solid #2c3e50;
            background-color: #f8f9fa;
        }

        .total-row td {
            padding: 12px;
            font-size: 14px;
        }

        .payment-section {
            clear: both;
            margin-bottom: 30px;
            padding: 15px;
            background-color: #f8f9fa;
            border-left: 4px solid #3498db;
        }

        .payment-section h3 {
            margin-bottom: 10px;
            color: #2c3e50;
        }

        .compliance-footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 10px;
            color: #666;
        }

        .compliance-info p {
            margin-bottom: 8px;
            font-weight: bold;
        }

        .compliance-info ul {
            margin-left: 20px;
        }

        .compliance-info li {
            margin-bottom: 3px;
        }

        @media print {
            .invoice-container {
                max-width: none;
                padding: 0;
            }
            
            body {
                font-size: 11px;
            }
        }
    `;
  }

  /**
   * Generate Header Template for PDF
   */
  private generateHeaderTemplate(invoiceData: NewZealandInvoiceData): string {
    return `
        <div style="font-size: 10px; padding: 10px; width: 100%; text-align: center; color: #666;">
            ${invoiceData.pharmacyDetails.name} - Tax Invoice ${invoiceData.invoiceNumber}
        </div>
    `;
  }

  /**
   * Generate Footer Template for PDF
   */
  private generateFooterTemplate(): string {
    return `
        <div style="font-size: 9px; padding: 10px; width: 100%; text-align: center; color: #666;">
            <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
            <span style="margin-left: 20px;">Generated on <span class="date"></span></span>
        </div>
    `;
  }

  /**
   * Format address for display
   */
  private formatAddress(address: any): string {
    if (typeof address === "string") {
      return address;
    }

    const parts = [];
    if (address.street) parts.push(address.street);
    if (address.city) parts.push(address.city);
    if (address.postalCode) parts.push(address.postalCode);
    if (address.country) parts.push(address.country);

    return parts.join(", ");
  }

  /**
   * Format contact information
   */
  private formatContact(contact: any): string {
    const parts = [];
    if (contact.phone) parts.push(`Phone: ${contact.phone}`);
    if (contact.email) parts.push(`Email: ${contact.email}`);

    return parts.join(" | ");
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString("en-NZ", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  /**
   * Format datetime for display
   */
  private formatDateTime(date: Date): string {
    return new Date(date).toLocaleString("en-NZ", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  }

  /**
   * Save PDF to file system (optional)
   */
  async savePdfToFile(
    pdfBuffer: Buffer,
    filename: string,
    directory: string = "./temp/invoices",
  ): Promise<string> {
    try {
      // Ensure directory exists
      await fs.mkdir(directory, { recursive: true });

      const filePath = path.join(directory, filename);
      await fs.writeFile(filePath, pdfBuffer);

      return filePath;
    } catch (error) {
      throw new BadRequestException(`保存PDF文件失败: ${error.message}`);
    }
  }

  /**
   * Get PDF generation capabilities info
   */
  getCapabilities() {
    return {
      formats: ["A4", "Letter"],
      features: [
        "New Zealand Tax Invoice Compliance",
        "IRD Requirements",
        "Multi-PO Line Items",
        "GST Calculations",
        "Professional Layout",
        "Print-Ready Format",
      ],
      supportedLanguages: ["English"],
      maxLineItems: 50,
      compliance: "NZ_IRD_GST_ACT",
    };
  }
}
