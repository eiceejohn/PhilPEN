# PhilPEN community health workspace

Isang offline patient registry at reporting system na nakabase sa `PhilPEN-Dashboard.xlsx`.

## Paano buksan

1. Panatilihing magkakasama ang buong `PhilPEN` folder at lahat ng laman nito.
2. I-double-click ang **index.html**, o piliin ang **Open with → Microsoft Edge / Google Chrome**.
3. Gumamit ng regular browser window at parehong browser profile sa bawat pagbukas.

Walang kailangang i-install. Walang server, internet connection, account, CDN o build command na kailangan.

## Paano gamitin

- **Patients:** magdagdag o mag-edit ng patient, pagkatapos ay mag-record ng assessment. May hiwalay na assessment history bawat patient.
- **Assessments:** ilagay ang petsa, risk factors, measurements, hypertension/diabetes status at gamot na kasalukuyang iniinom. Kapag kumpleto ang weight at height, awtomatikong kukuwentahin ang BMI category gamit ang source workbook thresholds. Kung kulang ang measurements, puwedeng piliin ang naitalang category. Ang medicine entry ay frequency kada araw, hindi bilang ng stock o reseta.
- **Reports:** piliin ang reporting period at barangay, tingnan ang indicators, at i-export ang report workbook o CSV.
- **Equipment:** i-update ang bilang ng BP apparatus, glucometer at glucose test strips kada barangay.
- **Settings:** baguhin ang facility information, contact details, eligible population at screening target kung kailangan.
- **CSV import:** i-download muna ang patient CSV template, sundin ang column headings, at i-import ang completed file. Puwedeng blank ang DOB kung hindi alam; ilagay ang edad sa bawat assessment. Patient demographics ang CSV import; JSON backup ang gamit para sa buong database at assessment history.
- **Backup:** gamitin ang **Back up your data** para mag-download ng JSON. Gamitin ang restore control para ibalik ang backup. Ang merge ay mag-a-update ng parehong record IDs; ang replace ay papalit sa kasalukuyang database kapag kinumpirma.

Ang report XLSX ay may anim na sheets: **MUNICIPAL INFO**, **NCD INDICATORS**, **NCD MEDICATION**, **eto yung format na pinapasa**, **ENCOUNTERS**, at **REPORT NOTES**. Ang indicators at submission register ay gumagamit ng pinakahuling assessment bawat patient sa napiling period; nasa ENCOUNTERS ang lahat ng matching visits. Ito ay generated report workbook; hindi ito eksaktong kopya ng original submission template.

Ginagamit ng reports ang kasalukuyang patient name, sex at barangay. Kapag itinama ang mga ito sa registry, maa-update rin ang dating period reports. Nananatiling hiwalay ang petsa, edad at findings ng bawat saved assessment.

## Saan naka-save ang data

May tunay na **IndexedDB database** ang app, na nasa browser profile ng computer. Hindi ito SQL database o database file sa tabi ng `index.html`, at hindi awtomatikong nagsi-sync sa ibang computer o staff.

Panatilihin ang parehong browser, profile at folder location. Ang pag-clear ng browser/site data, private browsing, paglipat ng profile o paglipat ng app ay maaaring magtanggal o maghiwalay ng saved records. Mag-export ng backup bago lumipat ng computer, browser o folder, at regular habang ginagamit ang system. Hindi sapat ang pagkopya ng application folder para makopya rin ang patient database.

May patient information ang JSON at CSV/XLSX exports. Itago ang mga ito sa protektadong lokasyon. Walang login, roles o application-level encryption ang local version. Windows account at browser/device access controls ang ginagamit para sa access protection.

## Ano ang galing sa Excel

Naka-seed ang tunay na municipal settings at **40 barangays**. Ang eligible population ay **200,900** at ang original annual screening target ay **80,360 (40%)**. Walang populated patient record sa source workbook: ang 2,000 numbered rows ay blank template. Kaya empty ang patient database sa unang pagbukas.

## Files

| Folder/file | Laman |
| --- | --- |
| `index.html` | Entry page at application shell |
| `css/` | Styling at responsive layout |
| `js/app.js` | Screens, forms at user interactions |
| `js/ui.js` | Reusable rendering, navigation at presentation helpers |
| `js/db.js` | IndexedDB storage, validation at backup/restore |
| `js/reports.js` | Calculations, CSV import/export at XLSX report generation |
| `data/seed.js` | Reference settings at barangay data |
| `docs/` | Architecture, database API at workbook findings |

Developer notes: [Architecture](docs/architecture.md), [Database](docs/database.md), [Reporting](docs/reporting.md), [Workbook analysis](docs/workbook-analysis.md).
