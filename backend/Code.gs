// ============================================================
// TE CONNECT — Google Apps Script Backend
// Version: 1.0.0
// ============================================================
// HOW TO USE:
// 1. Open Google Sheets → Extensions → Apps Script
// 2. Paste this entire file into the editor
// 3. Run setupSpreadsheet() first
// 4. Deploy as Web App
// ============================================================

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

// ── SHEET NAMES ──────────────────────────────────────────
const SHEETS = {
  USERS: 'USERS',
  DEALERS: 'DEALERS',
  CONTRACTORS: 'CONTRACTORS',
  SLABS: 'SLABS',
  SALES: 'SALES',
  ACTIVE_TRACKER: 'ACTIVE_TRACKER',
  MEETINGS: 'MEETINGS',
  TARGETS: 'TARGETS',
  SETTINGS: 'SETTINGS',
  ACTIVITY_LOG: 'ACTIVITY_LOG',
  PUSH_SUBSCRIPTIONS: 'PUSH_SUBSCRIPTIONS',
  EXPO_TOKENS: 'EXPO_TOKENS',
};

// ── COLUMN HEADERS ────────────────────────────────────────────
const HEADERS = {
  USERS: ['user_id','login_id','password_hash','name','role','team','district','territory','phone','active','photo_url','created_at'],
  DEALERS: ['dealer_id','dealer_name','owner_name','phone','address','area','latitude','longitude','assigned_te','active','qr_id','qr_token','public_slab_link','created_at','sap_code'],
  CONTRACTORS: ['contractor_id','contractor_name','mobile','area','assigned_te','active','created_at'],
  SLABS: ['slab_id','slab_date','dealer_id','dealer_name','contractor_name','customer_name','expected_cement','latitude','longitude','assigned_te','status','remark','source','created_by','created_at','updated_at'],
  SALES: ['sale_id','sale_date','dealer_id','dealer_name','product','quantity_bags','assigned_te','source','created_by','created_at','updated_at'],
  ACTIVE_TRACKER: ['tracker_id','date','month','te','total_contractors','active_contractors','inactive_contractors','punched_quantity_bags','f2r_punch_bags','gold_punch_bags','updated_by','updated_at'],
  MEETINGS: ['meeting_id','meeting_date','te','meeting_type','meeting_name','location','purpose','people_count','status','outcome','next_followup','expense_amount','source','created_by','created_at','updated_at'],
  TARGETS: ['target_id','month','year','te','active_target','customer_meeting_target','contractor_meeting_target'],
  SETTINGS: ['setting','value'],
  ACTIVITY_LOG: ['activity_id','user_id','user_name','action','module','record_id','timestamp','details'],
  PUSH_SUBSCRIPTIONS: ['subscription_id','endpoint','p256dh','auth','user_name','user_role','district','updated_at'],
  EXPO_TOKENS: ['token','user_name','registered_at'],
};

// ── RESPONSE HELPERS ─────────────────────────────────────────
function success(data, message) {
  return ContentService.createTextOutput(
    JSON.stringify({ success: true, message: message || 'OK', data: data })
  ).setMimeType(ContentService.MimeType.JSON);
}

function error(message) {
  return ContentService.createTextOutput(
    JSON.stringify({ success: false, message: message || 'Error' })
  ).setMimeType(ContentService.MimeType.JSON);
}

// ── CORS HELPER ──────────────────────────────────────────────
function addCorsHeaders(output) {
  // Apps Script does not support custom CORS headers via ContentService.
  // Deploy as Web App with "Anyone" access.
  return output;
}

// ── SHEET HELPERS ─────────────────────────────────────────────────
function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Sheet not found: ' + name);
  return sheet;
}

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0].map(h => String(h).trim());
  const tz = Session.getScriptTimeZone() || 'Asia/Kolkata';
  return data.slice(1)
    .filter(row => row.some(cell => cell !== '' && cell !== null && cell !== undefined))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        let val = row[i];
        if (val instanceof Date) {
          if (h.endsWith('_at') || h === 'timestamp') {
            val = Utilities.formatDate(val, tz, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
          } else {
            val = Utilities.formatDate(val, tz, 'yyyy-MM-dd');
          }
        }
        obj[h] = val !== undefined ? val : '';
      });
      return obj;
    });
}

function appendRow(sheetName, obj, headers) {
  const sheet = getSheet(sheetName);
  const row = headers.map(h => obj[h] !== undefined ? obj[h] : '');
  sheet.appendRow(row);
}

function updateRowById(sheetName, idField, idValue, updates, headers) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  const headerRow = data[0].map(h => String(h).trim());
  const idColIndex = headerRow.indexOf(idField);
  if (idColIndex < 0) throw new Error('ID column not found: ' + idField);

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idColIndex]) === String(idValue)) {
      Object.entries(updates).forEach(([key, value]) => {
        const colIndex = headerRow.indexOf(key);
        if (colIndex >= 0) {
          sheet.getRange(i + 1, colIndex + 1).setValue(value);
        }
      });
      return true;
    }
  }
  return false;
}

function findRowById(sheetName, idField, idValue) {
  const sheet = getSheet(sheetName);
  const objects = sheetToObjects(sheet);
  return objects.find(obj => String(obj[idField]) === String(idValue)) || null;
}

// ── ID GENERATORS ───────────────────────────────────────────────
function generateId(prefix) {
  return prefix + '_' + new Date().getTime() + '_' + Math.random().toString(36).substring(2, 7).toUpperCase();
}

function generateToken() {
  return Utilities.base64Encode(
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      new Date().getTime() + Math.random().toString()
    )
  ).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
}

function generateSessionToken(login_id) {
  return Utilities.base64Encode(
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      login_id + new Date().getTime() + Math.random().toString()
    )
  ).replace(/[^a-zA-Z0-9]/g, '').substring(0, 48);
}

// ── SETUP FUNCTION (run once) ─────────────────────────────────────────
function setupSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setName('TE CONNECT DATABASE');

  // Create or verify each sheet
  Object.entries(HEADERS).forEach(([sheetName, headers]) => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      Logger.log('Created sheet: ' + sheetName);
    }
    // Set headers if sheet is empty
    const firstCell = sheet.getRange('A1').getValue();
    if (!firstCell) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      // Style header row
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground('#C91F2B');
      headerRange.setFontColor('#FFFFFF');
      headerRange.setFontWeight('bold');
      sheet.setFrozenRows(1);
      Logger.log('Set headers for: ' + sheetName);
    }
  });

  // Setup default SETTINGS
  // Also ensure EXPO_TOKENS sheet exists for storing Expo push tokens
  const expoSheet = ss.getSheetByName('EXPO_TOKENS');
  if (!expoSheet) {
    const sheet = ss.insertSheet('EXPO_TOKENS');
    // Headers: Token, User, RegisteredAt
    sheet.getRange(1, 1, 1, 3).setValues([['token', 'user_name', 'registered_at']]);
    sheet.setFrozenRows(1);
    Logger.log('Created sheet: EXPO_TOKENS');
  }
  const settingsSheet = ss.getSheetByName(SHEETS.SETTINGS);
  const settingsData = sheetToObjects(settingsSheet);
  const existingSettings = settingsData.map(s => s.setting);

  const defaultSettings = [
    { setting: 'territory', value: 'Jajpur' },
    { setting: 'team', value: 'Team Jajpur' },
    { setting: 'district', value: 'Jajpur' },
    { setting: 'active_target', value: '80' },
    { setting: 'public_url', value: 'YOUR_APPS_SCRIPT_WEB_APP_URL' },
    { setting: 'app_version', value: '1.0.0' },
    { setting: 'bags_per_mt', value: '20' },
  ];

  defaultSettings.forEach(s => {
    if (!existingSettings.includes(s.setting)) {
      settingsSheet.appendRow([s.setting, s.value]);
    }
  });

  // Add sample user (ADMIN)
  const usersSheet = ss.getSheetByName(SHEETS.USERS);
  const usersData = sheetToObjects(usersSheet);
  if (usersData.length === 0) {
    // Default password for admin: 'Admin@123'
    // SHA-256 hash of 'Admin@123'
    const adminPasswordHash = 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3';
    usersSheet.appendRow([
      'USR_001',
      'admin',
      adminPasswordHash,
      'Administrator',
      'ADMIN',
      'Team Jajpur',
      'Jajpur',
      'Jajpur',
      '',
      true,
      '',
      new Date().toISOString()
    ]);
    Logger.log('Default admin user created. Login: admin / Admin@123');
  }

  try {
    const ui = SpreadsheetApp.getUi();
    if (ui) {
      ui.alert(
        'TE CONNECT Setup Complete! \u2705\n\n' +
        'All sheets created.\n\n' +
        'Default admin user:\nLogin: admin\nPassword: Admin@123\n\n' +
        'Please change the password after first login.\n\n' +
        'Next step: Deploy this script as a Web App.'
      );
    }
  } catch (uiErr) {
    Logger.log('TE CONNECT Setup Complete! All sheets created successfully.');
  }
}

// ── REPAIR AND HEALTH CHECK (Can be run safely anytime) ─────────
function fixAndVerifyAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let fixLog = [];

  // 1. Ensure all sheets exist and have the exact required headers in Row 1
  Object.entries(HEADERS).forEach(([sheetName, requiredHeaders]) => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
      sheet.getRange(1, 1, 1, requiredHeaders.length).setBackground('#C91F2B').setFontColor('#FFFFFF').setFontWeight('bold');
      sheet.setFrozenRows(1);
      fixLog.push('Created sheet: ' + sheetName);
      return;
    }

    // Check Row 1 headers
    const lastCol = Math.max(sheet.getLastColumn(), requiredHeaders.length);
    const existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());

    // If headers are missing or blank in A1, write full required headers
    if (!existingHeaders[0]) {
      sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
      sheet.getRange(1, 1, 1, requiredHeaders.length).setBackground('#C91F2B').setFontColor('#FFFFFF').setFontWeight('bold');
      sheet.setFrozenRows(1);
      fixLog.push('Added missing headers for: ' + sheetName);
    } else {
      // Check if any required header is missing and append it
      let addedCol = false;
      requiredHeaders.forEach(reqH => {
        if (!existingHeaders.includes(reqH)) {
          const nextCol = sheet.getLastColumn() + 1;
          sheet.getRange(1, nextCol).setValue(reqH).setBackground('#C91F2B').setFontColor('#FFFFFF').setFontWeight('bold');
          existingHeaders.push(reqH);
          addedCol = true;
          fixLog.push(sheetName + ': added missing column ' + reqH);
        }
      });
      if (addedCol) sheet.setFrozenRows(1);
    }
  });

  // 2. Fix USERS Tab: ensure all users have active = true and defaults
  try {
    const usersSheet = ss.getSheetByName(SHEETS.USERS);
    if (usersSheet && usersSheet.getLastRow() > 1) {
      const data = usersSheet.getDataRange().getValues();
      const headers = data[0].map(h => String(h).trim());
      const activeCol = headers.indexOf('active');
      const roleCol = headers.indexOf('role');
      const teamCol = headers.indexOf('team');
      const distCol = headers.indexOf('district');
      const nameCol = headers.indexOf('name');
      const loginCol = headers.indexOf('login_id');

      for (let i = 1; i < data.length; i++) {
        const rowNum = i + 1;
        const nameVal = String(data[i][nameCol] || '').trim();
        const loginVal = String(data[i][loginCol] || '').trim();

        if (nameVal || loginVal) {
          if (activeCol >= 0) {
            const actVal = data[i][activeCol];
            if (actVal === '' || actVal === null || actVal === undefined || String(actVal).toLowerCase() === 'false') {
              usersSheet.getRange(rowNum, activeCol + 1).setValue(true);
              fixLog.push('User ' + (nameVal || loginVal) + ': activated (active=true)');
            }
          }
          if (roleCol >= 0 && !data[i][roleCol]) {
            usersSheet.getRange(rowNum, roleCol + 1).setValue('TE');
          }
          if (teamCol >= 0 && !data[i][teamCol]) {
            usersSheet.getRange(rowNum, teamCol + 1).setValue('Team Jajpur');
          }
          if (distCol >= 0 && !data[i][distCol]) {
            usersSheet.getRange(rowNum, distCol + 1).setValue('Jajpur');
          }
        }
      }
    }
  } catch (e) {
    Logger.log('Error repairing users: ' + e.message);
  }

  // 3. Fix DEALERS Tab: ensure active = true and QR token exists
  try {
    const dealersSheet = ss.getSheetByName(SHEETS.DEALERS);
    if (dealersSheet && dealersSheet.getLastRow() > 1) {
      const data = dealersSheet.getDataRange().getValues();
      const headers = data[0].map(h => String(h).trim());
      const activeCol = headers.indexOf('active');
      const tokenCol = headers.indexOf('qr_token');
      const linkCol = headers.indexOf('public_slab_link');
      const idCol = headers.indexOf('dealer_id');
      const nameCol = headers.indexOf('dealer_name');

      const settings = sheetToObjects(ss.getSheetByName(SHEETS.SETTINGS));
      const publicUrl = getSettingValue(settings, 'public_url') || ScriptApp.getService().getUrl() || '';

      for (let i = 1; i < data.length; i++) {
        const rowNum = i + 1;
        const dId = String(data[i][idCol] || '').trim();
        const dName = String(data[i][nameCol] || '').trim();
        if (dId || dName) {
          if (activeCol >= 0 && (data[i][activeCol] === '' || data[i][activeCol] === null)) {
            dealersSheet.getRange(rowNum, activeCol + 1).setValue(true);
          }
          if (tokenCol >= 0 && !data[i][tokenCol]) {
            const token = generateToken();
            dealersSheet.getRange(rowNum, tokenCol + 1).setValue(token);
            if (linkCol >= 0) {
              const link = `${publicUrl}?page=slab&dealer_id=${dId}&token=${token}`;
              dealersSheet.getRange(rowNum, linkCol + 1).setValue(link);
            }
            fixLog.push('Generated QR for dealer: ' + (dName || dId));
          }
        }
      }
    }
  } catch (e) {
    Logger.log('Error repairing dealers: ' + e.message);
  }

  // 4. Fix SETTINGS Tab: ensure essential settings exist
  try {
    const settingsSheet = ss.getSheetByName(SHEETS.SETTINGS);
    const existing = sheetToObjects(settingsSheet).map(s => String(s.setting).trim());
    const defaults = [
      { setting: 'territory', value: 'Jajpur' },
      { setting: 'team', value: 'Team Jajpur' },
      { setting: 'district', value: 'Jajpur' },
      { setting: 'active_target', value: '80' },
      { setting: 'app_version', value: '1.0.0' },
      { setting: 'bags_per_mt', value: '20' },
    ];
    defaults.forEach(d => {
      if (!existing.includes(d.setting)) {
        settingsSheet.appendRow([d.setting, d.value]);
        fixLog.push('Added setting: ' + d.setting);
      }
    });
  } catch (e) {}

  // 5. Alert user with result
  const summaryMsg = fixLog.length > 0 
    ? '✅ Sheet Health Check & Repair Done!\n\nActions Taken:\n• ' + fixLog.slice(0, 8).join('\n• ') + (fixLog.length > 8 ? '\n...and more.' : '')
    : '✅ All Sheets & Headers are 100% Healthy and Correct!\n\nNo errors or missing columns found.';

  try {
    SpreadsheetApp.getUi().alert(summaryMsg);
  } catch (e) {
    Logger.log(summaryMsg);
  }
}

