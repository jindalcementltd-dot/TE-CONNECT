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
  DEALERS: ['dealer_id','dealer_name','owner_name','phone','address','area','latitude','longitude','assigned_te','active','qr_id','qr_token','public_slab_link','created_at'],
  CONTRACTORS: ['contractor_id','contractor_name','mobile','area','assigned_te','active','created_at'],
  SLABS: ['slab_id','slab_date','dealer_id','dealer_name','contractor_name','customer_name','expected_cement','latitude','longitude','assigned_te','status','remark','source','created_by','created_at','updated_at'],
  SALES: ['sale_id','sale_date','dealer_id','dealer_name','product','quantity_bags','assigned_te','source','created_by','created_at','updated_at'],
  ACTIVE_TRACKER: ['tracker_id','date','month','te','total_contractors','active_contractors','inactive_contractors','punched_quantity_bags','updated_by','updated_at'],
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
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
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
  const user = users.find(u => String(u.login_id).trim().toLowerCase() === String(login_id).trim().toLowerCase());

  if (!user) return error('Invalid login ID or password.');
  if (!user.active || String(user.active).toLowerCase() === 'false') return error('Your account is inactive. Please contact your manager.');
  if (String(user.password_hash).trim().toLowerCase() !== String(password).trim().toLowerCase()) return error('Invalid login ID or password.');

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
    active: user.active,
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
  const sheet = getSheet(SHEETS.DEALERS);
  const dealers = sheetToObjects(sheet);
  const dealer = dealers.find(d => String(d.dealer_id) === String(dealer_id) && String(d.qr_token) === String(token));
  if (!dealer) return error('Invalid dealer link.');
  // Only return public-safe info
  return success({
    dealer_id: dealer.dealer_id,
    dealer_name: dealer.dealer_name,
    area: dealer.area,
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

function handleAddPunch(data) {
  if (!data.date || !data.te || !data.punch_quantity_bags) return error('Date, TE, and punch quantity are required.');

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
    const newPunch = (Number(existing.punched_quantity_bags) || 0) + Number(data.punch_quantity_bags);
    const updates = {
      punched_quantity_bags: newPunch,
      updated_by: data.updated_by || data.te,
      updated_at: now,
    };
    updateRowById(SHEETS.ACTIVE_TRACKER, 'tracker_id', existing.tracker_id, updates, HEADERS.ACTIVE_TRACKER);
    logActivity(data.updated_by, data.updated_by, 'ADD_PUNCH', 'ACTIVE_TRACKER', existing.tracker_id, 'Added ' + data.punch_quantity_bags + ' bags punch for ' + data.te);
    return success({ ...existing, ...updates }, 'Punch recorded.');
  } else {
    const tracker_id = generateId('TRK');
    const trackerObj = {
      tracker_id,
      date: data.date,
      month,
      te: data.te,
      total_contractors: data.total_contractors || 0,
      active_contractors: data.active_contractors || 0,
      inactive_contractors: 0,
      punched_quantity_bags: Number(data.punch_quantity_bags),
      updated_by: data.updated_by || data.te,
      updated_at: now,
    };
    appendRow(SHEETS.ACTIVE_TRACKER, trackerObj, HEADERS.ACTIVE_TRACKER);
    logActivity(data.updated_by, data.updated_by, 'ADD_PUNCH', 'ACTIVE_TRACKER', tracker_id, 'Added ' + data.punch_quantity_bags + ' bags punch for ' + data.te);
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
  // Validate dealer token
  if (!data.dealer_id || !data.token) return error('Invalid link.');

  const dealers = sheetToObjects(getSheet(SHEETS.DEALERS));
  const dealer = dealers.find(d => String(d.dealer_id) === String(data.dealer_id) && String(d.qr_token) === String(data.token));
  if (!dealer) return error('Invalid or expired dealer link.');
  if (!data.slab_date) return error('Slab date is required.');

  const slab_id = generateId('SLB');
  const now = new Date().toISOString();
  const slabObj = {
    slab_id,
    slab_date: data.slab_date,
    dealer_id: dealer.dealer_id,
    dealer_name: dealer.dealer_name,
    contractor_name: data.contractor_name || '',
    customer_name: data.customer_name || '',
    expected_cement: data.expected_cement || '',
    latitude: data.latitude || '',
    longitude: data.longitude || '',
    assigned_te: dealer.assigned_te || '',
    status: 'UPCOMING',
    remark: data.remark || '',
    source: 'DEALER_QR',
    created_by: 'DEALER_QR:' + dealer.dealer_name,
    created_at: now,
    updated_at: now,
  };
  appendRow(SHEETS.SLABS, slabObj, HEADERS.SLABS);
  logActivity('', dealer.dealer_name, 'PUBLIC_SLAB_SUBMIT', 'SLABS', slab_id, 'Dealer QR submission');
  return success(null, 'Slab submitted successfully! Your team will be notified.');
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
  const dealer = dealers.find(d => String(d.dealer_id) === String(data.dealer_id));
  if (!dealer) return error('Dealer not found.');

  const token = generateToken();
  const settings = sheetToObjects(getSheet(SHEETS.SETTINGS));
  const publicUrl = getSettingValue(settings, 'public_url') || '';
  const publicSlabLink = publicUrl
    ? publicUrl + '?page=slab&dealer_id=' + dealer.dealer_id + '&token=' + token
    : 'PENDING_URL?page=slab&dealer_id=' + dealer.dealer_id + '&token=' + token;

  updateRowById(SHEETS.DEALERS, 'dealer_id', data.dealer_id, {
    qr_token: token,
    public_slab_link: publicSlabLink,
  }, HEADERS.DEALERS);

  return success({ token, public_slab_link: publicSlabLink }, 'QR generated.');
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
      case 'createMeeting': return handleCreateMeeting(data);
      case 'updateMeeting': return handleUpdateMeeting(data);
      case 'addPunch': return handleAddPunch(data);
      case 'updateContractorActivity': return handleUpdateContractorActivity(data);
      case 'addContractor': return handleAddContractor(data);
      case 'addDealer': return handleAddDealer(data);
      case 'publicSlabSubmit': return handlePublicSlabSubmit(data);
      case 'publicMeetingSubmit': return handlePublicMeetingSubmit(data);
      case 'generateDealerQR': return handleGenerateDealerQR(data);
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
  let dealerName = 'Your Store';

  if (dealer_id && token) {
    try {
      const dealers = sheetToObjects(getSheet(SHEETS.DEALERS));
      const dealer = dealers.find(d => String(d.dealer_id) === String(dealer_id) && String(d.qr_token) === String(token));
      if (dealer) dealerName = dealer.dealer_name;
      else return serveHtml(publicErrorPage('Invalid or expired dealer link. Please contact your TE.'));
    } catch (e) {}
  }

  const scriptUrl = ScriptApp.getService().getUrl();
  const html = '<!DOCTYPE html>\n' +
'<html lang="en">\n' +
'<head>\n' +
'<meta charset="UTF-8">\n' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">\n' +
'<title>TE CONNECT - Add Slab</title>\n' +
'<style>\n' +
'*{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif}\n' +
'body{background:#F6F7F9;min-height:100vh;padding:20px 16px 40px}\n' +
'.header{text-align:center;margin-bottom:24px}\n' +
'.logo{font-size:22px;font-weight:800;color:#C91F2B;letter-spacing:1px}\n' +
'.subtitle{font-size:13px;color:#6B7280;margin-top:4px}\n' +
'.card{background:#fff;border-radius:16px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.08)}\n' +
'.dealer-badge{background:#FDE8EA;border-radius:10px;padding:10px 14px;margin-bottom:20px;text-align:center}\n' +
'.dealer-badge .label{font-size:12px;color:#6B7280;font-weight:500}\n' +
'.dealer-badge .name{font-size:18px;font-weight:700;color:#C91F2B;margin-top:2px}\n' +
'.form-group{margin-bottom:16px}\n' +
'label{display:block;font-size:13px;font-weight:600;color:#172033;margin-bottom:6px}\n' +
'input,select,textarea{width:100%;border:1.5px solid #E5E7EB;border-radius:10px;padding:12px 14px;font-size:15px;color:#172033;background:#fff;outline:none;transition:border-color 0.2s}\n' +
'input:focus,select:focus,textarea:focus{border-color:#C91F2B}\n' +
'.optional{color:#9CA3AF;font-weight:400;font-size:11px;margin-left:4px}\n' +
'.btn{width:100%;background:#C91F2B;color:#fff;border:none;border-radius:12px;padding:16px;font-size:17px;font-weight:700;cursor:pointer;margin-top:8px;letter-spacing:0.3px}\n' +
'.btn:active{background:#A91420}\n' +
'.success{background:#DCFCE7;border:1.5px solid #16A34A;border-radius:12px;padding:16px;text-align:center;color:#166534;font-weight:600;display:none}\n' +
'.error-msg{background:#FEE2E2;border:1.5px solid #DC2626;border-radius:12px;padding:12px;text-align:center;color:#991B1B;font-size:14px;display:none;margin-top:8px}\n' +
'<\/style>\n' +
'<\/head>\n' +
'<body>\n' +
'<div class="header">\n' +
'  <div class="logo">TE CONNECT</div>\n' +
'  <div class="subtitle">Slab Casting Request</div>\n' +
'<\/div>\n' +
'<div class="card">\n' +
'  <div class="dealer-badge">\n' +
'    <div class="label">Dealer<\/div>\n' +
'    <div class="name">' + dealerName + '<\/div>\n' +
'  <\/div>\n' +
'  <div id="successMsg" class="success">Slab submitted successfully!<br>Your team will be notified.<\/div>\n' +
'  <div id="errorMsg" class="error-msg"><\/div>\n' +
'  <form id="slabForm">\n' +
'    <div class="form-group"><label>Slab Date *<\/label><input type="date" id="slab_date" required><\/div>\n' +
'    <div class="form-group"><label>Contractor Name<\/label><input type="text" id="contractor_name" placeholder="Contractor name"><\/div>\n' +
'    <div class="form-group"><label>Customer / Site <span class="optional">(Optional)<\/span><\/label><input type="text" id="customer_name" placeholder="Customer or site name"><\/div>\n' +
'    <div class="form-group"><label>Expected Cement<\/label><input type="text" id="expected_cement" placeholder="e.g. 50 bags"><\/div>\n' +
'    <div class="form-group"><label>Remark <span class="optional">(Optional)<\/span><\/label><textarea id="remark" rows="2" placeholder="Any notes..."><\/textarea><\/div>\n' +
'    <button type="submit" class="btn" id="submitBtn">Submit Slab<\/button>\n' +
'  <\/form>\n' +
'<\/div>\n' +
'<script>\n' +
'document.getElementById(\'slabForm\').addEventListener(\'submit\', async function(e) {\n' +
'  e.preventDefault();\n' +
'  const btn = document.getElementById(\'submitBtn\');\n' +
'  btn.textContent = \'Submitting...\';\n' +
'  btn.disabled = true;\n' +
'  document.getElementById(\'errorMsg\').style.display = \'none\';\n' +
'  const payload = {\n' +
'    action: \'publicSlabSubmit\',\n' +
'    dealer_id: \'' + dealer_id + '\',\n' +
'    token: \'' + token + '\',\n' +
'    slab_date: document.getElementById(\'slab_date\').value,\n' +
'    contractor_name: document.getElementById(\'contractor_name\').value,\n' +
'    customer_name: document.getElementById(\'customer_name\').value,\n' +
'    expected_cement: document.getElementById(\'expected_cement\').value,\n' +
'    remark: document.getElementById(\'remark\').value,\n' +
'  };\n' +
'  try {\n' +
'    const res = await fetch(\'' + scriptUrl + '\', {method:\'POST\',headers:{\'Content-Type\':\'application/json\'},body:JSON.stringify(payload)});\n' +
'    const json = await res.json();\n' +
'    if(json.success){document.getElementById(\'slabForm\').style.display=\'none\';document.getElementById(\'successMsg\').style.display=\'block\';}\n' +
'    else{document.getElementById(\'errorMsg\').textContent=json.message||\'Error\';document.getElementById(\'errorMsg\').style.display=\'block\';btn.textContent=\'Submit Slab\';btn.disabled=false;}\n' +
'  }catch(err){document.getElementById(\'errorMsg\').textContent=\'Network error. Try again.\';document.getElementById(\'errorMsg\').style.display=\'block\';btn.textContent=\'Submit Slab\';btn.disabled=false;}\n' +
'});\n' +
'document.getElementById(\'slab_date\').value=new Date().toISOString().split(\'T\')[0];\n' +
'<\/script>\n' +
'<\/body><\/html>';
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
