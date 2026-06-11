import { AppError } from '../middlewares/errorHandler';

export interface DateRange {
  $gte?: Date;
  $lte?: Date;
}

function parseDate(value: string, field: 'from' | 'to'): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, 'INVALID_DATE', `Invalid "${field}" date`);
  }
  return date;
}

export function parseDateRange(from?: string, to?: string): DateRange | undefined {
  if (!from && !to) return undefined;
  const range: DateRange = {};
  if (from) range.$gte = parseDate(from, 'from');
  if (to) range.$lte = parseDate(to, 'to');
  return range;
}