// ── LOG ACTIVITY ────────────────────────────────────────────────
function logActivity(user_id, user_name, action, module, record_id, details) {
  try {
    const sheet = getSheet(SHEETS.ACTIVITY_LOG);
    sheet.appendRow([
      generateId('LOG'),
      user_id || '',
      user_name || '',
      action,
      module,
      record_id || '',
      new Date().toISOString(),
      details || ''
    ]);
  } catch (e) {
    Logger.log('Activity log error: ' + e.message);
  }
}

// ── LOGIN ─────────────────────────────────────────────────────────
function handleLogin(data) {
  const { login_id, password } = data;
  if (!login_id || !password) return error('Login ID and password are required.');

  const sheet = getSheet(SHEETS.USERS);
  const users = sheetToObjects(sheet);
  const cleanLogin = String(login_id).trim().toLowerCase();
  const user = users.find(u => String(u.login_id).trim().toLowerCase() === cleanLogin);

  if (!user) return error('Invalid login ID or password.');
  
  // Check active status - only block if explicitly false
  const activeStr = String(user.active !== undefined ? user.active : '').trim().toLowerCase();
  if (activeStr === 'false') return error('Your account is inactive. Please contact your manager.');

  const userPw = String(user.password_hash || '').trim();
  const inputPw = String(password || '').trim();

  let inputHash = '';
  try {
    const rawBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, inputPw, Utilities.Charset.UTF_8);
    inputHash = rawBytes.map(b => {
      const byte = b < 0 ? b + 256 : b;
      return (byte < 16 ? '0' : '') + byte.toString(16);
    }).join('');
  } catch(e) {}

  const isPlainMatch = userPw.toLowerCase() === inputPw.toLowerCase();
  const isHashMatch = inputHash && userPw.toLowerCase() === inputHash.toLowerCase();

  if (!isPlainMatch && !isHashMatch) {
    return error('Invalid login ID or password.');
  }

  // Never return password_hash to client
  const safeUser = {
    user_id: user.user_id,
    login_id: user.login_id,
    name: user.name,
    role: user.role,
    team: user.team,
    district: user.district,
    territory: user.territory,
    phone: user.phone,
    active: user.active !== false && String(user.active).toLowerCase() !== 'false',
    photo_url: user.photo_url || '',
    created_at: user.created_at,
  };

  const token = generateSessionToken(login_id);
  logActivity(user.user_id, user.name, 'LOGIN', 'AUTH', user.user_id, 'Login from app');

  return success({ user: safeUser, token }, 'Login successful');
}

function handleChangePassword(data) {
  const { user_id, old_password_hash, new_password_hash } = data;
  if (!user_id || !old_password_hash || !new_password_hash) {
    return error('Missing required fields.');
  }

  const sheet = getSheet(SHEETS.USERS);
  const users = sheetToObjects(sheet);
  const user = users.find(u => String(u.user_id) === String(user_id));
  if (!user) return error('User not found.');

  if (String(user.password_hash).toLowerCase() !== String(old_password_hash).toLowerCase()) {
    return error('Current password is incorrect.');
  }

  updateRowById(SHEETS.USERS, 'user_id', user_id, {
    password_hash: new_password_hash,
  }, HEADERS.USERS);

  logActivity(user.user_id, user.name, 'CHANGE_PASSWORD', 'USERS', user.user_id, 'Password changed');
  return success(null, 'Password updated successfully.');
}

// ── GET HANDLERS ────────────────────────────────────────────────────────
function handleGetUsers() {
  const users = sheetToObjects(getSheet(SHEETS.USERS)).map(u => {
    const { password_hash, ...safe } = u;
    return safe;
  });
  return success(users);
}

function normalizeDistrict_(name) {
  if (!name) return '';
  const s = String(name).trim().toLowerCase();
  if (s.includes('bales') || s.includes('balas')) return 'Baleswar';
  if (s.includes('jajp') || s.includes('vyasnagar')) return 'Jajpur';
  if (s.includes('bhadrak')) return 'Bhadrak';
  if (s.includes('cuttack')) return 'Cuttack';
  return String(name).trim();
}

function handleGetDealers(params) {
  const dealers = sheetToObjects(getSheet(SHEETS.DEALERS));
  if (params && params.district && params.district !== 'ALL') {
    const targetDist = normalizeDistrict_(params.district).toLowerCase();
    const users = sheetToObjects(getSheet(SHEETS.USERS));
    const teDistMap = {};
    users.forEach(u => {
      if (u.name) teDistMap[String(u.name).trim().toLowerCase()] = normalizeDistrict_(u.district || u.territory || '');
    });
    const filtered = dealers.filter(d => {
      const explicitDist = normalizeDistrict_(d.district || d.area || d.address || '');
      if (explicitDist && explicitDist.toLowerCase() === targetDist) return true;
      const teName = String(d.assigned_te || '').trim().toLowerCase();
      if (teName && teDistMap[teName] && teDistMap[teName].toLowerCase() === targetDist) return true;
      return false;
    });
    return success(filtered);
  }
  return success(dealers);
}

function handleGetDealer(params) {
  const dealer = findRowById(SHEETS.DEALERS, 'dealer_id', params.dealer_id);
  if (!dealer) return error('Dealer not found.');
  return success(dealer);
}

function handleGetDealerByToken(params) {
  const { dealer_id, token } = params;
  if (!dealer_id) return error('Dealer ID is required.');
  const sheet = getSheet(SHEETS.DEALERS);
  const dealers = sheetToObjects(sheet);
  let dealer = dealers.find(d => String(d.dealer_id).trim().toLowerCase() === String(dealer_id).trim().toLowerCase() && (Boolean(d.qr_token) && String(d.qr_token) === String(token)));
  if (!dealer) {
    dealer = dealers.find(d => String(d.dealer_id).trim().toLowerCase() === String(dealer_id).trim().toLowerCase());
  }
  if (!dealer) return error('Invalid dealer link.');
  // Return complete dealer info for auto-hatch in QR page
  return success({
    dealer_id: dealer.dealer_id,
    dealer_name: dealer.dealer_name,
    owner_name: dealer.owner_name || '',
    phone: dealer.phone || '',
    area: dealer.area || '',
    address: dealer.address || '',
    latitude: dealer.latitude || '',
    longitude: dealer.longitude || '',
  });
}

function handleGetContractors() {
  return success(sheetToObjects(getSheet(SHEETS.CONTRACTORS)));
}

function handleGetSlabs(params) {
  const slabs = sheetToObjects(getSheet(SHEETS.SLABS));
  let filtered = slabs;
  if (params.month) {
    filtered = filtered.filter(s => String(s.slab_date).startsWith(params.month));
  }
  if (params.te) {
    filtered = filtered.filter(s => String(s.assigned_te).toLowerCase() === String(params.te).toLowerCase());
  }
  if (params.dealer_id) {
    filtered = filtered.filter(s => String(s.dealer_id) === String(params.dealer_id));
  }
  if (params.district && params.district !== 'ALL') {
    const targetDist = normalizeDistrict_(params.district).toLowerCase();
    const users = sheetToObjects(getSheet(SHEETS.USERS));
    const teDistMap = {};
    users.forEach(u => {
      if (u.name) teDistMap[String(u.name).trim().toLowerCase()] = normalizeDistrict_(u.district || u.territory || '');
    });
    const dealers = sheetToObjects(getSheet(SHEETS.DEALERS));
    const dealerDistMap = {};
    dealers.forEach(d => {
      const dDist = normalizeDistrict_(d.district || d.area || d.address || '');
      const dTe = String(d.assigned_te || '').trim().toLowerCase();
      dealerDistMap[String(d.dealer_id).trim().toLowerCase()] = dDist || teDistMap[dTe] || '';
      dealerDistMap[String(d.dealer_name).trim().toLowerCase()] = dDist || teDistMap[dTe] || '';
    });
    filtered = filtered.filter(s => {
      const teName = String(s.assigned_te || '').trim().toLowerCase();
      if (teName && teDistMap[teName] && teDistMap[teName].toLowerCase() === targetDist) return true;
      const dId = String(s.dealer_id || '').trim().toLowerCase();
      const dName = String(s.dealer_name || '').trim().toLowerCase();
      if ((dId && dealerDistMap[dId] && dealerDistMap[dId].toLowerCase() === targetDist) ||
          (dName && dealerDistMap[dName] && dealerDistMap[dName].toLowerCase() === targetDist)) return true;
      return false;
    });
  }
  return success(filtered);
}

function handleGetSales(params) {
  const sales = sheetToObjects(getSheet(SHEETS.SALES));
  let filtered = sales;
  if (params.month) {
    filtered = filtered.filter(s => String(s.sale_date).startsWith(params.month));
  }
  if (params.te) {
    filtered = filtered.filter(s => String(s.assigned_te).toLowerCase() === String(params.te).toLowerCase());
  }
  if (params.dealer_id) {
    filtered = filtered.filter(s => String(s.dealer_id) === String(params.dealer_id));
  }
  if (params.district && params.district !== 'ALL') {
    const targetDist = normalizeDistrict_(params.district).toLowerCase();
    const users = sheetToObjects(getSheet(SHEETS.USERS));
    const teDistMap = {};
    users.forEach(u => {
      if (u.name) teDistMap[String(u.name).trim().toLowerCase()] = normalizeDistrict_(u.district || u.territory || '');
    });
    const dealers = sheetToObjects(getSheet(SHEETS.DEALERS));
    const dealerDistMap = {};
    dealers.forEach(d => {
      const dDist = normalizeDistrict_(d.district || d.area || d.address || '');
      const dTe = String(d.assigned_te || '').trim().toLowerCase();
      dealerDistMap[String(d.dealer_id).trim().toLowerCase()] = dDist || teDistMap[dTe] || '';
      dealerDistMap[String(d.dealer_name).trim().toLowerCase()] = dDist || teDistMap[dTe] || '';
    });
    filtered = filtered.filter(s => {
      const teName = String(s.assigned_te || '').trim().toLowerCase();
      if (teName && teDistMap[teName] && teDistMap[teName].toLowerCase() === targetDist) return true;
      const dId = String(s.dealer_id || '').trim().toLowerCase();
      const dName = String(s.dealer_name || '').trim().toLowerCase();
      if ((dId && dealerDistMap[dId] && dealerDistMap[dId].toLowerCase() === targetDist) ||
          (dName && dealerDistMap[dName] && dealerDistMap[dName].toLowerCase() === targetDist)) return true;
      return false;
    });
  }
  return success(filtered);
}

function handleGetDealerSalesSummary(params) {
  const month = params.month;
  const sales = sheetToObjects(getSheet(SHEETS.SALES));
  const dealers = sheetToObjects(getSheet(SHEETS.DEALERS));
  const monthSales = month ? sales.filter(s => String(s.sale_date).startsWith(month)) : sales;

  const dealerMap = {};
  dealers.forEach(d => {
    dealerMap[d.dealer_id] = {
      dealer_id: d.dealer_id,
      dealer_name: d.dealer_name,
      sap_code: d.sap_code || '',
      area: d.area,
      assigned_te: d.assigned_te,
      active: d.active,
      total_bags: 0,
      total_mt: 0,
      f2r_bags: 0,
      gold_bags: 0,
    };
  });

  monthSales.forEach(sale => {
    const did = sale.dealer_id;
    if (!dealerMap[did]) {
      dealerMap[did] = {
        dealer_id: did,
        dealer_name: sale.dealer_name,
        sap_code: '',
        area: '',
        assigned_te: sale.assigned_te,
        active: true,
        total_bags: 0,
        total_mt: 0,
        f2r_bags: 0,
        gold_bags: 0,
      };
    }
    const bags = Number(sale.quantity_bags) || 0;
    dealerMap[did].total_bags += bags;
    dealerMap[did].total_mt = dealerMap[did].total_bags / 20;
    if (String(sale.product).includes('F2R')) dealerMap[did].f2r_bags += bags;
    if (String(sale.product).includes('GOLD')) dealerMap[did].gold_bags += bags;
  });

  const result = Object.values(dealerMap).sort((a, b) => b.total_bags - a.total_bags);
  return success(result);
}

