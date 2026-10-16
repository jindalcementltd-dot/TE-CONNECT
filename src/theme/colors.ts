export const Colors = {
  // Primary Red Theme
  primary: '#C91F2B',
  primaryDark: '#9F1420',
  primaryAccent: '#E53935',
  primaryLight: '#FDE8EA',
  primaryMuted: '#FEF2F3',

  // Background
  background: '#F6F7F9',
  white: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceSubtle: '#F9FAFB',

  // Text
  textPrimary: '#172033',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  textInverse: '#FFFFFF',

  // Border
  border: '#E5E7EB',
  borderLight: '#F3F4F6',

  // Status
  success: '#16A34A',
  successLight: '#DCFCE7',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  error: '#DC2626',
  errorLight: '#FEE2E2',
  info: '#2563EB',
  infoLight: '#DBEAFE',

  // Slab Status
  statusUpcoming: '#2563EB',
  statusUpcomingBg: '#DBEAFE',
  statusCompleted: '#16A34A',
  statusCompletedBg: '#DCFCE7',
  statusCancelled: '#6B7280',
  statusCancelledBg: '#F3F4F6',

  // Meeting Type
  meetingCustomer: '#7C3AED',
  meetingCustomerBg: '#EDE9FE',
  meetingContractor: '#EA580C',
  meetingContractorBg: '#FFF7ED',
  meetingOther: '#0891B2',
  meetingOtherBg: '#E0F2FE',

  // Shadow
  shadow: 'rgba(0,0,0,0.08)',
  shadowMedium: 'rgba(0,0,0,0.12)',

  // Overlay
  overlay: 'rgba(0,0,0,0.4)',
  transparent: 'transparent',
  
  glassWhite: 'rgba(255, 255, 255, 0.75)',
};

export type ColorKey = keyof typeof Colors;
