 
/* eslint-disable @typescript-eslint/consistent-indexed-object-style */
/* eslint-disable @stylistic/ts/member-delimiter-style */
/* eslint-disable @typescript-eslint/no-extraneous-class */
/* eslint-disable @typescript-eslint/prefer-promise-reject-errors */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/prefer-return-this-type */
/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
/* eslint-disable @typescript-eslint/no-inferrable-types */
/* eslint-disable @typescript-eslint/explicit-member-accessibility */
// FIX:ME later need to resolve all the typescript issues
import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";

export interface PDFOptions {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  margins?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  pageSize?: "A4" | "LETTER" | "LEGAL";
  layout?: "portrait" | "landscape";
}

export interface TableColumn {
  header: string;
  key: string;
  width: number;
  align?: "left" | "center" | "right";
}

export interface TableRow {
  [key: string]: string | number | Date;
}

export class PDFGenerator {
  private readonly doc: PDFKit.PDFDocument;
  private currentY: number = 50;

  constructor(options: PDFOptions = {}) {
    this.doc = new PDFDocument({
      size: options.pageSize || "A4",
      layout: options.layout || "portrait",
      margins: options.margins || { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: options.title || "Document",
        Author: options.author || "System Generated",
        Subject: options.subject || "",
        Keywords: options.keywords || "",
      },
    });
    this.currentY = this.doc.page.margins.top;
  }

  // Add title
  addTitle(text: string, fontSize: number = 20): PDFGenerator {
    this.doc
      .fontSize(fontSize)
      .font("Helvetica-Bold")
      .text(text, { align: "center" as const });
    this.currentY = this.doc.y + 20;
    return this;
  }

  // Add heading
  addHeading(text: string, fontSize: number = 16): PDFGenerator {
    this.doc
      .fontSize(fontSize)
      .font("Helvetica-Bold")
      .text(text, 50, this.currentY);
    this.currentY = this.doc.y + 10;
    return this;
  }

  // Add paragraph
  addParagraph(text: string, fontSize: number = 12): PDFGenerator {
    this.doc.fontSize(fontSize).font("Helvetica").text(text, 50, this.currentY);
    this.currentY = this.doc.y + 10;
    return this;
  }

  // Add key-value pair
  addKeyValue(
    key: string,
    value: string | number | Date,
    keyWidth: number = 150
  ): PDFGenerator {
    const formattedValue =
      value instanceof Date ? value.toLocaleDateString() : String(value);
    this.doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .text(`${key}:`, 50, this.currentY, { width: keyWidth });
    this.doc
      .font("Helvetica")
      .text(formattedValue, 50 + keyWidth, this.currentY);
    this.currentY = this.doc.y + 5;
    return this;
  }

  // Add horizontal line
  addLine(): PDFGenerator {
    this.doc
      .moveTo(50, this.currentY)
      .lineTo(this.doc.page.width - 50, this.currentY)
      .stroke();
    this.currentY += 20;
    return this;
  }

  // Add space
  addSpace(height: number = 20): PDFGenerator {
    this.currentY += height;
    return this;
  }

  // Add table
  addTable(columns: TableColumn[], rows: TableRow[]): PDFGenerator {
    const tableTop = this.currentY;
    const tableLeft = 50;
    let currentX = tableLeft;

    // Draw headers
    this.doc.fontSize(12).font("Helvetica-Bold");
    for (const col of columns) {
      this.doc.text(col.header, currentX, tableTop, {
        width: col.width,
        align: (col.align || "left") as "left" | "center" | "right" | "justify",
      });
      currentX += col.width;
    }

    // Draw header line
    this.currentY = tableTop + 20;
    this.doc
      .moveTo(tableLeft, this.currentY)
      .lineTo(
        tableLeft + columns.reduce((sum, col) => sum + col.width, 0),
        this.currentY
      )
      .stroke();
    this.currentY += 10;

    // Draw rows
    this.doc.font("Helvetica");
    for (const row of rows) {
      currentX = tableLeft;
      const rowTop = this.currentY;

      for (const col of columns) {
        const value = row[col.key];
        const formattedValue =
          value instanceof Date
            ? value.toLocaleDateString()
            : String(value || "");
        this.doc.text(formattedValue, currentX, rowTop, {
          width: col.width,
          align: (col.align || "left") as
            | "left"
            | "center"
            | "right"
            | "justify",
        });
        currentX += col.width;
      }

      this.currentY += 20;
    }

    this.currentY += 10;
    return this;
  }