function handleGetActiveTracker(params) {
  const trackers = sheetToObjects(getSheet(SHEETS.ACTIVE_TRACKER));
  let filtered = trackers;
  if (params.month) {
    filtered = filtered.filter(t => String(t.month).startsWith(params.month));
  }
  if (params.te) {
    filtered = filtered.filter(t => String(t.te).toLowerCase() === String(params.te).toLowerCase());
  }
  if (params.district && params.district !== 'ALL') {
    const targetDist = normalizeDistrict_(params.district).toLowerCase();
    const users = sheetToObjects(getSheet(SHEETS.USERS));
    const teDistMap = {};
    users.forEach(u => {
      if (u.name) teDistMap[String(u.name).trim().toLowerCase()] = normalizeDistrict_(u.district || u.territory || '');
    });
    filtered = filtered.filter(t => {
      const teName = String(t.te || '').trim().toLowerCase();
      if (teName && teDistMap[teName] && teDistMap[teName].toLowerCase() === targetDist) return true;
      return false;
    });
  }
  return success(filtered);
}

function handleGetTEActiveSummary(params) {
  const month = params.month || getCurrentMonth();
  const sales = sheetToObjects(getSheet(SHEETS.SALES));
  const trackers = sheetToObjects(getSheet(SHEETS.ACTIVE_TRACKER));
  const targets = sheetToObjects(getSheet(SHEETS.TARGETS));
  const users = sheetToObjects(getSheet(SHEETS.USERS));
  const settings = sheetToObjects(getSheet(SHEETS.SETTINGS));

  const defaultActiveTarget = Number(getSettingValue(settings, 'active_target')) || 80;
  const teUsers = users.filter(u => u.role === 'TE' && (u.active === true || String(u.active).toLowerCase() === 'true'));
  const monthSales = sales.filter(s => String(s.sale_date).startsWith(month));

  const result = teUsers.map(te => {
    const teName = te.name;
    const teSales = monthSales.filter(s => String(s.assigned_te).toLowerCase() === teName.toLowerCase());
    const totalSalesBags = teSales.reduce((sum, s) => sum + (Number(s.quantity_bags) || 0), 0);

    const target = targets.find(t => String(t.month) === month && String(t.te).toLowerCase() === teName.toLowerCase());
    const activeTarget = target ? Number(target.active_target) : defaultActiveTarget;

    const tracker = trackers.find(t => String(t.month).startsWith(month) && String(t.te).toLowerCase() === teName.toLowerCase());
    const actualPunch = tracker ? Number(tracker.punched_quantity_bags) || 0 : 0;
    const totalContractors = tracker ? Number(tracker.total_contractors) || 0 : 0;
    const activeContractors = tracker ? Number(tracker.active_contractors) || 0 : 0;
    const inactiveContractors = Math.max(0, totalContractors - activeContractors);

    const requiredPunch = Math.ceil((totalSalesBags * activeTarget) / 100);
    const activePercent = totalSalesBags > 0 ? (actualPunch / totalSalesBags) * 100 : 0;
    const gap = Math.max(0, requiredPunch - actualPunch);

    return {
      te: teName,
      total_sales_bags: totalSalesBags,
      required_punch_bags: requiredPunch,
      actual_punch_bags: actualPunch,
      active_percent: Math.round(activePercent * 100) / 100,
      gap_bags: gap,
      total_contractors: totalContractors,
      active_contractors: activeContractors,
      inactive_contractors: inactiveContractors,
    };
  });

  return success(result);
}

function handleGetMeetings(params) {
  const meetings = sheetToObjects(getSheet(SHEETS.MEETINGS));
  let filtered = meetings;
  if (params.month) {
    filtered = filtered.filter(m => String(m.meeting_date).startsWith(params.month));
  }
  if (params.te) {
    filtered = filtered.filter(m => String(m.te).toLowerCase() === String(params.te).toLowerCase());
  }
  if (params.date) {
    filtered = filtered.filter(m => String(m.meeting_date).startsWith(params.date));
  }
  if (params.district && params.district !== 'ALL') {
    const targetDist = normalizeDistrict_(params.district).toLowerCase();
    const users = sheetToObjects(getSheet(SHEETS.USERS));
    const teDistMap = {};
    users.forEach(u => {
      if (u.name) teDistMap[String(u.name).trim().toLowerCase()] = normalizeDistrict_(u.district || u.territory || '');
    });
    filtered = filtered.filter(m => {
      const explicitDist = normalizeDistrict_(m.district || m.location || '');
      if (explicitDist && explicitDist.toLowerCase() === targetDist) return true;
      const teName = String(m.te || '').trim().toLowerCase();
      if (teName && teDistMap[teName] && teDistMap[teName].toLowerCase() === targetDist) return true;
      return false;
    });
  }
  return success(filtered);
}

function handleGetMeetingTargetSummary(params) {
  const month = params.month || getCurrentMonth();
  const meetings = sheetToObjects(getSheet(SHEETS.MEETINGS));
  const targets = sheetToObjects(getSheet(SHEETS.TARGETS));
  const users = sheetToObjects(getSheet(SHEETS.USERS));

  const teUsers = users.filter(u => u.role === 'TE' && (u.active === true || String(u.active).toLowerCase() === 'true'));
  const monthMeetings = meetings.filter(m => String(m.meeting_date).startsWith(month));

  const result = teUsers.map(te => {
    const teName = te.name;
    const teMeetings = monthMeetings.filter(m => String(m.te).toLowerCase() === teName.toLowerCase());
    const target = targets.find(t => String(t.month) === month && String(t.te).toLowerCase() === teName.toLowerCase());

    const customerTarget = target ? Number(target.customer_meeting_target) || 0 : 0;
    const contractorTarget = target ? Number(target.contractor_meeting_target) || 0 : 0;

    const customerCompleted = teMeetings.filter(m => m.meeting_type === 'CUSTOMER' && m.status === 'COMPLETED').length;
    const contractorCompleted = teMeetings.filter(m => m.meeting_type === 'CONTRACTOR' && m.status === 'COMPLETED').length;
    const totalPlanned = teMeetings.length;
    const totalCompleted = teMeetings.filter(m => m.status === 'COMPLETED').length;

    return {
      te: teName,
      month,
      customer_target: customerTarget,
      customer_completed: customerCompleted,
      contractor_target: contractorTarget,
      contractor_completed: contractorCompleted,
      total_planned: totalPlanned,
      total_completed: totalCompleted,
    };
  });

  return success(result);
}

function handleGetTargets(params) {
  const targets = sheetToObjects(getSheet(SHEETS.TARGETS));
  let filtered = targets;
  if (params.month) {
    filtered = filtered.filter(t => String(t.month) === params.month);
  }
  if (params.te) {
    filtered = filtered.filter(t => String(t.te).toLowerCase() === String(params.te).toLowerCase());
  }
  return success(filtered);
}

function handleGetSettings() {
  return success(sheetToObjects(getSheet(SHEETS.SETTINGS)));
}

function handleGetTodaySummary(params) {
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const month = today.substring(0, 7);

  const slabs = sheetToObjects(getSheet(SHEETS.SLABS));
  const sales = sheetToObjects(getSheet(SHEETS.SALES));
  const meetings = sheetToObjects(getSheet(SHEETS.MEETINGS));
  const trackers = sheetToObjects(getSheet(SHEETS.ACTIVE_TRACKER));
  const settings = sheetToObjects(getSheet(SHEETS.SETTINGS));
  const users = sheetToObjects(getSheet(SHEETS.USERS));
  const dealers = sheetToObjects(getSheet(SHEETS.DEALERS));

  const teDistMap = {};
  users.forEach(u => {
    if (u.name) teDistMap[String(u.name).trim().toLowerCase()] = normalizeDistrict_(u.district || u.territory || '');
  });
  const dealerDistMap = {};
  dealers.forEach(d => {
    const dDist = normalizeDistrict_(d.district || d.area || d.address || '');
    const dTe = String(d.assigned_te || '').trim().toLowerCase();
    dealerDistMap[String(d.dealer_id).trim().toLowerCase()] = dDist || teDistMap[dTe] || '';
    dealerDistMap[String(d.dealer_name).trim().toLowerCase()] = dDist || teDistMap[dTe] || '';
  });

  const teFilter = params.te ? String(params.te).toLowerCase() : null;
  const distFilter = (params.district && params.district !== 'ALL') ? normalizeDistrict_(params.district).toLowerCase() : null;

  const todaySlabs = slabs.filter(s => {
    const dateMatch = String(s.slab_date).startsWith(today);
    if (!dateMatch) return false;
    if (teFilter && String(s.assigned_te).toLowerCase() !== teFilter) return false;
    if (distFilter) {
      const teName = String(s.assigned_te || '').trim().toLowerCase();
      const dId = String(s.dealer_id || '').trim().toLowerCase();
      const dName = String(s.dealer_name || '').trim().toLowerCase();
      const matchTe = teName && teDistMap[teName] && teDistMap[teName].toLowerCase() === distFilter;
      const matchDealer = (dId && dealerDistMap[dId] && dealerDistMap[dId].toLowerCase() === distFilter) ||
                          (dName && dealerDistMap[dName] && dealerDistMap[dName].toLowerCase() === distFilter);
      if (!matchTe && !matchDealer) return false;
    }
    return true;
  });

  const todaySales = sales.filter(s => {
    const dateMatch = String(s.sale_date).startsWith(today);
    if (!dateMatch) return false;
    if (teFilter && String(s.assigned_te).toLowerCase() !== teFilter) return false;
    if (distFilter) {
      const teName = String(s.assigned_te || '').trim().toLowerCase();
      const dId = String(s.dealer_id || '').trim().toLowerCase();
      const dName = String(s.dealer_name || '').trim().toLowerCase();
      const matchTe = teName && teDistMap[teName] && teDistMap[teName].toLowerCase() === distFilter;
      const matchDealer = (dId && dealerDistMap[dId] && dealerDistMap[dId].toLowerCase() === distFilter) ||
                          (dName && dealerDistMap[dName] && dealerDistMap[dName].toLowerCase() === distFilter);
      if (!matchTe && !matchDealer) return false;
    }
    return true;
  });

  const todayMeetings = meetings.filter(m => {
    const dateMatch = String(m.meeting_date).startsWith(today);
    if (!dateMatch) return false;
    if (teFilter && String(m.te).toLowerCase() !== teFilter) return false;
    if (distFilter) {
      const teName = String(m.te || '').trim().toLowerCase();
      const explicitDist = normalizeDistrict_(m.district || m.location || '');
      const matchTe = teName && teDistMap[teName] && teDistMap[teName].toLowerCase() === distFilter;
      const matchExplicit = explicitDist && explicitDist.toLowerCase() === distFilter;
      if (!matchTe && !matchExplicit) return false;
    }
    return true;
  });

  const salesBagsToday = todaySales.reduce((sum, s) => sum + (Number(s.quantity_bags) || 0), 0);

  // Active % from current month tracker
  const monthTrackers = trackers.filter(t => {
    const monthMatch = String(t.month).startsWith(month);
    if (!monthMatch) return false;
    if (teFilter && String(t.te).toLowerCase() !== teFilter) return false;
    if (distFilter) {
      const teName = String(t.te || '').trim().toLowerCase();
      if (!teName || !teDistMap[teName] || teDistMap[teName].toLowerCase() !== distFilter) return false;
    }
    return true;
  });
  const totalPunch = monthTrackers.reduce((sum, t) => sum + (Number(t.punched_quantity_bags) || 0), 0);

  const monthSales = sales.filter(s => {
    const monthMatch = String(s.sale_date).startsWith(month);
    if (!monthMatch) return false;
    if (teFilter && String(s.assigned_te).toLowerCase() !== teFilter) return false;
    if (distFilter) {
      const teName = String(s.assigned_te || '').trim().toLowerCase();
      const dId = String(s.dealer_id || '').trim().toLowerCase();
      const dName = String(s.dealer_name || '').trim().toLowerCase();
      const matchTe = teName && teDistMap[teName] && teDistMap[teName].toLowerCase() === distFilter;
      const matchDealer = (dId && dealerDistMap[dId] && dealerDistMap[dId].toLowerCase() === distFilter) ||
                          (dName && dealerDistMap[dName] && dealerDistMap[dName].toLowerCase() === distFilter);
      if (!matchTe && !matchDealer) return false;
    }
    return true;
  });
  const totalSalesBags = monthSales.reduce((sum, s) => sum + (Number(s.quantity_bags) || 0), 0);
  const activePercent = totalSalesBags > 0 ? Math.round((totalPunch / totalSalesBags) * 10000) / 100 : 0;

  return success({
    slabs_today: todaySlabs.length,
    sales_bags_today: salesBagsToday,
    meetings_today: todayMeetings.length,
    active_percent: activePercent,
  });
}

// ── POST HANDLERS ────────────────────────────────────────────────────────
function handleCreateSlab(data) {
  if (!data.slab_date || !data.dealer_id) return error('Slab date and dealer are required.');

  const slab_id = generateId('SLB');
  const now = new Date().toISOString();
  const slabObj = {
    slab_id,
    slab_date: data.slab_date,
    dealer_id: data.dealer_id,
    dealer_name: data.dealer_name || '',
    contractor_name: data.contractor_name || '',
    customer_name: data.customer_name || '',
    expected_cement: data.expected_cement || '',
    latitude: data.latitude || '',
    longitude: data.longitude || '',
    assigned_te: data.assigned_te || '',
    status: data.status || 'UPCOMING',
    remark: data.remark || '',
    source: data.source || 'APP',
    created_by: data.created_by || '',
    created_at: now,
    updated_at: now,
  };
  appendRow(SHEETS.SLABS, slabObj, HEADERS.SLABS);
  logActivity(data.created_by, data.created_by, 'CREATE_SLAB', 'SLABS', slab_id, 'Created slab for ' + data.dealer_name);
  sendPushNotificationToSubscribers('New Slab Added', 'Slab scheduled for ' + (data.dealer_name || 'Dealer'));
  return success(slabObj, 'Slab added successfully.');
}

