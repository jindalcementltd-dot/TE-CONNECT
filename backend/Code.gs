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
  return data.slice(1).map(row => {
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
      obj[h] = val;
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

  SpreadsheetApp.getUi().alert(
    'TE CONNECT Setup Complete! \u2705\n\n' +
    'All sheets created.\n\n' +
    'Default admin user:\nLogin: admin\nPassword: Admin@123\n\n' +
    'Please change the password after first login.\n\n' +
    'Next step: Deploy this script as a Web App.'
  );
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

// ── GET HANDLERS ────────────────────────────────────────────────────────
function handleGetUsers() {
  const users = sheetToObjects(getSheet(SHEETS.USERS)).map(u => {
    const { password_hash, ...safe } = u;
    return safe;
  });
  return success(users);
}

function handleGetDealers() {
  return success(sheetToObjects(getSheet(SHEETS.DEALERS)));
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

  const teFilter = params.te ? String(params.te).toLowerCase() : null;

  const todaySlabs = slabs.filter(s => {
    const dateMatch = String(s.slab_date).startsWith(today);
    if (teFilter) return dateMatch && String(s.assigned_te).toLowerCase() === teFilter;
    return dateMatch;
  });

  const todaySales = sales.filter(s => {
    const dateMatch = String(s.sale_date).startsWith(today);
    if (teFilter) return dateMatch && String(s.assigned_te).toLowerCase() === teFilter;
    return dateMatch;
  });

  const todayMeetings = meetings.filter(m => {
    const dateMatch = String(m.meeting_date).startsWith(today);
    if (teFilter) return dateMatch && String(m.te).toLowerCase() === teFilter;
    return dateMatch;
  });

  const salesBagsToday = todaySales.reduce((sum, s) => sum + (Number(s.quantity_bags) || 0), 0);

  // Active % from current month tracker
  const monthTrackers = trackers.filter(t => String(t.month).startsWith(month) && (!teFilter || String(t.te).toLowerCase() === teFilter));
  const totalPunch = monthTrackers.reduce((sum, t) => sum + (Number(t.punched_quantity_bags) || 0), 0);
  const monthSales = sales.filter(s => String(s.sale_date).startsWith(month) && (!teFilter || String(s.assigned_te).toLowerCase() === teFilter));
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
    contractorName = 'Mistri (' + mobileStr + ')';
  } else if (contractorName && mobileStr && !contractorName.includes(mobileStr)) {
    contractorName += ' (' + mobileStr + ')';
  }

  let finalRemark = data.remark || '';
  if (mobileStr && !finalRemark.includes(mobileStr)) {
    finalRemark = 'Mobile: ' + mobileStr + (finalRemark ? ' | ' + finalRemark : '');
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
      case 'getDealers': return handleGetDealers();
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
      default:
        return error('Unknown action: ' + action);
    }
  } catch (err) {
    return error('Server error: ' + err.message);
  }
}

// ── PUBLIC HTML PAGES ─────────────────────────────────────────────────
// These serve simple HTML forms for public submissions.

