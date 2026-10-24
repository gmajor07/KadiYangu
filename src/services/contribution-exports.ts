import "server-only";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import { getDb } from "@/lib/db";
import { contributionReport, contributionSummary } from "@/services/contributions";
export async function exportContributionData(userId: string, eventId: string, filters: Parameters<typeof contributionReport>[2] = {}) {
  const event = await getDb().event.findUnique({ where: { id: eventId }, select: { id: true, title: true, eventDate: true } }); if (!event) return null;
  const summary = await contributionSummary(userId, eventId); if (!summary) return null;
  const first = await contributionReport(userId, eventId, { ...filters, page: 1, pageSize: 100 }); if (!first) return null;
  const rows = [...first.rows]; for (let page = 2; page <= first.pages; page++) { const next = await contributionReport(userId, eventId, { ...filters, page, pageSize: 100 }); if (next) rows.push(...next.rows); }
  return { event, summary, rows, filters };
}
export async function createContributionXlsx(userId: string, eventId: string, filters: Parameters<typeof contributionReport>[2] = {}) {
  const data = await exportContributionData(userId, eventId, filters); if (!data) return null; const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet("Contributions");
  sheet.addRow(["KadiYangu Contribution Report"]); sheet.addRow(["Event", data.event.title]); sheet.addRow(["Generated", new Date().toISOString()]); sheet.addRow([]); sheet.addRow(["Contributors", data.summary.totalContributors, "Pledged", data.summary.totalPledged, "Confirmed", data.summary.totalConfirmed, "Outstanding", data.summary.outstanding]); sheet.addRow([]);
  sheet.addRow(["Contributor", "Phone", "Pledged (TZS)", "Confirmed (TZS)", "Outstanding (TZS)", "Overpaid (TZS)", "Status", "Last payment"]); for (const row of data.rows) sheet.addRow([row.fullName, row.phone || "", row.pledged, row.paid, row.outstanding, row.overpaid, row.status, row.lastPaymentDate?.toISOString() || ""]);
  sheet.getRow(1).font = { bold: true, size: 16 }; sheet.getRow(7).font = { bold: true }; sheet.columns.forEach(column => { column.width = Math.min(32, Math.max(14, (column.header?.length || 14) + 4)); }); return Buffer.from(await workbook.xlsx.writeBuffer());
}
export async function createContributionPdf(userId: string, eventId: string, filters: Parameters<typeof contributionReport>[2] = {}) {
  const data = await exportContributionData(userId, eventId, filters); if (!data) return null; const doc = new jsPDF({ unit: "pt", format: "a4" }); const left = 40; let y = 48;
  doc.setFontSize(18); doc.text("KadiYangu Contribution Report", left, y); y += 24; doc.setFontSize(11); doc.text(`Event: ${data.event.title}`, left, y); y += 16; doc.text(`Generated: ${new Date().toLocaleString()}`, left, y); y += 24; doc.text(`Pledged: TZS ${data.summary.totalPledged.toLocaleString()}   Confirmed: TZS ${data.summary.totalConfirmed.toLocaleString()}   Outstanding: TZS ${data.summary.outstanding.toLocaleString()}`, left, y); y += 24;
  doc.setFontSize(9); doc.text("Contributor", left, y); doc.text("Pledged", 220, y); doc.text("Confirmed", 300, y); doc.text("Outstanding", 390, y); doc.text("Status", 485, y); y += 14;
  for (const row of data.rows) { if (y > 770) { doc.addPage(); y = 48; } doc.text(row.fullName.slice(0, 28), left, y); doc.text(row.pledged.toLocaleString(), 220, y); doc.text(row.paid.toLocaleString(), 300, y); doc.text(row.outstanding.toLocaleString(), 390, y); doc.text(row.status, 485, y); y += 14; }
  const pages = doc.getNumberOfPages(); for (let i = 1; i <= pages; i++) { doc.setPage(i); doc.text(`Page ${i} of ${pages}`, 480, 810); } return Buffer.from(doc.output("arraybuffer"));
}