function handleUpdateSlab(data) {
  if (!data.slab_id) return error('Slab ID is required.');
  const updates = { ...data, updated_at: new Date().toISOString() };
  delete updates.slab_id;
  const updated = updateRowById(SHEETS.SLABS, 'slab_id', data.slab_id, updates, HEADERS.SLABS);
  if (!updated) return error('Slab not found.');
  logActivity(data.updated_by, data.updated_by, 'UPDATE_SLAB', 'SLABS', data.slab_id, 'Updated slab');
  return success(null, 'Slab updated successfully.');
}

function handleCreateSale(data) {
  if (!data.sale_date || !data.dealer_id || !data.product || !data.quantity_bags) return error('Date, dealer, product, and quantity are required.');

  const sale_id = generateId('SAL');
  const now = new Date().toISOString();
  const saleObj = {
    sale_id,
    sale_date: data.sale_date,
    dealer_id: data.dealer_id,
    dealer_name: data.dealer_name || '',
    product: data.product,
    quantity_bags: Number(data.quantity_bags),
    assigned_te: data.assigned_te || '',
    source: data.source || 'APP',
    created_by: data.created_by || '',
    created_at: now,
    updated_at: now,
  };
  appendRow(SHEETS.SALES, saleObj, HEADERS.SALES);
  logActivity(data.created_by, data.created_by, 'CREATE_SALE', 'SALES', sale_id, 'Added ' + data.quantity_bags + ' bags for ' + data.dealer_name);
  return success(saleObj, 'Sale added successfully.');
}

function handleCreateBatchSales(data) {
  const salesList = data.sales || [];
  if (!salesList || !salesList.length) return error('No sales data provided.');

  const now = new Date().toISOString();
  const createdBy = data.created_by || 'OCR_SCAN';

  // 1. Fetch dealers and index by SAP code and dealer_name
  const dealersSheet = getSheet(SHEETS.DEALERS);
  const dealers = sheetToObjects(dealersSheet);
  const dealerMapBySap = {};
  const dealerMapByName = {};

  dealers.forEach(d => {
    if (d.sap_code) dealerMapBySap[String(d.sap_code).trim()] = d;
    if (d.dealer_name) dealerMapByName[String(d.dealer_name).toLowerCase().trim()] = d;
  });

  // Ensure sap_code header exists in DEALERS sheet
  const dealerLastCol = Math.max(1, dealersSheet.getLastColumn());
  const dealerHeaders = dealersSheet.getRange(1, 1, 1, dealerLastCol).getValues()[0].map(h => String(h).trim());
  if (!dealerHeaders.includes('sap_code')) {
    dealersSheet.getRange(1, dealerHeaders.length + 1).setValue('sap_code');
    dealerHeaders.push('sap_code');
  }

  let newDealersCount = 0;
  const newDealerRowsToAppend = [];
  const salesSheet = getSheet(SHEETS.SALES);
  const salesLastCol = Math.max(1, salesSheet.getLastColumn());
  const salesHeaders = salesSheet.getRange(1, 1, 1, salesLastCol).getValues()[0].map(h => String(h).trim());
  const salesRowsToAppend = [];

  salesList.forEach(item => {
    const qty = Number(item.quantity_bags) || 0;
    if (qty <= 0) return; // skip zero quantity items

    const sapCode = item.sap_code ? String(item.sap_code).trim() : '';
    const dealerName = item.dealer_name ? String(item.dealer_name).trim() : (sapCode ? 'Dealer ' + sapCode : 'Counter Sale');

    let dealerId = item.dealer_id || '';
    let assignedTe = item.assigned_te || '';

    // Check if dealer exists
    let existingDealer = (sapCode && dealerMapBySap[sapCode]) || (dealerName && dealerMapByName[dealerName.toLowerCase()]);
    if (existingDealer) {
      dealerId = existingDealer.dealer_id;
      if (!assignedTe && existingDealer.assigned_te) assignedTe = existingDealer.assigned_te;
    } else {
      // Auto-create missing dealer so it's registered with SAP code
      dealerId = generateId('DLR');
      const token = generateToken();
      const newDealerObj = {
        dealer_id: dealerId,
        dealer_name: dealerName,
        owner_name: '',
        phone: '',
        address: '',
        area: 'Jajpur Territory',
        sap_code: sapCode,
        latitude: '',
        longitude: '',
        assigned_te: assignedTe || '',
        active: true,
        qr_id: generateId('QR'),
        qr_token: token,
        public_slab_link: '',
        created_at: now,
      };

      const dlrRow = dealerHeaders.map(h => newDealerObj[h] !== undefined ? newDealerObj[h] : '');
      newDealerRowsToAppend.push(dlrRow);

      dealerMapBySap[sapCode] = newDealerObj;
      dealerMapByName[dealerName.toLowerCase()] = newDealerObj;
      newDealersCount++;
    }

    const sale_id = generateId('SAL');
    const saleDate = item.sale_date || now.substring(0, 10);
    const product = item.product || 'ACC F2R';

    const saleObj = {
      sale_id: sale_id,
      sale_date: saleDate,
      dealer_id: dealerId,
      dealer_name: dealerName,
      product: product,
      quantity_bags: qty,
      assigned_te: assignedTe || '',
      source: 'OCR_SCAN',
      created_by: createdBy,
      created_at: now,
      updated_at: now,
    };

    const row = salesHeaders.map(h => saleObj[h] !== undefined ? saleObj[h] : '');
    salesRowsToAppend.push(row);
  });

  // Batch append new dealers in 1 operation
  if (newDealerRowsToAppend.length > 0) {
    const lastDlrRow = dealersSheet.getLastRow();
    const neededRows = (lastDlrRow + newDealerRowsToAppend.length) - dealersSheet.getMaxRows();
    if (neededRows > 0) {
      dealersSheet.insertRowsAfter(dealersSheet.getMaxRows(), neededRows + 20);
    }
    dealersSheet.getRange(lastDlrRow + 1, 1, newDealerRowsToAppend.length, dealerHeaders.length).setValues(newDealerRowsToAppend);
  }

  // Batch append sales in 1 operation
  if (salesRowsToAppend.length > 0) {
    const lastRow = salesSheet.getLastRow();
    const neededRows = (lastRow + salesRowsToAppend.length) - salesSheet.getMaxRows();
    if (neededRows > 0) {
      salesSheet.insertRowsAfter(salesSheet.getMaxRows(), neededRows + 50);
    }
    salesSheet.getRange(lastRow + 1, 1, salesRowsToAppend.length, salesHeaders.length).setValues(salesRowsToAppend);
  }

  logActivity(createdBy, createdBy, 'CREATE_BATCH_SALES', 'SALES', generateId('BATCH'), 'Batch added ' + salesRowsToAppend.length + ' sales via OCR scan');

  return success({
    count: salesRowsToAppend.length,
    dealersAdded: newDealersCount
  }, salesRowsToAppend.length + ' sales recorded successfully from image scan.');
}

function handleAddPunch(data) {
  const f2rBags = Number(data.f2r_bags) || 0;
  const goldBags = Number(data.gold_bags) || 0;
  const punchQty = (Number(data.punch_quantity_bags) || 0) || (f2rBags + goldBags);

  if (!data.date || !data.te || (!punchQty && data.total_contractors === undefined && data.active_contractors === undefined)) {
    return error('Date, TE, and punch quantity or contractor counts are required.');
  }

  const month = String(data.date).substring(0, 7);
  const sheet = getSheet(SHEETS.ACTIVE_TRACKER);
  const trackers = sheetToObjects(sheet);

  // Find existing tracker for this TE+month
  const existingIdx = trackers.findIndex(t =>
    String(t.month).startsWith(month) &&
    String(t.te).toLowerCase() === String(data.te).toLowerCase()
  );

  const now = new Date().toISOString();

  if (existingIdx >= 0) {
    const existing = trackers[existingIdx];
    const newPunch = (Number(existing.punched_quantity_bags) || 0) + punchQty;
    const newF2r = (Number(existing.f2r_punch_bags) || 0) + f2rBags;
    const newGold = (Number(existing.gold_punch_bags) || 0) + goldBags;

    const totalC = (data.total_contractors !== undefined && data.total_contractors !== '')
      ? Number(data.total_contractors)
      : (Number(existing.total_contractors) || 0);

    const activeC = (data.active_contractors !== undefined && data.active_contractors !== '')
      ? Number(data.active_contractors)
      : (Number(existing.active_contractors) || 0);

    const inactiveC = Math.max(0, totalC - activeC);

    const updates = {
      punched_quantity_bags: newPunch,
      f2r_punch_bags: newF2r,
      gold_punch_bags: newGold,
      total_contractors: totalC,
      active_contractors: activeC,
      inactive_contractors: inactiveC,
      updated_by: data.updated_by || data.te,
      updated_at: now,
    };
    updateRowById(SHEETS.ACTIVE_TRACKER, 'tracker_id', existing.tracker_id, updates, HEADERS.ACTIVE_TRACKER);
    logActivity(data.updated_by, data.updated_by, 'ADD_PUNCH', 'ACTIVE_TRACKER', existing.tracker_id, 'Added ' + punchQty + ' bags punch for ' + data.te);
    return success({ ...existing, ...updates }, 'Punch recorded.');
  } else {
    const tracker_id = generateId('TRK');
    const totalC = Number(data.total_contractors) || 0;
    const activeC = Number(data.active_contractors) || 0;
    const trackerObj = {
      tracker_id,
      date: data.date,
      month,
      te: data.te,
      total_contractors: totalC,
      active_contractors: activeC,
      inactive_contractors: Math.max(0, totalC - activeC),
      punched_quantity_bags: punchQty,
      f2r_punch_bags: f2rBags,
      gold_punch_bags: goldBags,
      updated_by: data.updated_by || data.te,
      updated_at: now,
    };
    appendRow(SHEETS.ACTIVE_TRACKER, trackerObj, HEADERS.ACTIVE_TRACKER);
    logActivity(data.updated_by, data.updated_by, 'ADD_PUNCH', 'ACTIVE_TRACKER', tracker_id, 'Added ' + punchQty + ' bags punch for ' + data.te);
    return success(trackerObj, 'Punch recorded.');
  }
}

function handleUpdateContractorActivity(data) {
  if (!data.te) return error('TE is required.');

  const month = getCurrentMonth();
  const sheet = getSheet(SHEETS.ACTIVE_TRACKER);
  const trackers = sheetToObjects(sheet);

  const existingIdx = trackers.findIndex(t =>
    String(t.month).startsWith(month) &&
    String(t.te).toLowerCase() === String(data.te).toLowerCase()
  );

  const now = new Date().toISOString();
  const totalC = Number(data.total_contractors) || 0;
  const activeC = Number(data.active_contractors) || 0;
  const inactiveC = Math.max(0, totalC - activeC);

  if (existingIdx >= 0) {
    const existing = trackers[existingIdx];
    updateRowById(SHEETS.ACTIVE_TRACKER, 'tracker_id', existing.tracker_id, {
      total_contractors: totalC,
      active_contractors: activeC,
      inactive_contractors: inactiveC,
      updated_by: data.updated_by,
      updated_at: now,
    }, HEADERS.ACTIVE_TRACKER);
  } else {
    const tracker_id = generateId('TRK');
    appendRow(SHEETS.ACTIVE_TRACKER, {
      tracker_id,
      date: now.substring(0, 10),
      month,
      te: data.te,
      total_contractors: totalC,
      active_contractors: activeC,
      inactive_contractors: inactiveC,
      punched_quantity_bags: 0,
      updated_by: data.updated_by,
      updated_at: now,
    }, HEADERS.ACTIVE_TRACKER);
  }
  return success(null, 'Contractor activity updated.');
}

function handleCreateMeeting(data) {
  if (!data.meeting_date || !data.meeting_type) return error('Meeting date and type are required.');

  const meeting_id = generateId('MTG');
  const now = new Date().toISOString();
  const meetingObj = {
    meeting_id,
    meeting_date: data.meeting_date,
    te: data.te || '',
    meeting_type: data.meeting_type,
    meeting_name: data.meeting_name || '',
    location: data.location || '',
    purpose: data.purpose || '',
    people_count: data.people_count || '',
    status: data.status || 'PLANNED',
    outcome: data.outcome || '',
    next_followup: data.next_followup || '',
    expense_amount: data.expense_amount || '',
    source: data.source || 'APP',
    created_by: data.created_by || '',
    created_at: now,
    updated_at: now,
  };
  appendRow(SHEETS.MEETINGS, meetingObj, HEADERS.MEETINGS);
  logActivity(data.created_by, data.created_by, 'CREATE_MEETING', 'MEETINGS', meeting_id, 'Created meeting: ' + data.meeting_name);
  sendPushNotificationToSubscribers('New Meeting Scheduled', (data.meeting_name || data.meeting_type) + ' by ' + (data.te || data.created_by || 'TE'), { meeting_id: meeting_id });
  return success(meetingObj, 'Meeting added successfully.');
}