function serveHtml(html) {
  return HtmlService.createHtmlOutput(html)
    .setTitle('TE CONNECT')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function handlePublicPageSlab(params) {
  const { dealer_id, token } = params;
  let dealerName = 'अधिकृत डीलर काउंटर';
  let dealerArea = 'Jajpur Territory';
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
'<html lang="hi">' +
'<head>' +
'<meta charset="UTF-8">' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">' +
'<title>TE CONNECT - स्लैब ढलाई बुकिंग</title>' +
'<style>' +
'*{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif}' +
'body{background:#F3F4F6;color:#1F2937;min-height:100vh;padding:14px}' +
'.header{text-align:center;padding:16px 10px 14px;background:#fff;border-radius:16px;margin-bottom:14px;border:1px solid #E5E7EB}' +
'.logo{font-size:22px;font-weight:900;letter-spacing:1px;color:#111827}' +
'.logo span{color:#C91F2B}' +
'.subtitle{font-size:14px;font-weight:700;color:#374151;margin-top:4px}' +
'.sub-desc{font-size:12px;color:#6B7280;margin-top:2px}' +
'.dealer-card{background:#fff;border:1.5px solid #DCFCE7;border-radius:16px;padding:16px;margin-bottom:14px;box-shadow:0 2px 8px rgba(22,163,74,0.08)}' +
'.verified{display:inline-flex;align-items:center;gap:4px;background:#DCFCE7;color:#15803D;font-size:11px;font-weight:800;padding:4px 8px;border-radius:6px;text-transform:uppercase;margin-bottom:8px}' +
'.dealer-name{font-size:20px;font-weight:800;color:#111827}' +
'.dealer-area{font-size:13px;color:#4B5563;margin-top:4px}' +
'.card{background:#fff;border-radius:16px;padding:16px;margin-bottom:14px;border:1px solid #E5E7EB}' +
'.card-highlight{border:2px solid #C91F2B;background:#fff}' +
'.step-title{display:flex;align-items:center;gap:10px;margin-bottom:12px}' +
'.step-num{width:26px;height:26px;background:#C91F2B;color:#fff;border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800}' +
'.step-num-gray{background:#E5E7EB;color:#374151}' +
'.step-text{font-size:15px;font-weight:800;color:#111827}' +
'.step-text span{color:#DC2626;font-size:12px}' +
'.phone-box{display:flex;align-items:center;border:2px solid #C91F2B;border-radius:12px;background:#FEF2F2;overflow:hidden}' +
'.code{background:#FDE8EA;color:#991B1B;font-weight:800;padding:14px 12px;font-size:15px;border-right:1.5px solid #FCA5A5}' +
'.phone-input{flex:1;border:none;background:transparent;padding:14px;font-size:18px;font-weight:800;color:#111827;outline:none}' +
'.hint{font-size:11px;color:#6B7280;margin-top:8px}' +
'.chips{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}' +
'.chip{border:1.5px solid #E5E7EB;border-radius:10px;background:#F9FAFB;padding:10px 4px;text-align:center;cursor:pointer}' +
'.chip.active{border-color:#C91F2B;background:#FDE8EA;color:#C91F2B}' +
'.chip-val{font-size:16px;font-weight:800;display:block}' +
'.chip-lbl{font-size:10px;font-weight:600;color:#6B7280}' +
'.chip.active .chip-lbl{color:#C91F2B}' +
'.custom-row{display:flex;align-items:center;gap:8px;padding-top:10px;border-top:1px solid #F3F4F6}' +
'.custom-input{width:90px;border:1.5px solid #D1D5DB;border-radius:8px;padding:8px 10px;font-size:15px;font-weight:700;text-align:center;outline:none}' +
'.date-chips{display:flex;gap:8px;margin-bottom:8px}' +
'.date-chip{flex:1;border:1.5px solid #E5E7EB;border-radius:10px;background:#F9FAFB;padding:10px 6px;text-align:center;cursor:pointer}' +
'.date-chip.active{border-color:#C91F2B;background:#FDE8EA;color:#C91F2B}' +
'.date-chip .lbl{font-size:13px;font-weight:700;display:block}' +
'.date-chip .sub{font-size:11px;color:#6B7280;margin-top:2px}' +
'.date-chip.active .sub{color:#C91F2B}' +
'.input-group{margin-bottom:12px}' +
'.input-label{display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px}' +
'.text-input{width:100%;border:1.5px solid #E5E7EB;border-radius:10px;padding:12px 14px;font-size:15px;outline:none;background:#fff}' +
'.gps-btn{width:100%;border:1.5px solid #C91F2B;background:#FEF2F2;color:#C91F2B;border-radius:10px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px}' +
'.gps-btn.saved{border-color:#16A34A;background:#DCFCE7;color:#16A34A}' +
'.btn-submit{width:100%;background:#C91F2B;color:#fff;border:none;border-radius:14px;padding:16px;cursor:pointer;margin-top:8px}' +
'.btn-submit .t1{font-size:18px;font-weight:900;display:block}' +
'.btn-submit .t2{font-size:12px;color:rgba(255,255,255,0.85);margin-top:2px;display:block}' +
'.success-box{background:#fff;border:2px solid #16A34A;border-radius:16px;padding:24px 18px;text-align:center;display:none}' +
'.success-icon{width:70px;height:70px;background:#DCFCE7;color:#15803D;border-radius:35px;display:inline-flex;align-items:center;justify-content:center;font-size:36px;margin-bottom:14px}' +
'.success-h{font-size:22px;font-weight:900;color:#15803D;margin-bottom:8px}' +
'.success-p{font-size:14px;color:#4B5563;line-height:1.5;margin-bottom:16px}' +
'.summary-card{background:#F9FAFB;border-radius:12px;padding:14px;text-align:left;font-size:13px;margin-bottom:16px}' +
'.summary-row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #E5E7EB}' +
'.summary-row:last-child{border:none}' +
'.summary-val{font-weight:700;color:#111827}' +
'.btn-again{background:#16A34A;color:#fff;border:none;border-radius:10px;padding:14px 20px;font-size:15px;font-weight:700;cursor:pointer;width:100%}' +
'</style>' +
'</head>' +
'<body>' +
'<div class="header">' +
'  <div class="logo">TE <span>CONNECT</span></div>' +
'  <div class="subtitle">स्लैब ढलाई बुकिंग (Slab Booking)</div>' +
'  <div class="sub-desc">आसान और तेज़ स्लैब बुकिंग सेवा</div>' +
'</div>' +
'<div class="dealer-card">' +
'  <div class="verified">✓ अधिकृत काउंटर (Authorized Dealer)</div>' +
'  <div class="dealer-name">' + dealerName + '</div>' +
'  <div class="dealer-area">📍 ' + dealerArea + '</div>' +
'</div>' +
'<div id="successBox" class="success-box">' +
'  <div class="success-icon">✓</div>' +
'  <div class="success-h">स्लैब ढलाई दर्ज हो गई! 🎉</div>' +
'  <div class="success-p">धन्यवाद! आपकी ढलाई की जानकारी हमारे टेक्निकल इंजीनियर (TE) के पास पहुँच गई है।</div>' +
'  <div class="summary-card" id="summaryCard"></div>' +
'  <button class="btn-again" onclick="resetForm()">+ एक और स्लैब जोड़ें (Add Another)</button>' +
'</div>' +
'<form id="slabForm">' +
'  <div class="card card-highlight">' +
'    <div class="step-title">' +
'      <div class="step-num">1</div>' +
'      <div class="step-text">मिस्त्री / ठेकेदार का मोबाइल नंबर <span>* (जरूरी)</span></div>' +
'    </div>' +
'    <div class="phone-box">' +
'      <div class="code">🇮🇳 +91</div>' +
'      <input type="tel" id="mobile" class="phone-input" placeholder="10 अंकों का नंबर" maxlength="10" required autofocus>' +
'    </div>' +
'    <div class="hint">ℹ️ हमारी टेक्निकल टीम (TE) स्लैब सहायता के लिए इस नंबर पर संपर्क करेगी।</div>' +
'  </div>' +
'  <div class="card">' +
'    <div class="step-title">' +
'      <div class="step-num step-num-gray">2</div>' +
'      <div class="step-text">सीमेंट बैग की मात्रा (Select Bags)</div>' +
'    </div>' +
'    <div class="chips">' +
'      <div class="chip" onclick="selectBags(25, this)"><span class="chip-val">25</span><span class="chip-lbl">बैग</span></div>' +
'      <div class="chip active" onclick="selectBags(50, this)"><span class="chip-val">50</span><span class="chip-lbl">बैग</span></div>' +
'      <div class="chip" onclick="selectBags(75, this)"><span class="chip-val">75</span><span class="chip-lbl">बैग</span></div>' +
'      <div class="chip" onclick="selectBags(100, this)"><span class="chip-val">100</span><span class="chip-lbl">बैग</span></div>' +
'      <div class="chip" onclick="selectBags(150, this)"><span class="chip-val">150</span><span class="chip-lbl">बैग</span></div>' +
'      <div class="chip" onclick="selectBags(200, this)"><span class="chip-val">200</span><span class="chip-lbl">बैग</span></div>' +
'      <div class="chip" onclick="selectBags(250, this)"><span class="chip-val">250</span><span class="chip-lbl">बैग</span></div>' +
'      <div class="chip" onclick="selectBags(300, this)"><span class="chip-val">300</span><span class="chip-lbl">बैग</span></div>' +
'    </div>' +
'    <div class="custom-row">' +
'      <span style="font-size:13px;color:#4B5563;font-weight:600">या अन्य मात्रा:</span>' +
'      <input type="number" id="customBags" class="custom-input" placeholder="उदा. 80" oninput="customBagsTyped()">' +
'      <span style="font-size:13px;color:#6B7280;font-weight:600">बैग</span>' +
'    </div>' +
'  </div>' +
'  <div class="card">' +
'    <div class="step-title">' +
'      <div class="step-num step-num-gray">3</div>' +
'      <div class="step-text">ढलाई की तारीख (Slab Date)</div>' +
'    </div>' +
'    <div class="date-chips">' +
'      <div class="date-chip active" id="dChipToday" onclick="selectDate(0, this)"><span class="lbl">आज (Today)</span><span class="sub" id="subToday"></span></div>' +
'      <div class="date-chip" id="dChipTom" onclick="selectDate(1, this)"><span class="lbl">कल (Tomorrow)</span><span class="sub" id="subTom"></span></div>' +
'      <div class="date-chip" id="dChipNext" onclick="selectDate(2, this)"><span class="lbl">परसों (In 2 Days)</span><span class="sub" id="subNext"></span></div>' +
'    </div>' +
'    <input type="date" id="slab_date" style="display:none">' +
'  </div>' +
'  <div class="card">' +
'    <div class="step-title">' +
'      <div class="step-num step-num-gray">4</div>' +
'      <div class="step-text">अतिरिक्त विवरण (Optional Details)</div>' +
'    </div>' +
'    <div class="input-group">' +
'      <label class="input-label">👷 मिस्त्री का नाम (Contractor Name)</label>' +
'      <input type="text" id="contractor_name" class="text-input" placeholder="उदा. रमेश मिस्त्री">' +
'    </div>' +
'    <div class="input-group">' +
'      <label class="input-label">🏠 मकान मालिक / गांव (Site / Village)</label>' +
'      <input type="text" id="customer_name" class="text-input" placeholder="उदा. कुआखिया बाजार">' +
'    </div>' +
'    <div class="input-group">' +
'      <label class="input-label">📍 साइट लोकेशन (Current GPS Location)</label>' +
'      <button type="button" id="gpsBtn" class="gps-btn" onclick="captureGPS()">📍 अभी की लोकेशन जोड़ें (1-Tap GPS)</button>' +
'    </div>' +
'  </div>' +
'  <button type="submit" id="submitBtn" class="btn-submit">' +
'    <span class="t1">स्लैब ढलाई बुक करें 🏗️</span>' +
'    <span class="t2">Submit Slab Casting Request →</span>' +
'  </button>' +
'</form>' +
'<script>' +
'var currentBags = 50;' +
'var currentLat = "";' +
'var currentLng = "";' +
'var today = new Date();' +
'function fmtDate(d){ return d.toISOString().split("T")[0]; }' +
'function fmtDisp(d){ var m=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return d.getDate() + " " + m[d.getMonth()]; }' +
'document.getElementById("slab_date").value = fmtDate(today);' +
'document.getElementById("subToday").textContent = fmtDisp(today);' +
'var tom = new Date(today); tom.setDate(tom.getDate()+1);' +
'document.getElementById("subTom").textContent = fmtDisp(tom);' +
'var nxt = new Date(today); nxt.setDate(nxt.getDate()+2);' +
'document.getElementById("subNext").textContent = fmtDisp(nxt);' +
'function selectBags(val, el){' +
'  currentBags = val;' +
'  document.getElementById("customBags").value = "";' +
'  document.querySelectorAll(".chip").forEach(function(c){ c.classList.remove("active"); });' +
'  el.classList.add("active");' +
'}' +
'function customBagsTyped(){' +
'  var v = document.getElementById("customBags").value;' +
'  if(v){ currentBags = v; document.querySelectorAll(".chip").forEach(function(c){ c.classList.remove("active"); }); }' +
'}' +
'function selectDate(offset, el){' +
'  var d = new Date(); d.setDate(d.getDate()+offset);' +
'  document.getElementById("slab_date").value = fmtDate(d);' +
'  document.querySelectorAll(".date-chip").forEach(function(c){ c.classList.remove("active"); });' +
'  el.classList.add("active");' +
'}' +
'function captureGPS(){' +
'  if(navigator.geolocation){' +
'    navigator.geolocation.getCurrentPosition(function(pos){' +
'      currentLat = pos.coords.latitude;' +
'      currentLng = pos.coords.longitude;' +
'      var b = document.getElementById("gpsBtn");' +
'      b.classList.add("saved");' +
'      b.innerHTML = "✓ GPS सुरक्षित: " + currentLat.toFixed(4) + ", " + currentLng.toFixed(4);' +
'    }, function(err){ alert("GPS ऑन रखें या परमिशन दें।"); });' +
'  } else { alert("GPS समर्थित नहीं है।"); }' +
'}' +
'document.getElementById("slabForm").addEventListener("submit", async function(e){' +
'  e.preventDefault();' +
'  var mob = document.getElementById("mobile").value.trim().replace(/[^0-9]/g, "");' +
'  if(!mob || mob.length < 10){ alert("कृपया 10 अंकों का सही मोबाइल नंबर दर्ज करें।"); return; }' +
'  var btn = document.getElementById("submitBtn");' +
'  btn.disabled = true;' +
'  btn.innerHTML = "<span class=\'t1\'>दर्ज हो रहा है...</span>";' +
'  var cName = document.getElementById("contractor_name").value.trim() || ("मिस्त्री (" + mob + ")");' +
'  var sDate = document.getElementById("slab_date").value;' +
'  var bagsText = currentBags + " बैग";' +
'  var payload = {' +
'    action: "publicSlabSubmit",' +
'    dealer_id: "' + dealer_id + '",' +
'    token: "' + token + '",' +
'    slab_date: sDate,' +
'    contractor_name: cName,' +
'    mobile: mob,' +
'    customer_name: document.getElementById("customer_name").value.trim(),' +
'    expected_cement: bagsText,' +
'    latitude: currentLat,' +
'    longitude: currentLng,' +
'    remark: "मोबाइल: " + mob' +
'  };' +
'  try {' +
'    var res = await fetch("' + scriptUrl + '", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});' +
'    var json = await res.json();' +
'    if(json.success){' +
'      document.getElementById("slabForm").style.display = "none";' +
'      var s = "<div class=\'summary-row\'><span>डीलर:</span><span class=\'summary-val\'>" + dealerName.replace(/"/g, \'\') + "</span></div>" +' +
'              "<div class=\'summary-row\'><span>मोबाइल:</span><span class=\'summary-val\'>" + mob + "</span></div>" +' +
'              "<div class=\'summary-row\'><span>सीमेंट:</span><span class=\'summary-val\'>" + bagsText + "</span></div>" +' +
'              "<div class=\'summary-row\'><span>ढलाई तारीख:</span><span class=\'summary-val\'>" + sDate + "</span></div>";' +
'      document.getElementById("summaryCard").innerHTML = s;' +
'      document.getElementById("successBox").style.display = "block";' +
'    } else {' +
'      alert(json.message || "एरर। कृपया पुनः प्रयास करें।");' +
'      btn.disabled = false;' +
'      btn.innerHTML = "<span class=\'t1\'>स्लैब ढलाई बुक करें 🏗️</span><span class=\'t2\'>Submit Slab Casting Request →</span>";' +
'    }' +
'  } catch(err){' +
'    alert("नेटवर्क एरर। इंटरनेट चेक करें।");' +
'    btn.disabled = false;' +
'    btn.innerHTML = "<span class=\'t1\'>स्लैब ढलाई बुक करें 🏗️</span><span class=\'t2\'>Submit Slab Casting Request →</span>";' +
'  }' +
'});' +
'function resetForm(){' +
'  document.getElementById("successBox").style.display = "none";' +
'  document.getElementById("slabForm").style.display = "block";' +
'  document.getElementById("mobile").value = "";' +
'  document.getElementById("submitBtn").disabled = false;' +
'  document.getElementById("submitBtn").innerHTML = "<span class=\'t1\'>स्लैब ढलाई बुक करें 🏗️</span><span class=\'t2\'>Submit Slab Casting Request →</span>";' +
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
