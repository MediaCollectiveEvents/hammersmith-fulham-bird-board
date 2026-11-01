import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {publicationDecision,checkPublicationHead} from '../scripts/check-publication-head.mjs';
const A='a'.repeat(40),B='b'.repeat(40),C='c'.repeat(40);
// Discrete-event model of the serialized workflow. Every start checks out main;
// the production gate is exercised at both artifact and deployment boundaries.
function publisher(){let head=A,active=null;const queued=[],published=[];return {
 commit(sha,event='push'){head=sha;queued.push({event,eventSha:sha});},
 notify(event,eventSha=A){queued.push({event,eventSha});},
 start(index=0){assert.equal(active,null,'Only one Pages deployment may be active');const event=queued.splice(index,1)[0];assert(event);active={event,sha:head,validated:true};return active.sha;},
 gate(){return publicationDecision(active.sha,head).publish;},
 finish({validated=true}={}){if(validated&&this.gate())published.push(active.sha);active=null;},
 finishAfterFinalGate(){published.push(active.sha);active=null;},
 drain(){while(queued.length){this.start();this.finish();}},
 get head(){return head;},get published(){return published;}
};}
test('freshness gate fails closed on missing or non-full identities',()=>{assert.throws(()=>publicationDecision('',A));assert.throws(()=>publicationDecision(A,'main'));assert.equal(publicationDecision(A,A).publish,true);assert.equal(publicationDecision(A,B).publish,false);});
test('code merge and refresh together: any delayed event selects latest committed main',()=>{const p=publisher();p.notify('push',A);p.commit(B,'refresh-completed');assert.equal(p.start(),B);p.finish();p.drain();assert.equal(p.published.at(-1),B);assert(p.published.every(x=>x===B));});
test('refresh during validation skips stale upload and publishes the committed successor',()=>{const p=publisher();p.notify('push');p.start();p.commit(B,'refresh-completed');assert.equal(p.gate(),false);p.finish();p.drain();assert.deepEqual(p.published,[B]);});
test('second refresh during artifact upload is caught by the second gate',()=>{const p=publisher();p.commit(B);p.start();assert(p.gate());p.commit(C,'refresh-completed');assert.equal(p.gate(),false);p.finish();p.drain();assert.deepEqual(p.published,[C]);});
test('commit just after final gate cannot let an old deployment finish after a newer one',()=>{const p=publisher();p.notify('push');p.start();assert(p.gate());p.commit(B,'refresh-completed');assert.throws(()=>p.start(),/one Pages/);p.finishAfterFinalGate();p.drain();assert.deepEqual(p.published,[A,B]);assert.equal(p.published.at(-1),p.head);});
test('out-of-order completed events never republish their obsolete event snapshot',()=>{const p=publisher();p.commit(B);p.drain();p.notify('delayed-old-push',A);p.notify('delayed-old-refresh-completed',A);p.drain();assert.deepEqual(p.published,[B,B,B]);});
test('failed/partial refresh completion still reconciles valid committed main; invalid snapshots do not publish',()=>{const p=publisher();p.commit(B,'partial-refresh-failed-after-valid-successes-committed');p.drain();assert.equal(p.published.at(-1),B);p.notify('failed-with-no-commit',A);p.start();p.finish({validated:false});assert.deepEqual(p.published,[B]);p.notify('completed-retry');p.drain();assert.equal(p.published.at(-1),B);});
test('scheduled and manual refresh completions use the same latest-main path',()=>{for(const event of ['schedule-completed','workflow_dispatch-completed']){const p=publisher();p.commit(B,event);p.drain();assert.deepEqual(p.published,[B]);}});
test('production workflows wire a sole publisher, fresh checkout and two gates without cancelling active deploys',async()=>{
 const pages=await fs.readFile(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8'),refresh=await fs.readFile(new URL('../.github/workflows/update-ebird.yml',import.meta.url),'utf8');
 assert.match(pages,/workflow_run:[\s\S]*workflows: \[Update eBird observations\]/);assert.match(pages,/types: \[completed\]/);assert.match(pages,/ref: main/);assert.match(pages,/cancel-in-progress: false/);assert.equal((pages.match(/run: node scripts\/check-publication-head.mjs/g)||[]).length,2);assert.match(pages,/steps.before_deploy.outputs.publish == 'true'/);assert.match(pages,/head_repository.full_name == github.repository/);assert.doesNotMatch(pages,/conclusion == 'success'/);
 assert.doesNotMatch(refresh,/deploy-pages|configure-pages|upload-pages-artifact|pages: write|id-token:/);assert.match(refresh,/Validate candidate feeds and archives before committing/);assert.match(refresh,/if: failure\(\)/);assert.match(refresh,/actions\/upload-artifact@v4/);assert.match(refresh,/retention-days: 7/);assert.match(refresh,/git push origin HEAD:main/);assert.doesNotMatch(refresh,/--force/);
});
test('real git remote fence detects main advancing and CLI reports skip without changing candidate',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'bird-publish-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const remote=path.join(dir,'origin.git'),repo=path.join(dir,'candidate');
 const git=(args,cwd)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 git(['init','--bare',remote],dir);git(['clone',remote,repo],dir);git(['config','user.name','Publication test'],repo);git(['config','user.email','publication@example.invalid'],repo);git(['checkout','-b','main'],repo);await fs.writeFile(path.join(repo,'data.txt'),'first');git(['add','.'],repo);git(['commit','-m','first'],repo);git(['push','origin','main'],repo);const first=git(['rev-parse','HEAD'],repo);assert((await checkPublicationHead({cwd:repo})).publish);
 await fs.writeFile(path.join(repo,'data.txt'),'new committed data');git(['commit','-am','second'],repo);git(['push','origin','main'],repo);const latest=git(['rev-parse','HEAD'],repo);git(['checkout','--detach',first],repo);const result=await checkPublicationHead({cwd:repo});assert.deepEqual(result,{candidate:first,main:latest,publish:false});
 const output=path.join(dir,'output');execFileSync(process.execPath,[fileURLToPath(new URL('../scripts/check-publication-head.mjs',import.meta.url))],{cwd:repo,env:{...process.env,GITHUB_OUTPUT:output,GITHUB_STEP_SUMMARY:path.join(dir,'summary')}});assert.match(await fs.readFile(output,'utf8'),/publish=false/);assert.equal(git(['rev-parse','HEAD'],repo),first);assert.equal(git(['status','--porcelain'],repo),'');
});
