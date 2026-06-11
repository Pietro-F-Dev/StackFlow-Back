import type { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler';
import { AppError } from '../middlewares/errorHandler';
import * as reportService from '../services/report.service';

interface ReportParams {
  year: number;
  month: number;
}

function parseReportParams(req: Request): ReportParams {
  const year = parseInt(String(req.query.year), 10);
  const month = parseInt(String(req.query.month), 10);
  if (!year || !month || month < 1 || month > 12) {
    throw new AppError(400, 'INVALID_PARAMS', 'year and month query params are required (month: 1-12)');
  }
  return { year, month };
}

function reportFilename({ year, month }: ReportParams, ext: string): string {
  return `stockflow-report-${year}-${String(month).padStart(2, '0')}.${ext}`;
}

export const getMonthlyReport = asyncHandler(async (req: Request, res: Response) => {
  const { year, month } = parseReportParams(req);
  const report = await reportService.getMonthlyReport(year, month);
  res.json(report);
});

export const exportReport = asyncHandler(async (req: Request, res: Response) => {
  const params = parseReportParams(req);
  const format = String(req.query.format ?? 'csv').toLowerCase();

  if (format !== 'csv' && format !== 'pdf') {
    throw new AppError(400, 'INVALID_FORMAT', 'format must be "csv" or "pdf"');
  }

  const report = await reportService.getMonthlyReport(params.year, params.month);

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${reportFilename(params, 'csv')}"`);
    res.send('﻿' + reportService.buildCsv(report)); // BOM for Excel compatibility
    return;
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${reportFilename(params, 'pdf')}"`);
  reportService.buildPdf(report).pipe(res);
});