  // Add two-column layout
  addTwoColumns(leftContent: string, rightContent: string): PDFGenerator {
    const pageWidth = this.doc.page.width - 100;
    const columnWidth = pageWidth / 2 - 10;

    this.doc.fontSize(12).font("Helvetica");
    this.doc.text(leftContent, 50, this.currentY, { width: columnWidth });
    this.doc.text(rightContent, 50 + columnWidth + 20, this.currentY, {
      width: columnWidth,
    });

    this.currentY = Math.max(this.doc.y, this.currentY) + 10;
    return this;
  }

  // Add footer
  addFooter(text: string): PDFGenerator {
    const pageHeight = this.doc.page.height;
    this.doc
      .fontSize(10)
      .font("Helvetica")
      .text(text, 50, pageHeight - 50, { align: "center" as const });
    return this;
  }

  // Generate buffer
  async generateBuffer(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const buffers: Buffer[] = [];
        this.doc.on("data", buffers.push.bind(buffers));
        this.doc.on("end", () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });
        this.doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  // Save to file
  async saveToFile(filePath: string): Promise<void> {
    const buffer = await this.generateBuffer();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, buffer);
  }

  // Get current Y position
  getCurrentY(): number {
    return this.currentY;
  }

  // Set current Y position
  setCurrentY(y: number): PDFGenerator {
    this.currentY = y;
    return this;
  }

  // Add page break
  addPageBreak(): PDFGenerator {
    this.doc.addPage();
    this.currentY = this.doc.page.margins.top;
    return this;
  }
}

// Utility functions for common PDF types
export class PDFTemplates {
  // Generate invoice PDF
  static async generateInvoice(invoiceData: any): Promise<Buffer> {
    const pdf = new PDFGenerator({
      title: `Invoice ${invoiceData.invoiceNumber}`,
      subject: "Invoice Document",
      layout: "landscape",
    });

    PDFTemplates.addInvoiceHeader(pdf, invoiceData);
    PDFTemplates.addInvoiceContent(pdf, invoiceData);
    PDFTemplates.addInvoiceTables(pdf, invoiceData);
    PDFTemplates.addInvoiceSummary(pdf, invoiceData);

    return pdf.generateBuffer();
  }

  private static addInvoiceHeader(pdf: PDFGenerator, invoiceData: any): void {
    const doc = (pdf as any).doc;
    
    // Header: "Invoice Billing" on left
    doc.fontSize(14).font("Helvetica-Bold").text("Invoice Billing", 50, 50);
    
    // Header: "Invoice Number" label and value on top-right
    const pageWidth = doc.page.width;
    doc.fontSize(10).font("Helvetica").fillColor("#888888")
      .text("Invoice Number", pageWidth - 200, 35, { width: 150, align: 'right' });
    doc.fontSize(14).font("Helvetica-Bold").fillColor("#000000")
      .text(invoiceData.invoiceNumber, pageWidth - 200, 50, { width: 150, align: 'right' });

    pdf.setCurrentY(100);
  }

  private static addInvoiceContent(pdf: PDFGenerator, invoiceData: any): void {
    const leftContent = PDFTemplates.buildLeftContent(invoiceData);
    const rightContent = PDFTemplates.buildRightContent(invoiceData);
    
    pdf.addTwoColumns(leftContent, rightContent);
    pdf.addSpace(20).addLine();
  }

