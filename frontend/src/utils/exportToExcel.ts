import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import type { Task } from "../types";

export function exportToExcel(tasks: Task[]) {
  const data = tasks.map((t) => ({
    "Total Time (hours)": (t.totalSeconds / 3600).toFixed(2),
    Title: t.title,
    Status: t.status,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);

  const maxTitleLength = Math.max(
    "Title".length,
    ...tasks.map((t) => t.title.length)
  );
  worksheet["!cols"] = [
    { wch: 18 }, // Total Time column fixed width
    { wch: maxTitleLength + 5 }, // Title column auto-sized with padding
    { wch: 12 }, // Status column fits "In progress"
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Tasks");

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
  saveAs(blob, "tasks.xlsx");
}
