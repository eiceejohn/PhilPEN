# PhilPEN reporting and export

The reports use the field order in the supplied **PhilPEN-Dashboard.xlsx**. The original workbook is read-only reference material. The application does not overwrite it.

## Counting rules

- A reporting period is a calendar year and optional month, optionally filtered by barangay.
- Screening, risk, condition, treatment, medication and submission totals use the **latest assessment per patient within that period**. A follow-up does not count the patient twice. Assessments on the same day are ordered by updated/created timestamp, then ID.
- The report includes patients aged **20–59** and **60+** with recorded sex M/F. The age saved at assessment is authoritative. When absent, age is calculated using date of birth and assessment date. It is never recalculated using today's date.
- Reports use current patient names, sex and barangay. Registry corrections also change historical report labels and aggregates; saved age at assessment is retained.
- The 12 monthly trend values count unique patients within each month of the selected year and barangay. The month filter affects the other report values. Monthly counts can add to more than the annual unique count.
- BMI categories, hypertension and Type II Diabetes come from recorded fields. Reports do not assign diagnoses or calculate a BMI classification.
- Treated hypertension means recorded hypertension and either a recorded HTN medication source or a nonzero frequency for amlodipine, losartan or hydrochlorothiazide. Statins alone are not counted as antihypertensive treatment. Diabetes treatment uses the corresponding source or metformin, gliclazide or insulin.
- A source recorded as `both` contributes to both facility and out-of-pocket counts. Those source columns overlap.
- Medication totals sum the recorded daily frequencies, matching the source register's 1/2/3 entries and SUM totals. They are **not** dispensed quantities, stock balances or a count of distinct patients taking each medicine.
- Equipment values are current inventory at export time, independent of the period filter. Blank means no inventory has been recorded; zero means a recorded zero.
- Barangay demographic and target baselines retain the source workbook's values. For the register header, FHSIS target is eligible population × saved target proportion, rounded to a whole person.

## Excel workbook

The download contains six sheets:

1. **MUNICIPAL INFO** — report scope, reporting-area settings, contact person/number/email and barangay population/target baseline.
2. **NCD INDICATORS** — A: barangay; B:AE: adult indicators; AF:BI: senior indicators. Each indicator is male then female. There are 60 numeric indicator columns. Data begins at row 4.
3. **NCD MEDICATION** — A:B: barangay/screened; C:F: hypertension by sex and age; G:J: diabetes by sex and age; K:V: the 12 medications; W:Z: equipment. Data begins at row 5.
4. **eto yung format na pinapasa** — source-aligned A:CC register, with totals in row 12 and people from row 13. A and CC are reserved empty columns in the source. This export fills the corresponding age/sex columns individually rather than retaining the source's merged data-entry blocks.
5. **ENCOUNTERS** — every assessment matching the selected period and barangay, preserving repeat visits, saved BMI category, medication frequency, remarks and next visit.
6. **REPORT NOTES** — definitions, scope and exclusions packaged with the report.

The exported workbook is a snapshot. Numeric values and dates retain their types. Names, PhilHealth numbers and IDs are text, including leading zeroes. User-entered strings are inline text cells; they never become Excel formulas. The file contains no macros, external links or remote dependencies.

The submission register column mapping is:

| Columns | Field |
|---|---|
| B:C | Date assessed, sequence number |
| D:G | Last, first, middle name, suffix |
| H:I | Male/female flags |
| J:M | Age: adult male, adult female, senior male, senior female |
| N:Q | Birth date, barangay, address, PhilHealth number |
| R:U | Tobacco use by male adult/senior, female adult/senior |
| V:Y | Binge drinking in the same order |
| Z:AC | Insufficient physical activity |
| AD:AG | Unhealthy diet |
| AH:AI | Weight in kg, height in metres |
| AJ:AM | Recorded overweight |
| AN:AQ | Recorded obesity |
| AR:AU | Recorded hypertension |
| AV:AY | Recorded Type II Diabetes |
| AZ:BC | HTN medication out of pocket |
| BD:BG | DM medication out of pocket |
| BH:BK | HTN medication provided by facility |
| BL:BO | DM medication provided by facility |
| BP:CA | Daily frequencies: amlodipine 5, amlodipine 10, losartan 50, losartan 100, simvastatin, atorvastatin, hydrochlorothiazide, metformin, gliclazide, insulin R, NPH, 70/30 |
| CB | Remarks |

Normal, underweight and unrecorded BMI categories have no indicator flag in the source register. Their exact values remain in ENCOUNTERS. Age totals in row 12 count patients; they do not sum their ages.

## Patient CSV

The patient CSV and blank import template use:

`id,firstName,lastName,middleName,suffix,sex,dob,barangay,address,philhealth,phone`

Required columns are `firstName`, `lastName`, `sex`, `dob`, and `barangay`. Sex accepts M/F or Male/Female. Birth dates accept YYYY-MM-DD or YYYY/MM/DD and may be blank when unknown; record age on the assessment in that case. A blank ID lets the application assign an ID when importing. The importer reports malformed fields, duplicate IDs, invalid dates and missing required values with line numbers. It parses quoted commas, quotes and multiline addresses.

CSV identifiers receive a reversible leading apostrophe so spreadsheet software preserves their exact text. Potential formula text and existing leading apostrophes are escaped the same way. The app removes only its protection when reimporting. Do not remove protective apostrophes before opening a CSV in spreadsheet software. Use the Excel download when typed dates and text need to be retained reliably by Excel.

## Developer API

Load `js/reports.js` after `data/seed.js`. The module adds `window.PhilReports` and uses no imports, fetch requests, CDNs or package installation.

```js
const filters = { year: 2026, month: 'all', barangay: 'all' };
const report = PhilReports.summarize(patients, assessments, filters);
await PhilReports.exportWorkbook({ patients, assessments, equipment, settings, barangays, filters });
```

`summarize()` returns `assessments` (all filtered encounters), `people` (latest eligible encounter per patient), `screened`, `hypertensive`, `diabetic`, `treatedHTN`, `treatedDM`, `riskCounts`, `monthly`, `byBarangay`, `byGroup`, and `excluded`. Each returned encounter has the original fields plus `patient` and resolved `age`. `byGroup` has adultMale, adultFemale, seniorMale and seniorFemale counts. `monthly` is a 12-element numeric array. `excluded` counts latest records excluded for age or sex.

Other functions: `exportIndicatorsCSV(context)`, `exportEncountersCSV(context)`, `exportPatientsCSV(patients)`, `downloadPatientTemplate()`, `parsePatientsCSV(text) → {rows, errors}`, and `buildWorkbookBytes(context) → Uint8Array`. CSV downloads return `{filename, blob}`. `exportWorkbook` returns a Promise resolving to `{filename, blob, summary}` after initiating the download. `buildWorkbookBytes` builds the same workbook without initiating a browser download, for automated verification.