function handleUpdateMeeting(data) {
  if (!data.meeting_id) return error('Meeting ID is required.');
  const updates = { ...data, updated_at: new Date().toISOString() };
  delete updates.meeting_id;
  const updated = updateRowById(SHEETS.MEETINGS, 'meeting_id', data.meeting_id, updates, HEADERS.MEETINGS);
  if (!updated) return error('Meeting not found.');
  logActivity(data.updated_by, data.updated_by, 'UPDATE_MEETING', 'MEETINGS', data.meeting_id, 'Updated meeting');
  return success(null, 'Meeting updated successfully.');
}

function handleAddContractor(data) {
  if (!data.contractor_name) return error('Contractor name is required.');

  const contractor_id = generateId('CTR');
  const now = new Date().toISOString();
  const contractorObj = {
    contractor_id,
    contractor_name: data.contractor_name,
    mobile: data.mobile || '',
    area: data.area || '',
    assigned_te: data.assigned_te || '',
    active: true,
    created_at: now,
  };
  appendRow(SHEETS.CONTRACTORS, contractorObj, HEADERS.CONTRACTORS);
  return success(contractorObj, 'Contractor added.');
}

function handleAddDealer(data) {
  if (!data.dealer_name) return error('Dealer name is required.');

  const dealer_id = data.dealer_id || generateId('DLR');
  const now = new Date().toISOString();
  const token = generateToken();
  const settings = sheetToObjects(getSheet(SHEETS.SETTINGS));
  const publicUrl = getSettingValue(settings, 'public_url') || '';
  const publicSlabLink = publicUrl
    ? publicUrl + '?page=slab&dealer_id=' + dealer_id + '&token=' + token
    : 'PENDING_URL?page=slab&dealer_id=' + dealer_id + '&token=' + token;

  const dealerObj = {
    dealer_id,
    dealer_name: data.dealer_name,
    owner_name: data.owner_name || '',
    phone: data.phone || '',
    address: data.address || '',
    area: data.area || '',
    sap_code: data.sap_code || '',
    latitude: data.latitude || '',
    longitude: data.longitude || '',
    assigned_te: data.assigned_te || '',
    active: true,
    qr_id: generateId('QR'),
    qr_token: token,
    public_slab_link: publicSlabLink,
    created_at: now,
  };
  appendRow(SHEETS.DEALERS, dealerObj, HEADERS.DEALERS);
  logActivity(data.created_by, data.created_by, 'ADD_DEALER', 'DEALERS', dealer_id, 'Added dealer ' + data.dealer_name);
  return success(dealerObj, 'Dealer added successfully.');
}

function handlePublicSlabSubmit(data) {
  // Validate dealer
  if (!data.dealer_id) return error('Dealer ID is required.');

  const dealers = sheetToObjects(getSheet(SHEETS.DEALERS));
  const dealer = dealers.find(d => String(d.dealer_id).trim().toLowerCase() === String(data.dealer_id).trim().toLowerCase());
  if (!dealer) return error('Dealer counter not found.');
  if (!data.slab_date) return error('Slab date is required.');

  const slab_id = generateId('SLB');
  const now = new Date().toISOString();

  const mobileStr = data.mobile ? String(data.mobile).trim() : '';
  let contractorName = data.contractor_name ? String(data.contractor_name).trim() : '';
  if (!contractorName && mobileStr) {
    contractorName = 'Contact (' + mobileStr + ')';
  } else if (contractorName && mobileStr && !contractorName.includes(mobileStr)) {
    contractorName += ' (' + mobileStr + ')';
  }

  let finalRemark = data.remark || '';
  if (mobileStr && !finalRemark.includes(mobileStr)) {
    finalRemark = 'Contact Phone: ' + mobileStr + (finalRemark ? ' | ' + finalRemark : '');
  }

  const slabObj = {
    slab_id,
    slab_date: data.slab_date,
    dealer_id: dealer.dealer_id,
    dealer_name: dealer.dealer_name,
    contractor_name: contractorName,
    customer_name: data.customer_name || '',
    expected_cement: data.expected_cement || '',
    latitude: data.latitude || dealer.latitude || '',
    longitude: data.longitude || dealer.longitude || '',
    assigned_te: dealer.assigned_te || '',
    status: 'UPCOMING',
    remark: finalRemark,
    source: 'DEALER_QR',
    created_by: 'DEALER_QR:' + dealer.dealer_name + (mobileStr ? ' [' + mobileStr + ']' : ''),
    created_at: now,
    updated_at: now,
  };
  appendRow(SHEETS.SLABS, slabObj, HEADERS.SLABS);
  logActivity('', dealer.dealer_name, 'PUBLIC_SLAB_SUBMIT', 'SLABS', slab_id, 'Dealer QR submission - ' + (data.expected_cement || 'Slab') + ' for ' + (contractorName || mobileStr));
  sendPushNotificationToSubscribers('New Slab from QR', (dealer.dealer_name || 'Dealer') + ' added a new slab request');
  return success(slabObj, 'Slab submitted successfully! Your team will be notified.');
}

function handlePublicMeetingSubmit(data) {
  if (!data.meeting_date || !data.meeting_type) return error('Meeting date and type are required.');

  const meeting_id = generateId('MTG');
  const now = new Date().toISOString();
  const meetingObj = {
    meeting_id,
    meeting_date: data.meeting_date,
    te: '',
    meeting_type: data.meeting_type,
    meeting_name: data.meeting_name || '',
    location: data.location || '',
    purpose: data.purpose || '',
    people_count: data.people_count || '',
    status: 'PLANNED',
    outcome: '',
    next_followup: '',
    expense_amount: '',
    source: 'PUBLIC_LINK',
    created_by: 'PUBLIC',
    created_at: now,
    updated_at: now,
  };
  appendRow(SHEETS.MEETINGS, meetingObj, HEADERS.MEETINGS);
  logActivity('', 'PUBLIC', 'PUBLIC_MEETING_SUBMIT', 'MEETINGS', meeting_id, 'Public link submission');
  sendPushNotificationToSubscribers('New Public Meeting', 'Meeting request for ' + data.meeting_date + ' (' + data.meeting_type + ')', { meeting_id: meeting_id });
  return success(null, 'Meeting submitted successfully. Thank you!');
}

function handleGenerateDealerQR(data) {
  if (!data.dealer_id) return error('Dealer ID is required.');

  const sheet = getSheet(SHEETS.DEALERS);
  const dealers = sheetToObjects(sheet);
  const dealer = dealers.find(d => String(d.dealer_id).trim().toLowerCase() === String(data.dealer_id).trim().toLowerCase());
  if (!dealer) return error('Dealer not found.');

  const token = dealer.qr_token || generateToken();
  const settings = sheetToObjects(getSheet(SHEETS.SETTINGS));
  const defaultGasUrl = 'https://script.google.com/macros/s/AKfycbwD_2lt1qBbtcEiTcjbct565HUusllU1YW4b5i3fS_cEQBmBE_ZZ8WLBlPOXhs6ELum_g/exec';
  let publicUrl = getSettingValue(settings, 'public_url');
  if (!publicUrl || publicUrl === 'YOUR_APPS_SCRIPT_WEB_APP_URL') {
    try {
      publicUrl = ScriptApp.getService().getUrl() || defaultGasUrl;
    } catch (e) {
      publicUrl = defaultGasUrl;
    }
  }

  let publicSlabLink = '';
  if (publicUrl.includes('vercel.app')) {
    publicSlabLink = publicUrl + '/public/slab?dealer_id=' + encodeURIComponent(dealer.dealer_id) + '&token=' + encodeURIComponent(token);
  } else {
    publicSlabLink = publicUrl + (publicUrl.includes('?') ? '&' : '?') + 'action=page&page=slab&dealer_id=' + encodeURIComponent(dealer.dealer_id) + '&token=' + encodeURIComponent(token);
  }

  updateRowById(SHEETS.DEALERS, 'dealer_id', dealer.dealer_id, {
    qr_token: token,
    public_slab_link: publicSlabLink,
  }, HEADERS.DEALERS);

  return success({ token: token, public_slab_link: publicSlabLink }, 'QR generated successfully.');
}

function handleGenerateAllDealerQRs() {
  const sheet = getSheet(SHEETS.DEALERS);
  const dealers = sheetToObjects(sheet);
  const settings = sheetToObjects(getSheet(SHEETS.SETTINGS));
  const defaultGasUrl = 'https://script.google.com/macros/s/AKfycbwD_2lt1qBbtcEiTcjbct565HUusllU1YW4b5i3fS_cEQBmBE_ZZ8WLBlPOXhs6ELum_g/exec';
  let publicUrl = getSettingValue(settings, 'public_url');
  if (!publicUrl || publicUrl === 'YOUR_APPS_SCRIPT_WEB_APP_URL') {
    try {
      publicUrl = ScriptApp.getService().getUrl() || defaultGasUrl;
    } catch (e) {
      publicUrl = defaultGasUrl;
    }
  }

  let count = 0;
  dealers.forEach(dealer => {
    if (!dealer.public_slab_link || !dealer.qr_token) {
      const token = dealer.qr_token || generateToken();
      let link = '';
      if (publicUrl.includes('vercel.app')) {
        link = publicUrl + '/public/slab?dealer_id=' + encodeURIComponent(dealer.dealer_id) + '&token=' + encodeURIComponent(token);
      } else {
        link = publicUrl + (publicUrl.includes('?') ? '&' : '?') + 'action=page&page=slab&dealer_id=' + encodeURIComponent(dealer.dealer_id) + '&token=' + encodeURIComponent(token);
      }
      updateRowById(SHEETS.DEALERS, 'dealer_id', dealer.dealer_id, {
        qr_token: token,
        public_slab_link: link,
      }, HEADERS.DEALERS);
      count++;
    }
  });

  return success({ updated: count }, 'Generated QR codes for ' + count + ' dealers.');
}

// ── UTILITY HELPERS ──────────────────────────────────────────────────────
function getCurrentMonth() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM');
}

function getSettingValue(settings, key) {
  const found = settings.find(s => String(s.setting) === key);
  return found ? String(found.value) : '';
}

// ── MAIN ROUTERS ────────────────────────────────────────────────────────
function doGet(e) {
  try {
    const params = e.parameter || {};
    const action = params.action;

    // Direct page routing support for QR scans (e.g. ?page=slab or ?action=page&page=slab)
    if (params.page === 'slab' || (!action && params.page === 'slab')) return handlePublicPageSlab(params);
    if (params.page === 'meeting' || (!action && params.page === 'meeting')) return handlePublicPageMeeting(params);
    if (params.page === 'quick' || (!action && params.page === 'quick')) return handlePublicPageQuick();

    switch (action) {
      case 'getUsers': return handleGetUsers();
      case 'getDealers': return handleGetDealers(params);
      case 'getDealer': return handleGetDealer(params);
      case 'getDealerByToken': return handleGetDealerByToken(params);
      case 'getContractors': return handleGetContractors();
      case 'getSlabs': return handleGetSlabs(params);
      case 'getSales': return handleGetSales(params);
      case 'getDealerSalesSummary': return handleGetDealerSalesSummary(params);
      case 'getActiveTracker': return handleGetActiveTracker(params);
      case 'getTEActiveSummary': return handleGetTEActiveSummary(params);
      case 'getMeetings': return handleGetMeetings(params);
      case 'getMeetingTargetSummary': return handleGetMeetingTargetSummary(params);
      case 'getTargets': return handleGetTargets(params);
      case 'getSettings': return handleGetSettings();
      case 'getTodaySummary': return handleGetTodaySummary(params);
      // Public page router (for query-param based routing)
      case 'page':
        if (params.page === 'slab') return handlePublicPageSlab(params);
        if (params.page === 'meeting') return handlePublicPageMeeting(params);
        if (params.page === 'quick') return handlePublicPageQuick();
        return serveHtml('<h1>TE CONNECT</h1><p>Invalid page.</p>');
      default:
        return error('Unknown action: ' + action);
    }
  } catch (err) {
    return error('Server error: ' + err.message);
  }
}

function doPost(e) {
  try {
    let data = {};
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else {
      data = e.parameter || {};
    }
    const action = data.action || (e.parameter && e.parameter.action);

    switch (action) {
      case 'login': return handleLogin(data);
      case 'createSlab': return handleCreateSlab(data);
      case 'updateSlab': return handleUpdateSlab(data);
      case 'createSale': return handleCreateSale(data);
      case 'createBatchSales': return handleCreateBatchSales(data);
      case 'createMeeting': return handleCreateMeeting(data);
      case 'updateMeeting': return handleUpdateMeeting(data);
      case 'addPunch': return handleAddPunch(data);
      case 'updateContractorActivity': return handleUpdateContractorActivity(data);
      case 'addContractor': return handleAddContractor(data);
      case 'addDealer': return handleAddDealer(data);
      case 'publicSlabSubmit': return handlePublicSlabSubmit(data);
      case 'publicMeetingSubmit': return handlePublicMeetingSubmit(data);
      case 'generateDealerQR': return handleGenerateDealerQR(data);
      case 'generateAllDealerQRs': return handleGenerateAllDealerQRs();
      case 'changePassword': return handleChangePassword(data);
      case 'registerPushSubscription': return handleRegisterPushSubscription(data);
      default:
        return error('Unknown action: ' + action);
    }
  } catch (err) {
    return error('Server error: ' + err.message);
  }
}

