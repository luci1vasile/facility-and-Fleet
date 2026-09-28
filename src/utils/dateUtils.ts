import { InspectionStatus, VignetteDurationCode } from '../types';

export function formatTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysToTodayISO(offsetDays: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getDaysRemaining(expiryDateStr: string): number {
  if (!expiryDateStr) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = expiryDateStr.split('-').map(Number);
  if (!y || !m || !d) return 0;
  const target = new Date(y, m - 1, d, 0, 0, 0, 0);
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Status rules from user specification:
 * - Overdue (Red): <= 3 days until expiration (including already expired)
 * - Due soon (Yellow): > 3 days and <= 15 days until expiration
 * - OK (Green): > 15 days until expiration
 */
export function getInspectionStatus(expiryDateStr: string): InspectionStatus {
  const days = getDaysRemaining(expiryDateStr);
  if (days <= 3) return 'overdue';
  if (days <= 15) return 'due_soon';
  return 'ok';
}

/**
 * Calculates new expiration date by combining years, months, weeks, and days
 * starting from the selected calendar date.
 */
export function calculateCombinedExpiryDate(
  baseDateStr: string,
  years: number,
  months: number,
  weeks: number,
  days: number
): string {
  const [y, m, d] = (baseDateStr || formatTodayISO()).split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);

  if (years > 0) {
    date.setFullYear(date.getFullYear() + years);
  }
  if (months > 0) {
    date.setMonth(date.getMonth() + months);
  }
  const totalExtraDays = (weeks || 0) * 7 + (days || 0);
  if (totalExtraDays > 0) {
    date.setDate(date.getDate() + totalExtraDays);
  }

  const outY = date.getFullYear();
  const outM = String(date.getMonth() + 1).padStart(2, '0');
  const outD = String(date.getDate()).padStart(2, '0');
  return `${outY}-${outM}-${outD}`;
}

/**
 * Calculates new ITP/MOT expiration date for 1, 2, or 3 years from selected calendar date.
 */
export function calculateItpExpiryDate(
  baseDateStr: string,
  years: 1 | 2 | 3
): string {
  return calculateCombinedExpiryDate(baseDateStr, years, 0, 0, 0);
}

/**
 * Calculates new vignette expiration date for 1d, 7d, 10d, 3m, 6m, 12m.
 */
export function calculateVignetteExpiryDate(
  baseDateStr: string,
  durationCode: VignetteDurationCode
): string {
  switch (durationCode) {
    case '1d':
      return calculateCombinedExpiryDate(baseDateStr, 0, 0, 0, 1);
    case '7d':
      return calculateCombinedExpiryDate(baseDateStr, 0, 0, 0, 7);
    case '10d':
      return calculateCombinedExpiryDate(baseDateStr, 0, 0, 0, 10);
    case '3m':
      return calculateCombinedExpiryDate(baseDateStr, 0, 3, 0, 0);
    case '6m':
      return calculateCombinedExpiryDate(baseDateStr, 0, 6, 0, 0);
    case '12m':
      return calculateCombinedExpiryDate(baseDateStr, 1, 0, 0, 0);
    default:
      return calculateCombinedExpiryDate(baseDateStr, 1, 0, 0, 0);
  }
}

export function formatDateDisplay(isoDate: string, lang: string = 'ro'): string {
  if (!isoDate) return '-';
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const date = new Date(y, m - 1, d);
  const localeMap: Record<string, string> = {
    ro: 'ro-RO',
    en: 'en-GB',
    nl: 'nl-NL',
    de: 'de-DE',
    fr: 'fr-FR',
  };
  return date.toLocaleDateString(localeMap[lang] || 'ro-RO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
