import ExcelJS from "exceljs";
import { Response } from "express";

interface ColumnConfig {
  header: string;
  key: string;
  width?: number;
  formatter?: (value: unknown) => unknown
}

interface ExcelExportConfig {
  sheetName: string;
  title?: string;
  subtitle?: string;
  columns: ColumnConfig[];
  data: unknown[];
  filename: string;
  headerStyle?: Partial<ExcelJS.Row>;
  titleStyle?: {
    font?: Partial<ExcelJS.Font>,
    fill?: ExcelJS.FillPattern,
    alignment?: Partial<ExcelJS.Alignment>
  }
}

export class ExcelExporter {
  private workbook: ExcelJS.Workbook;
  private worksheet!: ExcelJS.Worksheet;

  constructor() {
    this.workbook = new ExcelJS.Workbook();
  }

  public generateWorkbook(config: ExcelExportConfig): ExcelJS.Workbook {
    this.worksheet = this.workbook.addWorksheet(config.sheetName);

    let currentRow = 1;

    // Add title if provided
    if (config.title) {
      currentRow = this.addTitle(config.title, currentRow, config.titleStyle);
    }

    // Add subtitle if provided
    if (config.subtitle) {
      currentRow = this.addSubtitle(config.subtitle, currentRow);
    }

    // Add empty row for spacing
    if (config.title || config.subtitle) {
      this.worksheet.addRow([]);
      currentRow++;
    }

    // Add headers and data
    this.addHeaders(config.columns, currentRow);
    this.addData(config.columns, config.data, currentRow + 1);

    // Apply styling
    this.applyBorders(currentRow);

    return this.workbook;
  }

  public async writeToBuffer(): Promise<Buffer> {
    const arrayBuffer = await this.workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer); // 👈 This line fixes the TS error
  }

  private addTitle(
    title: string,
    row: number,
    titleStyle?: ExcelExportConfig["titleStyle"]
  ): number {
    const titleCell = this.worksheet.getCell(`A${row}`);
    titleCell.value = title;

    // Default title styling
    titleCell.font = { bold: true, size: 14, ...titleStyle?.font };
    titleCell.alignment = { horizontal: "center", ...titleStyle?.alignment };
    titleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
      ...titleStyle?.fill,
    };

    // Merge title across all columns
    const lastCol = String.fromCharCode(64 + this.getColumnCount());
    this.worksheet.mergeCells(`A${row}:${lastCol}${row}`);

    return row + 1;
  }

  private addSubtitle(subtitle: string, row: number): number {
    const subtitleCell = this.worksheet.getCell(`A${row}`);
    subtitleCell.value = subtitle;
    subtitleCell.font = { italic: true };
    subtitleCell.alignment = { horizontal: "center" };

    // Merge subtitle across all columns
    const lastCol = String.fromCharCode(64 + this.getColumnCount());
    this.worksheet.mergeCells(`A${row}:${lastCol}${row}`);

    return row + 1;
  }

  private addHeaders(columns: ColumnConfig[], row: number): void {
    const headerRow = this.worksheet.getRow(row);

    columns.forEach((col, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = col.header;

      // Set column width
      if (col.width) {
        this.worksheet.getColumn(index + 1).width = col.width;
      }
    });

    // Style header row
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };
  }

  private addData(
    columns: ColumnConfig[],
    data: unknown[],
    startRow: number
  ): void {
    data.forEach((item, rowIndex) => {
      const row = this.worksheet.getRow(startRow + rowIndex);

      columns.forEach((col, colIndex) => {
        let value = (item as Record<string, unknown>)[col.key];

        // Apply formatter if provided
        if (col.formatter) {
          value = col.formatter(value);
        }

        // Handle null/undefined values
        value ??= "N/A";

        row.getCell(colIndex + 1).value = value as ExcelJS.CellValue;
      });
    });
  }

  private applyBorders(startRow: number): void {
    this.worksheet.eachRow((row, rowNumber) => {
      if (rowNumber >= startRow) {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });
      }
    });
  }

  private getColumnCount(): number {
    return this.worksheet.columns?.length || 20;
  }

  public async writeToResponse(res: Response, filename: string): Promise<void> {
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

    await this.workbook.xlsx.write(res);
    res.end();
  }
}

// Utility function for pagination info
export const createPaginationSubtitle = (
  page: number,
  perPage: number,
  skip: number,
  total: number
): string => {
  const totalPages = Math.ceil(total / perPage);
  const endRecord = Math.min(skip + perPage, total);
  return `Page ${page} of ${totalPages} | Records ${
    skip + 1
  }-${endRecord} of ${total} | Date: ${new Date().toLocaleString()}`;
};

// Common formatters
export const formatters = {
  date: (value: unknown) =>
    value ? new Date(value as string).toLocaleString() : "N/A",
  boolean: (value: boolean) => (value ? "Yes" : "No"),
  currency: (value: number) => (value ? `$${value.toFixed(2)}` : "N/A"),
  serialNumber: (index: number, skip = 0) => skip + index + 1,
};

export const formatDate = (val?: Date | string | null): string => {
  if (!val) return "N/A";
  const date = new Date(val);
  if (isNaN(date.getTime())) return "N/A";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};
