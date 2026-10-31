// Read-only validation of published files. Reuses the production validators;
// never runs refresh/archive writers or requires private upstream inputs.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=process.cwd(),dist=path.join(root,'dist');
const read=relative=>fs.readFile(path.join(root,relative),'utf8');
const json=async relative=>JSON.parse(await read(relative));
const moduleAt=relative=>import(pathToFileURL(path.join(root,relative)).href);
async function files(dir){const result=[];for(const entry of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())result.push(...await files(file));else if(entry.isFile())result.push(file);}return result;}
const published=await files(dist);let jsonCount=0;
for(const file of published.filter(f=>f.endsWith('.json')||f.endsWith('.webmanifest'))){JSON.parse(await fs.readFile(file,'utf8'));jsonCount++;}
console.log(`${jsonCount} published JSON/manifest files parse.`);
const require=createRequire(path.join(root,'package.json'));
const Ajv=require('ajv/dist/2020.js').default,addFormats=require('ajv-formats').default;
const ajv=new Ajv({allErrors:true});addFormats(ajv);
const validate=ajv.compile(await json('schemas/seasonality_metadata.schema.json'));
assert(validate(await json('dist/data/seasonality_metadata.json')),JSON.stringify(validate.errors));
const {validateRankings,verifyRelease}=await moduleAt('dist/bird-rankings-data.mjs');
await verifyRelease(validateRankings(await json('dist/data/bird-rankings.json')),await read('dist/data/seasonality_metadata.json'),await read('dist/data/species_migration_calendar.csv'));
const {createSpeciesLookup,validateImages}=await moduleAt('dist/bird-cards-data.mjs');
const lookup=createSpeciesLookup(await json('dist/data/ebird-history.json'));
for(const image of validateImages(await json('dist/data/bird-images.json'),lookup).values())for(const key of ['imageUrl','smallImageUrl'])await fs.access(path.resolve(dist,image[key]));
console.log('Published metadata schema, READY release hashes, rankings, species identities and verified photo assets pass.');
for(const file of published.filter(f=>f.endsWith('.html'))){const html=await fs.readFile(file,'utf8');for(const match of html.matchAll(/(?:src|href)=["'](\.\/[^"'#?]+)["']/g)){if(match[1].includes('${'))continue;await fs.access(path.resolve(path.dirname(file),match[1]));}}
for(const folder of ['dist','scripts','test','tests']){let entries;try{entries=await files(path.join(root,folder));}catch(e){if(e.code==='ENOENT')continue;throw e;}for(const file of entries.filter(f=>/\.(?:mjs|cjs|js)$/.test(f))){execFileSync(process.execPath,['--check',file],{stdio:'pipe'});}}
console.log('JavaScript syntax and literal HTML asset paths pass.');
const directory=path.join(dist,'data/sightings-archive');let names;
try{names=await fs.readdir(directory);}catch(e){if(e.code!=='ENOENT')throw e;}
if(names){
 const {buildMonthlyArchives}=await moduleAt('scripts/archive-sightings.mjs');
 const prior=new Map();for(const name of names.filter(n=>/^\d{4}-\d{2}\.json$/.test(n)).sort())prior.set(name.slice(0,7),JSON.parse(await fs.readFile(path.join(directory,name),'utf8')));
 const rebuilt=buildMonthlyArchives(await json('dist/data/observations.json'),prior);
 assert.deepEqual(rebuilt,prior,'Checked-in monthly archives differ from the in-memory validated rebuild');
 const index=JSON.parse(await fs.readFile(path.join(directory,'index.json'),'utf8'));
 assert.equal(index.schemaVersion,1);assert.equal(index.source,'eBird');assert.equal(index.timeZone,'Europe/London');
 assert.deepEqual(index.months,[...rebuilt].map(([month,a])=>({month,...a.totals,coverage:a.coverage})),'Monthly index differs from retained records');
 for(const archive of prior.values())assert(archive.records.every(r=>!Object.hasOwn(r,'observer')),'Observer names must not appear in monthly archives');
 console.log(`${rebuilt.size} monthly archives reproduce in memory; totals/index/privacy pass. No files written.`);
}else console.log('No monthly archives on this ref; archive checks not applicable.');
