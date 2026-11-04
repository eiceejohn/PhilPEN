/* PhilPEN local database. Native IndexedDB; works without a build step. */
(function () {
  'use strict';

  const DB_NAME = 'PhilPEN-Offline';
  const DB_VERSION = 1;
  const STORES = ['patients', 'assessments', 'equipment', 'settings', 'audit'];
  const MEDICATIONS = ['amlodipine5', 'amlodipine10', 'losartan50', 'losartan100', 'simvastatin', 'atorvastatin', 'hydrochlorothiazide', 'metformin', 'gliclazide', 'insulinR', 'insulinNPH', 'insulin7030'];
  const LIMITS = { patients: 50000, assessments: 250000, equipment: 10000, settings: 1, audit: 500000 };
  const SOURCES = ['', 'facility', 'out-of-pocket', 'both'];
  let connection = null;
  let opening = null;

  function fail(message) {
    const error = new Error(message);
    error.name = 'ValidationError';
    throw error;
  }

  function object(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(label + ' must be an object.');
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) fail(label + ' must be a plain object.');
    return value;
  }

  function text(value, label, max, required) {
    if (value === undefined || value === null) value = '';
    if (typeof value !== 'string') fail(label + ' must be text.');
    value = value.trim();
    if (required && !value) fail(label + ' is required.');
    if (value.length > (max || 200)) fail(label + ' is too long.');
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) fail(label + ' contains unsupported control characters.');
    return value;
  }

  function identifier(value, label) {
    value = text(value, label || 'Record ID', 160, true);
    if (['__proto__', 'prototype', 'constructor'].includes(value)) fail('Invalid record ID.');
    return value;
  }

  function number(value, label, min, max, integer, fallback) {
    if (value === undefined && fallback !== undefined) value = fallback;
    if (typeof value !== 'number' || !Number.isFinite(value) || (integer && !Number.isInteger(value)) || value < min || value > max) {
      fail(label + ' must be ' + (integer ? 'a whole number' : 'a number') + ' from ' + min + ' to ' + max + '.');
    }
    return value;
  }

  function optionalNumber(value, label, min, max) {
    return value === '' || value === undefined || value === null ? null : number(value, label, min, max, false);
  }

  function bool(value, label) {
    if (value === undefined) return false;
    if (typeof value !== 'boolean') fail(label + ' must be true or false.');
    return value;
  }

  function choice(value, label, choices, fallback) {
    if (value === undefined || value === null) value = fallback;
    if (!choices.includes(value)) fail(label + ' has an unsupported value.');
    return value;
  }

  function date(value, label, required) {
    if (!required && (value === undefined || value === null || value === '')) return '';
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(label + ' must use YYYY-MM-DD.');
    const parsed = new Date(value + 'T00:00:00.000Z');
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value || value < '1900-01-01' || value > '2200-12-31') fail(label + ' is not a valid date.');
    return value;
  }

  function timestamp(value, label, fallback) {
    if (value === undefined || value === '') value = fallback;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) || !Number.isFinite(Date.parse(value))) fail(label + ' must be a UTC ISO timestamp.');
    if (new Date(value).toISOString().slice(0, 10) !== value.slice(0, 10)) fail(label + ' is not a valid timestamp.');
    return value;
  }

  function createId(prefix) {
    const random = globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    return (prefix ? prefix + '-' : '') + random;
  }

  function checkStore(store, write) {
    if (!STORES.includes(store)) fail('Unknown database table: ' + store + '.');
    if (write && store === 'audit') fail('Activity history is managed automatically.');
  }

  function normalize(store, input, options) {
    checkStore(store, false);
    object(input, store + ' record');
    options = options || {};
    const now = new Date().toISOString();
    const missingId = input.id === undefined || input.id === null || input.id === '';
    const id = identifier(missingId && options.allowId ? createId(store.slice(0, 3)) : input.id);
    let row;
    if (store === 'patients') {
      row = {
        id: id,
        firstName: text(input.firstName, 'First name', 100, true),
        lastName: text(input.lastName, 'Last name', 100, true),
        middleName: text(input.middleName, 'Middle name', 100),
        suffix: text(input.suffix, 'Suffix', 30),
        sex: choice(input.sex, 'Sex', ['M', 'F']),
        dob: date(input.dob, 'Date of birth', false),
        barangay: text(input.barangay, 'Barangay', 160),
        address: text(input.address, 'Address', 500),
        philhealth: text(input.philhealth, 'PhilHealth number', 60),
        phone: text(input.phone, 'Phone', 60),
        createdAt: timestamp(input.createdAt, 'Created date', now),
        updatedAt: timestamp(input.updatedAt, 'Updated date', now)
      };
      if (row.dob && row.dob > now.slice(0, 10)) fail('Date of birth cannot be in the future.');
    } else if (store === 'assessments') {
      const medications = input.medications === undefined ? {} : object(input.medications, 'Medications');
      for (const key of Object.keys(medications)) if (!MEDICATIONS.includes(key)) fail('Unknown medication: ' + key + '.');
      const normalizedMeds = {};
      for (const key of MEDICATIONS) normalizedMeds[key] = number(medications[key], key + ' frequency', 0, 3, true, 0);
      row = {
        id: id,
        patientId: identifier(input.patientId, 'Patient ID'),
        date: date(input.date, 'Assessment date', true),
        datePrecision: choice(input.datePrecision, 'Date precision', ['day', 'month'], 'day'),
        age: number(input.age, 'Age', 20, 120, true),
        riskAssessed: input.riskAssessed === undefined ? true : bool(input.riskAssessed, 'Risk assessed'),
        htnMedicationProvided: input.htnMedicationProvided == null ? null : bool(input.htnMedicationProvided, 'Antihypertensive medication provided'),
        dmMedicationProvided: input.dmMedicationProvided == null ? null : bool(input.dmMedicationProvided, 'Antidiabetic medication provided'),
        smoker: bool(input.smoker, 'Smoking status'),
        bingeDrinker: bool(input.bingeDrinker, 'Binge drinking status'),
        inactive: bool(input.inactive, 'Physical inactivity'),
        unhealthyDiet: bool(input.unhealthyDiet, 'Unhealthy diet'),
        weightKg: optionalNumber(input.weightKg, 'Weight in kilograms', 10, 500),
        heightM: optionalNumber(input.heightM, 'Height in metres', 0.5, 2.75),
        bmiClass: choice(input.bmiClass, 'BMI classification', ['', 'underweight', 'normal', 'overweight', 'obese'], ''),
        hypertension: bool(input.hypertension, 'Hypertension'),
        diabetes: bool(input.diabetes, 'Diabetes'),
        htnSource: choice(input.htnSource, 'Hypertension medicine source', SOURCES, ''),
        dmSource: choice(input.dmSource, 'Diabetes medicine source', SOURCES, ''),
        medications: normalizedMeds,
        remarks: text(input.remarks, 'Remarks', 5000),
        nextVisit: date(input.nextVisit, 'Next visit', false)
      };
      for (const [condition, provided, source] of [['hypertension','htnMedicationProvided','htnSource'],['diabetes','dmMedicationProvided','dmSource']]) {
        if(row[provided] === true && !row[condition]) fail('Select '+condition+' before marking medication provided.');
        if(row[provided] === false && row[source]) fail('Medication source must be blank when medication was not provided.');
      }
      if (row.nextVisit && row.nextVisit < row.date) fail('Next visit cannot be earlier than the assessment date.');
    } else if (store === 'equipment') {
      row = {
        id: id,
        manualBP: number(input.manualBP, 'Manual BP apparatus count', 0, 1000000000, true, 0),
        automaticBP: number(input.automaticBP, 'Automatic BP apparatus count', 0, 1000000000, true, 0),
        glucometers: number(input.glucometers, 'Glucometer count', 0, 1000000000, true, 0),
        testStrips: number(input.testStrips, 'Test strip count', 0, 1000000000, true, 0),
        updatedAt: timestamp(input.updatedAt, 'Updated date', now)
      };
    } else if (store === 'settings') {
      if (id !== 'main') fail('Settings must use the ID main.');
      row = {
        id: 'main',
        province: text(input.province, 'Province', 160),
        lgu: text(input.lgu, 'LGU', 160),
        facility: text(input.facility, 'Facility', 200),
        address: text(input.address, 'Facility address', 500),
        eligiblePopulation: number(input.eligiblePopulation, 'Eligible population', 0, 1000000000, true, 0),
        targetRate: number(input.targetRate, 'Target rate', 0, 1, false, 0.4),
        contactName: text(input.contactName, 'Contact name', 160),
        contactPhone: text(input.contactPhone, 'Contact phone', 60),
        viber: text(input.viber, 'Viber number', 60),
        email: text(input.email, 'Email', 254)
      };
      if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) fail('Enter a valid email address.');
    } else {
      row = {
        id: id,
        at: timestamp(input.at, 'Activity timestamp', now),
        action: text(input.action, 'Activity action', 80, true),
        store: choice(input.store, 'Activity table', STORES.concat(['database'])),
        recordId: text(input.recordId, 'Activity record ID', 160),
        detail: text(input.detail, 'Activity details', 1000)
      };
    }
    return row;
  }

  function contextualError(error, action) {
    if (error && error.name === 'ValidationError') return error;
    const name = error && error.name || 'DatabaseError';
    let hint = error && error.message || 'The browser could not complete the database operation.';
    if (name === 'QuotaExceededError') hint = 'Browser storage is full. Export a backup and free disk space, then try again. Nothing from this operation was saved.';
    if (name === 'SecurityError' || name === 'NotAllowedError') hint = 'This browser blocked local database access. Open index.html in a regular Chrome or Edge window with local storage enabled.';
    if (name === 'InvalidStateError') hint = 'The database connection was closed. Reload the page and try again.';
    const result = new Error(action + ': ' + hint);
    result.name = name;
    return result;
  }

  function activity(action, store, id, detail) {
    return { id: createId('log'), at: new Date().toISOString(), action: action, store: store, recordId: id || '', detail: detail || '' };
  }

  function transact(stores, mode, label, task) {
    return new Promise(function (resolve, reject) {
      if (!connection) { reject(new Error('Database is not ready. Reload the page and initialize PhilPEN first.')); return; }
      let tx;
      try { tx = connection.transaction(stores, mode); }
      catch (error) { reject(contextualError(error, label)); return; }
      let value;
      let problem;
      tx.oncomplete = function () { resolve(value); };
      tx.onabort = function () { reject(contextualError(problem || tx.error, label)); };
      tx.onerror = function (event) { if (!problem) problem = event.target.error; };
      const context = {
        table: function (name) { return tx.objectStore(name); },
        result: function (result) { value = result; },
        stop: function (error) {
          problem = error;
          try { tx.abort(); } catch (_) { reject(contextualError(error, label)); }
        },
        request: function (request, callback) {
          request.onsuccess = function () {
            try { callback(request.result); } catch (error) { context.stop(error); }
          };
          return request;
        }
      };
      try { task(context); } catch (error) { context.stop(error); }
    });
  }

  function openDatabase() {
    return new Promise(function (resolve, reject) {
      if (!globalThis.indexedDB) { reject(new Error('IndexedDB is unavailable in this browser. Open index.html in a regular Chrome or Edge window.')); return; }
      let abandoned = false;
      let request;
      try { request = indexedDB.open(DB_NAME, DB_VERSION); }
      catch (error) { reject(contextualError(error, 'Open database')); return; }
      request.onupgradeneeded = function () {
        const db = request.result;
        for (const name of STORES) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
        }
        const assessments = request.transaction.objectStore('assessments');
        if (!assessments.indexNames.contains('patientId')) assessments.createIndex('patientId', 'patientId', { unique: false });
        if (!assessments.indexNames.contains('date')) assessments.createIndex('date', 'date', { unique: false });
        const patients = request.transaction.objectStore('patients');
        if (!patients.indexNames.contains('barangay')) patients.createIndex('barangay', 'barangay', { unique: false });
        const audit = request.transaction.objectStore('audit');
        if (!audit.indexNames.contains('at')) audit.createIndex('at', 'at', { unique: false });
      };
      request.onerror = function () { reject(contextualError(request.error, 'Open database')); };
      request.onblocked = function () {
        abandoned = true;
        reject(new Error('The database is blocked by another PhilPEN window. Close other PhilPEN tabs, then reload this page.'));
      };
      request.onsuccess = function () {
        if (abandoned) { request.result.close(); return; }
        const opened = request.result;
        connection = opened;
        opened.onversionchange = function () {
          opened.close();
          if (connection === opened) { connection = null; opening = null; }
        };
        opened.onclose = function () {
          if (connection === opened) { connection = null; opening = null; }
        };
        resolve();
      };
    });
  }

  async function init(seed) {
    if (opening) return opening;
    opening = (async function () {
      if (!connection) await openDatabase();
      const rawSettings = Object.assign({}, seed && seed.settings || {}, { id: 'main' });
      const defaults = normalize('settings', rawSettings);
      await transact(['settings', 'audit'], 'readwrite', 'Initialize database', function (ctx) {
        ctx.request(ctx.table('settings').get('main'), function (existing) {
          if (!existing) {
            ctx.table('settings').put(defaults);
            ctx.table('audit').put(activity('initialize', 'settings', 'main', 'Created initial facility settings.'));
          }
          ctx.result(true);
        });
      });
      return true;
    }());
    try { return await opening; }
    catch (error) { opening = null; throw error; }
  }

  async function all(store) {
    checkStore(store, false);
    return transact([store], 'readonly', 'Read ' + store, function (ctx) {
      ctx.request(ctx.table(store).getAll(), ctx.result);
    });
  }

  async function get(store, id) {
    checkStore(store, false);
    identifier(id);
    return transact([store], 'readonly', 'Read ' + store, function (ctx) {
      ctx.request(ctx.table(store).get(id), function (row) { ctx.result(row || null); });
    });
  }

  function writeRows(ctx, store, rows, label) {
    let remaining = rows.length;
    const saved = new Array(rows.length);
    if (!remaining) { ctx.result(saved); return; }
    rows.forEach(function (row, index) {
      function commit() {
        ctx.request(ctx.table(store).get(row.id), function (existing) {
          function save() {
            if (store === 'patients') {
              row.createdAt = existing ? existing.createdAt : row.createdAt;
              row.updatedAt = new Date().toISOString();
            }
            if (store === 'equipment') row.updatedAt = new Date().toISOString();
            ctx.table(store).put(row);
            ctx.table('audit').put(activity(existing ? 'update' : 'create', store, row.id, label || (existing ? 'Updated record.' : 'Created record.')));
            saved[index] = row;
            remaining -= 1;
            if (!remaining) ctx.result(saved);
          }
          if (store === 'patients' && existing && row.dob) {
            ctx.request(ctx.table('assessments').index('patientId').getAll(row.id), function (assessments) {
              if (assessments.some(function (assessment) { return assessment.date < row.dob; })) fail('Date of birth cannot be after an existing assessment.');
              save();
            });
          } else save();
        });
      }
      if (store === 'assessments') {
        ctx.request(ctx.table('patients').get(row.patientId), function (patient) {
          if (!patient) fail('The assessment references a patient that does not exist.');
          if (patient.dob && patient.dob > row.date) fail('Assessment date cannot be before the patient’s date of birth.');
          commit();
        });
      } else commit();
    });
  }

  async function put(store, input) {
    checkStore(store, true);
    const row = normalize(store, input, { allowId: store === 'patients' || store === 'assessments' });
    const rows = await transact(STORES, 'readwrite', 'Save ' + store, function (ctx) { writeRows(ctx, store, [row]); });
    return rows[0];
  }

  async function bulkPut(store, inputs) {
    checkStore(store, true);
    if (!Array.isArray(inputs) || inputs.length > LIMITS[store]) fail('Invalid number of ' + store + ' records.');
    const ids = new Set();
    const rows = inputs.map(function (input) {
      const row = normalize(store, input, { allowId: store === 'patients' || store === 'assessments' });
      if (ids.has(row.id)) fail('Duplicate record ID in the batch: ' + row.id + '.');
      ids.add(row.id);
      return row;
    });
    return transact(STORES, 'readwrite', 'Save ' + store, function (ctx) { writeRows(ctx, store, rows, 'Saved in a batch.'); });
  }

  async function remove(store, id) {
    checkStore(store, true);
    identifier(id);
    if (store === 'settings') fail('Facility settings cannot be deleted.');
    return transact(STORES, 'readwrite', 'Delete ' + store, function (ctx) {
      ctx.request(ctx.table(store).get(id), function (existing) {
        if (!existing) { ctx.result(false); return; }
        ctx.table(store).delete(id);
        if (store === 'patients') {
          const cursorRequest = ctx.table('assessments').index('patientId').openCursor(IDBKeyRange.only(id));
          let deleted = 0;
          ctx.request(cursorRequest, function (cursor) {
            if (cursor) { cursor.delete(); deleted += 1; cursor.continue(); }
            else ctx.table('audit').put(activity('delete', store, id, 'Deleted patient and ' + deleted + ' linked assessment(s).'));
          });
        } else ctx.table('audit').put(activity('delete', store, id, 'Deleted record.'));
        ctx.result(true);
      });
    });
  }

  async function snapshot() {
    return transact(STORES, 'readonly', 'Export database', function (ctx) {
      const result = { schemaVersion: 1, app: 'PhilPEN', exportedAt: new Date().toISOString(), stores: {} };
      let remaining = STORES.length;
      STORES.forEach(function (store) {
        ctx.request(ctx.table(store).getAll(), function (rows) {
          result.stores[store] = rows;
          remaining -= 1;
          if (!remaining) ctx.result(result);
        });
      });
    });
  }

  function normalizeSnapshot(input) {
    object(input, 'Backup');
    if (input.app !== 'PhilPEN' || input.schemaVersion !== 1) fail('This is not a supported PhilPEN version 1 backup.');
    timestamp(input.exportedAt, 'Backup export date');
    object(input.stores, 'Backup tables');
    for (const key of Object.keys(input.stores)) if (!STORES.includes(key)) fail('Unknown backup table: ' + key + '.');
    const normalized = {};
    for (const store of STORES) {
      const rows = input.stores[store];
      if (!Array.isArray(rows) || rows.length > LIMITS[store]) fail('Backup table ' + store + ' must be an array containing at most ' + LIMITS[store] + ' records.');
      const ids = new Set();
      normalized[store] = rows.map(function (inputRow, index) {
        let row;
        try { row = normalize(store, inputRow); }
        catch (error) { fail(store + ' row ' + (index + 1) + ': ' + error.message); }
        if (ids.has(row.id)) fail('Duplicate ID in backup table ' + store + ': ' + row.id + '.');
        ids.add(row.id);
        return row;
      });
    }
    if (normalized.settings.length !== 1) fail('Backup must contain exactly one facility settings record.');
    return normalized;
  }

  async function restore(input, options) {
    options = options || {};
    object(options, 'Restore options');
    if (options.replace !== undefined && typeof options.replace !== 'boolean') fail('Replace must be true or false.');
    const replace = options.replace === true;
    const incoming = normalizeSnapshot(input);
    return transact(STORES, 'readwrite', 'Restore backup', function (ctx) {
      function apply(existingPatients, existingAssessments) {
        const patients = new Map(existingPatients.map(function (row) { return [row.id, row]; }));
        incoming.patients.forEach(function (row) { patients.set(row.id, row); });
        const assessments = new Map(existingAssessments.map(function (row) { return [row.id, row]; }));
        incoming.assessments.forEach(function (row) { assessments.set(row.id, row); });
        for (const row of assessments.values()) {
          const patient = patients.get(row.patientId);
          if (!patient) fail('Backup assessment ' + row.id + ' references missing patient ' + row.patientId + '.');
          if (patient.dob && patient.dob > row.date) fail('Backup assessment ' + row.id + ' is dated before the patient’s birth.');
        }
        const counts = {};
        for (const store of STORES) {
          const table = ctx.table(store);
          if (replace) table.clear();
          incoming[store].forEach(function (row) { table.put(row); });
          counts[store] = incoming[store].length;
        }
        ctx.table('audit').put(activity('restore', 'database', '', (replace ? 'Replaced' : 'Merged') + ' local records using a validated PhilPEN backup.'));
        ctx.result({ mode: replace ? 'replace' : 'merge', counts: counts });
      }
      if (replace) apply([], []);
      else ctx.request(ctx.table('patients').getAll(), function (patients) {
        ctx.request(ctx.table('assessments').getAll(), function (assessments) { apply(patients, assessments); });
      });
    });
  }


  // One transaction for linked Excel records; existing records are never overwritten.
  async function importRecords(input, options) {
    options=options||{};
    if(!input||!Array.isArray(input.patients)||!Array.isArray(input.assessments))fail('Invalid import batch.');
    if(input.errors&&input.errors.length)fail('Resolve all Excel row errors before importing.');
    if(input.patients.length>LIMITS.patients||input.assessments.length>LIMITS.assessments)fail('Import is too large.');
    const patients=input.patients.map(p=>normalize('patients',p));
    const assessments=input.assessments.map(a=>normalize('assessments',a));
    const identity=p=>[p.lastName,p.firstName,p.middleName,p.suffix,p.sex,p.dob,p.barangay].map(v=>String(v||'').normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ')).join('|');
    const marker=options.once?identifier(options.once):'';
    return transact(['patients','assessments','audit'],'readwrite','Import Excel records',function(ctx){
      function start(){ctx.request(ctx.table('patients').getAll(),function(existingPatients){ctx.request(ctx.table('assessments').getAll(),function(existingAssessments){
        const ids=new Map(existingPatients.map(p=>[p.id,p]));const identities=new Map(existingPatients.map(p=>[identity(p),p]));const remap=new Map();
        const counts={patients:0,assessments:0,skippedPatients:0,skippedAssessments:0};
        for(const p of patients){const sameId=ids.get(p.id);if(sameId&&identity(sameId)!==identity(p))fail('A patient ID belongs to a different patient.');const existing=sameId||identities.get(identity(p));if(existing){remap.set(p.id,existing.id);counts.skippedPatients++;}else{ids.set(p.id,p);identities.set(identity(p),p);remap.set(p.id,p.id);ctx.table('patients').add(p);counts.patients++;}}
        const visits=new Set(existingAssessments.map(a=>a.patientId+'|'+a.date));const visitIds=new Map(existingAssessments.map(a=>[a.id,a]));
        for(const raw of assessments){const a=Object.assign({},raw,{patientId:remap.get(raw.patientId)||raw.patientId});const patient=ids.get(a.patientId);if(!patient)fail('Assessment references a missing patient.');if(patient.dob&&patient.dob>a.date)fail('Assessment precedes birth date.');const sameId=visitIds.get(a.id);if(sameId&&(sameId.patientId!==a.patientId||sameId.date!==a.date))fail('Assessment ID conflict.');const visit=a.patientId+'|'+a.date;if(sameId||visits.has(visit)){counts.skippedAssessments++;continue;}ctx.table('assessments').add(a);visits.add(visit);visitIds.set(a.id,a);counts.assessments++;}
        const log=activity('import','database','',counts.patients+' patients and '+counts.assessments+' assessments added; existing records retained.');if(marker)log.id=marker;ctx.table('audit').put(log);ctx.result(counts);
      });});}
      if(marker)ctx.request(ctx.table('audit').get(marker),function(done){if(done)ctx.result({alreadyLoaded:true,patients:0,assessments:0});else start();});else start();
    });
  }

  window.PhilDB = Object.freeze({
    importRecords: importRecords,
    init: init,
    all: all,
    get: get,
    put: put,
    remove: remove,
    bulkPut: bulkPut,
    snapshot: snapshot,
    restore: restore,
    createId: createId,
    validateRecord: function (store, record) { return normalize(store, record); },
    databaseName: DB_NAME,
    schemaVersion: DB_VERSION
  });
}());
