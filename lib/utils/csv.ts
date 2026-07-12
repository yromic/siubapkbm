import type { ImportTemplate } from "@/lib/api/imports";

export function readCsvFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("File CSV tidak dapat dibaca."));
        return;
      }
      resolve(reader.result.replace(/^\uFEFF/, ""));
    };
    reader.onerror = () => reject(new Error("File CSV tidak dapat dibaca."));
    reader.readAsText(file, "UTF-8");
  });
}

function escapeCsvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildTemplateCsv(template: ImportTemplate): string {
  const headers = [...template.required_columns, ...template.optional_columns];
  const lines = [headers.map(escapeCsvCell).join(",")];
  template.sample_rows.forEach((row) => {
    lines.push(headers.map((header) => escapeCsvCell(row[header])).join(","));
  });
  return `\uFEFF${lines.join("\r\n")}`;
}

export function downloadCsvFile(content: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName.endsWith(".csv") ? fileName : `${fileName}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
