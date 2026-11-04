# Workbook field coverage

Source: PhilPEN-Dashboard (1).xlsx, reviewed 2026-11-04. The workbook remains unchanged.

| Excel section | App coverage | Change |
| --- | --- | --- |
| NCD INDICATORS B:O / AF:AS | Risk assessed; tobacco; binge drinking; inactivity; unhealthy diet; overweight; obese | Added explicit risk-assessed control and full live preview. BMI category supplies overweight/obese flags. |
| NCD INDICATORS P:W / AT:BA | Hypertension; medication provided; facility; out of pocket | Added independent medication-provided status; retained condition and source fields. |
| NCD INDICATORS X:AE / BB:BI | Type II diabetes; medication provided; facility; out of pocket | Added independent medication-provided status; retained condition and source fields. |
| Male/female × ages 20–59/60+ | Derived from registered sex and assessment age | All 60 report columns now visible in the screen matrix. |
| NCD MEDICATION K:V | Amlodipine 5/10 mg, Losartan 50/100 mg, Simvastatin, Atorvastatin, Hydrochlorothiazide, Metformin, Gliclazide, Insulin R/NPH/70-30 | All 12 fields retained, now also available through a dedicated medication screen with edit controls and totals. |
| NCD MEDICATION W:Z | Manual/automatic BP apparatus, glucometer, test strips | Already covered in Equipment and exports. |
| MUNICIPAL INFO | Province, LGU, population, targets, contact, phone, Viber, email | Added Viber field and export. Population 200,900 and target 40% match the baseline. |
| Submission register | Patient identity, birth date, sex, age, barangay, address, PhilHealth, visit date, weight/height, findings, medicines, remarks | Covered by registry/assessment; updated import accepts headers on row 10 as well as row 13. |
| Legend | Facilities, barangays, months and target population reference | Already available through reference seed, filters and report exports. |

The dashboard medication layout has BU=Atorvastatin, BV=Hydrochlorothiazide, BW=Metformin and BX=Gliclazide. Tagpos uses different columns; mapping is selected from headers, never from the filename. Blank template rows and aggregate sheets are not converted into artificial patient records.

The 15 unique indicators repeat across two age groups and two sexes. They are not 60 separate inputs per patient. Explicit medication-provided status is distinct from medicine frequency. Existing rows preserve their inferred status until edited.
