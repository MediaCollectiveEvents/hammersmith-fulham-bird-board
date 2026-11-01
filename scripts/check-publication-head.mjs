// Read-only freshness gate shared by the Pages workflow and ordering tests.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const exec=promisify(execFile);
export function publicationDecision(candidate,main){
 if(!/^[a-f0-9]{40}$/.test(candidate)||!/^[a-f0-9]{40}$/.test(main))throw Error('Publication requires full candidate and main commit identities.');
 return {candidate,main,publish:candidate===main};
}
export async function checkPublicationHead({cwd=process.cwd()}={}){
 const candidate=(await exec('git',['rev-parse','HEAD'],{cwd})).stdout.trim();
 const refs=(await exec('git',['ls-remote','--exit-code','origin','refs/heads/main'],{cwd})).stdout.trim();
 return publicationDecision(candidate,refs.split(/\s+/)[0]);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=await checkPublicationHead();
 const output=`publish=${result.publish}\ncandidate_sha=${result.candidate}\nmain_sha=${result.main}\n`;
 if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,output);
 const message=result.publish?`Validated candidate ${result.candidate} still matches main.`:`Skipping stale candidate ${result.candidate}; main is now ${result.main}. A queued/new publication must select latest main.`;
 console.log(message);if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,message+'\n');
}