function handleRegisterPushSubscription(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('PUSH_SUBSCRIPTIONS');
    if (!sheet) {
      sheet = ss.insertSheet('PUSH_SUBSCRIPTIONS');
      sheet.appendRow(['subscription_id', 'endpoint', 'p256dh', 'auth', 'user_name', 'user_role', 'district', 'updated_at']);
    }
    const endpoint = String(data.endpoint || data.token || '').trim();
    if (!endpoint) return success(null, 'No endpoint');

    const keys = data.keys || {};
    const p256dh = keys.p256dh || '';
    const authKey = keys.auth || '';
    const now = new Date().toISOString();

    const subs = sheetToObjects(sheet);
    const existing = subs.find(s => String(s.endpoint) === endpoint);
    if (existing) {
      updateRowById('PUSH_SUBSCRIPTIONS', 'endpoint', endpoint, {
        user_name: data.user_name || existing.user_name || '',
        user_role: data.user_role || existing.user_role || '',
        district: data.district || existing.district || '',
        updated_at: now,
      }, ['subscription_id', 'endpoint', 'p256dh', 'auth', 'user_name', 'user_role', 'district', 'updated_at']);
    } else {
      sheet.appendRow([
        generateId('SUB'),
        endpoint,
        p256dh,
        authKey,
        data.user_name || '',
        data.user_role || '',
        data.district || '',
        now,
      ]);
    }

    // Also sync to EXPO_TOKENS if it is an Expo token
    if (endpoint.indexOf('ExponentPushToken') === 0 || endpoint.indexOf('ExpoPushToken') === 0) {
      let expoSheet = ss.getSheetByName('EXPO_TOKENS');
      if (!expoSheet) {
        expoSheet = ss.insertSheet('EXPO_TOKENS');
        expoSheet.appendRow(['token', 'user_name', 'registered_at']);
      }
      const expoRows = sheetToObjects(expoSheet);
      if (!expoRows.some(r => String(r.token) === endpoint)) {
        expoSheet.appendRow([endpoint, data.user_name || '', now]);
      }
    }

    return success(null, 'Subscription registered.');
  } catch (e) {
    return success(null, 'Ignored: ' + e.message);
  }
}

function sendPushNotificationToSubscribers(title, body, data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const expoTokensSet = {};
    const webEndpoints = [];

    // 1. Collect from PUSH_SUBSCRIPTIONS
    const sheet = ss.getSheetByName('PUSH_SUBSCRIPTIONS');
    if (sheet) {
      const subs = sheetToObjects(sheet);
      subs.forEach(function(sub) {
        if (!sub || !sub.endpoint) return;
        const ep = String(sub.endpoint).trim();
        if (ep.indexOf('ExponentPushToken') === 0 || ep.indexOf('ExpoPushToken') === 0) {
          expoTokensSet[ep] = true;
        } else if (ep.indexOf('http') === 0) {
          webEndpoints.push(ep);
        }
      });
    }

    // 2. Collect from EXPO_TOKENS
    const expoSheet = ss.getSheetByName('EXPO_TOKENS');
    if (expoSheet) {
      const expoRows = sheetToObjects(expoSheet);
      expoRows.forEach(function(r) {
        const t = String(r.token || '').trim();
        if (t.indexOf('ExponentPushToken') === 0 || t.indexOf('ExpoPushToken') === 0) {
          expoTokensSet[t] = true;
        }
      });
    }

    const expoTokens = Object.keys(expoTokensSet);

    // Mobile Android / iOS via Expo Push API
    if (expoTokens.length > 0) {
      try {
        const payload = expoTokens.map(function(t) {
          return {
            to: t,
            sound: 'default',
            title: title,
            body: body,
            data: data || {},
            priority: 'high',
            channelId: 'default',
            _displayInForeground: true,
          };
        });
        UrlFetchApp.fetch('https://exp.host/--/api/v2/push/send', {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify(payload),
          muteHttpExceptions: true
        });
      } catch (errExpo) {
        Logger.log('Expo push dispatch error: ' + errExpo.message);
      }
    }

    // Web Push endpoints
    webEndpoints.forEach(function(ep) {
      try {
        UrlFetchApp.fetch(ep, {
          method: 'post',
          headers: {
            'TTL': '86400',
            'Urgency': 'high'
          },
          muteHttpExceptions: true
        });
      } catch (errWeb) {}
    });

    // Native Android Firebase FCM dispatch
    if (sheet) {
      const subs = sheetToObjects(sheet);
      subs.forEach(function(sub) {
        if (!sub || !sub.endpoint) return;
        const ep = String(sub.endpoint).trim();
        if (ep.indexOf('ExponentPushToken') !== 0 && ep.indexOf('ExpoPushToken') !== 0 && ep.indexOf('http') !== 0 && ep.length > 25) {
          try {
            UrlFetchApp.fetch('https://fcm.googleapis.com/fcm/send', {
              method: 'post',
              contentType: 'application/json',
              headers: {
                'Authorization': 'key=AIzaSyDJ9-KHy_tSzwMHVxTEQnl_zWxo7F4hue0'
              },
              payload: JSON.stringify({
                to: ep,
                priority: 'high',
                notification: {
                  title: title,
                  body: body,
                  sound: 'default'
                },
                data: data || {}
              }),
              muteHttpExceptions: true
            });
          } catch (errFcm) {
            Logger.log('FCM dispatch error: ' + errFcm.message);
          }
        }
      });
    }
  } catch (e) {
    Logger.log('Push dispatch error: ' + e.message);
  }
}

// ── PUBLIC HTML PAGES ─────────────────────────────────────────────────
// These serve simple HTML forms for public submissions.

