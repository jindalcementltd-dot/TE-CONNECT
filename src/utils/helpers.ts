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
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const istDate = new Date(utc + (5.5 * 60 * 60 * 1000));
  const y = istDate.getFullYear();
  const m = String(istDate.getMonth() + 1).padStart(2, '0');
  const d = String(istDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function currentMonthISO(): string {
  return currentDateISO().substring(0, 7);
}

export function normalizeDate(dateStr: any): string {
  if (!dateStr) return '';
  if (dateStr instanceof Date) {
    const utc = dateStr.getTime() + (dateStr.getTimezoneOffset() * 60000);
    const istDate = new Date(utc + (5.5 * 60 * 60 * 1000));
    const y = istDate.getFullYear();
    const m = String(istDate.getMonth() + 1).padStart(2, '0');
    const d = String(istDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(dateStr).trim();

  // If already pure YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // If ISO string with T and Z / offset (e.g. 2026-09-18T18:30:00.000Z)
  if (str.includes('T') || str.endsWith('Z')) {
    try {
      const utcDate = new Date(str);
      if (!isNaN(utcDate.getTime())) {
        // Convert to IST (UTC + 5:30)
        const istOffsetMs = 5.5 * 60 * 60 * 1000;
        const istDate = new Date(utcDate.getTime() + istOffsetMs);
        const y = istDate.getUTCFullYear();
        const m = String(istDate.getUTCMonth() + 1).padStart(2, '0');
        const d = String(istDate.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    } catch {}
  }

  // Check DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Check YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return str.substring(0, 10);
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 12) return 'Good Morning';
  if (hour >= 12 && hour < 17) return 'Good Afternoon';
  if (hour >= 17 && hour < 22) return 'Good Evening';
  return 'Good Evening'; // Late night
}

// Business Target Constants
export const PUNCH_VOLUME_TARGET_PERCENT = 80; // 80% of total sales volume (bags)
export const CONTRACTOR_ACTIVE_MIN_TARGET_PERCENT = 40; // 40% minimum active contractor base

export function calcActivePercent(actualPunch: number, totalSales: number): number {
  if (totalSales === 0) return 0;
  return (actualPunch / totalSales) * 100;
}

export function calcContractorActivePercent(activeContractors: number, totalContractors: number): number {
  if (totalContractors === 0) return 0;
  return (activeContractors / totalContractors) * 100;
}

export function calcRequiredPunch(totalSales: number, targetPercent = PUNCH_VOLUME_TARGET_PERCENT): number {
  return Math.ceil((totalSales * targetPercent) / 100);
}

export function calcRequiredActiveContractors(totalContractors: number, targetPercent = CONTRACTOR_ACTIVE_MIN_TARGET_PERCENT): number {
  return Math.ceil((totalContractors * targetPercent) / 100);
}

export function calcGap(requiredPunch: number, actualPunch: number): number {
  return Math.max(0, requiredPunch - actualPunch);
}

export interface DistributionSimulation {
  totalSalesBags: number;
  totalSalesMT: number;
  punchTargetBags: number;
  totalContractors: number;
  minActiveContractorTarget: number;
  bagRate: number;
  fullContractors: number;
  remainderBags: number;
  activatedContractors: number;
  activePercentAchieved: number;
  isContractorTargetMet: boolean;
  contractorShortfall: number;
}

export function simulateContractorPunchDistribution(
  totalSalesBags: number,
  totalContractors: number,
  bagRate: number
): DistributionSimulation {
  const safeSalesBags = Math.max(0, Number(totalSalesBags) || 0);
  const safeContractors = Math.max(0, Number(totalContractors) || 0);
  const safeBagRate = Math.max(1, Number(bagRate) || 80);

  const punchTargetBags = Math.ceil(safeSalesBags * (PUNCH_VOLUME_TARGET_PERCENT / 100));
  const minActiveContractorTarget = Math.ceil(safeContractors * (CONTRACTOR_ACTIVE_MIN_TARGET_PERCENT / 100));

  const fullContractors = Math.floor(punchTargetBags / safeBagRate);
  const remainderBags = punchTargetBags % safeBagRate;
  const activatedContractors = remainderBags > 0 ? fullContractors + 1 : fullContractors;
  
  const activePercentAchieved = safeContractors > 0
    ? Math.round(((activatedContractors / safeContractors) * 100) * 10) / 10
    : 0;

  const isContractorTargetMet = activePercentAchieved >= CONTRACTOR_ACTIVE_MIN_TARGET_PERCENT;
  const contractorShortfall = Math.max(0, minActiveContractorTarget - activatedContractors);

  return {
    totalSalesBags: safeSalesBags,
    totalSalesMT: safeSalesBags / BAGS_PER_MT,
    punchTargetBags,
    totalContractors: safeContractors,
    minActiveContractorTarget,
    bagRate: safeBagRate,
    fullContractors,
    remainderBags,
    activatedContractors,
    activePercentAchieved,
    isContractorTargetMet,
    contractorShortfall,
  };
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

export function formatNumber(val: number | string | null | undefined): string {
  if (val === null || val === undefined) return '0';
  const num = typeof val === 'number' ? val : Number(val);
  if (isNaN(num)) return '0';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function isNetworkError(error: any): boolean {
  return error?.message?.includes('Network') || error?.message?.includes('network') || error?.message?.includes('timeout');
}