  private static buildLeftContent(invoiceData: any): string {
    const accountNumber = invoiceData.account?.account_number || invoiceData.account?.legacy_account_number || "";
    const accountDisplay = invoiceData.account 
      ? `(${accountNumber}) ${invoiceData.account.account_name}` 
      : "N/A";
    
    return [
      `Invoice #: ${invoiceData.invoiceNumber}`,
      `Work Order #: ${invoiceData.workorder?.workorder_ref_id || ""}`,
      `Account: ${accountDisplay}`,
      `Address: ${invoiceData.billingAddress || ""}`,
      "Category: "
    ].join("\n");
  }

  private static buildRightContent(invoiceData: any): string {
    const invoiceDate = new Date(invoiceData.date).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
    const dueDate = new Date(invoiceData.dueDate).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
    
    return [
      `Invoice Date: ${invoiceDate}`,
      `Due Date: ${dueDate}`,
      "Payment Terms: ",
      `PO #: ${invoiceData.invoice_po || ""}`,
      `Status: ${invoiceData.status || "PAID"}`
    ].join("\n");
  }

  private static addInvoiceTables(pdf: PDFGenerator, invoiceData: any): void {
    if (PDFTemplates.hasVmrsCodes(invoiceData)) {
      PDFTemplates.addVmrsTable(pdf, invoiceData);
    } else if (PDFTemplates.hasInvoiceItems(invoiceData)) {
      PDFTemplates.addInvoiceItemsTable(pdf, invoiceData);
    }
  }

  private static hasVmrsCodes(invoiceData: any): boolean {
    return Boolean(invoiceData.workorder?.vmrsCodes && invoiceData.workorder.vmrsCodes.length > 0);
  }

  private static hasInvoiceItems(invoiceData: any): boolean {
    return invoiceData.invoiceItems?.length > 0;
  }

  private static addVmrsTable(pdf: PDFGenerator, invoiceData: any): void {
    const vmrsColumns = PDFTemplates.getVmrsColumns();
    const vmrsRows = PDFTemplates.buildVmrsRows(invoiceData);
    
    pdf.addTable(vmrsColumns, vmrsRows).addSpace(20);
  }

  private static getVmrsColumns(): TableColumn[] {
    return [
      { header: "Line", key: "line", width: 40, align: "center" },
      { header: "Unit #", key: "unitNumber", width: 50 },
      { header: "Billable", key: "billable", width: 55, align: "center" },
      { header: "VMRS Reason", key: "vmrsReason", width: 85 },
      { header: "Description", key: "description", width: 75 },
      { header: "Parts Charge", key: "partsCharge", width: 95, align: "right" },
      { header: "Labor Charge", key: "laborCharge", width: 110, align: "right" },
      { header: "Parts Description", key: "partsDescription", width: 150 },
      { header: "Line Subtotal", key: "lineSubtotal", width: 100, align: "right" },
    ];
  }

  private static buildVmrsRows(invoiceData: any): TableRow[] {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return invoiceData.workorder.vmrsCodes.map((vmrs: any, index: number) => ({
      line: vmrs.line || (index + 1),
      unitNumber: invoiceData.workorder?.unit_number || "",
      billable: vmrs.is_billable ? "Yes" : "No",
      vmrsReason: vmrs.vmrs_Lookup?.vmrs_code || "",
      description: vmrs.vmrs_Lookup?.vmrs_description || "testing",
      partsCharge: `$${Number(vmrs.workorder_part_cost || 0).toFixed(2)}`,
      laborCharge: `$${Number(vmrs.workorder_labour_cost || 0).toFixed(2)}`,
      partsDescription: vmrs.part_description || "",
      lineSubtotal: `$${Number(vmrs.workorder_totalCost || 0).toFixed(2)}`,
    } as TableRow));
  }

  private static addInvoiceItemsTable(pdf: PDFGenerator, invoiceData: any): void {
    const columns = PDFTemplates.getInvoiceItemsColumns();
    const rows = PDFTemplates.buildInvoiceItemsRows(invoiceData);
    
    pdf.addHeading("Invoice Items").addTable(columns, rows).addSpace(20);
  }

