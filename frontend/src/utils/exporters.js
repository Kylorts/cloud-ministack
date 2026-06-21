// Ekspor data tabel ke Excel (.xlsx) & PDF — lebih mudah dibaca daripada CSV.
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

function pad(rows, n) {
  return rows.map((r) => {
    const a = r.map((c) => (c == null ? '' : c))
    while (a.length < n) a.push('')
    return a
  })
}

export function exportXlsx(filename, sheetName, headers, rows) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...pad(rows, headers.length)])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, (sheetName || 'Sheet1').slice(0, 31))
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`)
}

export function exportPdf(filename, title, headers, rows) {
  const doc = new jsPDF({ orientation: headers.length > 4 ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' })
  doc.setFontSize(14)
  doc.text(title, 40, 40)
  doc.setFontSize(9)
  doc.setTextColor(120)
  doc.text(new Date().toLocaleString('id-ID'), 40, 56)
  autoTable(doc, {
    head: [headers],
    body: pad(rows, headers.length),
    startY: 70,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [6, 47, 40], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 250, 245] },
  })
  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`)
}
