# PhilPEN local database

The app uses the browser's native **IndexedDB** database, `PhilPEN-Offline`, schema version 1. Opening `index.html` directly requires no server, package installation, or cloud account. Patient records remain in the browser profile on this computer. The database is not a file written next to `index.html`.

Use the same browser, profile, and application location each time. Browser handling of local `file://` origins varies; changing browsers, moving the app, using private browsing, or clearing website data can make records unavailable or remove them. Export JSON backups regularly, retain them in a protected location, and confirm that a backup can be restored. Backups contain patient information and are not encrypted. This local edition does not provide shared accounts, server synchronization, access permissions, or encryption at rest beyond protections supplied by the browser and operating system.

If the browser refuses storage, an upgrade is blocked, or its storage quota is exhausted, the database rejects the operation with an error. The UI must display the error. There is no silent in-memory or `localStorage` fallback and no successful save response before transaction completion.

## Source and API

`js/db.js` is a plain, strict-mode script that exposes `window.PhilDB`. Load it before `app.js`; no ES modules or build tools are required. All operations return promises except `createId` and `validateRecord`.

```js
await PhilDB.init(window.PHILPEN_SEED);
const patients = await PhilDB.all('patients');
const saved = await PhilDB.put('patients', patient);
const backup = await PhilDB.snapshot();
await PhilDB.restore(backup, { replace: false });
```

| Method | Result and behavior |
| --- | --- |
| `init(seed)` | Opens the database and creates `settings/main` only when absent. Uses `seed.settings`; does not populate patient or assessment records. Returns `true`. |
| `all(store)` | Returns all stored records as an array. The caller chooses display ordering. |
| `get(store, id)` | Returns a record or `null`. |
| `put(store, record)` | Validates and upserts a whole record, then returns the normalized saved record. Missing patient or assessment IDs are generated. It is not a partial patch. |
| `bulkPut(store, records)` | Validates and saves a batch atomically; returns normalized saved records in input order. Duplicate IDs in a batch are rejected. |
| `remove(store, id)` | Returns `true` if a record was deleted, otherwise `false`. Deleting a patient also deletes all linked assessments in the same transaction. |
| `snapshot()` | Returns a consistent backup containing all five tables. |
| `restore(snapshot, { replace: false })` | Merges by record ID. Imported IDs overwrite matching records; other local records remain. Returns `{ mode, counts }`. |
| `restore(snapshot, { replace: true })` | Validates first, then clears and replaces all tables in one transaction. The UI must obtain explicit confirmation before calling this mode. |
| `createId(prefix)` | Returns a new string ID. |
| `validateRecord(store, record)` | Returns a normalized record or throws `ValidationError`. Does not check database relationships or save anything. |

`put`, `bulkPut`, and `remove` manage activity history automatically. Direct mutation of the `audit` table is prohibited; `restore` accepts validated history from a backup. Settings cannot be deleted. Application writes use one transaction across relevant tables, so a failure aborts every change in the operation. Database reads do not create audit entries. The local audit log is an activity aid, not a tamper-proof compliance log.

## Tables

Every table uses `id` as its primary key.

* `patients`: first, middle, and last names; suffix; `sex` (`M` or `F`); optional `dob` (`YYYY-MM-DD`); barangay, address, PhilHealth number, phone, and creation/update timestamps. First and last names and sex are required. Birthday may be omitted because the assessment records age.
* `assessments`: patient ID; assessment date and age (20–120); smoking, binge drinking, inactivity, unhealthy diet, hypertension, and diabetes booleans; optional weight and height; optional BMI class (`underweight`, `normal`, `overweight`, or `obese`); separate hypertension and diabetes medicine sources; medication frequencies; remarks; and optional next-visit date. The patient must exist. A next visit cannot precede the assessment.
* `equipment`: barangay name as ID, integer quantities for manual and automatic BP apparatus, glucometers, and test strips, and an update timestamp. Missing quantities become zero. Equipment begins empty.
* `settings`: the single record `id: "main"`, containing province, LGU, facility, address, eligible population, target rate, contact name, contact phone, and email. **Target rate is a fraction from 0 to 1**; `0.4` means 40%.
* `audit`: activity ID, UTC timestamp, action, table, affected record ID, and brief details. A patient's deletion leaves a deletion event without retaining their name.

Medicine sources are `""`, `"facility"`, `"out-of-pocket"`, or `"both"`. Medication keys are `amlodipine5`, `amlodipine10`, `losartan50`, `losartan100`, `simvastatin`, `atorvastatin`, `hydrochlorothiazide`, `metformin`, `gliclazide`, `insulinR`, `insulinNPH`, and `insulin7030`. Every frequency must be a whole number from 0 through 3. Missing medication frequencies become zero. These fields record workbook entries; they do not recommend prescriptions.

Indexes support assessment lookup by patient/date, patients by barangay, and activity by timestamp. The browser stores numeric values as numbers and booleans as booleans. Validation rejects numeric strings, invalid date formats, impossible calendar dates, invalid enums, missing references, duplicate backup IDs, and unreasonable counts. Dates range from 1900 through 2200. Normalized records retain only documented fields.

## Backup format

```json
{
  "schemaVersion": 1,
  "app": "PhilPEN",
  "exportedAt": "2026-10-28T00:00:00.000Z",
  "stores": {
    "patients": [],
    "assessments": [],
    "equipment": [],
    "settings": [{ "id": "main", "targetRate": 0.4 }],
    "audit": []
  }
}
```

Actual exports include all settings fields. Import requires all five arrays and exactly one settings row. Supported maximum imported counts are 50,000 patients, 250,000 assessments, 10,000 equipment rows, one settings row, and 500,000 history entries. An import validates all rows before writing and checks assessment references against the resulting patient set. A failed import leaves the prior database intact. A successful import adds a `restore` event after importing the included history.

## Excel imports

`PhilDB.importRecords({patients, assessments}, {once?: marker})` validates both tables before an atomic transaction. It adds new records, matches patients by normalized identity, remaps visit foreign keys, skips existing same-date visits, retains existing edits and logs the batch. A failed linked record rolls back the whole transaction. A one-time marker in audit prevents starter rows being re-added on every load.

Assessments support optional `datePrecision` (`day` by default, or `month`). Month-only imports use YYYY-MM-01 internally and are displayed/exported as a reporting month. Backups preserve precision and source remarks.
