// TE CONNECT — Premium Wine/Burgundy Color System (Proton Vault / Luxury Grade)
export const Colors = {
  // Deep Wine / Burgundy Primaries
  primary: '#800E20',         // Rich Wine Red
  primaryDark: '#4E0511',     // Deep Burgundy / Midnight Wine
  primaryDeep: '#38030B',     // Darkest Wine
  primaryAccent: '#B81D36',   // Radiant Ruby Accent
  primaryLight: '#FBE8EC',    // Soft Rosé Tint
  primaryMuted: '#FDF2F4',    // Lightest Rosé
  primaryBorder: 'rgba(128, 14, 32, 0.12)',

  // Gradients Reference
  gradientStart: '#5E0B1A',
  gradientMid: '#8A1428',
  gradientEnd: '#B81D36',

  // Backgrounds & Surface
  background: '#F9F5F6',      // Warm Soft Rosé Neutral
  surface: '#FFFFFF',
  surfaceSubtle: '#FDFBFC',
  white: '#FFFFFF',

  // Text Hierarchy
  textPrimary: '#1F0B10',     // Deep Velvet Dark
  textSecondary: '#6B4E55',   // Warm Muted Burgundy/Slate
  textMuted: '#A0858C',       // Soft Ash Rose
  textInverse: '#FFFFFF',

  // Border & Dividers
  border: '#EEDCE1',
  borderLight: '#F6EAEF',
  borderDark: '#D4B8C1',

  // Status & Feedback
  success: '#15803D',
  successLight: '#DCFCE7',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  error: '#DC2626',
  errorLight: '#FEE2E2',
  info: '#800E20',
  infoLight: '#FBE8EC',

  // Slab Status
  statusUpcoming: '#800E20',
  statusUpcomingBg: '#FBE8EC',
  statusCompleted: '#15803D',
  statusCompletedBg: '#DCFCE7',
  statusCancelled: '#6B7280',
  statusCancelledBg: '#F3F4F6',

  // Meeting Type
  meetingCustomer: '#800E20',
  meetingCustomerBg: '#FBE8EC',
  meetingContractor: '#C2410C',
  meetingContractorBg: '#FFEDD5',
  meetingOther: '#0F766E',
  meetingOtherBg: '#CCFBF1',

  // Shadows
  shadow: 'rgba(78, 5, 17, 0.08)',
  shadowMedium: 'rgba(78, 5, 17, 0.14)',
  shadowHeavy: 'rgba(78, 5, 17, 0.22)',
  glow: 'rgba(184, 29, 54, 0.35)',

  // Overlay
  overlay: 'rgba(31, 11, 16, 0.6)',
  transparent: 'transparent',
};

export type ColorKey = keyof typeof Colors;
