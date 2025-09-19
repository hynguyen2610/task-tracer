import { FileSpreadsheet } from "lucide-react"
import * as XLSX from "xlsx"
import { saveAs } from "file-saver"
import type { Task } from "../types"

export default function ExportButton({ tasks }: { tasks: Task[] }) {
  const exportToExcel = () => {
    const data = tasks.map(t => ({
      "Total Time (hours)": (t.totalSeconds / 3600).toFixed(2).replace(/\./, ','),
      Title: t.title,
    }))
    const worksheet = XLSX.utils.json_to_sheet(data)
    const maxTitleLength = Math.max("Title".length, ...tasks.map(t => t.title.length))
    worksheet["!cols"] = [{ wch: 18 }, { wch: maxTitleLength + 5 }]
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Tasks")
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" })
    saveAs(blob, "tasks.xlsx")
  }

  return (
    <button
      onClick={exportToExcel}
      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center justify-center"
    >
      <span className="sr-only">Export to Excel</span>
      <FileSpreadsheet className="h-6 w-6" />
    </button>
  )
}

