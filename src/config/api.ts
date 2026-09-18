// TE CONNECT — API Configuration
// ============================================================
// IMPORTANT: After deploying Google Apps Script, paste your
// Web App URL below. It looks like:
// https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
// ============================================================

export const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwD_2lt1qBbtcEiTcjbct565HUusllU1YW4b5i3fS_cEQBmBE_ZZ8WLBlPOXhs6ELum_g/exec';

// Timeout for API calls (milliseconds)
export const API_TIMEOUT = 15000;

// App version
export const APP_VERSION = '1.0.0';

// Cache durations (milliseconds)
export const CACHE = {
  SHORT: 2 * 60 * 1000,    // 2 minutes
  MEDIUM: 5 * 60 * 1000,   // 5 minutes
  LONG: 30 * 60 * 1000,    // 30 minutes
};