  private static getInvoiceItemsColumns(): TableColumn[] {
    return [
      { header: "Description", key: "description", width: 400 },
      { header: "Qty", key: "quantity", width: 80, align: "center" },
      { header: "Rate", key: "rate", width: 100, align: "right" },
      { header: "Amount", key: "amount", width: 100, align: "right" },
    ];
  }

  private static buildInvoiceItemsRows(invoiceData: any): TableRow[] {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return invoiceData.invoiceItems.map((item: any) => ({
      description: item.item_description,
      quantity: item.quantity,
      rate: `$${item.rate}`,
      amount: `$${item.amount}`,
    } as TableRow));
  }

  private static addInvoiceSummary(pdf: PDFGenerator, invoiceData: any): void {
    const summaryContent = PDFTemplates.buildSummaryContent(invoiceData);
    pdf.addTwoColumns("", summaryContent);
  }

  private static buildSummaryContent(invoiceData: any): string {
    return [
      `Sub Total: $${Number(invoiceData.subTotal || 0).toFixed(2)}`,
      `Other Charges: $${Number(invoiceData.other_charges || 0).toFixed(2)}`,
      `Shop Supplies: $${Number(invoiceData.shop_supplies_charges || 0).toFixed(2)}`,
      `Taxes: $${Number(invoiceData.taxes || 0).toFixed(2)}`,
      `Total: $${Number(invoiceData.totalAmount).toFixed(2)}`,
      `Payments/Credits: $${Number(invoiceData.amountPaid || 0).toFixed(2)}`,
      `Remaining Balance: $${Number(invoiceData.balanceDue).toFixed(2)}`
    ].join("\n");
  }
  // Generate payment receipt PDF
  static async generatePaymentReceipt(paymentData: any): Promise<Buffer> {
    const pdf = new PDFGenerator({
      title: `Payment Receipt ${paymentData.paymentId}`,
      subject: "Payment Receipt",
    });

    pdf
      .addTitle("PAYMENT RECEIPT")
      .addSpace(20)
      .addTwoColumns(
        `Payment ID: ${paymentData.paymentId}\nDate: ${new Date(
          paymentData.paymentDate
        ).toLocaleDateString()}\nMethod: ${paymentData.paymentMethod}`,
        `Payer: ${paymentData.payerName}\nEntity: ${
          paymentData.payerEntity || "N/A"
        }\nAccount: ${paymentData.account?.account_name || "N/A"}`
      )
      .addSpace(20)
      .addLine()
      .addKeyValue("Payment Amount", `$${paymentData.paymentAmount}`)
      .addKeyValue("Invoice Payments", paymentData.invoicePayments)
      .addKeyValue("Invoice Credits", paymentData.invoiceCredits || 0)
      .addSpace(20);

    if (paymentData.paymentInvoices?.length > 0) {
      const columns: TableColumn[] = [
        { header: "Invoice Number", key: "invoiceNumber", width: 150 },
        {
          header: "Invoice Amount",
          key: "totalAmount",
          width: 120,
          align: "right",
        },
        {
          header: "Balance Due",
          key: "balanceDue",
          width: 120,
          align: "right",
        },
      ];

      const rows = paymentData.paymentInvoices.map((pi: any) => ({
        invoiceNumber: pi.invoice.invoiceNumber,
        totalAmount: `$${pi.invoice.totalAmount}`,
        balanceDue: `$${pi.invoice.balanceDue}`,
      }));

      pdf.addHeading("Applied to Invoices").addTable(columns, rows);
    }

    return pdf.generateBuffer();
  }

  // Generate report PDF
  static async generateReport(
    title: string,
    data: any[],
    columns: TableColumn[]
  ): Promise<Buffer> {
    const pdf = new PDFGenerator({
      title: title,
      subject: "Report Document",
    });

    pdf
      .addTitle(title.toUpperCase())
      .addSpace(20)
      .addKeyValue("Generated On", new Date())
      .addKeyValue("Total Records", data.length)
      .addSpace(20)
      .addLine()
      .addTable(columns, data);

    return pdf.generateBuffer();
  }
}
