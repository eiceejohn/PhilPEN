# PhilPEN community health workspace

Isang offline patient registry at reporting system na nakabase sa `PhilPEN-Dashboard.xlsx`.

## Paano buksan

1. Panatilihing magkakasama ang buong `PhilPEN` folder at lahat ng laman nito.
2. I-double-click ang **index.html**, o piliin ang **Open with → Microsoft Edge / Google Chrome**.
3. Gumamit ng regular browser window at parehong browser profile sa bawat pagbukas.

Walang kailangang i-install. Walang server, internet connection, account, CDN o build command na kailangan.

## Paano gamitin

- **Patients:** magdagdag o mag-edit ng patient, pagkatapos ay mag-record ng assessment. May hiwalay na assessment history bawat patient.
- **Assessment records table:** lahat ng 44 columns ay visible sa horizontally scrollable table: patient/visit details, NCD indicators, measurements, 12 medicines, follow-up at remarks. Gamitin ang field-group buttons para mabilis lumipat; naka-fix ang patient at edit/delete columns. Nananatili ang column position habang nag-search o lumilipat ng page.
- **Assessments:** ilagay ang petsa, risk factors, measurements, hypertension/diabetes status at gamot na kasalukuyang iniinom. Kapag kumpleto ang weight at height, awtomatikong kukuwentahin ang BMI category gamit ang source workbook thresholds. Kung kulang ang measurements, puwedeng piliin ang naitalang category. Ang medicine entry ay frequency kada araw, hindi bilang ng stock o reseta.
- **NCD indicators:** may explicit Risk assessed at Yes/No medication-provided fields para sa HTN at DM. May live preview ng lahat ng 15 indicator columns; automatic ang age/sex group. Sa old records, retained ang dating treatment inference hanggang maglagay ng explicit Yes/No.
- **Medications:** hiwalay na page para sa lahat ng 12 workbook medication fields, per-patient editing at frequency totals.
- **Reports:** piliin ang reporting period at barangay, tingnan ang indicators, at i-export ang report workbook o CSV.
- **Equipment:** i-update ang bilang ng BP apparatus, glucometer at glucose test strips kada barangay.
- **Settings:** baguhin ang facility information, contact details kasama ang Viber number, eligible population at screening target kung kailangan.
- **CSV import:** i-download muna ang patient CSV template, sundin ang column headings, at i-import ang completed file. Puwedeng blank ang DOB kung hindi alam; ilagay ang edad sa bawat assessment. Patient demographics ang CSV import; JSON backup ang gamit para sa buong database at assessment history.
- **Backup:** gamitin ang **Back up your data** para mag-download ng JSON. Gamitin ang restore control para ibalik ang backup. Ang merge ay mag-a-update ng parehong record IDs; ang replace ay papalit sa kasalukuyang database kapag kinumpirma.

Ang report XLSX ay may anim na sheets: **MUNICIPAL INFO**, **NCD INDICATORS**, **NCD MEDICATION**, **eto yung format na pinapasa**, **ENCOUNTERS**, at **REPORT NOTES**. Ang indicators at submission register ay gumagamit ng pinakahuling assessment bawat patient sa napiling period; nasa ENCOUNTERS ang lahat ng matching visits. Ito ay generated report workbook; hindi ito eksaktong kopya ng original submission template.

Ginagamit ng reports ang kasalukuyang patient name, sex at barangay. Kapag itinama ang mga ito sa registry, maa-update rin ang dating period reports. Nananatiling hiwalay ang petsa, edad at findings ng bawat saved assessment.

## Excel import at Tagpos masterlist

Sa **Patient registry → Import Excel**, pumili ng `.xlsx` o `.xls` na sumusunod sa supplied PhilPEN masterlist layout (FAMILY NAME / FIRST NAME on row 10 or 13, data three rows below). I-review ang bilang, preview at source notes bago pindutin ang **Import records**. Lahat ng populated matching worksheets ay binabasa. Blank templates at Legend ay nilalaktawan. Kapag may invalid row, walang ise-save hangga’t hindi naitatama ang file. Repeated imports skip matching patients and same-date visits; hindi nito pinapalitan ang existing edits. I-edit sa app ang existing record kung may correction.

Sa supplied workbook, ang sheet na `June` ay may heading na **SEPTEMBER 2026**. May 158 exact assessment dates na September 1 at 246 blank assessment dates. Ang blank dates ay month-only records; internally ginagamit ang September 1 para sa sorting, pero month lang ang ipinapakita at ini-export. May 76 ages na hindi tugma sa birth date; pinanatili ang source age at may note sa assessment. Source BMI categories are retained.

Kasama ang original Excel sa `data/` at may download link sa Settings. Ayon sa explicit request ng owner, kasama ang patient seed at original workbook sa public repository; publicly downloadable ang patient data. Browser edits after installation remain local and are not automatically uploaded.

The offline Excel reader is SheetJS CE 0.20.3, bundled in `js/vendor/`, with its Apache 2.0 license. [Official browser documentation](https://docs.sheetjs.com/docs/getting-started/installation/standalone/).

## Saan naka-save ang data

May tunay na **IndexedDB database** ang app, na nasa browser profile ng computer. Hindi ito SQL database o database file sa tabi ng `index.html`, at hindi awtomatikong nagsi-sync sa ibang computer o staff.

Panatilihin ang parehong browser, profile at folder location. Ang pag-clear ng browser/site data, private browsing, paglipat ng profile o paglipat ng app ay maaaring magtanggal o maghiwalay ng saved records. Mag-export ng backup bago lumipat ng computer, browser o folder, at regular habang ginagamit ang system. Hindi sapat ang pagkopya ng application folder para makopya rin ang patient database.

May patient information ang JSON at CSV/XLSX exports. Itago ang mga ito sa protektadong lokasyon. Walang login, roles o application-level encryption ang local version. Windows account at browser/device access controls ang ginagamit para sa access protection.

## Ano ang galing sa Excel

Naka-seed ang tunay na municipal settings at **40 barangays**. Ang eligible population ay **200,900** at ang original annual screening target ay **80,360 (40%)**. Ang original dashboard workbook ay blank patient template. Kasama na ngayon ang **404 patients at 404 assessments** mula sa Tagpos September 2026 masterlist. Idinadagdag ito sa database sa unang pagbukas ng updated app; existing records are retained.

## Files

| Folder/file | Laman |
| --- | --- |
| `index.html` | Entry page at application shell |
| `css/` | Styling at responsive layout |
| `js/app.js` | Screens, forms at user interactions |
| `js/ui.js` | Reusable rendering, navigation at presentation helpers |
| `js/db.js` | IndexedDB storage, validation at backup/restore |
| `js/reports.js` | Calculations, CSV import/export at XLSX report generation |
| `js/excel-import.js` | Excel parsing, validation at masterlist column mapping |
| `assets/logo.jpg` | Supplied NCD logo |
| `data/tagpos-september-2026.js` | Initial patient and assessment data |
| `data/seed.js` | Reference settings at barangay data |
| `docs/` | Architecture, database API at workbook findings |

Developer notes: [Architecture](docs/architecture.md), [Database](docs/database.md), [Reporting](docs/reporting.md), [Workbook analysis](docs/workbook-analysis.md).

## Updated workbook review

Compared against PhilPEN-Dashboard (1).xlsx. See [field coverage](docs/workbook-field-audit.md) for all source sections, added controls and supported import layouts. The new workbook is a blank patient template; it does not replace the 404 existing Tagpos records. Use JSON backup/restore for a complete database roundtrip including explicit provided-status fields; source masterlist imports infer those statuses when the workbook has no dedicated status column.
