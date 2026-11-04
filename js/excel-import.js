/* Offline Excel reader and source-to-database mapping. SheetJS is bundled locally. */
(function (g) {
'use strict';
const MONTHS=['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
const text=v=>v==null?'':String(v).trim();
const key=v=>text(v).normalize('NFKC').toLowerCase().replace(/\s+/g,' ');
function identity(p){return [p.lastName,p.firstName,p.middleName,p.suffix,p.sex,p.dob,p.barangay].map(key).join('|');}
function hash(s){let a=2166136261,b=5381;for(let i=0;i<s.length;i++){a=Math.imul(a^s.charCodeAt(i),16777619);b=Math.imul(b,33)^s.charCodeAt(i);}return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');}
function iso(v,date1904){if(v==null||v==='')return '';if(typeof v==='number'){const d=g.XLSX.SSF.parse_date_code(v,{date1904:!!date1904});if(!d)throw Error('Invalid Excel date.');return [d.y,String(d.m).padStart(2,'0'),String(d.d).padStart(2,'0')].join('-');}const s=text(v);let m=s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T].*)?$/);if(m)return m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');m=s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);if(m)return m[3]+'-'+m[1].padStart(2,'0')+'-'+m[2].padStart(2,'0');throw Error('Use a real Excel date, YYYY-MM-DD, or MM/DD/YYYY.');}
function ageAt(dob,date){if(!dob)return null;return Number(date.slice(0,4))-Number(dob.slice(0,4))-(date.slice(5)<dob.slice(5)?1:0);}
function barangay(v){const s=key(v).replace(/^(brgy\.?|barangay)\s*/,'');const found=(g.PHILPEN_SEED.barangays||[]).find(b=>key(b.name)===s);if(!found)throw Error('Unrecognized barangay: '+text(v));return found.name;}
function parseWorkbook(wb){
 const result={patients:[],assessments:[],errors:[],warnings:[],sheets:[],sourceRows:0};const seen=new Map();
 const date1904=wb.Workbook?.WBProps?.date1904;
 for(const name of wb.SheetNames){const ws=wb.Sheets[name];if(!ws){result.errors.push(name+': Worksheet could not be read.');continue;}const at=(c,r)=>ws[c+r]?.v;const header=[10,13].find(r=>key(at('D',r))==='family name'&&key(at('E',r))==='first name');
 if(!header)continue;
 const dashboardLayout=key(at('BU',header))==='atorvastatin'&&key(at('BV',header))==='hydrochlorothiazide';
 const tagposLayout=key(at('BV',header))==='metformin'&&key(at('BW',header))==='gliclazide';
 if(!dashboardLayout&&!tagposLayout){result.errors.push(name+': Unsupported medication headers. Check columns BT:BX.');continue;}
 const rowNums=[...new Set(Object.keys(ws).filter(k=>/^[DE]\d+$/.test(k)).map(k=>Number(k.replace(/\D/g,''))))].filter(r=>r>header+2&&(text(at('D',r))||text(at('E',r)))).sort((a,b)=>a-b);
 if(!rowNums.length)continue;if(rowNums.length>50000)throw Error('A worksheet may contain at most 50,000 patient rows.');
 const month=MONTHS.indexOf(text(at('V',header-8)).toUpperCase())+1,year=Number(at('BI',header-8));
 const period=month&&year>=1900&&year<=2200?year+'-'+String(month).padStart(2,'0'):'';
 result.sheets.push({name,rows:rowNums.length,period,facility:text(at('E',header-6))});
 for(const r of rowNums){result.sourceRows++;const label=name+' row '+r;
 try{
 const warnings=[];const val=c=>at(c,r);const flag=(start,end)=>{let yes=false;for(let c=g.XLSX.utils.decode_col(start);c<=g.XLSX.utils.decode_col(end);c++){const v=val(g.XLSX.utils.encode_col(c));if(v==null||v==='')continue;if(v!==0&&v!==1&&v!=='0'&&v!=='1')throw Error('Expected 0 or 1 in '+g.XLSX.utils.encode_col(c)+'.');if(Number(v)===1)yes=true;}return yes;};
 const male=Number(val('H'))===1,female=Number(val('I'))===1;if(male===female)throw Error('Exactly one sex column (H/I) must be marked 1.');
 const p={firstName:text(val('E')),lastName:text(val('D')),middleName:text(val('F')),suffix:text(val('G')),sex:male?'M':'F',dob:iso(val('N'),date1904),barangay:barangay(val('O')),address:text(val('P')),philhealth:text(val('Q')),phone:''};
 p.id='xls-p-'+hash(identity(p));
 let date=iso(val('B'),date1904),precision='day';if(!date){if(!period)throw Error('Missing assessment date and reporting month/year.');date=period+'-01';precision='month';warnings.push('Assessment day is blank; reporting month '+period+' is stored with a first-day sorting value.');}
 if(period&&date.slice(0,7)!==period)warnings.push('Assessment date is outside the worksheet reporting month '+period+'.');
 const ages=['J','K','L','M'].map(val).filter(v=>v!=null&&v!==''&&Number(v)>0);if(ages.length>1&&new Set(ages.map(Number)).size>1)throw Error('Conflicting ages in J:M.');const age=ages.length?Number(ages[0]):ageAt(p.dob,date);if(age!==ageAt(p.dob,date)&&p.dob)warnings.push('Recorded age '+age+' differs from age calculated from birth date; source age retained.');
 const sourceBMI=key(val('AJ'));let bmiClass=['normal','underweight','overweight','obese'].includes(sourceBMI)?sourceBMI:'';
 if(!bmiClass){if(flag('AN','AQ'))bmiClass='obese';else if(flag('AJ','AM'))bmiClass='overweight';}
 const weightKg=val('AH')==null||val('AH')===''?null:Number(val('AH')),heightM=val('AI')==null||val('AI')===''?null:Number(val('AI'));
 if(weightKg&&heightM){const bmi=weightKg/heightM**2;const calculated=bmi<18.5?'underweight':bmi<23?'normal':bmi<25?'overweight':'obese';if(!bmiClass)bmiClass=calculated;else if(calculated!==bmiClass)warnings.push('Recorded BMI category differs from calculated category; source category retained.');}
 const source=(pocket,facility)=>pocket&&facility?'both':pocket?'out-of-pocket':facility?'facility':'';
 const meds={};for(const [c,k] of [['BP','amlodipine5'],['BQ','amlodipine10'],['BR','losartan50'],['BS','losartan100'],['BT','simvastatin'],...(dashboardLayout?[['BU','atorvastatin'],['BV','hydrochlorothiazide'],['BW','metformin'],['BX','gliclazide']]:[['BV','metformin'],['BW','gliclazide']]),['BY','insulinR'],['BZ','insulinNPH'],['CA','insulin7030']])meds[k]=val(c)==null||val(c)===''?0:Number(val(c));
 // These source dose columns have no separate field in the municipal schema.
 if(!dashboardLayout&&(Number(val('BU'))||Number(val('BX'))))throw Error('Simvastatin 40 mg / Gliclazide 80 mg needs manual mapping; no medication columns were shifted.');
 const notes=['Imported from '+name+', row '+r+'.',...warnings,text(val('CB'))].filter(Boolean).join('\n');
 const a={id:'xls-a-'+hash(p.id+'|'+date),patientId:p.id,date,datePrecision:precision,age,smoker:flag('R','U'),bingeDrinker:flag('V','Y'),inactive:flag('Z','AC'),unhealthyDiet:flag('AD','AG'),weightKg,heightM,bmiClass,hypertension:flag('AR','AU'),diabetes:flag('AV','AY'),htnSource:source(flag('AZ','BC'),flag('BH','BK')),dmSource:source(flag('BD','BG'),flag('BL','BO')),medications:meds,remarks:notes,nextVisit:''};
 const np=g.PhilDB.validateRecord('patients',p),na=g.PhilDB.validateRecord('assessments',a);
 if(np.dob>na.date)throw Error('Assessment precedes date of birth.');
 if(seen.has(p.id)&&seen.get(p.id)!==identity(p))throw Error('Patient identifier collision.');
 if(!seen.has(p.id)){seen.set(p.id,identity(p));result.patients.push(np);}
 if(result.assessments.some(old=>old.id===na.id))throw Error('Duplicate patient and assessment date within workbook; review these source rows.');
 result.assessments.push(na);warnings.forEach(w=>result.warnings.push(label+': '+w));
 }catch(error){result.errors.push(label+': '+error.message);}
 }
 }
 if(!result.sheets.length)result.errors.push('No populated PhilPEN masterlist found. Expected FAMILY NAME / FIRST NAME on row 10 or 13 and data three rows below. Use the supplied masterlist layout.');
 return result;
}
async function readFile(file){if(!/\.(xlsx|xls)$/i.test(file.name))throw Error('Choose an .xlsx or .xls file.');if(file.size>30*1024*1024)throw Error('Excel file must be 30 MB or smaller.');if(!g.XLSX)throw Error('Excel reader is missing. Keep js/vendor with the app.');const wb=g.XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false,cellFormula:false,cellHTML:false});return parseWorkbook(wb);}
g.PhilExcel=Object.freeze({readFile,parseWorkbook,identity,iso});
})(window);
