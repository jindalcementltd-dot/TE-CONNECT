import { format, parseISO, isToday, isThisMonth } from 'date-fns';

// Bags to MT conversion (1 MT = 20 bags)
export const BAGS_PER_MT = 20;

export function bagsToMT(bags: number): number {
  return bags / BAGS_PER_MT;
}

export function formatMT(bags: number): string {
  const mt = bagsToMT(bags);
  if (mt >= 1) return `${mt.toFixed(2)} MT`;
  return `${bags} Bags`;
}

export function formatMTOnly(bags: number): string {
  return `${bagsToMT(bags).toFixed(2)} MT`;
}

export function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd MMM yyyy');
  } catch {
    return dateStr;
  }
}

export function formatDateShort(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd MMM');
  } catch {
    return dateStr;
  }
}

export function formatMonthYear(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'MMMM yyyy');
  } catch {
    return dateStr;
  }
}

export function currentDateISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function currentMonthISO(): string {
  return format(new Date(), 'yyyy-MM');
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export function calcActivePercent(actualPunch: number, totalSales: number): number {
  if (totalSales === 0) return 0;
  return (actualPunch / totalSales) * 100;
}

export function calcRequiredPunch(totalSales: number, targetPercent: number): number {
  return Math.ceil((totalSales * targetPercent) / 100);
}

export function calcGap(requiredPunch: number, actualPunch: number): number {
  return Math.max(0, requiredPunch - actualPunch);
}

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((result, item) => {
    const group = String(item[key]);
    if (!result[group]) result[group] = [];
    result[group].push(item);
    return result;
  }, {} as Record<string, T[]>);
}

export function sumBy<T>(array: T[], key: keyof T): number {
  return array.reduce((sum, item) => sum + (Number(item[key]) || 0), 0);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function isNetworkError(error: any): boolean {
  return error?.message?.includes('Network') || error?.message?.includes('network') || error?.message?.includes('timeout');
}
