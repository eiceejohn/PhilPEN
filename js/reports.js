/* PhilPEN reporting. Plain browser JavaScript; no network or build step required. */
(function (global) {
  'use strict';

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MEDICATIONS = [
    ['amlodipine5', 'Amlodipine 5 mg'], ['amlodipine10', 'Amlodipine 10 mg'],
    ['losartan50', 'Losartan 50 mg'], ['losartan100', 'Losartan 100 mg'],
    ['simvastatin', 'Simvastatin'], ['atorvastatin', 'Atorvastatin'],
    ['hydrochlorothiazide', 'Hydrochlorothiazide'], ['metformin', 'Metformin 500 mg'],
    ['gliclazide', 'Gliclazide'], ['insulinR', 'Insulin R'],
    ['insulinNPH', 'Insulin NPH'], ['insulin7030', 'Insulin 70/30']
  ];
  const HTN_MEDICATIONS = ['amlodipine5', 'amlodipine10', 'losartan50', 'losartan100', 'hydrochlorothiazide'];
  const DM_MEDICATIONS = ['metformin', 'gliclazide', 'insulinR', 'insulinNPH', 'insulin7030'];
  const RISK_LABELS = Object.freeze({ smoker: 'Current tobacco use', bingeDrinker: 'Binge drinking', inactive: 'Insufficient physical activity', unhealthyDiet: 'Unhealthy diet', overweight: 'Overweight', obese: 'Obese' });
  const PATIENT_FIELDS = ['id', 'firstName', 'lastName', 'middleName', 'suffix', 'sex', 'dob', 'barangay', 'address', 'philhealth', 'phone'];
  const TEXT_IDENTIFIERS = new Set(['id', 'patientId', 'philhealth', 'phone']);
  const INDICATOR_LABELS = [
    'Risk assessed using the PhilPEN protocol', 'Current Smoker', 'Binge Drinker',
    'Insufficient physical activities', 'Consumed unhealthy diet', 'Overweight', 'Obese',
    'Identified as hypertensive using the PhilPEN protocol',
    'Hypertensives provided with antihypertensive medications',
    'Antihypertensive medications provided by facility', 'Antihypertensive medications out of pocket',
    'Identified with Type II Diabetes using the PhilPEN protocol',
    'Type II Diabetics provided with antidiabetic medications',
    'Antidiabetic medications provided by facility', 'Antidiabetic medications out of pocket'
  ];

  function isISODate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
    const date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function encounterAge(patient, assessment) {
    if (assessment.age !== null && assessment.age !== '' && assessment.age !== undefined) {
      const age = Number(assessment.age);
      if (Number.isInteger(age) && age >= 0 && age <= 130) return age;
    }
    if (!isISODate(patient.dob) || !isISODate(assessment.date) || patient.dob > assessment.date) return null;
    const birthday = patient.dob.split('-').map(Number);
    const when = assessment.date.split('-').map(Number);
    return when[0] - birthday[0] - (when[1] < birthday[1] || (when[1] === birthday[1] && when[2] < birthday[2]) ? 1 : 0);
  }

  function frequency(assessment, key) {
    const number = Number((assessment.medications || {})[key] || 0);
    return Number.isInteger(number) && number >= 0 && number <= 3 ? number : 0;
  }

  function treated(assessment, type) {
    const condition = type === 'HTN' ? assessment.hypertension : assessment.diabetes;
    const source = type === 'HTN' ? assessment.htnSource : assessment.dmSource;
    const medications = type === 'HTN' ? HTN_MEDICATIONS : DM_MEDICATIONS;
    const provided = type === 'HTN' ? assessment.htnMedicationProvided : assessment.dmMedicationProvided;
    if (provided !== undefined && provided !== null) return !!condition && provided === true;
    return !!condition && (['facility', 'out-of-pocket', 'both'].includes(source) || medications.some(key => frequency(assessment, key) > 0));
  }

  function sourceMatches(value, source) { return value === source || value === 'both'; }
  function eligible(assessment) { return assessment.age !== null && assessment.age >= 20 && ['M', 'F'].includes(assessment.patient.sex); }
  function groupKey(assessment) { return (assessment.age >= 60 ? 'senior' : 'adult') + (assessment.patient.sex === 'M' ? 'Male' : 'Female'); }

  function joinedAssessments(patients, assessments, filters) {
    const patientMap = new Map((patients || []).map(patient => [String(patient.id), patient]));
    const year = String((filters || {}).year || new Date().getFullYear());
    const barangay = (filters || {}).barangay || 'all';
    return (assessments || []).flatMap(assessment => {
      const patient = patientMap.get(String(assessment.patientId));
      if (!patient || !isISODate(assessment.date) || assessment.date.slice(0, 4) !== year || (barangay !== 'all' && patient.barangay !== barangay)) return [];
      return [{ ...assessment, patient, age: encounterAge(patient, assessment) }];
    }).sort((a, b) => a.date.localeCompare(b.date) || String(a.updatedAt || a.createdAt || '').localeCompare(String(b.updatedAt || b.createdAt || '')) || String(a.id).localeCompare(String(b.id)));
  }

  function latestPeople(encounters) {
    const latest = new Map();
    encounters.forEach(assessment => latest.set(String(assessment.patientId), assessment));
    return Array.from(latest.values());
  }

  function summarize(patients, assessments, filters) {
    filters = filters || {};
    const yearEncounters = joinedAssessments(patients, assessments, filters);
    const month = filters.month === 'all' || !filters.month ? null : Number(filters.month);
    const encounters = yearEncounters.filter(assessment => month === null || Number(assessment.date.slice(5, 7)) === month);
    const allPeople = latestPeople(encounters);
    const people = allPeople.filter(eligible);
    const riskCounts = { smoker: 0, bingeDrinker: 0, inactive: 0, unhealthyDiet: 0, overweight: 0, obese: 0 };
    const byGroup = { adultMale: 0, adultFemale: 0, seniorMale: 0, seniorFemale: 0 };
    const names = new Set(((global.PHILPEN_SEED || {}).barangays || []).map(barangay => typeof barangay === 'string' ? barangay : barangay.name));
    people.forEach(assessment => names.add(assessment.patient.barangay));
    const byBarangay = Array.from(names).filter(name => name && (!filters.barangay || filters.barangay === 'all' || filters.barangay === name)).map(name => ({ name, screened: 0, hypertensive: 0, diabetic: 0 }));
    const barangayMap = new Map(byBarangay.map(row => [row.name, row]));
    let hypertensive = 0, diabetic = 0, treatedHTN = 0, treatedDM = 0;
    people.forEach(assessment => {
      ['smoker', 'bingeDrinker', 'inactive', 'unhealthyDiet'].forEach(key => { if (assessment[key]) riskCounts[key] += 1; });
      if (assessment.bmiClass === 'overweight') riskCounts.overweight += 1;
      if (assessment.bmiClass === 'obese') riskCounts.obese += 1;
      if (assessment.riskAssessed !== false) byGroup[groupKey(assessment)] += 1;
      const row = barangayMap.get(assessment.patient.barangay);
      if (row && assessment.riskAssessed !== false) row.screened += 1;
      if (assessment.hypertension) { hypertensive += 1; if (row) row.hypertensive += 1; }
      if (assessment.diabetes) { diabetic += 1; if (row) row.diabetic += 1; }
      if (treated(assessment, 'HTN')) treatedHTN += 1;
      if (treated(assessment, 'DM')) treatedDM += 1;
    });
    const monthly = MONTHS.map((_, index) => latestPeople(yearEncounters.filter(assessment => Number(assessment.date.slice(5, 7)) === index + 1)).filter(a => eligible(a) && a.riskAssessed !== false).length);
    return { assessments: encounters, people, screened: people.filter(a => a.riskAssessed !== false).length, hypertensive, diabetic, treatedHTN, treatedDM, riskCounts, monthly, byBarangay, byGroup, excluded: allPeople.length - people.length };
  }

  function metricFlags(assessment) {
    return [assessment.riskAssessed !== false, assessment.smoker, assessment.bingeDrinker, assessment.inactive, assessment.unhealthyDiet,
      assessment.bmiClass === 'overweight', assessment.bmiClass === 'obese', assessment.hypertension,
      treated(assessment, 'HTN'), treated(assessment, 'HTN') && sourceMatches(assessment.htnSource, 'facility'),
      treated(assessment, 'HTN') && sourceMatches(assessment.htnSource, 'out-of-pocket'), assessment.diabetes,
      treated(assessment, 'DM'), treated(assessment, 'DM') && sourceMatches(assessment.dmSource, 'facility'),
      treated(assessment, 'DM') && sourceMatches(assessment.dmSource, 'out-of-pocket')];
  }

  function normalizedContext(context) {
    const result = { patients: [], assessments: [], equipment: [], settings: {}, barangays: (global.PHILPEN_SEED || {}).barangays || [], filters: { year: new Date().getFullYear(), month: 'all', barangay: 'all' }, ...context };
    result.filters = { year: new Date().getFullYear(), month: 'all', barangay: 'all', ...(context || {}).filters };
    result.summary = summarize(result.patients, result.assessments, result.filters);
    const names = new Set(result.barangays.map(barangay => typeof barangay === 'string' ? barangay : barangay.name));
    result.summary.people.forEach(assessment => names.add(assessment.patient.barangay));
    result.names = Array.from(names).filter(name => name && (result.filters.barangay === 'all' || result.filters.barangay === name));
    return result;
  }

  function indicatorRows(context) {
    return context.names.map(name => {
      const row = [name, ...Array(60).fill(0)];
      context.summary.people.filter(assessment => assessment.patient.barangay === name).forEach(assessment => {
        const offset = (assessment.age >= 60 ? 30 : 0) + (assessment.patient.sex === 'F' ? 1 : 0);
        metricFlags(assessment).forEach((value, index) => { if (value) row[1 + offset + index * 2] += 1; });
      });
      return row;
    });
  }

  function indicatorHeaders() {
    return ['Barangay', ...['Adults 20–59', 'Senior citizens 60+'].flatMap(age => INDICATOR_LABELS.flatMap(label => ['Male', 'Female'].map(sex => `${age}: ${label} (${sex})`)))];
  }

  function sumRows(rows, columns, label) { return [label || 'TOTAL', ...Array.from({ length: columns - 1 }, (_, index) => rows.reduce((sum, row) => sum + (typeof row[index + 1] === 'number' ? row[index + 1] : 0), 0))]; }
  function periodLabel(filters) { return (filters.month === 'all' || !filters.month ? 'All months' : MONTHS[Number(filters.month) - 1]) + ' ' + filters.year; }
  function filePeriod(filters) { return String(filters.year) + (filters.month && filters.month !== 'all' ? '-' + String(filters.month).padStart(2, '0') : '-annual'); }

  /* CSV uses quoted fields throughout and reversible apostrophe protection. */
  function safeCSVText(value, field) {
    let text = value == null ? '' : String(value);
    if (text && (TEXT_IDENTIFIERS.has(field) || /^['=+\-@\t\r]/.test(text) || /^\s+[=+\-@]/.test(text))) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function unprotectCSVText(value, field) {
    if (value.charAt(0) !== "'") return value;
    const rest = value.slice(1);
    return TEXT_IDENTIFIERS.has(field) || /^['=+\-@\t\r]/.test(rest) || /^\s+[=+\-@]/.test(rest) ? rest : value;
  }

  function toCSV(headers, rows, fieldNames) {
    const fields = fieldNames || headers;
    return '\uFEFF' + [headers.map(value => safeCSVText(value, '')).join(','), ...rows.map(row => row.map((value, index) => safeCSVText(value, fields[index])).join(','))].join('\r\n') + '\r\n';
  }

  function parseCSV(text) {
    text = String(text || '').replace(/^\uFEFF/, '');
    const records = [], errors = [];
    let fields = [], value = '', quoted = false, afterQuote = false, line = 1, startLine = 1;
    const finishField = () => { fields.push(value); value = ''; afterQuote = false; };
    const finishRecord = () => { finishField(); if (fields.some(field => field !== '')) records.push({ fields, line: startLine }); fields = []; startLine = line + 1; };
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      if (quoted) {
        if (char === '"') {
          if (text[index + 1] === '"') { value += '"'; index += 1; }
          else { quoted = false; afterQuote = true; }
        } else { value += char; if (char === '\n') line += 1; }
      } else if (char === '"' && value === '' && !afterQuote) quoted = true;
      else if (char === ',') finishField();
      else if (char === '\r' || char === '\n') {
        if (char === '\r' && text[index + 1] === '\n') index += 1;
        finishRecord(); line += 1; startLine = line;
      } else {
        if (afterQuote || char === '"') errors.push(`Line ${line}: unexpected character outside a quoted CSV field.`);
        value += char;
      }
    }
    if (quoted) errors.push(`Line ${startLine}: quoted field is not closed.`);
    if (value !== '' || fields.length || afterQuote) finishRecord();
    return { records, errors: Array.from(new Set(errors)) };
  }

  function parsePatientsCSV(text) {
    const parsed = parseCSV(text), errors = parsed.errors.slice(), rows = [];
    if (!parsed.records.length) return { rows, errors: [...errors, 'CSV file is empty. Download the patient template first.'] };
    const header = parsed.records.shift().fields.map(value => value.trim());
    const aliases = { firstname: 'firstName', lastname: 'lastName', middlename: 'middleName', dateofbirth: 'dob', birthdate: 'dob', philhealthnumber: 'philhealth', phonenumber: 'phone', contactnumber: 'phone' };
    const headers = header.map(value => {
      const key = value.replace(/[\s_-]/g, '').toLowerCase();
      return PATIENT_FIELDS.find(field => field.toLowerCase() === key) || aliases[key] || null;
    });
    const recognized = headers.filter(Boolean);
    if (new Set(recognized).size !== recognized.length) errors.push('CSV contains duplicate patient columns.');
    ['firstName', 'lastName', 'sex', 'dob', 'barangay'].forEach(field => { if (!headers.includes(field)) errors.push(`Missing required column: ${field}.`); });
    if (errors.length) return { rows, errors };
    const ids = new Set();
    parsed.records.forEach(record => {
      if (record.fields.length !== headers.length) { errors.push(`Line ${record.line}: expected ${headers.length} columns, received ${record.fields.length}.`); return; }
      const patient = Object.fromEntries(PATIENT_FIELDS.map(field => [field, '']));
      headers.forEach((field, index) => { if (field) patient[field] = unprotectCSVText(record.fields[index], field); });
      patient.sex = patient.sex.trim().toUpperCase();
      if (patient.sex === 'MALE') patient.sex = 'M';
      if (patient.sex === 'FEMALE') patient.sex = 'F';
      patient.dob = patient.dob.trim().replace(/\//g, '-');
      const problems = [];
      ['firstName', 'lastName', 'barangay'].forEach(field => { if (!patient[field].trim()) problems.push(`${field} is required`); });
      if (!['M', 'F'].includes(patient.sex)) problems.push('sex must be M or F');
      if (patient.dob && !isISODate(patient.dob)) problems.push('dob must be blank or a valid YYYY-MM-DD date');
      if (patient.id && ids.has(patient.id)) problems.push(`duplicate id ${patient.id}`);
      if (patient.id) ids.add(patient.id);
      if (problems.length) errors.push(`Line ${record.line}: ${problems.join('; ')}.`);
      else rows.push(patient);
    });
    return { rows, errors };
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; anchor.style.display = 'none';
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return { filename, blob };
  }

  function exportPatientsCSV(patients) {
    return downloadBlob(new Blob([toCSV(PATIENT_FIELDS, (patients || []).map(patient => PATIENT_FIELDS.map(field => patient[field] || '')), PATIENT_FIELDS)], { type: 'text/csv;charset=utf-8' }), 'PhilPEN-patients.csv');
  }

  function downloadPatientTemplate() {
    return downloadBlob(new Blob([toCSV(PATIENT_FIELDS, [], PATIENT_FIELDS)], { type: 'text/csv;charset=utf-8' }), 'PhilPEN-patient-import-template.csv');
  }

  function exportIndicatorsCSV(input) {
    const context = normalizedContext(input), rows = indicatorRows(context);
    return downloadBlob(new Blob([toCSV(indicatorHeaders(), [...rows, sumRows(rows, 61)])], { type: 'text/csv;charset=utf-8' }), 'PhilPEN-indicators-' + filePeriod(context.filters) + '.csv');
  }

  function encounterTable(context) {
    const headers = ['Assessment ID', 'Patient ID', 'Date assessed', 'Last name', 'First name', 'Middle name', 'Suffix', 'Sex', 'Age at assessment', 'Date of birth', 'Barangay', 'Address', 'PhilHealth number', 'Phone', 'Current tobacco use', 'Binge drinking', 'Insufficient physical activity', 'Unhealthy diet', 'Weight (kg)', 'Height (m)', 'Recorded BMI category', 'Hypertension', 'Type II Diabetes', 'HTN medication source', 'DM medication source', ...MEDICATIONS.map(medication => medication[1] + ' frequency/day'), 'Remarks', 'Next visit', 'Risk assessed', 'Antihypertensive medication provided', 'Antidiabetic medication provided'];
    const fields = ['id', 'patientId', 'date', 'lastName', 'firstName', 'middleName', 'suffix', 'sex', 'age', 'dob', 'barangay', 'address', 'philhealth', 'phone'];
    const rows = context.summary.assessments.map(assessment => {
      const patient = assessment.patient;
      return [assessment.id, patient.id, assessment.datePrecision === 'month' ? assessment.date.slice(0,7) : assessment.date, patient.lastName, patient.firstName, patient.middleName, patient.suffix, patient.sex, assessment.age == null ? '' : assessment.age, patient.dob, patient.barangay, patient.address, patient.philhealth, patient.phone,
        ...['smoker', 'bingeDrinker', 'inactive', 'unhealthyDiet'].map(key => assessment[key] ? 1 : 0),
        assessment.weightKg == null ? '' : assessment.weightKg, assessment.heightM == null ? '' : assessment.heightM, assessment.bmiClass || '', assessment.hypertension ? 1 : 0, assessment.diabetes ? 1 : 0, assessment.htnSource || '', assessment.dmSource || '',
        ...MEDICATIONS.map(medication => frequency(assessment, medication[0])), assessment.remarks || '', assessment.nextVisit || '', assessment.riskAssessed !== false ? 1 : 0, assessment.htnMedicationProvided == null ? 'Inferred from recorded source/medicines' : assessment.htnMedicationProvided ? 'Yes' : 'No', assessment.dmMedicationProvided == null ? 'Inferred from recorded source/medicines' : assessment.dmMedicationProvided ? 'Yes' : 'No'];
    });
    return { headers, fields, rows };
  }

  function exportEncountersCSV(input) {
    const context = normalizedContext(input), table = encounterTable(context);
    return downloadBlob(new Blob([toCSV(table.headers, table.rows, table.fields)], { type: 'text/csv;charset=utf-8' }), 'PhilPEN-encounters-' + filePeriod(context.filters) + '.csv');
  }

  /* XLSX is an ordinary OOXML ZIP with inline strings. No formulas or macros. */
  function xml(value) { return String(value == null ? '' : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[character])).replace(/\r/g, '&#13;'); }
  function columnName(index) { let name = ''; while (index > 0) { index -= 1; name = String.fromCharCode(65 + index % 26) + name; index = Math.floor(index / 26); } return name; }
  function columnIndex(name) { return name.split('').reduce((value, char) => value * 26 + char.charCodeAt(0) - 64, 0); }
  function excelDate(value) { return isISODate(value) ? { value: Math.round((Date.parse(value + 'T00:00:00Z') - Date.UTC(1899, 11, 30)) / 86400000), style: 5 } : ''; }

  function sheetXML(sheet) {
    const rows = sheet.rows.map((row, rowIndex) => {
      const number = rowIndex + 1;
      const defaultStyle = (sheet.headerRows || []).includes(number) ? 1 : (sheet.totalRows || []).includes(number) ? 3 : 0;
      const cells = row.map((item, index) => {
        const descriptor = item && typeof item === 'object' ? item : { value: item };
        const value = descriptor.value;
        const style = descriptor.style == null ? defaultStyle : descriptor.style;
        if (value === '' || value == null) return '';
        const coordinate = columnName(index + 1) + number;
        return typeof value === 'number' && Number.isFinite(value)
          ? `<c r="${coordinate}" s="${style}"><v>${value}</v></c>`
          : `<c r="${coordinate}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
      }).join('');
      const height = (sheet.heights || {})[number];
      return `<row r="${number}"${height ? ` ht="${height}" customHeight="1"` : ''}>${cells}</row>`;
    }).join('');
    const columnCount = sheet.columns || Math.max(...sheet.rows.map(row => row.length));
    const widths = (sheet.widths || []).map(width => `<col min="${width[0]}" max="${width[1]}" width="${width[2]}" customWidth="1"/>`).join('');
    const frozen = sheet.freeze || 0;
    const pane = frozen ? `<pane xSplit="1" ySplit="${frozen}" topLeftCell="B${frozen + 1}" activePane="bottomRight" state="frozen"/>` : '';
    const merges = (sheet.merges || []).length ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map(range => `<mergeCell ref="${range}"/>`).join('')}</mergeCells>` : '';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${columnName(columnCount)}${Math.max(1, sheet.rows.length)}"/><sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="24"/>${widths ? `<cols>${widths}</cols>` : ''}<sheetData>${rows}</sheetData>${sheet.autoFilter ? `<autoFilter ref="${sheet.autoFilter}"/>` : ''}${merges}<pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
  }

  const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy/mm/dd"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Calibri"/><color rgb="FF1E293B"/></font><font><b/><sz val="11"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font><font><b/><sz val="11"/><name val="Calibri"/><color rgb="FF1E293B"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2563EB"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEFF6FF"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFE2E8F0"/></left><right style="thin"><color rgb="FFE2E8F0"/></right><top style="thin"><color rgb="FFE2E8F0"/></top><bottom style="thin"><color rgb="FFE2E8F0"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" horizontal="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="2" fontId="0" fillId="0" borderId="1" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

  function makeIndicatorSheet(context) {
    const top = ['Barangay'], sex = [''], columns = [''];
    const merges = ['A1:A2'];
    ['Adults 20–59 years old', 'Senior citizens 60 years old and above'].forEach((age, ageIndex) => INDICATOR_LABELS.forEach((label, index) => {
      const start = 2 + ageIndex * 30 + index * 2;
      top[start - 1] = age + '\n' + label; top[start] = '';
      sex[start - 1] = 'Male'; sex[start] = 'Female'; columns[start - 1] = index * 2 + 1; columns[start] = index * 2 + 2;
      merges.push(columnName(start) + '1:' + columnName(start + 1) + '1');
    }));
    const data = indicatorRows(context);
    return { name: 'NCD INDICATORS', rows: [top, sex, columns, ...data, sumRows(data, 61)], columns: 61, headerRows: [1, 2], totalRows: [data.length + 4], heights: { 1: 118, 2: 25, 3: 20 }, widths: [[1, 1, 25], [2, 61, 10]], merges, freeze: 3 };
  }

  function medicationTableFromContext(context) {
    const rows = context.names.map(name => {
      const people = context.summary.people.filter(assessment => assessment.patient.barangay === name);
      const row = [name, people.filter(a => a.riskAssessed !== false).length, ...Array(24).fill(0)];
      people.forEach(assessment => {
        const group = (assessment.patient.sex === 'F' ? 2 : 0) + (assessment.age >= 60 ? 1 : 0);
        if (assessment.hypertension) row[2 + group] += 1;
        if (assessment.diabetes) row[6 + group] += 1;
        MEDICATIONS.forEach((medication, index) => { row[10 + index] += frequency(assessment, medication[0]); });
      });
      const equipment = Array.isArray(context.equipment) ? context.equipment.find(item => item.id === name || item.barangay === name) : context.equipment[name];
      ['manualBP', 'automaticBP', 'glucometers', 'testStrips'].forEach((key, index) => { row[22 + index] = equipment && equipment[key] != null ? Number(equipment[key]) : ''; });
      return row;
    });
    const totals = sumRows(rows, 26);
    for (let col = 22; col < 26; col += 1) if (!rows.some(row => row[col] !== '')) totals[col] = '';
    return {rows,totals};
  }

  function medicationTable(input) { return medicationTableFromContext(normalizedContext(input)); }

  function makeMedicationSheet(context) {
    const top = ['Barangay', 'Total Screen', 'Hypertension', '', '', '', 'Diabetes', '', '', '', 'Amlodipine', '', 'Losartan', '', 'Simvastatin', 'Atorvastatin', 'Hydrochlorothiazide', 'Metformin', 'Gliclazide', 'Insulin', '', '', 'Current BP Apparatus (Manual)', 'Current BP Apparatus (Automatic)', 'Current Glucometers', 'Current Glucose Test Strips'];
    const second = ['', '', 'Male', '', 'Female', '', 'Male', '', 'Female'];
    const third = ['', '', '20–59 yrs.', '≥60 yrs.', '20–59 yrs.', '≥60 yrs.', '20–59 yrs.', '≥60 yrs.', '20–59 yrs.', '≥60 yrs.', '5 mg', '10 mg', '50 mg', '100 mg', '', '', '', '', '', 'R', 'NPH', '70/30'];
    const {rows,totals} = medicationTableFromContext(context);
    const merges = ['A1:A3', 'B1:B3', 'C1:F1', 'G1:J1', 'C2:D2', 'E2:F2', 'G2:H2', 'I2:J2', 'K1:L2', 'M1:N2', 'O1:O3', 'P1:P3', 'Q1:Q3', 'R1:R3', 'S1:S3', 'T1:V2', 'W1:W3', 'X1:X3', 'Y1:Y3', 'Z1:Z3'];
    return { name: 'NCD MEDICATION', rows: [top, second, third, ['Medication columns K–V sum the recorded daily frequencies (1–3); equipment is the current inventory.'], ...rows, totals], columns: 26, headerRows: [1, 2, 3], totalRows: [rows.length + 5], heights: { 1: 42, 2: 30, 3: 28, 4: 34 }, widths: [[1, 1, 25], [2, 10, 11], [11, 22, 13], [23, 26, 16]], merges: [...merges, 'A4:Z4'], freeze: 4 };
  }

  function makeRegisterSheet(context) {
    const rows = Array.from({ length: 12 }, () => Array(81).fill(''));
    const put = (address, value) => { const match = address.match(/^([A-Z]+)(\d+)$/); rows[Number(match[2]) - 1][columnIndex(match[1]) - 1] = value; };
    const headings = {
      T2: 'MONTH:', V2: context.filters.month === 'all' ? 'ALL MONTHS' : MONTHS[Number(context.filters.month) - 1].toUpperCase(), BC2: 'YEAR:', BI2: Number(context.filters.year),
      B4: 'NAME OF FACILITY:', E4: context.settings.facility || '', R4: 'Target Population:', B5: 'FACILITY ADDRESS:', E5: context.settings.address || '', R5: 'FHSIS Target:',
      B7: 'DATE Assessed', C7: 'NO.', D7: 'COMPLETE NAME', H7: 'SEX (put 1)', J7: 'AGE AT ASSESSMENT', N7: 'DATE OF BIRTH (yyyy/mm/dd)', O7: 'Barangay', P7: 'House No./ Sitio/ Street', Q7: 'PHILHEALTH NUMBER', R7: 'Risk factors and recorded conditions (1 = yes)', BP7: 'Daily medication frequency: 1, 2 or 3', CB7: 'Remarks',
      R8: 'Current Tobacco User (SMOKER)', V8: 'Binge Drinker', Z8: 'Insufficient Physical Activities', AD8: 'Consumed Unhealthy Diet', AH8: 'Weight (kg)', AI8: 'Height (m)', AJ8: 'RECORDED BMI CATEGORY', AR8: 'Hypertension', AV8: 'Diabetes', AZ8: 'Out Of Pocket', BH8: 'Provided by Facility', BP8: 'MEDICATIONS TAKEN',
      AJ9: 'Overweight', AN9: 'Obese', AZ9: 'Hypertension', BD9: 'Diabetes', BH9: 'Hypertension', BL9: 'Diabetes', D10: 'FAMILY NAME', E10: 'FIRST NAME', F10: 'MIDDLE NAME', G10: 'SUFFIX', J10: '20–59', L10: '60-UP',
      BP10: 'Amlodipine', BR10: 'Losartan', BT10: 'Simvastatin', BU10: 'Atorvastatin', BV10: 'Hydrochlorothiazide', BW10: 'Metformin', BX10: 'Gliclazide', BY10: 'Insulin', H11: 'M', I11: 'F', J11: 'M', K11: 'F', L11: 'M', M11: 'F', BP11: '5 mg', BQ11: '10 mg', BR11: '50 mg', BS11: '100 mg', BW11: '500 mg', BY11: 'R', BZ11: 'NPH', CA11: '70/30'
    };
    const population = context.filters.barangay !== 'all' ? (context.barangays.find(row => row.name === context.filters.barangay) || {}).total : context.settings.eligiblePopulation;
    headings.AB4 = Number.isFinite(Number(population)) && population != null ? Number(population) : '';
    headings.AB5 = headings.AB4 === '' ? '' : Math.round(headings.AB4 * (Number(context.settings.targetRate) || 0));
    Object.entries(headings).forEach(([address, value]) => put(address, value));
    const blocks = ['R', 'V', 'Z', 'AD', 'AJ', 'AN', 'AR', 'AV', 'AZ', 'BD', 'BH', 'BL'];
    blocks.forEach(column => {
      const start = columnIndex(column);
      ['M', '', 'F', ''].forEach((value, index) => put(columnName(start + index) + '10', value));
      ['20–59', '60-UP', '20–59', '60-UP'].forEach((value, index) => put(columnName(start + index) + '11', value));
    });
    const people = context.summary.people.slice().sort((a, b) => a.patient.barangay.localeCompare(b.patient.barangay) || a.patient.lastName.localeCompare(b.patient.lastName) || a.patient.firstName.localeCompare(b.patient.firstName));
    const totals = Array(81).fill('');
    const countColumns = [7, 8, 9, 10, 11, 12, ...blocks.flatMap(column => Array.from({ length: 4 }, (_, index) => columnIndex(column) - 1 + index)), ...Array.from({ length: 12 }, (_, index) => 67 + index)];
    countColumns.forEach(column => { totals[column] = 0; });
    people.forEach((assessment, index) => {
      const patient = assessment.patient;
      const row = Array(81).fill('');
      row[1] = assessment.datePrecision === 'month' ? assessment.date.slice(0,7) : excelDate(assessment.date); row[2] = index + 1;
      row[3] = patient.lastName; row[4] = patient.firstName; row[5] = patient.middleName || ''; row[6] = patient.suffix || '';
      const sex = patient.sex === 'F' ? 1 : 0;
      row[7 + sex] = 1; totals[7 + sex] += 1;
      const ageCol = 9 + (assessment.age >= 60 ? 2 : 0) + sex;
      row[ageCol] = assessment.age; totals[ageCol] += 1;
      row[13] = excelDate(patient.dob); row[14] = patient.barangay; row[15] = patient.address || ''; row[16] = patient.philhealth || '';
      const blockGroup = sex * 2 + (assessment.age >= 60 ? 1 : 0);
      const flags = [assessment.smoker, assessment.bingeDrinker, assessment.inactive, assessment.unhealthyDiet, assessment.bmiClass === 'overweight', assessment.bmiClass === 'obese', assessment.hypertension, assessment.diabetes,
        treated(assessment, 'HTN') && sourceMatches(assessment.htnSource, 'out-of-pocket'), treated(assessment, 'DM') && sourceMatches(assessment.dmSource, 'out-of-pocket'), treated(assessment, 'HTN') && sourceMatches(assessment.htnSource, 'facility'), treated(assessment, 'DM') && sourceMatches(assessment.dmSource, 'facility')];
      blocks.forEach((column, blockIndex) => { if (flags[blockIndex]) { const col = columnIndex(column) - 1 + blockGroup; row[col] = 1; totals[col] += 1; } });
      row[33] = assessment.weightKg == null ? '' : assessment.weightKg; row[34] = assessment.heightM == null ? '' : assessment.heightM;
      MEDICATIONS.forEach((medication, medicationIndex) => { const value = frequency(assessment, medication[0]); row[67 + medicationIndex] = value || ''; totals[67 + medicationIndex] += value; });
      row[79] = assessment.remarks || '';
      rows.push(row);
    });
    rows[11] = rows[11].map((value, index) => totals[index] === '' ? value : totals[index]);
    const merges = ['B7:B12', 'C7:C12', 'D7:G9', 'D10:D12', 'E10:E12', 'F10:F12', 'G10:G12', 'H7:I10', 'J7:M9', 'J10:K10', 'L10:M10', 'N7:N12', 'O7:O12', 'P7:P12', 'Q7:Q12', 'R7:BO7', 'BP7:CA7', 'CB7:CB12', 'R8:U9', 'V8:Y9', 'Z8:AC9', 'AD8:AG9', 'AH8:AH12', 'AI8:AI12', 'AJ8:AQ8', 'AJ9:AM9', 'AN9:AQ9', 'AR8:AU9', 'AV8:AY9', 'AZ8:BG8', 'BH8:BO8', 'AZ9:BC9', 'BD9:BG9', 'BH9:BK9', 'BL9:BO9', 'BP8:CA9', 'BP10:BQ10', 'BR10:BS10', 'BT10:BT11', 'BU10:BU11', 'BV10:BV11', 'BX10:BX11', 'BY10:CA10', 'T2:U2', 'V2:AG2', 'BC2:BH2', 'BI2:BQ2', 'B4:D4', 'E4:P4', 'R4:AA4', 'AB4:AG4', 'B5:D5', 'E5:P5', 'R5:AA5', 'AB5:AG5'];
    blocks.forEach(column => { const start = columnIndex(column); merges.push(`${columnName(start)}10:${columnName(start + 1)}10`, `${columnName(start + 2)}10:${columnName(start + 3)}10`); });
    return { name: 'eto yung format na pinapasa', rows, columns: 81, headerRows: [7, 8, 9, 10, 11], totalRows: [12], heights: { 2: 27, 4: 32, 5: 32, 7: 40, 8: 34, 9: 30, 10: 34, 11: 30, 12: 28 }, widths: [[1, 1, 3], [2, 2, 13], [3, 3, 6], [4, 6, 18], [7, 7, 8], [8, 13, 7], [14, 14, 14], [15, 15, 22], [16, 16, 28], [17, 17, 22], [18, 67, 8], [68, 79, 12], [80, 80, 35], [81, 81, 3]], merges, freeze: 12 };
  }

  function makeMunicipalSheet(context) {
    const settings = context.settings;
    const rows = [
      ['HYPERTENSION & DIABETES PATIENT DASHBOARD'], ['Reporting period', periodLabel(context.filters)], ['Reporting barangay', context.filters.barangay === 'all' ? 'All barangays' : context.filters.barangay],
      ['Province', settings.province || ''], ['LGU', settings.lgu || ''], ['Facility', settings.facility || ''], ['Facility address', settings.address || ''],
      ['Total eligible population 20+', Number(settings.eligiblePopulation) || 0], ['Target proportion', Number(settings.targetRate) || 0],
      ['Contact person', settings.contactName || ''], ['Contact number', settings.contactPhone || ''], ['Viber number', settings.viber || ''], ['Email address', settings.email || ''], [],
      ['Barangay', 'Male 20+', 'Female 20+', 'Total 20+', 'Annual target', 'Monthly target', 'Quarterly target', 'Facility'],
      ...context.barangays.filter(barangay => context.names.includes(barangay.name)).map(barangay => [barangay.name, barangay.male, barangay.female, barangay.total, barangay.annual, barangay.monthly, barangay.quarterly, barangay.facility || ''])
    ];
    return { name: 'MUNICIPAL INFO', rows, columns: 8, headerRows: [1, 15], heights: { 1: 35, 8: 32, 15: 38 }, widths: [[1, 1, 35], [2, 7, 16], [8, 8, 40]], merges: ['A1:H1', ...[2, 3, 4, 5, 6, 7, 10, 11, 12, 13].map(row => `B${row}:H${row}`)], freeze: 15 };
  }

  function makeNotesSheet(context) {
    const rows = [
      ['REPORTING DEFINITIONS', 'Detail'], ['Period', periodLabel(context.filters)], ['Barangay filter', context.filters.barangay === 'all' ? 'All barangays' : context.filters.barangay],
      ['Source layout', 'PhilPEN-Dashboard.xlsx: MUNICIPAL INFO, NCD INDICATORS, NCD MEDICATION and eto yung format na pinapasa.'],
      ['Counted population', 'Patients aged 20–59 or 60+ at the encounter, with recorded sex M/F. Age is saved at assessment or calculated from DOB and assessment date, never from today.'],
      ['One person per reporting period', 'NCD INDICATORS, NCD MEDICATION and the submission register use the latest assessment per patient within the selected period. For identical dates, updated/created time and assessment ID break ties.'],
      ['Patient demographics', 'Reports use the current patient name, sex and barangay. Corrections to the patient registry also change historical report labels and aggregates. Assessment age remains the saved age at that visit.'],
      ['Explicit assessment fields', 'Risk assessed controls the screening indicator. Medication provided Yes/No takes precedence over inferred treatment; legacy records infer from medication source or medicines. Age/sex groups are derived from the patient and recorded assessment age.'],
      ['Month-only assessments', 'YYYY-MM means the exact visit day was not recorded. These visits use day 01 only for internal sorting and month filters.'],
      ['Encounter history', 'ENCOUNTERS includes every matching assessment, including follow-ups. It is separate from the deduplicated submission register.'],
      ['Uncounted latest records', context.summary.excluded], ['Assessed people', context.summary.screened], ['Recorded encounters', context.summary.assessments.length],
      ['Monthly trend', 'Each calendar month counts unique eligible patients independently. Summing monthly counts can exceed annual unique patients.'],
      ['Recorded classifications', 'BMI category, hypertension and Type II Diabetes are explicitly recorded assessment fields. This report does not assign diagnoses or infer BMI categories.'],
      ['Medication treatment', 'A recorded condition plus explicit medication-provided Yes counts as treated. Explicit No excludes treatment. When unset, relevant medicine frequency or a recorded source is used; statins alone do not count for HTN.'],
      ['Medication sources', 'Both contributes to facility and out-of-pocket counts. These categories overlap and must not be added as a unique total.'],
      ['Medication totals', 'NCD MEDICATION columns K–V sum recorded daily frequencies (0–3), matching the source register medication totals. They are not distinct patient counts, dispensed quantities or stock balances.'],
      ['Equipment', 'Current inventory at export time. Blank means no recorded inventory for that barangay; zero means recorded zero. Historical period filters do not reconstruct historical inventory.'],
      ['Register column mapping', 'A–CC retained. Original reserved A and CC remain empty. Sex, age, risks and conditions are split into the source age/sex columns. Row 12 contains counts (including age counts), rows 13+ contain the selected patients.'],
      ['BMI in register', 'Overweight and obese are placed as 1 in their matching age/sex columns. Normal, underweight and unrecorded values are available in ENCOUNTERS.'],
      ['Targets', 'Barangay baseline targets are copied from the supplied workbook. The register FHSIS target is the selected eligible population multiplied by the saved target proportion, rounded to a whole person.'],
      ['Report values', 'Export is a dated snapshot with typed numbers and dates. No workbook formulas, external links or macros.']
    ];
    return { name: 'REPORT NOTES', rows, columns: 2, headerRows: [1], widths: [[1, 1, 31], [2, 2, 110]], heights: Object.fromEntries(rows.map((row, index) => [index + 1, row[1] && String(row[1]).length > 160 ? 58 : 40])), freeze: 1 };
  }

  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let number = 0; number < 256; number += 1) { let value = number; for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xEDB88320 ^ value >>> 1 : value >>> 1; table[number] = value >>> 0; }
    return table;
  })();
  function crc32(bytes) { let crc = 0xFFFFFFFF; for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 255] ^ crc >>> 8; return (crc ^ 0xFFFFFFFF) >>> 0; }
  function concatBytes(parts) { const bytes = new Uint8Array(parts.reduce((length, part) => length + part.length, 0)); let offset = 0; parts.forEach(part => { bytes.set(part, offset); offset += part.length; }); return bytes; }

  function zipFiles(files) {
    const encoder = new TextEncoder(), local = [], central = [];
    let offset = 0;
    files.forEach(file => {
      const name = encoder.encode(file.name), data = encoder.encode(file.data), crc = crc32(data);
      const header = new Uint8Array(30 + name.length), view = new DataView(header.buffer);
      view.setUint32(0, 0x04034B50, true); view.setUint16(4, 20, true); view.setUint16(6, 0x0800, true);
      view.setUint16(12, 33, true); view.setUint32(14, crc, true); view.setUint32(18, data.length, true); view.setUint32(22, data.length, true); view.setUint16(26, name.length, true); header.set(name, 30);
      local.push(header, data);
      const entry = new Uint8Array(46 + name.length), directory = new DataView(entry.buffer);
      directory.setUint32(0, 0x02014B50, true); directory.setUint16(4, 20, true); directory.setUint16(6, 20, true); directory.setUint16(8, 0x0800, true); directory.setUint16(14, 33, true);
      directory.setUint32(16, crc, true); directory.setUint32(20, data.length, true); directory.setUint32(24, data.length, true); directory.setUint16(28, name.length, true); directory.setUint32(42, offset, true); entry.set(name, 46); central.push(entry);
      offset += header.length + data.length;
    });
    const directory = concatBytes(central), end = new Uint8Array(22), view = new DataView(end.buffer);
    view.setUint32(0, 0x06054B50, true); view.setUint16(8, files.length, true); view.setUint16(10, files.length, true); view.setUint32(12, directory.length, true); view.setUint32(16, offset, true);
    return concatBytes([...local, directory, end]);
  }

  function buildWorkbookBytes(input) {
    const context = normalizedContext(input), encounters = encounterTable(context);
    const encounterRows = encounters.rows.map(row => row.map((value, index) => index === 2 && /^\d{4}-\d{2}$/.test(value) ? value : [2, 9, 38].includes(index) ? excelDate(value) : value));
    const sheets = [makeMunicipalSheet(context), makeIndicatorSheet(context), makeMedicationSheet(context), makeRegisterSheet(context),
      { name: 'ENCOUNTERS', rows: [encounters.headers, ...encounterRows], columns: encounters.headers.length, headerRows: [1], heights: { 1: 58 }, widths: [[1, 2, 24], [3, 3, 14], [4, 7, 18], [8, 9, 10], [10, 10, 14], [11, 12, 25], [13, 14, 22], [15, 37, 15], [38, 38, 35], [39, 39, 14]], freeze: 1, autoFilter: `A1:${columnName(encounters.headers.length)}${encounterRows.length + 1}` }, makeNotesSheet(context)];
    const files = [
      { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${sheets.map((sheet, index) => `<sheet name="${xml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets></workbook>` },
      { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
      { name: 'xl/styles.xml', data: STYLES_XML },
      ...sheets.map((sheet, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, data: sheetXML(sheet) }))
    ];
    return zipFiles(files);
  }

  async function exportWorkbook(input) {
    const context = normalizedContext(input);
    const blob = new Blob([buildWorkbookBytes(context)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    return { ...downloadBlob(blob, 'PhilPEN-report-' + filePeriod(context.filters) + '.xlsx'), summary: context.summary };
  }

  global.PhilReports = Object.freeze({ summarize, medicationTable, indicatorLabels: INDICATOR_LABELS, metricFlags, exportWorkbook, buildWorkbookBytes, exportPatientsCSV, parsePatientsCSV, downloadPatientTemplate, exportIndicatorsCSV, exportEncountersCSV, encounterAge, frequency, treated, riskLabels: RISK_LABELS, medicationColumns: MEDICATIONS, patientFields: PATIENT_FIELDS, toCSV });
})(typeof window !== 'undefined' ? window : globalThis);
