
/**
 * resQ Amal Backend - Google Apps Script (v3.9)
 * Tactical Registration & Global HQ Mirroring.
 */

const MASTER_SHEET_NAME = "Master_Users_List";

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🚀 resQ Amal')
    .addItem('Sediakan Semua Sheet & Header', 'setupSystemSheets')
    .addSeparator()
    .addItem('Semak Status Backend', 'checkStatus')
    .addToUi();
}

function setupSystemSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  getOrCreateSheet(ss, "Summary_Programs", ["id", "name", "location", "date", "time", "state", "level", "status"]);
  getOrCreateSheet(ss, MASTER_SHEET_NAME, ["id", "name", "role", "state", "createdAt", "spreadsheetId", "password", "assignment"]);
  getOrCreateSheet(ss, "Kehadiran_Petugas", ["id", "name", "state", "role", "masa_lapor_diri"]);
  getOrCreateSheet(ss, "Master_Session_Logs", ["id", "userId", "userName", "role", "action", "entryTime", "exitTime", "timestamp"]);
  
  const caseHeaders = ["id", "programId", "state", "responderName", "checkpoint", "patientName", "complaint", "bp", "pr", "temp", "dxt", "treatment", "status", "timestamp", "latitude", "longitude", "remark"];
  getOrCreateSheet(ss, "Summary_Cases", caseHeaders);
  getOrCreateSheet(ss, "Data_Kes_Demo", caseHeaders);
  
  getOrCreateSheet(ss, "Summary_Attendance", ["id", "responderId", "responderName", "programName", "checkpoint", "entryTime", "exitTime", "lat", "lng", "remark"]);
  getOrCreateSheet(ss, "Senarai_Kehadiran_Demo", ["id", "responderId", "responderName", "programName", "checkpoint", "entryTime", "exitTime", "lat", "lng", "remark"]);
  
  SpreadsheetApp.getUi().alert('Pangkalan Data Berjaya Dikemaskini (v3.9: Profile Assignment Support).');
}

function handleRegistration(userData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const masterSheet = getOrCreateSheet(ss, MASTER_SHEET_NAME, ["id", "name", "role", "state", "createdAt", "spreadsheetId", "password", "assignment"]);
  
  // Use upsertRow to handle both new registrations and updates
  upsertRow(masterSheet, userData);
  
  let personalSsId = userData.spreadsheetId || "";
  const isDemo = userData.id.includes('DEMO');
  
  // Only create spreadsheet if it's a new MECC registration and doesn't have one
  if (userData.role === 'MECC' && !personalSsId) {
    const prefix = isDemo ? "DEMO_resQ_Data" : "resQ_Data";
    const fileName = `${prefix}_MECC_${userData.id}_${userData.name}`;
    try {
      const newSs = SpreadsheetApp.create(fileName);
      personalSsId = newSs.getId();
      getOrCreateSheet(newSs, "programs", ["id", "name", "location", "date", "time", "state", "level", "status"]);
      getOrCreateSheet(newSs, "cases_received", ["id", "programId", "state", "responderName", "patientName", "status", "timestamp", "remark"]);
      
      // Update the master row with the new spreadsheetId
      userData.spreadsheetId = personalSsId;
      upsertRow(masterSheet, userData);
    } catch (e) {
      console.error("Personal SS Creation Error: " + e.toString());
    }
  }

  return createResponse({ 
    status: 'success', 
    message: 'Data Petugas Berjaya Dikemaskini', 
    spreadsheetId: personalSsId 
  });
}

function handleCheckId(userId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(MASTER_SHEET_NAME);
  if (!sheet) return createResponse({ status: 'error', message: 'Master Sheet not found' });
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString().toUpperCase() === userId.toString().toUpperCase()) {
      const userObj = {};
      headers.forEach((header, index) => {
        userObj[header] = data[i][index];
      });
      return createResponse({ status: 'success', user: userObj });
    }
  }
  
  return createResponse({ status: 'error', message: 'ID tidak ditemui dalam rekod Master.' });
}

function handleGetProgramsByState(state) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Summary_Programs");
  if (!sheet) return createResponse({ status: 'success', programs: [] });

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const programs = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[5].toString().toUpperCase() === state.toUpperCase()) {
      const progObj = {};
      headers.forEach((header, index) => {
        progObj[header] = row[index];
      });
      programs.push(progObj);
    }
  }

  return createResponse({ status: 'success', programs: programs });
}

function handleSync(syncItems, targetSsId) {
  if (targetSsId) {
    try {
      const ss = SpreadsheetApp.openById(targetSsId);
      const items = Array.isArray(syncItems) ? syncItems : [syncItems];
      items.forEach(item => {
        if (item.type !== 'sessions') {
          const sheet = getOrCreateSheet(ss, item.type, Object.keys(item.payload));
          upsertRow(sheet, item.payload);
        }
      });
    } catch (err) {
      console.error("Personal Sync Error: " + err.toString());
    }
  }

  try {
    const items = Array.isArray(syncItems) ? syncItems : [syncItems];
    items.forEach(item => {
      syncToMaster(item);
    });
    return createResponse({ status: 'success' });
  } catch (err) {
    return createResponse({ status: 'error', message: err.toString() });
  }
}

function syncToMaster(item) {
  const masterSs = SpreadsheetApp.getActiveSpreadsheet();
  let sheetName = "";
  const isDemo = item.payload.remark === 'DEMO';
  
  if (item.type === 'cases') sheetName = isDemo ? "Data_Kes_Demo" : "Summary_Cases";
  else if (item.type === 'programs') sheetName = "Summary_Programs";
  else if (item.type === 'attendance') sheetName = isDemo ? "Senarai_Kehadiran_Demo" : "Summary_Attendance";
  else if (item.type === 'sessions') sheetName = "Master_Session_Logs";
  
  if (sheetName) {
    const headers = item.type === 'sessions' 
      ? ["id", "userId", "userName", "role", "action", "entryTime", "exitTime", "timestamp"]
      : Object.keys(item.payload);
    const sheet = getOrCreateSheet(masterSs, sheetName, headers);
    upsertRow(sheet, item.payload);
  }
}

function upsertRow(sheet, payload) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  let updated = false;
  
  if (payload.id) {
    for (let i = 1; i < data.length; i++) {
      if (data[i][0].toString() === payload.id.toString()) {
        const values = headers.map((h, idx) => {
          if (payload[h] !== undefined) return payload[h];
          return data[i][idx];
        });
        sheet.getRange(i + 1, 1, 1, values.length).setValues([values]);
        updated = true;
        break;
      }
    }
  }
  
  if (!updated) {
    const values = headers.map(h => payload[h] !== undefined ? payload[h] : "");
    sheet.appendRow(values);
  }
}

function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length)
         .setValues([headers])
         .setFontWeight("bold")
         .setBackground("#f8fafc")
         .setFontColor("#0f172a");
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  }
  return sheet;
}

function createResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;
    const data = requestData.data;
    const id = requestData.id;
    const state = requestData.state;
    
    switch (action) {
      case 'register':
        return handleRegistration(data);
      case 'check_id':
        return handleCheckId(id);
      case 'get_programs_by_state':
        return handleGetProgramsByState(state);
      case 'sync':
        return handleSync(data, requestData.spreadsheetId);
      case 'test_connection':
        return createResponse({ status: 'success' });
      default:
        return createResponse({ status: 'error', message: 'Unknown Action' });
    }
  } catch (err) {
    return createResponse({ status: 'error', message: err.toString() });
  }
}

function checkStatus() {
  SpreadsheetApp.getUi().alert('Backend resQ Amal v3.9 Tactical Active.');
}
