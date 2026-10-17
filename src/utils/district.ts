// TE CONNECT — District & TE Scoping Utilities
import { User, Dealer, Slab, Sale, Meeting, ActiveTracker } from '../types';

/**
 * Normalizes district names (e.g., 'baleswer' vs 'baleswar' -> standardized)
 */
export function normalizeDistrictName(dist?: string): string {
  if (!dist) return '';
  const clean = dist.trim();
  const lower = clean.toLowerCase();
  if (lower.includes('balesw') || lower.includes('balas')) {
    return 'Baleswar';
  }
  if (lower.includes('jajpur')) {
    return 'Jajpur';
  }
  if (lower.includes('bhadrak')) {
    return 'Bhadrak';
  }
  if (lower.includes('cuttack')) {
    return 'Cuttack';
  }
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/**
 * Resolves a User's district
 */
export function getUserDistrict(user: User | null): string {
  if (!user) return 'Jajpur';
  return normalizeDistrictName(user.district || user.territory || user.team) || 'Jajpur';
}

/**
 * Resolves a Dealer's district
 */
export function getDealerDistrict(dealer: Dealer, usersList?: User[]): string {
  if (dealer.district && dealer.district.trim()) {
    return normalizeDistrictName(dealer.district);
  }
  if (dealer.assigned_te && usersList && usersList.length > 0) {
    const teName = dealer.assigned_te.trim().toLowerCase();
    const matched = usersList.find(u => u.name && u.name.trim().toLowerCase() === teName);
    if (matched && matched.district) {
      return normalizeDistrictName(matched.district);
    }
  }
  // Check area or address strings
  const searchStr = `${dealer.area || ''} ${dealer.address || ''}`.toLowerCase();
  if (searchStr.includes('balesw') || searchStr.includes('balas')) return 'Baleswar';
  if (searchStr.includes('bhadrak')) return 'Bhadrak';
  if (searchStr.includes('cuttack')) return 'Cuttack';
  if (searchStr.includes('jajpur')) return 'Jajpur';

  return 'Jajpur';
}

/**
 * Resolves a Slab's district
 */
export function getSlabDistrict(slab: Slab, dealers?: Dealer[], usersList?: User[]): string {
  if (slab.assigned_te && usersList && usersList.length > 0) {
    const teName = slab.assigned_te.trim().toLowerCase();
    const matched = usersList.find(u => u.name && u.name.trim().toLowerCase() === teName);
    if (matched && matched.district) {
      return normalizeDistrictName(matched.district);
    }
  }
  if (slab.dealer_id && dealers && dealers.length > 0) {
    const dealer = dealers.find(d => d.dealer_id === slab.dealer_id);
    if (dealer) return getDealerDistrict(dealer, usersList);
  }
  const searchStr = `${slab.dealer_name || ''} ${slab.remark || ''} ${slab.customer_name || ''}`.toLowerCase();
  if (searchStr.includes('balesw') || searchStr.includes('balas')) return 'Baleswar';
  if (searchStr.includes('bhadrak')) return 'Bhadrak';

  return 'Jajpur';
}

/**
 * Resolves a Sale's district
 */
export function getSaleDistrict(sale: Sale, dealers?: Dealer[], usersList?: User[]): string {
  if (sale.assigned_te && usersList && usersList.length > 0) {
    const teName = sale.assigned_te.trim().toLowerCase();
    const matched = usersList.find(u => u.name && u.name.trim().toLowerCase() === teName);
    if (matched && matched.district) {
      return normalizeDistrictName(matched.district);
    }
  }
  if (sale.dealer_id && dealers && dealers.length > 0) {
    const dealer = dealers.find(d => d.dealer_id === sale.dealer_id);
    if (dealer) return getDealerDistrict(dealer, usersList);
  }
  return 'Jajpur';
}

/**
 * Resolves a Meeting's district
 */
export function getMeetingDistrict(meeting: Meeting, usersList?: User[]): string {
  if (meeting.te && usersList && usersList.length > 0) {
    const teName = meeting.te.trim().toLowerCase();
    const matched = usersList.find(u => u.name && u.name.trim().toLowerCase() === teName);
    if (matched && matched.district) {
      return normalizeDistrictName(matched.district);
    }
  }
  const loc = (meeting.location || '').toLowerCase();
  if (loc.includes('balesw') || loc.includes('balas')) return 'Baleswar';
  if (loc.includes('bhadrak')) return 'Bhadrak';
  return 'Jajpur';
}

/**
 * Resolves an ActiveTracker's district
 */
export function getTrackerDistrict(tracker: ActiveTracker, usersList?: User[]): string {
  if (tracker.te && usersList && usersList.length > 0) {
    const teName = tracker.te.trim().toLowerCase();
    const matched = usersList.find(u => u.name && u.name.trim().toLowerCase() === teName);
    if (matched && matched.district) {
      return normalizeDistrictName(matched.district);
    }
  }
  return 'Jajpur';
}

/**
 * Extracts all unique districts known across users and dealers
 */
export function getAvailableDistricts(usersList?: User[], dealers?: Dealer[]): string[] {
  const set = new Set<string>();
  set.add('Jajpur');

  (usersList || []).forEach(u => {
    if (u.district) set.add(normalizeDistrictName(u.district));
    if (u.territory) set.add(normalizeDistrictName(u.territory));
  });

  (dealers || []).forEach(d => {
    if (d.district) set.add(normalizeDistrictName(d.district));
    const search = `${d.area || ''} ${d.address || ''}`.toLowerCase();
    if (search.includes('balesw') || search.includes('balas')) set.add('Baleswar');
    if (search.includes('bhadrak')) set.add('Bhadrak');
  });

  return Array.from(set).filter(Boolean).sort();
}

/**
 * Evaluates whether a given item belongs to the requested active district and user.
 * - If user is TE: only match if item is in user's district AND (if TE name is assigned, matches TE name)
 * - If user is Admin/Manager: filter by activeDistrict ('ALL' returns all, else exact district match)
 */
export function isItemInScope(
  itemDistrict: string,
  itemTe: string | undefined,
  user: User | null,
  activeDistrict: string
): boolean {
  const normItemDist = normalizeDistrictName(itemDistrict);

  // If user is a TE: strictly scoped to their own district
  if (user && user.role === 'TE') {
    const userDist = getUserDistrict(user);
    if (normItemDist.toLowerCase() !== userDist.toLowerCase()) {
      return false;
    }
    // If the item has an assigned TE, also check if it's assigned to this TE or general pool
    if (itemTe && user.name) {
      const cleanItemTe = itemTe.trim().toLowerCase();
      const cleanUserName = user.name.trim().toLowerCase();
      if (cleanItemTe && cleanItemTe !== 'team jajpur' && cleanItemTe !== 'consolidated' && cleanItemTe !== cleanUserName) {
        return false;
      }
    }
    return true;
  }

  // If Admin / Manager:
  if (!activeDistrict || activeDistrict === 'ALL') {
    return true;
  }

  return normItemDist.toLowerCase() === normalizeDistrictName(activeDistrict).toLowerCase();
}