function serveHtml(html) {
  return HtmlService.createHtmlOutput(html)
    .setTitle('TE CONNECT - ସ୍ଲାବ୍ ଢଳାଇ ବୁକିଂ')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function handlePublicPageSlab(params) {
  const { dealer_id, token } = params;
  let dealerName = 'ଅନୁମୋଦିତ ଡିଲର କାଉଣ୍ଟର (Authorized Counter)';
  let dealerArea = 'Jajpur & Bhadrak Territory';
  let dealerPhone = '';
  let dealerLat = '';
  let dealerLng = '';

  if (dealer_id) {
    try {
      const dealers = sheetToObjects(getSheet(SHEETS.DEALERS));
      const dealer = dealers.find(d => String(d.dealer_id).trim().toLowerCase() === String(dealer_id).trim().toLowerCase());
      if (dealer) {
        dealerName = dealer.dealer_name || dealerName;
        dealerArea = dealer.area || dealer.address || dealerArea;
        dealerPhone = dealer.phone ? String(dealer.phone) : '';
        dealerLat = dealer.latitude || '';
        dealerLng = dealer.longitude || '';
      }
    } catch (e) {}
  }

  const scriptUrl = ScriptApp.getService().getUrl();
  const html = '<!DOCTYPE html>' +
'<html lang="or">' +
'<head>' +
'<meta charset="UTF-8">' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">' +
'<title>TE CONNECT - ସ୍ଲାବ୍ ଢଳାଇ ବୁକିଂ (Slab Booking)</title>' +
'<style>' +
'*, *::before, *::after{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif}' +
'html,body{width:100%;max-width:100%;overflow-x:hidden;-webkit-text-size-adjust:100%;touch-action:manipulation}' +
'body{background:#F1F5F9;color:#0F172A;min-height:100vh;padding:10px 8px 36px;margin:0 auto;max-width:480px}' +
'.header{text-align:center;padding:14px 10px;background:#FFFFFF;border-radius:16px;margin-bottom:12px;border:1.5px solid #E2E8F0;box-shadow:0 2px 8px rgba(0,0,0,0.04);width:100%}' +
'.logo{font-size:22px;font-weight:900;letter-spacing:1px;color:#0F172A}' +
'.logo span{color:#C91F2B}' +
'.subtitle{font-size:14px;font-weight:800;color:#1E293B;margin-top:4px}' +
'.sub-desc{font-size:11px;color:#64748B;margin-top:2px;font-weight:600}' +
'.dealer-card{background:#FFFFFF;border:2px solid #86EFAC;border-radius:16px;padding:14px;margin-bottom:12px;box-shadow:0 4px 12px rgba(22,163,74,0.08);width:100%}' +
'.verified{display:inline-flex;align-items:center;gap:4px;background:#DCFCE7;color:#15803D;font-size:11px;font-weight:800;padding:4px 8px;border-radius:6px;text-transform:uppercase;margin-bottom:6px}' +
'.dealer-name{font-size:18px;font-weight:900;color:#0F172A;line-height:1.25}' +
'.dealer-area{font-size:13px;font-weight:700;color:#334155;margin-top:4px}' +
'.dealer-phone{font-size:12px;color:#0F766E;font-weight:700;margin-top:3px}' +
'.card{background:#FFFFFF;border-radius:16px;padding:14px;margin-bottom:12px;border:1.5px solid #E2E8F0;box-shadow:0 2px 8px rgba(0,0,0,0.04);width:100%}' +
'.card-highlight{border:2.5px solid #C91F2B;background:#FFFFFF}' +
'.step-title{display:flex;align-items:flex-start;gap:8px;margin-bottom:10px}' +
'.step-num{width:26px;height:26px;background:#C91F2B;color:#FFFFFF;border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;flex-shrink:0;margin-top:1px}' +
'.step-num-gray{background:#E2E8F0;color:#334155}' +
'.step-text{font-size:14px;font-weight:900;color:#0F172A;line-height:1.3;flex:1}' +
'.step-text span{color:#DC2626;font-size:12px;font-weight:800}' +
'.step-sub{font-size:11px;color:#64748B;font-weight:600;display:block;margin-top:2px}' +
'.phone-box{display:flex;align-items:center;border:2px solid #C91F2B;border-radius:12px;background:#FEF2F2;overflow:hidden;width:100%}' +
'.code{background:#FDE8EA;color:#991B1B;font-weight:900;padding:12px 10px;font-size:15px;border-right:1.5px solid #FCA5A5;white-space:nowrap;flex-shrink:0}' +
'.phone-input{flex:1;min-width:0;border:none;background:transparent;padding:12px 10px;font-size:18px;font-weight:900;color:#0F172A;outline:none;-webkit-appearance:none}' +
'.hint{font-size:11px;color:#64748B;margin-top:6px;line-height:1.4}' +
'.bag-input-row{display:flex;align-items:center;border:2px solid #CBD5E1;border-radius:12px;background:#FFFFFF;padding:4px 12px;margin-bottom:10px;width:100%}' +
'.bag-input-row:focus-within{border-color:#C91F2B;box-shadow:0 0 0 3px rgba(201,31,43,0.12)}' +
'.bag-main-input{flex:1;min-width:0;border:none;outline:none;font-size:20px;font-weight:900;color:#0F172A;padding:10px 0;-webkit-appearance:none}' +
'.bag-main-unit{font-size:13px;font-weight:800;color:#475569;margin-left:8px;flex-shrink:0}' +
'.chips-title{font-size:12px;font-weight:800;color:#475569;margin-bottom:6px}' +
'.chips{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;width:100%}' +
'.chip{border:1.5px solid #E2E8F0;border-radius:10px;background:#F8FAFC;padding:8px 2px;text-align:center;cursor:pointer;transition:all 0.15s;min-width:0}' +
'.chip.active{border-color:#C91F2B;background:#FDE8EA;color:#C91F2B}' +
'.chip-val{font-size:15px;font-weight:900;display:block}' +
'.chip-lbl{font-size:10px;font-weight:700;color:#64748B}' +
'.chip.active .chip-lbl{color:#C91F2B}' +
'.date-chips{display:flex;gap:6px;width:100%;margin-bottom:6px}' +
'.date-chip{flex:1 1 0;min-width:0;border:1.5px solid #E2E8F0;border-radius:10px;background:#F8FAFC;padding:10px 4px;text-align:center;cursor:pointer}' +
'.date-chip.active{border-color:#C91F2B;background:#FDE8EA;color:#C91F2B}' +
'.date-chip .lbl{font-size:12px;font-weight:800;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
'.date-chip .sub{font-size:11px;color:#64748B;margin-top:2px;font-weight:700}' +
'.date-chip.active .sub{color:#C91F2B}' +
'.custom-date-box{margin-top:10px;background:#F8FAFC;border:1.5px dashed #CBD5E1;border-radius:12px;padding:10px 12px}' +
'.custom-date-title{font-size:12px;font-weight:800;color:#334155;margin-bottom:6px;display:flex;align-items:center;gap:5px}' +
'.date-picker-wrap{position:relative;width:100%}' +
'.date-input-field{width:100%;border:2px solid #CBD5E1;border-radius:10px;padding:10px 12px;font-size:15px;font-weight:800;color:#0F172A;background:#FFFFFF;outline:none;cursor:pointer;-webkit-appearance:none;appearance:none;box-sizing:border-box}' +
'.date-input-field:focus{border-color:#C91F2B}' +
'.date-selected-preview{font-size:11px;font-weight:700;color:#C91F2B;margin-top:6px;line-height:1.3}' +
'.input-group{margin-bottom:10px}' +
'.input-label{display:block;font-size:12px;font-weight:800;color:#334155;margin-bottom:5px}' +
'.text-input{width:100%;border:1.5px solid #E2E8F0;border-radius:10px;padding:11px 12px;font-size:15px;outline:none;background:#FFFFFF;font-weight:600;-webkit-appearance:none}' +
'.text-input:focus{border-color:#C91F2B}' +
'.gps-btn{width:100%;border:1.5px solid #C91F2B;background:#FEF2F2;color:#C91F2B;border-radius:10px;padding:12px;font-size:13px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px}' +
'.gps-btn.saved{border-color:#16A34A;background:#DCFCE7;color:#16A34A}' +
'.btn-submit{width:100%;background:#C91F2B;color:#FFFFFF;border:none;border-radius:14px;padding:16px;cursor:pointer;margin-top:8px;box-shadow:0 4px 14px rgba(201,31,43,0.35);text-align:center}' +
'.btn-submit:disabled{opacity:0.7}' +
'.btn-submit .t1{font-size:18px;font-weight:900;display:block;letter-spacing:0.5px}' +
'.btn-submit .t2{font-size:11px;color:rgba(255,255,255,0.9);margin-top:2px;display:block;font-weight:600}' +
'.success-box{background:#FFFFFF;border:2.5px solid #16A34A;border-radius:18px;padding:22px 14px;text-align:center;display:none;box-shadow:0 6px 18px rgba(22,163,74,0.15);width:100%}' +
'.success-icon{width:70px;height:70px;background:#DCFCE7;color:#15803D;border-radius:35px;display:inline-flex;align-items:center;justify-content:center;font-size:36px;margin-bottom:12px}' +
'.success-h{font-size:20px;font-weight:900;color:#15803D;margin-bottom:6px}' +
'.success-subh{font-size:13px;font-weight:700;color:#16A34A;margin-bottom:8px}' +
'.success-p{font-size:13px;color:#334155;line-height:1.5;margin-bottom:14px}' +
'.summary-card{background:#F8FAFC;border-radius:12px;padding:12px;text-align:left;font-size:13px;margin-bottom:14px;border:1px solid #E2E8F0}' +
'.summary-title{font-size:12px;font-weight:800;color:#64748B;text-transform:uppercase;margin-bottom:8px;border-bottom:1px solid #E2E8F0;padding-bottom:4px}' +
'.summary-row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #F1F5F9;font-size:13px}' +
'.summary-row:last-child{border:none}' +
'.summary-val{font-weight:800;color:#0F172A;text-align:right}' +
'.btn-again{background:#16A34A;color:#FFFFFF;border:none;border-radius:12px;padding:14px 18px;font-size:15px;font-weight:800;cursor:pointer;width:100%}' +
'</style>' +
'</head>' +
'<body>' +
'<div class="header">' +
'  <div class="logo">TE <span>CONNECT</span></div>' +
'  <div class="subtitle">ସ୍ଲାବ୍ ଢଳାଇ ବୁକିଂ (Slab Booking)</div>' +
'  <div class="sub-desc">ଆଦାନୀ ଏସିସି ସିମେଣ୍ଟ · ୧୦ ସେକେଣ୍ଡରେ ତୁରନ୍ତ ବୁକିଂ</div>' +
'</div>' +
'<div class="dealer-card">' +
'  <div class="verified">✓ ଅନୁମୋଦିତ କାଉଣ୍ଟର (Authorized Counter)</div>' +
'  <div class="dealer-name">' + dealerName + '</div>' +
'  <div class="dealer-area">📍 ' + dealerArea + '</div>' +
(dealerPhone ? '<div class="dealer-phone">📞 ' + dealerPhone + '</div>' : '') +
'</div>' +
'<div id="successBox" class="success-box">' +
'  <div class="success-icon">✓</div>' +
'  <div class="success-h">ସ୍ଲାବ୍ ଢଳାଇ ଦର୍ଜ ହୋଇଗଲା! 🎉</div>' +
'  <div class="success-subh">Slab Booking Successfully Recorded!</div>' +
'  <div class="success-p">ଧନ୍ୟବାଦ! ଆପଣଙ୍କ ସ୍ଲାବ୍ ସୂଚନା ଆମ ଟେକ୍ନିକାଲ୍ ଇଞ୍ଜିନିୟର (TE) ଙ୍କ ପାଖକୁ ପଠାଗଲା। ଖୁବ୍ ଶୀଘ୍ର ଆପଣଙ୍କ ସହ ଯୋଗାଯୋଗ କରାଯିବ।</div>' +
'  <div class="summary-card" id="summaryCard"></div>' +
'  <button type="button" class="btn-again" onclick="resetForm()">+ ଆଉ ଏକ ସ୍ଲାବ୍ ଯୋଡ଼ନ୍ତୁ (Book Another)</button>' +
'</div>' +
'<form id="slabForm">' +
'  <div class="card card-highlight">' +
'    <div class="step-title">' +
'      <div class="step-num">1</div>' +
'      <div class="step-text">ଆପଣଙ୍କ ମୋବାଇଲ୍ ନମ୍ବର <span>* (ବାଧ୍ୟତାମୂଳକ)</span><span class="step-sub">Your Contact Mobile Number (Mandatory)</span></div>' +
'    </div>' +
'    <div class="phone-box">' +
'      <div class="code">🇮🇳 +91</div>' +
'      <input type="tel" id="mobile" class="phone-input" placeholder="10-digit number" maxlength="10" required autofocus>' +
'    </div>' +
'    <div class="hint">ℹ️ ଯିଏ ଫର୍ମ ଭରୁଛନ୍ତି ତାଙ୍କ ନମ୍ବର ଦିଅନ୍ତୁ। ଆମ ଟେକ୍ନିକାଲ୍ ଇଞ୍ଜିନିୟର (TE) ସ୍ଲାବ୍ ସହାୟତା ପାଇଁ ଏହି ନମ୍ବରରେ ସିଧାସଳଖ ଯୋଗାଯୋଗ କରିବେ।</div>' +
'  </div>' +
'  <div class="card">' +
'    <div class="step-title">' +
'      <div class="step-num step-num-gray">2</div>' +
'      <div class="step-text">ସିମେଣ୍ଟ ବସ୍ତା ପରିମାଣ (Cement Bags 🧱)<span class="step-sub">ପ୍ରଥମେ କେତେ ବସ୍ତା ଦରକାର ଲେଖନ୍ତୁ କିମ୍ବା ତଳେ ବଟନ୍ ଦବାନ୍ତୁ:</span></div>' +
'    </div>' +
'    <div class="bag-input-row">' +
'      <input type="number" id="customBags" class="bag-main-input" value="50" min="1" max="5000" placeholder="e.g. 80" oninput="customBagsTyped()">' +
'      <span class="bag-main-unit">ବସ୍ତା (Bags)</span>' +
'    </div>' +
'    <div class="chips-title">ସହଜ ବିକଳ୍ପ (Quick 1-Tap Options):</div>' +
'    <div class="chips">' +
'      <div class="chip" onclick="selectBags(25, this)"><span class="chip-val">25</span><span class="chip-lbl">ବସ୍ତା</span></div>' +
'      <div class="chip active" onclick="selectBags(50, this)"><span class="chip-val">50</span><span class="chip-lbl">ବସ୍ତା</span></div>' +
'      <div class="chip" onclick="selectBags(75, this)"><span class="chip-val">75</span><span class="chip-lbl">ବସ୍ତା</span></div>' +
'      <div class="chip" onclick="selectBags(100, this)"><span class="chip-val">100</span><span class="chip-lbl">ବସ୍ତା</span></div>' +
'      <div class="chip" onclick="selectBags(150, this)"><span class="chip-val">150</span><span class="chip-lbl">ବସ୍ତା</span></div>' +
'      <div class="chip" onclick="selectBags(200, this)"><span class="chip-val">200</span><span class="chip-lbl">ବସ୍ତା</span></div>' +
'      <div class="chip" onclick="selectBags(250, this)"><span class="chip-val">250</span><span class="chip-lbl">ବସ୍ତା</span></div>' +
'      <div class="chip" onclick="selectBags(300, this)"><span class="chip-val">300</span><span class="chip-lbl">ବସ୍ତା</span></div>' +
'    </div>' +
'  </div>' +
'  <div class="card">' +
'    <div class="step-title">' +
'      <div class="step-num step-num-gray">3</div>' +
'      <div class="step-text">ଢଳାଇ ତାରିଖ (Slab Casting Date 📅)<span class="step-sub">କେଉଁ ଦିନ ଢଳାଇ ହେବ? ବାଛନ୍ତୁ କିମ୍ବା କ୍ୟାଲେଣ୍ଡରରୁ ଚୟନ କରନ୍ତୁ:</span></div>' +
'    </div>' +
'    <div class="date-chips">' +
'      <div class="date-chip active" id="dChipToday" onclick="selectDate(0, this)"><span class="lbl">ଆଜି (Today)</span><span class="sub" id="subToday"></span></div>' +
'      <div class="date-chip" id="dChipTom" onclick="selectDate(1, this)"><span class="lbl">ଆସନ୍ତାକାଲି</span><span class="sub" id="subTom"></span></div>' +
'      <div class="date-chip" id="dChipNext" onclick="selectDate(2, this)"><span class="lbl">ପରଦିନ</span><span class="sub" id="subNext"></span></div>' +
'    </div>' +
'    <div class="custom-date-box">' +
'      <div class="custom-date-title"><span>📅</span> କିମ୍ବା କ୍ୟାଲେଣ୍ଡରରୁ ଅନ୍ୟ ତାରିଖ ବାଛନ୍ତୁ (Custom Date):</div>' +
'      <div class="date-picker-wrap">' +
'        <input type="date" id="slab_date" class="date-input-field" onchange="customDateSelected(this.value)">' +
'      </div>' +
'      <div class="date-selected-preview" id="datePreviewText">✓ ବଛାଯାଇଛି (Selected): ଆଜି (Today)</div>' +
'    </div>' +
'  </div>' +
'  <div class="card">' +
'    <div class="step-title">' +
'      <div class="step-num step-num-gray">4</div>' +
'      <div class="step-text">ଅତିରିକ୍ତ ବିବରଣୀ (Optional Details)<span class="step-sub">ଆବଶ୍ୟକ ହେଲେ ଲେଖନ୍ତୁ, ନଚେତ୍ ଖାଲି ଛାଡ଼ିପାରିବେ:</span></div>' +
'    </div>' +
'    <div class="input-group">' +
'      <label class="input-label">👷 ମିସ୍ତ୍ରୀଙ୍କ ନାମ (Contractor / Mistri Name)</label>' +
'      <input type="text" id="contractor_name" class="text-input" placeholder="ନାମ ଲେଖନ୍ତୁ (e.g. Ramesh Mistri)">' +
'    </div>' +
'    <div class="input-group">' +
'      <label class="input-label">🏠 ସାଇଟ୍ / ଗ୍ରାମ (Site / Village Name)</label>' +
'      <input type="text" id="customer_name" class="text-input" placeholder="ସ୍ଥାନ / ସାଇଟ୍ (e.g. Kuakhia Bazar)">' +
'    </div>' +
'    <div class="input-group">' +
'      <label class="input-label">📍 ସାଇଟ୍ ଲୋକେସନ୍ (Site GPS Location)</label>' +
'      <button type="button" id="gpsBtn" class="gps-btn" onclick="captureGPS()">📍 ବର୍ତ୍ତମାନର ସାଇଟ୍ ଲୋକେସନ୍ ଯୋଡ଼ନ୍ତୁ (1-Tap GPS)</button>' +
'    </div>' +
'  </div>' +
'  <button type="submit" id="submitBtn" class="btn-submit">' +
'    <span class="t1">ସ୍ଲାବ୍ ଢଳାଇ ବୁକ୍ କରନ୍ତୁ 🏗️</span>' +
'    <span class="t2">Submit Slab Casting Request →</span>' +
'  </button>' +
'</form>' +
'<script>' +
'var currentBags = 50;' +
'var currentLat = "' + dealerLat + '";' +
'var currentLng = "' + dealerLng + '";' +
'var today = new Date();' +
'function fmtDate(d){ return d.toISOString().split("T")[0]; }' +
'function fmtDisp(d){ var m=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return d.getDate() + " " + m[d.getMonth()]; }' +
'var slabDateInput = document.getElementById("slab_date");' +
'slabDateInput.value = fmtDate(today);' +
'slabDateInput.min = fmtDate(today);' +
'document.getElementById("subToday").textContent = fmtDisp(today);' +
'var tom = new Date(today); tom.setDate(tom.getDate()+1);' +
'document.getElementById("subTom").textContent = fmtDisp(tom);' +
'var nxt = new Date(today); nxt.setDate(nxt.getDate()+2);' +
'document.getElementById("subNext").textContent = fmtDisp(nxt);' +
'function selectBags(val, el){' +
'  currentBags = val;' +
'  document.getElementById("customBags").value = val;' +
'  document.querySelectorAll(".chip").forEach(function(c){ c.classList.remove("active"); });' +
'  if(el) el.classList.add("active");' +
'}' +
'function customBagsTyped(){' +
'  var v = document.getElementById("customBags").value.trim();' +
'  var num = parseInt(v, 10);' +
'  currentBags = (!isNaN(num) && num > 0) ? num : 50;' +
'  document.querySelectorAll(".chip").forEach(function(c){' +
'    var chipVal = parseInt(c.querySelector(".chip-val").textContent, 10);' +
'    if(chipVal === num){ c.classList.add("active"); } else { c.classList.remove("active"); }' +
'  });' +
'}' +
'function selectDate(offset, el){' +
'  var d = new Date(); d.setDate(d.getDate()+offset);' +
'  var iso = fmtDate(d);' +
'  document.getElementById("slab_date").value = iso;' +
'  document.querySelectorAll(".date-chip").forEach(function(c){ c.classList.remove("active"); });' +
'  if(el) el.classList.add("active");' +
'  var labels = ["ଆଜି (Today)", "ଆସନ୍ତାକାଲି (Tomorrow)", "ପରଦିନ (In 2 Days)"];' +
'  document.getElementById("datePreviewText").textContent = "✓ ବଛାଯାଇଛି (Selected): " + (labels[offset] || fmtDisp(d));' +
'}' +
'function customDateSelected(val){' +
'  if(!val) return;' +
'  document.querySelectorAll(".date-chip").forEach(function(c){ c.classList.remove("active"); });' +
'  var parts = val.split("-");' +
'  var d = new Date(parts[0], parseInt(parts[1], 10) - 1, parts[2]);' +
'  document.getElementById("datePreviewText").textContent = "✓ ବଛାଯାଇଛି (Custom Date): " + fmtDisp(d) + " (" + val + ")";' +
'}' +
'function captureGPS(){' +
'  if(navigator.geolocation){' +
'    navigator.geolocation.getCurrentPosition(function(pos){' +
'      currentLat = pos.coords.latitude;' +
'      currentLng = pos.coords.longitude;' +
'      var b = document.getElementById("gpsBtn");' +
'      b.classList.add("saved");' +
'      b.innerHTML = "✓ GPS ସୁରକ୍ଷିତ: " + Number(currentLat).toFixed(4) + ", " + Number(currentLng).toFixed(4);' +
'    }, function(err){ alert("GPS On କରନ୍ତୁ କିମ୍ବା Permission ଦିଅନ୍ତୁ।"); });' +
'  } else { alert("GPS ଏହି ଫୋନରେ ଉପଲବ୍ଧ ନାହିଁ।"); }' +
'}' +
'function showSuccessUI(mob, bagsText, sDate, cName, custName){' +
'  document.getElementById("slabForm").style.display = "none";' +
'  window.scrollTo({top: 0, behavior: "smooth"});' +
'  var s = "<div class=\'summary-title\'>ବୁକିଂ ବିବରଣୀ (Booking Receipt)</div>" +' +
'          "<div class=\'summary-row\'><span>🏪 ଡିଲର (Dealer):</span><span class=\'summary-val\'>" + ' + JSON.stringify(dealerName) + ' + "</span></div>" +' +
'          "<div class=\'summary-row\'><span>📱 ମୋବାଇଲ୍ (Mobile):</span><span class=\'summary-val\' style=\'color:#C91F2B\'>" + mob + "</span></div>" +' +
'          "<div class=\'summary-row\'><span>🧱 ସିମେଣ୍ଟ (Cement):</span><span class=\'summary-val\'>" + bagsText + "</span></div>" +' +
'          "<div class=\'summary-row\'><span>📅 ଢଳାଇ ତାରିଖ (Date):</span><span class=\'summary-val\'>" + sDate + "</span></div>" +' +
'          (cName ? "<div class=\'summary-row\'><span>👷 ମିସ୍ତ୍ରୀ (Mistri):</span><span class=\'summary-val\'>" + cName + "</span></div>" : "") +' +
'          (custName ? "<div class=\'summary-row\'><span>🏠 ସାଇଟ୍ (Site):</span><span class=\'summary-val\'>" + custName + "</span></div>" : "");' +
'  document.getElementById("summaryCard").innerHTML = s;' +
'  document.getElementById("successBox").style.display = "block";' +
'}' +
'document.getElementById("slabForm").addEventListener("submit", async function(e){' +
'  e.preventDefault();' +
'  var mob = document.getElementById("mobile").value.trim().replace(/[^0-9]/g, "");' +
'  if(!mob || mob.length < 10){' +
'    alert("ଦୟାକରି ୧୦ ଅଙ୍କର ସଠିକ୍ ମୋବାଇଲ୍ ନମ୍ବର ଦିଅନ୍ତୁ। (Please enter valid 10-digit mobile number)");' +
'    return;' +
'  }' +
'  var btn = document.getElementById("submitBtn");' +
'  btn.disabled = true;' +
'  btn.innerHTML = "<span class=\'t1\'>ବୁକ୍ ହେଉଛି... ⏳</span><span class=\'t2\'>Submitting request...</span>";' +
'  var cName = document.getElementById("contractor_name").value.trim();' +
'  var custName = document.getElementById("customer_name").value.trim();' +
'  var sDate = document.getElementById("slab_date").value || fmtDate(today);' +
'  var bagsVal = document.getElementById("customBags").value.trim() || currentBags || 50;' +
'  var bagsText = bagsVal + " ବସ୍ତା (Bags)";' +
'  var payload = {' +
'    action: "publicSlabSubmit",' +
'    dealer_id: "' + dealer_id + '",' +
'    token: "' + token + '",' +
'    slab_date: sDate,' +
'    contractor_name: cName || ("Contact (" + mob + ")"),' +
'    mobile: mob,' +
'    customer_name: custName,' +
'    expected_cement: bagsText,' +
'    latitude: currentLat,' +
'    longitude: currentLng,' +
'    remark: "Contact Phone: " + mob + (custName ? " | Site: " + custName : "")' +
'  };' +
'  try {' +
'    var res = await fetch("' + scriptUrl + '", {' +
'      method: "POST",' +
'      headers: {"Content-Type": "text/plain;charset=utf-8"},' +
'      body: JSON.stringify(payload)' +
'    });' +
'    showSuccessUI(mob, bagsText, sDate, cName, custName);' +
'  } catch(err){' +
'    showSuccessUI(mob, bagsText, sDate, cName, custName);' +
'  }' +
'});' +
'function resetForm(){' +
'  document.getElementById("successBox").style.display = "none";' +
'  document.getElementById("slabForm").style.display = "block";' +
'  document.getElementById("mobile").value = "";' +
'  document.getElementById("contractor_name").value = "";' +
'  document.getElementById("customer_name").value = "";' +
'  document.getElementById("customBags").value = "50";' +
'  currentBags = 50;' +
'  document.querySelectorAll(".chip").forEach(function(c, i){' +
'    if(i === 1) c.classList.add("active"); else c.classList.remove("active");' +
'  });' +
'  document.getElementById("submitBtn").disabled = false;' +
'  document.getElementById("submitBtn").innerHTML = "<span class=\'t1\'>ସ୍ଲାବ୍ ଢଳାଇ ବୁକ୍ କରନ୍ତୁ 🏗️</span><span class=\'t2\'>Submit Slab Casting Request →</span>";' +
'}' +
'</script>' +
'</body></html>';
  return serveHtml(html);
}

function handlePublicPageMeeting() {
  const scriptUrl = ScriptApp.getService().getUrl();
  const html = '<!DOCTYPE html>\n' +
'<html lang="en">\n' +
'<head>\n' +
'<meta charset="UTF-8">\n' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">\n' +
'<title>TE CONNECT - Meeting</title>\n' +
'<style>\n' +
'*{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif}\n' +
'body{background:#F6F7F9;min-height:100vh;padding:20px 16px 40px}\n' +
'.header{text-align:center;margin-bottom:24px}\n' +
'.logo{font-size:22px;font-weight:800;color:#C91F2B}\n' +
'.subtitle{font-size:13px;color:#6B7280;margin-top:4px}\n' +
'.card{background:#fff;border-radius:16px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.08)}\n' +
'.form-group{margin-bottom:16px}\n' +
'label{display:block;font-size:13px;font-weight:600;color:#172033;margin-bottom:6px}\n' +
'input,select,textarea{width:100%;border:1.5px solid #E5E7EB;border-radius:10px;padding:12px 14px;font-size:15px;color:#172033;background:#fff;outline:none}\n' +
'input:focus,select:focus{border-color:#C91F2B}\n' +
'.optional{color:#9CA3AF;font-weight:400;font-size:11px}\n' +
'.btn{width:100%;background:#C91F2B;color:#fff;border:none;border-radius:12px;padding:16px;font-size:17px;font-weight:700;cursor:pointer;margin-top:8px}\n' +
'.success{background:#DCFCE7;border:1.5px solid #16A34A;border-radius:12px;padding:16px;text-align:center;color:#166534;font-weight:600;display:none}\n' +
'.error-msg{background:#FEE2E2;border-radius:12px;padding:12px;text-align:center;color:#991B1B;display:none;margin-top:8px}\n' +
'<\/style><\/head><body>\n' +
'<div class="header"><div class="logo">TE CONNECT<\/div><div class="subtitle">Meeting Submission<\/div><\/div>\n' +
'<div class="card">\n' +
'<div id="successMsg" class="success">Meeting submitted! Thank you.<\/div>\n' +
'<div id="errorMsg" class="error-msg"><\/div>\n' +
'<form id="meetingForm">\n' +
'<div class="form-group"><label>Meeting Date *<\/label><input type="date" id="meeting_date" required><\/div>\n' +
'<div class="form-group"><label>Meeting Type *<\/label><select id="meeting_type" required><option value="">Select type...<\/option><option value="CUSTOMER">Customer<\/option><option value="CONTRACTOR">Contractor<\/option><option value="OTHER">Other<\/option><\/select><\/div>\n' +
'<div class="form-group"><label>Your Name<\/label><input type="text" id="meeting_name" placeholder="Your name"><\/div>\n' +
'<div class="form-group"><label>Location <span class="optional">(Optional)<\/span><\/label><input type="text" id="location" placeholder="Meeting location"><\/div>\n' +
'<div class="form-group"><label>Purpose <span class="optional">(Optional)<\/span><\/label><input type="text" id="purpose" placeholder="Purpose of meeting"><\/div>\n' +
'<div class="form-group"><label>People Count <span class="optional">(Optional)<\/span><\/label><input type="number" id="people_count" placeholder="Number of people" min="1"><\/div>\n' +
'<div class="form-group"><label>Remark <span class="optional">(Optional)<\/span><\/label><textarea id="remark" rows="2" placeholder="Any notes..."><\/textarea><\/div>\n' +
'<button type="submit" class="btn" id="submitBtn">Submit Meeting<\/button>\n' +
'<\/form><\/div>\n' +
'<script>\n' +
'document.getElementById(\'meetingForm\').addEventListener(\'submit\', async function(e) {\n' +
'  e.preventDefault();\n' +
'  const btn = document.getElementById(\'submitBtn\');\n' +
'  btn.textContent = \'Submitting...\';\n' +
'  btn.disabled = true;\n' +
'  document.getElementById(\'errorMsg\').style.display = \'none\';\n' +
'  const payload = {\n' +
'    action: \'publicMeetingSubmit\',\n' +
'    meeting_date: document.getElementById(\'meeting_date\').value,\n' +
'    meeting_type: document.getElementById(\'meeting_type\').value,\n' +
'    meeting_name: document.getElementById(\'meeting_name\').value,\n' +
'    location: document.getElementById(\'location\').value,\n' +
'    purpose: document.getElementById(\'purpose\').value,\n' +
'    people_count: document.getElementById(\'people_count\').value,\n' +
'    remark: document.getElementById(\'remark\').value,\n' +
'  };\n' +
'  try {\n' +
'    const res = await fetch(\'' + scriptUrl + '\', {method:\'POST\',headers:{\'Content-Type\':\'application/json\'},body:JSON.stringify(payload)});\n' +
'    const json = await res.json();\n' +
'    if(json.success){document.getElementById(\'meetingForm\').style.display=\'none\';document.getElementById(\'successMsg\').style.display=\'block\';}\n' +
'    else{document.getElementById(\'errorMsg\').textContent=json.message||\'Error\';document.getElementById(\'errorMsg\').style.display=\'block\';btn.textContent=\'Submit Meeting\';btn.disabled=false;}\n' +
'  }catch(err){document.getElementById(\'errorMsg\').textContent=\'Network error. Try again.\';document.getElementById(\'errorMsg\').style.display=\'block\';btn.textContent=\'Submit Meeting\';btn.disabled=false;}\n' +
'});\n' +
'document.getElementById(\'meeting_date\').value=new Date().toISOString().split(\'T\')[0];\n' +
'<\/script><\/body><\/html>';
  return serveHtml(html);
}

function handlePublicPageQuick() {
  const scriptUrl = ScriptApp.getService().getUrl();
  const html = '<!DOCTYPE html>\n' +
'<html lang="en"><head>\n' +
'<meta charset="UTF-8">\n' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">\n' +
'<title>TE CONNECT - Quick Entry<\/title>\n' +
'<style>\n' +
'*{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif}\n' +
'body{background:#F6F7F9;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px}\n' +
'.logo{font-size:26px;font-weight:800;color:#C91F2B;margin-bottom:6px;letter-spacing:1px}\n' +
'.subtitle{font-size:15px;color:#6B7280;margin-bottom:40px}\n' +
'.btn-card{background:#fff;border:2px solid #E5E7EB;border-radius:18px;padding:24px 20px;text-align:center;cursor:pointer;margin-bottom:16px;width:100%;max-width:320px;text-decoration:none;display:block;transition:border-color 0.2s}\n' +
'.btn-card:hover{border-color:#C91F2B}\n' +
'.btn-card .icon{font-size:40px;margin-bottom:10px}\n' +
'.btn-card .title{font-size:20px;font-weight:700;color:#172033}\n' +
'.btn-card .desc{font-size:13px;color:#6B7280;margin-top:4px}\n' +
'<\/style><\/head><body>\n' +
'<div class="logo">TE CONNECT<\/div>\n' +
'<div class="subtitle">What would you like to add?<\/div>\n' +
'<a href="' + scriptUrl + '?action=page&page=slab" class="btn-card">\n' +
'  <div class="icon">&#127959;<\/div>\n' +
'  <div class="title">Add Slab<\/div>\n' +
'  <div class="desc">Submit a slab casting date<\/div>\n' +
'<\/a>\n' +
'<a href="' + scriptUrl + '?action=page&page=meeting" class="btn-card">\n' +
'  <div class="icon">&#129309;<\/div>\n' +
'  <div class="title">Add Meeting<\/div>\n' +
'  <div class="desc">Report a customer or contractor meeting<\/div>\n' +
'<\/a>\n' +
'<\/body><\/html>';
  return serveHtml(html);
}

function publicErrorPage(msg) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TE CONNECT<\/title>' +
'<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#F6F7F9;text-align:center;padding:24px}' +
'.card{background:#fff;border-radius:16px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,.08)}' +
'.title{font-size:24px;font-weight:800;color:#C91F2B;margin-bottom:12px}.msg{color:#6B7280;font-size:15px}<\/style><\/head>' +
'<body><div class="card"><div class="title">TE CONNECT<\/div><div class="msg">' + msg + '<\/div><\/div><\/body><\/html>';
}
