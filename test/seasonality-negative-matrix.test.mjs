import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url).pathname;
const files=['species_migration_calendar.csv','seasonality_validation.csv','seasonality_audit.csv','seasonality_changes.csv','seasonality_metadata.json','seasonality_metadata.csv'];
function parse(text){const rows=[];let row=[],field='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++;}else if(c==='"')quoted=false;else field+=c;}else if(c==='"')quoted=true;else if(c===','){row.push(field);field='';}else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);field='';if(row.some(v=>v!==''))rows.push(row);row=[];}else field+=c;}if(field||row.length){row.push(field);rows.push(row);}const headers=rows.shift();return {headers,rows:rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])))};}
const cell=v=>/[",\r\n]/.test(String(v))?'"'+String(v).replaceAll('"','""')+'"':String(v);
const csv=(headers,rows)=>[headers,...rows.map(r=>headers.map(h=>r[h]??''))].map(r=>r.map(cell).join(',')).join('\n')+'\n';

async function fixture(t){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'hf-negative-matrix-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const archive=path.join(dir,'archive.csv'),publicFile=path.join(dir,'public.csv'),out=path.join(dir,'out');
 const rows=['COMMON NAME,OBSERVATION DATE,APPROVED,GLOBAL UNIQUE IDENTIFIER'];let id=0;
 for(const name of ['Alpha Bird','Beta Bird'])for(const year of [2022,2023,2024])for(let month=1;month<=12;month++)rows.push(`${name},${year}-${String(month).padStart(2,'0')}-15,1,fixture-${++id}`);
 await fs.writeFile(archive,rows.join('\n')+'\n');await fs.writeFile(publicFile,'COMMON NAME,marker\nAlpha Bird,a\nBeta Bird,b\n');
 const built=spawnSync(process.execPath,[path.join(root,'scripts/build-seasonality.mjs'),archive,publicFile],{encoding:'utf8',env:{PATH:process.env.PATH,SEASONALITY_OUTPUT_DIR:out}});
 assert.equal(built.status,0,built.stderr);
 const tables={};for(const file of files.filter(n=>n.endsWith('.csv')))tables[file]=parse(await fs.readFile(path.join(out,file),'utf8'));
 const metadata=JSON.parse(await fs.readFile(path.join(out,'seasonality_metadata.json'),'utf8'));
 return {dir,out,publicFile,tables,metadata,calendar:tables['species_migration_calendar.csv'].rows,audit:tables['seasonality_audit.csv'].rows,changes:tables['seasonality_changes.csv'].rows};
}
async function validate(f){
 for(const [file,table] of Object.entries(f.tables))if(file!=='seasonality_metadata.csv')await fs.writeFile(path.join(f.out,file),csv(table.headers,table.rows));
 await fs.writeFile(path.join(f.out,'seasonality_metadata.json'),JSON.stringify(f.metadata));
 await fs.writeFile(path.join(f.out,'seasonality_metadata.csv'),csv(Object.keys(f.metadata),[f.metadata]));
 return spawnSync(process.execPath,[path.join(root,'scripts/validate-seasonality.mjs'),f.publicFile],{encoding:'utf8',env:{PATH:process.env.PATH,SEASONALITY_OUTPUT_DIR:f.out}});
}
const cases=[
 ['missing calendar species',f=>{f.calendar.pop();},/PUBLIC_SPECIES MINUS CALENDAR_SPECIES/],
 ['unexpected calendar species',f=>{f.calendar[0]['COMMON NAME']='Unexpected Bird';},/CALENDAR_SPECIES MINUS PUBLIC_SPECIES/],
 ['duplicate calendar species',f=>{f.calendar[1]['COMMON NAME']=f.calendar[0]['COMMON NAME'];},/duplicate species/],
 ['blank calendar species',f=>{f.calendar[0]['COMMON NAME']='';},/PUBLIC_SPECIES MINUS CALENDAR_SPECIES/],
 ['blank public species',async f=>{await fs.writeFile(f.publicFile,'COMMON NAME,marker\nAlpha Bird,a\n,b\n');},/blank COMMON NAME/],
 ...[['arrival_month','0'],['arrival_month','13'],['departure_month','0'],['departure_month','13'],['arrival_month','April']].map(([field,value])=>[`${field}=${value}`,f=>{f.calendar[0][field]=value;},new RegExp(`invalid ${field}`)]),
 ['Resident with arrival',f=>{f.calendar[0].arrival_month='4';},/Resident has arrival\/departure month/],
 ['Resident with departure',f=>{f.calendar[0].departure_month='9';},/Resident has arrival\/departure month/],
 // High-evidence fixtures deliberately prevent the separate low-evidence rule
 // from masking a missing unconditional Scarce / Irregular timing check.
 ['Scarce / Irregular with arrival',f=>{Object.assign(f.calendar[0],{movement_type:'Scarce / Irregular',confidence:'Low',arrival_month:'4'});},/Scarce|scarce/],
 ['Scarce / Irregular with departure',f=>{Object.assign(f.calendar[0],{movement_type:'Scarce / Irregular',confidence:'Low',departure_month:'9'});},/Scarce|scarce/],
 ['invalid movement type',f=>{f.calendar[0].movement_type='Invented';},/invalid movement type/],
 ['invalid confidence',f=>{f.calendar[0].confidence='Certain';},/invalid confidence/],
 ['missing audit row',f=>{f.audit.pop();},/missing audit row/],
 ['low-evidence classification violation',f=>{f.audit[0].records='2';},/low evidence classification/],
 ['unchanged change-report row',f=>{f.changes.push({'COMMON NAME':'Alpha Bird',field_changed:'arrival_month',old_value:'3',new_value:'3',change_date:'2026-10-23'});},/no-op record/],
 ['duplicate change-report rows',f=>{const row={'COMMON NAME':'Alpha Bird',field_changed:'confidence',old_value:'Low',new_value:'Medium',change_date:'2026-10-23'};f.changes.push(row,{...row});Object.assign(f.metadata,{changes_detected:2,confidence_changes:2});Object.assign(f.tables['seasonality_validation.csv'].rows[0],{changes_detected:'2',confidence_changes:'2'});},/duplicate.*change|change.*duplicate/i],
 ['missing required metadata field',f=>{delete f.metadata.generated_at;},/required property 'generated_at'/],
 ['metadata schema violation',f=>{f.metadata.public_species_count='2';},/must be integer/],
 ['READY with failed validation',f=>{f.metadata.validation_passed=false;},/READY status dependency violated/],
 ['FAILED with success flags',f=>{f.metadata.expected_board_status='FAILED';f.tables['seasonality_validation.csv'].rows[0].expected_board_status='FAILED';},/board status is FAILED/],
 ['INCOMPLETE with success flags',f=>{f.metadata.expected_board_status='INCOMPLETE';f.tables['seasonality_validation.csv'].rows[0].expected_board_status='INCOMPLETE';},/board status is INCOMPLETE/],
 ['metadata species-count mismatch',f=>{f.metadata.calendar_species_count=3;},/species counts do not match/]
];
test('negative matrix control: valid fixture passes',async t=>{assert.equal((await validate(await fixture(t))).status,0);});
for(const [label,mutate,reason] of cases)test(`validator must reject: ${label}`,async t=>{
 const f=await fixture(t);await mutate(f);const result=await validate(f);
 assert.notEqual(result.status,0,`UNEXPECTED ACCEPTANCE: ${label}`);
 assert.match(result.stderr,reason);
});

const html=await fs.readFile(path.join(root,'dist/index.html'),'utf8');
const loader=html.split('\n').find(l=>l.includes('async function loadMigrationCalendar()'));
assert.ok(loader,'Test must execute the actual browser loader');
const message='Seasonal guidance is temporarily unavailable while borough migration data is being rebuilt.';
async function browserLoad(metadata){
 const requested=[];let displayed;
 const context=vm.createContext({console:{warn(){}},fetch:async url=>{requested.push(url);return {ok:true,json:async()=>metadata,text:async()=>''};},parseCsvRows(){throw new Error('Invalid-state tests must not fetch/parse calendar');},render(){displayed=vm.runInContext('migrationCalendar===null ? migrationCalendarUnavailableMessage : "calendar displayed"',context);}});
 vm.runInContext(`let migrationCalendar=null;const migrationCalendarUnavailableMessage=${JSON.stringify(message)};${loader}`,context);
 await vm.runInContext('loadMigrationCalendar()',context);
 return {requested,displayed};
}
for(const status of ['FAILED','INCOMPLETE'])test(`browser suppresses ${status} even with otherwise passing flags`,async()=>{
 const result=await browserLoad({expected_board_status:status,validation_passed:true,reconciliation_passed:true,missing_from_calendar:0,unexpected_in_calendar:0,duplicate_species_found:false,invalid_months_found:false,invalid_movement_types_found:false,invalid_confidence_values_found:false});
 assert.equal(result.displayed,message);assert.deepEqual(result.requested,['./data/seasonality_metadata.json']);
});
