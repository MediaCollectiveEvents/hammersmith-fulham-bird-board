// Select one of the two UTC candidates for local noon; do not gate on runner hour.
// GitHub may start a scheduled run late, including after the other UTC trigger.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function londonNoonDecision({eventName,schedule,now=new Date()}) {
  // Manual dispatch and existing push refreshes must never be time-restricted.
  if(eventName!=='schedule')return {run:true,reason:'Non-scheduled refresh: London-time check bypassed.'};
  const utcHour={'0 11 * * *':'11','0 12 * * *':'12'}[schedule];
  if(!utcHour)throw Error(`Unrecognized scheduled refresh: ${schedule}`);
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));
  const day=`${parts.year}-${parts.month}-${parts.day}`;
  const candidate=new Date(`${day}T${utcHour}:00:00Z`);
  const hour=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',hourCycle:'h23'}).format(candidate);
  const run=hour==='12';
  return {run,reason:`${run?'Eligible':'Skipping'} ${utcHour}:00 UTC candidate for ${day}: ${hour}:00 Europe/London.`};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const event=JSON.parse(await fs.readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
  const result=londonNoonDecision({eventName:process.env.GITHUB_EVENT_NAME,schedule:event.schedule});
  if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,`run=${result.run}\n`);
  console.log(result.reason);
  if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,result.reason+'\n');
}
