# Application architecture

## Execution model

PhilPEN is a static, browser-local application. `index.html` loads ordinary deferred scripts in a fixed order: `data/seed.js`, `js/db.js`, `js/reports.js`, `js/ui.js`, then `js/app.js`. It does not use JavaScript modules, fetch local JSON, load CDN dependencies, or require a service worker, package manager or application server. This supports opening the entry page directly through `file://` in a regular Edge or Chrome window.

HTML owns the document shell and accessibility landmarks. CSS owns presentation and responsive layouts. JavaScript is separated by responsibilities. Reference data is a standalone script to avoid restrictions on fetching local files.

| Component | Responsibility |
| --- | --- |
| `index.html` | Script/style loading, sidebar, main content region, dialog and file inputs |
| `css/styles.css` | Theme, layouts, tables, forms, dialogs and responsive behavior |
| `js/app.js` | Navigation, rendering, form interaction, filtering and calls to storage/report APIs |
| `js/ui.js` | Reusable interface templates and presentation helpers |
| `js/db.js` | `window.PhilDB`: asynchronous persistence, normalized records, relationship validation, transactional changes and snapshots |
| `js/reports.js` | `window.PhilReports`: derived measures and portable report/import formats |
| `data/seed.js` | `window.PHILPEN_SEED`: source settings and 40 barangay reference records |

## Data flow

The UI submits structured records to `PhilDB`; it must wait for the returned promise before displaying a successful save. Reports read saved patients and assessments and derive their results using the selected period and geography. Rendering must escape text values. Report exports download local files and do not transmit data to an external service.

Database `PhilPEN-Offline` version 1 contains `patients`, `assessments`, `equipment`, `settings` and `audit`. Every object store uses `id` as the key. Assessments reference `patients.id`; removing a patient also removes their assessments in a single transaction. `settings/main` is seeded only when missing. The source workbook contains no patient records, so initialization does not create patient or assessment fixtures.

Barangay reference data is loaded from `data/seed.js`; it is not a mutable database table. The source provides exact eligible populations and rounded annual/monthly/quarterly targets. See the workbook analysis before changing those source values or population lookups.

## Calculation semantics

Assessments carry a reporting date and age. Age should be calculated on the assessment date when a birth date is known. Adults aged 20–59 and seniors aged 60+ are reported separately by sex. Source risk factors and diagnoses are recorded observations, not automatically inferred diagnoses.

BMI uses kilograms and metres. When both measurements are entered, the application calculates and saves the category using the source workbook thresholds: underweight below 18.5, normal from 18.5 to below 23, overweight from 23 to below 25, and obese from 25. When either measurement is unavailable, the encoder can select the category already recorded during assessment. Reports read that saved category. Medication values represent frequency per day. They must not be represented as stock, dispensed tablet quantities or prescribing recommendations.

The indicators, medication report and submission register count one patient using their latest assessment in the selected reporting period. ENCOUNTERS includes every matching assessment. Each monthly trend point counts unique patients independently, so monthly counts should not be summed to calculate annual unique coverage. The generated XLSX has six sheets: MUNICIPAL INFO, NCD INDICATORS, NCD MEDICATION, eto yung format na pinapasa, ENCOUNTERS and REPORT NOTES. It is a data report rather than a byte-for-byte or pixel-identical copy of the source template.

Historical reports use the patient's current registered name, sex and barangay. Correcting those demographics therefore changes existing period aggregates and exports. Assessment date, age, measurements and recorded findings remain separate visit records. This version does not retain a separate demographic snapshot for every visit.

## Portability and storage

IndexedDB is a transactional browser database, not SQL and not a database file distributed with the application. Storage is scoped by browser/profile/origin. Local-file origin behavior may differ between browser versions, so users should keep the same browser, profile and application location and use JSON backups when moving. A browser may deny storage or reach its storage quota; the app must surface the actual save failure rather than imply records persisted.

`PhilDB.snapshot()` reads all five stores consistently. JSON restore validates schema, values and relationships before applying changes. Merge restores upsert matching record IDs. Replace restores clear and replace the stores and must be explicitly confirmed in the UI. Preserve a backup before replacement. A JSON snapshot is the whole-database interchange format; patient CSV import is for demographics, not an assessment-history restore.

CSV/XLSX exports are user-readable report artifacts. The patient CSV template uses `id,firstName,lastName,middleName,suffix,sex,dob,barangay,address,philhealth,phone`. DOB may be blank; a nonblank DOB must be a valid ISO date (`YYYY-MM-DD`). Assessment age remains required when DOB is unknown. Do not treat exported reports as interchangeable with a full JSON backup.

## Access model and extension boundary

This local edition has no authentication, server-side authorization, role separation, multiuser synchronization or application-level encryption. The audit store is a useful local activity history, not a tamper-proof audit system. The device and browser profile owner can access local data. Backups and exports contain patient information and must be protected using the organization's device, account and file-access controls.

A shared deployment needs a separate backend, an authenticated API, authorization policies, a centrally managed database and backup/recovery controls. A SQL schema file alone would not make a directly opened HTML page a shared database system. Keep the present data/report APIs separate from any later transport adapter so a backend can be introduced without mixing persistence into rendering logic.

See `database.md` for record fields, method contracts and backup limits; `workbook-analysis.md` records source ranges and known formula defects.
