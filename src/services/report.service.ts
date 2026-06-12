import PDFDocument from 'pdfkit';
import { Sale } from '../models/Sale';

export async function getMonthlyReport(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const [summary, topProducts, dailySeries] = await Promise.all([
    getSummary(start, end),
    getTopProducts(start, end),
    getDailySeries(start, end, year, month),
  ]);

  return {
    year,
    month,
    grossRevenue: summary.grossRevenue,
    netRevenue: summary.netRevenue,
    salesCount: summary.salesCount,
    itemsSold: summary.itemsSold,
    topProducts,
    dailySeries,
  };
}

async function getSummary(start: Date, end: Date) {
  const [result] = await Sale.aggregate([
    { $match: { date: { $gte: start, $lt: end }, cancelledAt: null } },
    { $unwind: '$items' },
    {
      $group: {
        _id: null,
        grossRevenue: { $sum: { $multiply: ['$items.qty', '$items.unitPrice'] } },
        netRevenue: { $sum: { $multiply: ['$items.qty', { $subtract: ['$items.unitPrice', '$items.unitCost'] }] } },
        salesCount: { $addToSet: '$_id' },
        itemsSold: { $sum: '$items.qty' },
      },
    },
    {
      $project: {
        _id: 0,
        grossRevenue: 1,
        netRevenue: 1,
        salesCount: { $size: '$salesCount' },
        itemsSold: 1,
      },
    },
  ]);

  return result ?? { grossRevenue: 0, netRevenue: 0, salesCount: 0, itemsSold: 0 };
}

async function getTopProducts(start: Date, end: Date) {
  return Sale.aggregate([
    { $match: { date: { $gte: start, $lt: end }, cancelledAt: null } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.productId',
        name: { $first: '$items.name' },
        qtySold: { $sum: '$items.qty' },
        grossRevenue: { $sum: { $multiply: ['$items.qty', '$items.unitPrice'] } },
      },
    },
    { $sort: { grossRevenue: -1 } },
    { $limit: 10 },
    { $project: { _id: 0, productId: '$_id', name: 1, qtySold: 1, grossRevenue: 1 } },
  ]);
}

async function getDailySeries(start: Date, end: Date, year: number, month: number) {
  const rows = await Sale.aggregate([
    { $match: { date: { $gte: start, $lt: end }, cancelledAt: null } },
    { $unwind: '$items' },
    {
      $group: {
        _id: { $dayOfMonth: '$date' },
        grossRevenue: { $sum: { $multiply: ['$items.qty', '$items.unitPrice'] } },
        netRevenue: { $sum: { $multiply: ['$items.qty', { $subtract: ['$items.unitPrice', '$items.unitCost'] }] } },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, day: '$_id', grossRevenue: 1, netRevenue: 1 } },
  ]);

  // Fill every day of the month (even days with no sales → 0)
  const daysInMonth = new Date(year, month, 0).getDate();
  const byDay = new Map(rows.map((r) => [r.day, r]));
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    return byDay.get(day) ?? { day, grossRevenue: 0, netRevenue: 0 };
  });
}

// ─── Export helpers ────────────────────────────────────────────────────────

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const brl = (cents: number) => `R$ ${(cents / 100).toFixed(2)}`;
const pad = (v: string | number, w: number) => String(v).padEnd(w);

type MonthlyReport = Awaited<ReturnType<typeof getMonthlyReport>>;

export function buildCsv(report: MonthlyReport): string {
  const lines: string[] = [
    `StockFlow - Relatório Mensal - ${MONTHS[report.month - 1]}/${report.year}`,
    '',
    'RESUMO',
    `Receita Bruta,${brl(report.grossRevenue)}`,
    `Receita Líquida,${brl(report.netRevenue)}`,
    `Total de Vendas,${report.salesCount}`,
    `Itens Vendidos,${report.itemsSold}`,
    '',
    'TOP PRODUTOS',
    'Produto,Qtd Vendida,Receita Bruta',
    ...report.topProducts.map((p) => `${p.name},${p.qtySold},${brl(p.grossRevenue)}`),
    '',
    'SÉRIE DIÁRIA',
    'Dia,Receita Bruta,Receita Líquida',
    ...report.dailySeries.map((d) => `${d.day},${brl(d.grossRevenue)},${brl(d.netRevenue)}`),
  ];
  return lines.join('\r\n');
}

export function buildPdf(report: MonthlyReport): PDFKit.PDFDocument {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  // ── Header ──
  doc.fontSize(18).font('Helvetica-Bold').text('StockFlow — Relatório Mensal', { align: 'center' });
  doc.fontSize(12).font('Helvetica').text(`${MONTHS[report.month - 1]} de ${report.year}`, { align: 'center' });
  doc.moveDown(1.5);

  // ── Summary ──
  doc.fontSize(13).font('Helvetica-Bold').text('Resumo');
  doc.moveDown(0.3);
  doc.fontSize(11).font('Helvetica');
  const summary = [
    ['Receita Bruta', brl(report.grossRevenue)],
    ['Receita Líquida', brl(report.netRevenue)],
    ['Total de Vendas', String(report.salesCount)],
    ['Itens Vendidos', String(report.itemsSold)],
  ];
  for (const [label, value] of summary) {
    doc.text(`${pad(label, 20)}${value}`);
  }
  doc.moveDown(1);

  // ── Top Products ──
  doc.fontSize(13).font('Helvetica-Bold').text('Top Produtos');
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica-Bold').text(`${pad('Produto', 30)}${pad('Qtd', 8)}Receita Bruta`);
  doc.font('Helvetica');
  for (const p of report.topProducts) {
    doc.text(`${pad(p.name, 30)}${pad(p.qtySold, 8)}${brl(p.grossRevenue)}`);
  }
  doc.moveDown(1);

  // ── Daily series ──
  doc.fontSize(13).font('Helvetica-Bold').text('Série Diária');
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica-Bold').text(`${pad('Dia', 8)}${pad('Receita Bruta', 20)}Receita Líquida`);
  doc.font('Helvetica');
  for (const d of report.dailySeries.filter((x) => x.grossRevenue > 0)) {
    doc.text(`${pad(d.day, 8)}${pad(brl(d.grossRevenue), 20)}${brl(d.netRevenue)}`);
  }

  doc.end();
  return doc;
}
