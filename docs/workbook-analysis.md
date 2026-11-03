# Workbook mapping

Source: `PhilPEN-Dashboard.xlsx`, read without changing the source file. Content and notes in the workbook were treated as data describing the workflow.

The workbook is a blank patient template with real municipal reference data. It contains **40 barangays**, an eligible population of **200,900**, a **40%** annual screening target of **80,360**, and **zero populated patient records**. The 2,000 numbered patient rows are template slots, not patients. No sample patients are included in the application database.

| Workbook sheet and range | System purpose |
| --- | --- |
| MUNICIPAL INFO!B5:B12 | Province, LGU, eligible population, reporting contact and target rate |
| MUNICIPAL INFO!D6:J45 | Barangay population by sex and annual, monthly, quarterly targets |
| MUNICIPAL INFO!B14:B17 | Equipment counts; source values are blank |
| NCD INDICATORS!A1:BI43 | Barangay reports for 20–59 and 60+ groups, split by sex |
| NCD MEDICATION!A1:Z44 | Screening, diagnoses, medicines and equipment report structure; source counts are blank |
| eto yung format na pinapasa!B2:CB12 | Facility and period fields, patient column headings and report totals |
| eto yung format na pinapasa!B13:CB2012 | Empty patient assessment template with age and BMI formulas |
| Legend!A2:B41 and E2:E41 | Facility names and barangay mapping |

## Patient fields

The source captures assessment date, family/first/middle name, suffix, sex, birth date, barangay, address and PhilHealth number. It records tobacco use, binge drinking, insufficient physical activity, unhealthy diet, weight, height, hypertension and diabetes. Hypertension and diabetes medication support are recorded separately as facility-provided or out-of-pocket. A person may have both conditions and may receive support through both sources.

Medication fields are amlodipine 5/10 mg, losartan 50/100 mg, simvastatin, atorvastatin, hydrochlorothiazide, metformin 500 mg, gliclazide and insulin R/NPH/70–30. Source cells BP13:CA2012 record frequency per day, using 1, 2 or 3. Frequency totals are not medicine stock or dispensed quantities. The medication sheet spells gliclazide as “Glicazide”; the app uses “Gliclazide.”

BMI is weight in kilograms divided by height in metres squared. The source formula in AJ13 uses the bands below. These are reproduced as workbook reporting categories; the app does not infer hypertension or diabetes diagnoses from measurements.

| BMI | Source category |
| --- | --- |
| Below 18.5 | Underweight |
| 18.5 to below 23 | Normal |
| 23 to below 25 | Overweight |
| 25 and above | Obese |

## Source issues and implementation decisions

- **Population lookup references:** Legend!B5 uses MUNICIPAL INFO!H27 for Mahabang Parang and B8 uses H39 for Tatala. These are annual targets, not eligible populations. Legend!B22 uses F32, the female population, for Pila Pila. The application seeds total populations from MUNICIPAL INFO column G, while preserving all explicit targets from columns H:J.
- **Historical age:** J13:J2012 calculates age using TODAY(). This would move historical assessments between age groups as time passes. The system should calculate age on the assessment date and include everyone aged 60 or above in the senior band.
- **Incomplete age totals:** J12:M12 stops at row 1997 even though the patient template continues to row 2012. Its sex range has one column, while its age range has four. Direct record aggregation avoids the mismatched range and excludes no final rows.
- **Senior upper bound:** Several COUNTIFS formulas limit seniors to age 100, despite the visible label “60-UP.” Reports should not silently exclude patients older than 100.
- **Missing medicine total:** BV12 has no formula although BV13:BV2012 accepts hydrochlorothiazide frequency.
- **Screening accomplishment:** MUNICIPAL INFO!B34, under “Accomplishment for Total Eligible Pop.,” simply links to H5 (annual target). It is not a completed screening count or an accomplishment rate. Screening coverage and progress toward target need their own explicit denominators.
- **Separate rounding:** Individual barangay monthly targets sum to 6,695, while MUNICIPAL INFO!I5 stores 6,697. Quarterly targets sum to 20,093, while J5 stores 20,090. These source values are preserved rather than silently changing the reference data. Male, female, population and annual target sums reconcile exactly.
- **Facility naming:** Legend!A11 labels the Kalawaan mapping as “RHU II - DARANGAN BHS.” The application preserves this source mapping rather than guessing a replacement.
- **Blank inputs:** No equipment counts or patient records were supplied. The application starts without clinical records. Empty source slots are not imported as real patients.

## Storage and reports

This application uses a browser-local IndexedDB database so it can start by opening `index.html`. Reference data loads from `data/seed.js`. HTML, CSS, JavaScript, reference data and documentation are separate files. Patient editing, assessment history and reports should operate on saved records with stable identifiers. JSON database backups are the portable copy of local data; keep a backup before changing browser profiles or moving to another computer.

The original workbook has formatting and formulas for reports but no populated reporting counts. Reports generated by the app must be calculated from the saved assessments for the chosen period, barangay and age/sex groups. Data exports provide a reviewable system report; they should not be described as the original Excel submission template unless the original layout is explicitly reproduced.
