/* PCO Stage Plot - main code. Loaded by the small "Stage Plot" bookmark (see stageplot/index.html).
   Works on "Stage Plot AM" and "Stage Plot PM" (Bentonville Stage Plot template) for a Bentonville plan:
   Create   - build both plots from scratch with everyone placed roughly in position
   Update   - add newly scheduled people and remove dropped ones; nobody already on the plot moves,
              and a replacement takes the spot of the person they replaced (same team + position)
   Reorient - evenly re-space the front line and the bottom row, keeping everyone's left-to-right order */
(async()=>{
const ST=1014028,TPL=16286,TZ='America/Chicago',B=location.origin,API=B+'/~api/services/v2/';
const COLORS={BAND:'blue',LEADER:'green',PRODUCTION:'orange','WC TECH':'red'};
const PLOTS=[['Stage Plot AM',h=>h<12],['Stage Plot PM',h=>h>=12]];

/* ---------- panel ---------- */
const old=document.getElementById('__spPanel');if(old)old.remove();
const panel=document.createElement('div');panel.id='__spPanel';
panel.style.cssText='position:fixed;top:16px;right:16px;z-index:2147483647;width:360px;max-height:85vh;overflow:auto;background:#fff;color:#222;border-radius:10px;box-shadow:0 6px 28px rgba(0,0,0,.28);font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;padding:16px 18px';
panel.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b style="font-size:16px">Stage Plot</b><button id="__spX" style="border:0;background:none;font-size:20px;cursor:pointer;color:#666" title="Close">&times;</button></div><div id="__spHead"></div><div id="__spBtns" style="display:flex;flex-direction:column;gap:8px;margin:10px 0"></div><div id="__spLog"></div>';
document.body.appendChild(panel);
panel.querySelector('#__spX').onclick=()=>panel.remove();
const head=panel.querySelector('#__spHead'),btns=panel.querySelector('#__spBtns'),logEl=panel.querySelector('#__spLog');
const say=(t,style)=>{const p=document.createElement('div');p.style.cssText='margin:3px 0;'+(style||'');p.innerHTML=t;logEl.appendChild(p);return p;};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const first=n=>String(n||'').split(' ')[0];

/* ---------- API helpers (run inside your own Planning Center session) ---------- */
const csrf=()=>{const m=document.querySelector('meta[name="csrf-token"]');return m?m.content:'';};
const fix=u=>u.replace(/^https:\/\/api\.planningcenteronline\.com\/services\/v2\//,API);
const req=async(method,path,body)=>{
const r=await fetch(path.startsWith('http')?fix(path):API+path,{method,credentials:'same-origin',headers:{Accept:'application/json','Content-Type':'application/json','X-CSRF-Token':csrf()},body:body?JSON.stringify(body):undefined});
if(!r.ok){let t='';try{t=(await r.text()).slice(0,200);}catch(e){}throw new Error('Planning Center answered '+r.status+' ('+method+' '+path.split('?')[0].replace(API,'')+') '+t);}
if(r.status===204)return null;try{return await r.json();}catch(e){return null;}};
const all=async path=>{let url=API+path;const data=[],inc=[];while(url){const r=await req('GET',url);data.push(...r.data);inc.push(...(r.included||[]));url=r.links&&r.links.next?fix(r.links.next):null;}return{data,included:inc};};
const batch=async(items,fn)=>{for(let i=0;i<items.length;i+=4)await Promise.all(items.slice(i,i+4).map(fn));};

/* ---------- positions (Bentonville Stage Plot is 1000 x 515; x,y = tag's top-left) ---------- */
const isVox=p=>/vocal|voice|singer|bgv|choir/i.test(p.pos);
const isDrums=p=>/^drum/i.test(p.pos);
const isKeys=p=>/key|piano|synth|organ|aux/i.test(p.pos);
const isGuitar=p=>/acoustic|electric|guitar/i.test(p.pos);
const DRUMS=[476,118],BASS=[325,138];
const SLOTS={R1:[630,145],R2:[770,200],L1:[180,200],L2:[70,225],R3:[620,265],L3:[330,260],C2:[476,240],L4:[60,300],R4:[860,280]};
const ORDER=['R1','R2','L1','L2','R3','L3','C2','L4','R4'];
const PREF=p=>{const s=p.pos;
if(isKeys(p))return['R1','C2','R2','L1'];
if(/electric 1|electric$/i.test(s))return['R2','R1','L1'];
if(/electric/i.test(s))return['L1','R1','R2'];
if(/acoustic|guitar/i.test(s))return['R1','R2','L1'];
if(/violin|viola|cello|fiddle|string/i.test(s))return['L1','L2','L3'];
if(/cajon|perc|drum|bass/i.test(s))return['R3','L3','C2'];
return[];};
const rank=(list,pos)=>{for(let i=0;i<list.length;i++)if(list[i].test(pos))return i;return list.length;};
const BACKR=[/^drum/i,/bass/i,/key|piano|synth|organ/i,/electric 1/i,/electric/i,/acoustic/i];
const LEADR=[/teach/i,/host/i,/point/i];
const TECHR=[/engineer/i,/audio 1/i,/audio 2/i,/audio/i,/graphic|gfx|propres/i,/light/i,/livestream$/i,/livestream/i];
const Y=477,STEP=72,LSTEP=74,VOXY=338,INSTY=358,SOLOY=340;
const frontXs=n=>{const L=n<=2?330:n<=4?270:n<=6?220:160,R=n<=2?610:n<=4?670:n<=6?730:790;return Array.from({length:n},(_,i)=>n===1?470:L+(R-L)*i/(n-1));};
const isCoord=p=>p.team==='PRODUCTION'&&/coord/i.test(p.pos);
const bottomXs=(leaders,coords,tech)=>{
const lx=leaders.map((_,i)=>i*LSTEP);
const cx=coords.map((_,i)=>470-(coords.length-1)*STEP/2+i*STEP);
const coordEnd=coords.length?470+(coords.length-1)*STEP/2+80:leaders.length*LSTEP;
const ts=tech.length>1?Math.min(STEP,(922-coordEnd)/(tech.length-1)):STEP;
const tx=tech.map((_,i)=>922-(tech.length-1-i)*ts);
return{lx,cx,tx};};

/* full layout for Create */
function layout(people){
const out=[];const put=(p,x,y)=>out.push({p,x:Math.round(x),y:Math.round(y)});
const band=people.filter(p=>p.team==='BAND');
const singerIds=new Set(band.filter(isVox).map(p=>p.personId));
const used=new Set();let drumsDone=false,bassDone=false;
const back=[],front=[],bySinger={};
band.filter(isVox).forEach(p=>{(bySinger[p.personId]=bySinger[p.personId]||{vox:[],inst:null}).vox.push(p);});
band.filter(p=>!isVox(p)).forEach(p=>{
if(singerIds.has(p.personId)&&!isDrums(p)&&!bySinger[p.personId].inst){bySinger[p.personId].inst=p;return;}
back.push(p);});
Object.values(bySinger).forEach(e=>front.push(e));
back.sort((a,b)=>rank(BACKR,a.pos)-rank(BACKR,b.pos));
back.forEach(p=>{
let xy;
if(isDrums(p)&&!drumsDone){drumsDone=true;xy=DRUMS;}
else if(/^bass/i.test(p.pos)&&!bassDone){bassDone=true;xy=BASS;}
else{const k=PREF(p).concat(ORDER).find(k=>!used.has(k));if(k){used.add(k);xy=SLOTS[k];}else xy=[396+(out.length%5)*40,280];}
put(p,xy[0],xy[1]);
if(isDrums(p)&&bySinger[p.personId]){bySinger[p.personId].vox.forEach((v,i)=>put(v,xy[0],xy[1]-20*(i+1)));front.splice(front.indexOf(bySinger[p.personId]),1);}});
const g=front.filter(e=>e.inst&&isGuitar(e.inst)),k=front.filter(e=>e.inst&&isKeys(e.inst)),o=front.filter(e=>!(e.inst&&(isGuitar(e.inst)||isKeys(e.inst))));
const line=[...g.slice(0,1),...o,...k,...g.slice(1)];
const xs=frontXs(line.length);
line.forEach((e,i)=>{if(e.inst){e.vox.forEach((v,j)=>put(v,xs[i],VOXY-20*j));put(e.inst,xs[i],INSTY);}else e.vox.forEach((v,j)=>put(v,xs[i],SOLOY-20*j));});
const leaders=people.filter(p=>p.team==='LEADER').sort((a,b)=>rank(LEADR,a.pos)-rank(LEADR,b.pos));
const coords=people.filter(isCoord);
const tech=people.filter(p=>p.team==='WC TECH').sort((a,b)=>rank(TECHR,a.pos)-rank(TECHR,b.pos));
const{lx,cx,tx}=bottomXs(leaders,coords,tech);
leaders.forEach((p,i)=>put(p,lx[i],Y));coords.forEach((p,i)=>put(p,cx[i],Y));tech.forEach((p,i)=>put(p,tx[i],Y));
return out;}

try{
/* ---------- plan + schedule ---------- */
let pid;
const m=location.pathname.match(/\/plans\/(\d+)/);
if(m)pid=m[1];
else{const p=(await req('GET','service_types/'+ST+'/plans?filter=future&per_page=1&fields[Plan]=dates')).data[0];if(!p)throw new Error('No upcoming Bentonville plan found.');pid=p.id;}
let plan;
try{plan=(await req('GET','service_types/'+ST+'/plans/'+pid+'?fields[Plan]=dates,title')).data.attributes;}
catch(e){throw new Error('This plan isn\'t in Bentonville Worship Gatherings. Open a Bentonville plan and click the bookmark again.');}
head.innerHTML='<b>'+esc(plan.dates)+'</b>'+(plan.title?'<br><span style="color:#666">'+esc(plan.title)+'</span>':'');
const status=say('Reading the schedule...','color:#666');

let hourOf,sched,jobsAll;
const readSchedule=async()=>{
const [times,members,stages]=await Promise.all([
all('service_types/'+ST+'/plans/'+pid+'/plan_times?per_page=100'),
all('service_types/'+ST+'/plans/'+pid+'/team_members?per_page=100&include=team'),
all('service_types/'+ST+'/plans/'+pid+'/stages?per_page=100&fields[Stage]=name')]);
hourOf={};
times.data.forEach(t=>{if(t.attributes.time_type==='service'&&t.attributes.starts_at)hourOf[t.id]=+new Date(t.attributes.starts_at).toLocaleString('en-US',{timeZone:TZ,hour:'numeric',hour12:false}).replace(/\D/g,'')%24;});
const teamName={};members.included.filter(x=>x.type==='Team').forEach(t=>{teamName[t.id]=t.attributes.name.trim().toUpperCase();});
sched={};
members.data.filter(d=>d.attributes.status!=='D').forEach(d=>{sched[d.id]={
ppid:d.id,team:teamName[d.relationships.team.data&&d.relationships.team.data.id]||'',pos:d.attributes.team_position_name||'',name:d.attributes.name||'',
personId:d.relationships.person.data?d.relationships.person.data.id:d.id,
hours:((d.relationships.service_times&&d.relationships.service_times.data)||[]).map(x=>hourOf[x.id]).filter(h=>h!==undefined)};});
const relevant=Object.values(sched).filter(p=>COLORS[p.team]&&(p.team!=='PRODUCTION'||isCoord(p)));
jobsAll=PLOTS.filter(([,test])=>Object.values(hourOf).some(test)).map(([name,test])=>{
const inService=p=>!p.hours.length||p.hours.some(test);
return{name,test,inService,people:relevant.filter(inService),existing:stages.data.filter(s=>s.attributes.name.trim().toLowerCase()===name.toLowerCase())};});};

/* ---------- read a plot's current tags ---------- */
const loadTags=async sid=>{
const t=await (await fetch(B+'/plans/'+pid+'/stages/'+sid+'/edit',{credentials:'same-origin'})).text();
/* Planning Center has used two markups for the editor's data; accept either */
const doc=new DOMParser().parseFromString(t,'text/html');
const el=doc.querySelector('[data-tapestry-react-component-name="Components.Plans.StageContainer"]')||doc.querySelector('[data-react-class="Components.Plans.StageContainer"]');
const raw=el&&(el.getAttribute('data-tapestry-react-component-props')||el.getAttribute('data-react-props'));
if(!raw)throw new Error('Could not read the stage plot from Planning Center.');
const p=JSON.parse(raw);
const tn={};(p.teams||[]).forEach(t=>{tn[t.id]=String(t.name).trim().toUpperCase();});
return p.stage.stage_members.map(mm=>{const pp=mm.plan_person;const ppid=mm.plan_person_id?String(mm.plan_person_id):null;const s=ppid&&sched[ppid];
return{id:mm.id,x:mm.x,y:mm.y,ppid,team:s?s.team:(pp?tn[pp.team_id]||'':''),pos:s?s.pos:(pp&&pp.position)||'',personId:s?s.personId:null,
name:s?s.name:(pp&&pp.person?pp.person.first_name+' '+(pp.person.last_name||''):'(removed person)')};});};
const addTag=(sid,p,x,y)=>req('POST','service_types/'+ST+'/plans/'+pid+'/stages/'+sid+'/stage_members',{fields:{StageMember:[]},data:{attributes:{x:Math.round(x),y:Math.round(y),color:COLORS[p.team]||'blue',size:'1.0',variant:'name_small'},relationships:{plan_person:{data:{id:String(p.ppid)}}}}});
const moveTag=(sid,id,x,y)=>req('PATCH','service_types/'+ST+'/plans/'+pid+'/stages/'+sid+'/stage_members/'+id,{fields:{StageMember:[]},data:{attributes:{x:Math.round(x),y:Math.round(y)}}});
const delTag=(sid,id)=>req('DELETE','service_types/'+ST+'/plans/'+pid+'/stages/'+sid+'/stage_members/'+id);
const link=(job,sid)=>'<a href="'+B+'/plans/'+pid+'/stages/'+sid+'/edit" target="_blank" style="color:#2a7a3b;font-weight:600">'+esc(job.name)+'</a>';
const list=a=>a.map(esc).join(', ');

/* ---------- CREATE ---------- */
const createPlot=async job=>{
const created=await req('POST','service_types/'+ST+'/plans/'+pid+'/stages',{data:{type:'Stage',attributes:{name:job.name},relationships:{stage_template:{data:{type:'StageTemplate',id:String(TPL)}}}}});
const sid=created.data.id;
if((created.data.attributes||{}).name!==job.name)await req('PATCH','service_types/'+ST+'/plans/'+pid+'/stages/'+sid,{data:{type:'Stage',attributes:{name:job.name}}});
const spots=layout(job.people);let done=0;const fails=[];
await batch(spots,async s=>{try{await addTag(sid,s.p,s.x,s.y);done++;}catch(e){fails.push(s.p.name);}});
return{sid,done,fails};};
const doCreate=async()=>{
const jobs=jobsAll.filter(j=>j.people.length);
if(!jobs.length)throw new Error('Nobody from Band, Leader, Production Coordinator or WC Tech is scheduled on this plan yet.');
const dup=jobs.filter(j=>j.existing.length);
if(dup.length&&!confirm('This plan already has '+dup.map(j=>'"'+j.name+'"').join(' and ')+'.\n\nCreate starts over: '+(dup.length>1?'they':'it')+' will be replaced and every hand adjustment lost.\n\nTo keep your adjustments, cancel and use Update instead.'))return say('Create cancelled. Nothing was changed.','color:#666');
for(const job of jobs){
status.textContent='Creating '+job.name+'...';
for(const s of job.existing)await req('DELETE','service_types/'+ST+'/plans/'+pid+'/stages/'+s.id);
const r=await createPlot(job);
say('&#10003; '+link(job,r.sid)+' created: '+r.done+' tags'+(r.fails.length?'<br><span style="color:#a00">Couldn\'t place: '+list(r.fails)+'</span>':''));}};

/* ---------- UPDATE ---------- */
const doUpdate=async()=>{
let any=false;
for(const job of jobsAll){
status.textContent='Updating '+job.name+'...';
if(!job.existing.length){
if(!job.people.length)continue;
const r=await createPlot(job);any=true;
say('&#10003; '+link(job,r.sid)+' didn\'t exist yet, so it was created: '+r.done+' tags');continue;}
const sid=job.existing[0].id;
const tags=await loadTags(sid);
const removed=tags.filter(t=>!t.ppid||!sched[t.ppid]||!job.inService(sched[t.ppid]));
const kept=tags.filter(t=>!removed.includes(t));
const keptIds=new Set(kept.map(t=>t.ppid));
const adds=job.people.filter(p=>!keptIds.has(p.ppid));
const placed=kept.map(t=>({x:t.x,y:t.y,t}));
const free=(x,y)=>!placed.some(q=>Math.abs(q.x-x)<60&&Math.abs(q.y-y)<16);
const todo=[];const notes=[];
const place=(p,x,y,note)=>{todo.push({p,x,y});placed.push({x,y,t:p});if(note)notes.push(note);};
/* 1. replacements take the old spot (same team + position) */
const freed=[...removed];
const rest=[];
adds.forEach(a=>{const i=freed.findIndex(r=>r.team===a.team&&r.pos.toLowerCase()===a.pos.toLowerCase());
if(i>=0){const r=freed.splice(i,1)[0];place(a,r.x,r.y,first(a.name)+' took '+first(r.name)+'\'s '+a.pos+' spot');}else rest.push(a);});
/* 2. everyone else, grouped by person */
const byPerson={};rest.forEach(a=>{(byPerson[a.personId]=byPerson[a.personId]||[]).push(a);});
const tagOf=(pid2,pred)=>placed.find(q=>q.t.personId===pid2&&q.t.team==='BAND'&&pred(q.t));
const frontFree=()=>{for(const x of [470,400,540,330,610,270,670,220,730,160,790])if(free(x,SOLOY)&&free(x,INSTY))return x;return 470;};
const backFree=p=>{
if(isDrums(p)&&free(...DRUMS))return DRUMS;
if(/^bass/i.test(p.pos)&&free(...BASS))return BASS;
for(const k of PREF(p).concat(ORDER))if(free(...SLOTS[k]))return SLOTS[k];
return[396,290];};
Object.values(byPerson).forEach(group=>{
const band=group.filter(p=>p.team==='BAND');
const vox=band.filter(isVox),inst=band.filter(p=>!isVox(p));
/* band: stack with the same person's existing tag if they already have one */
vox.slice().forEach(v=>{const t=tagOf(v.personId,x=>!isVox(x));if(t){place(v,t.x,t.y-20);vox.splice(vox.indexOf(v),1);}});
inst.slice().forEach(n=>{const t=tagOf(n.personId,isVox);if(t&&!isDrums(n)){place(n,t.x,t.y+20);inst.splice(inst.indexOf(n),1);}});
if(vox.length){
const pair=inst.find(n=>!isDrums(n));
const x=frontFree();
if(pair){vox.forEach((v,j)=>place(v,x,VOXY-20*j));place(pair,x,INSTY);inst.splice(inst.indexOf(pair),1);}
else vox.forEach((v,j)=>place(v,x,SOLOY-20*j));
notes.push(first(vox[0].name)+' added to the front line');}
inst.sort((a,b)=>rank(BACKR,a.pos)-rank(BACKR,b.pos)).forEach(n=>{const xy=backFree(n);place(n,xy[0],xy[1]);});
/* bottom row */
group.filter(p=>p.team!=='BAND').forEach(p=>{
let cands;
if(p.team==='LEADER')cands=Array.from({length:8},(_,i)=>[i*LSTEP,Y]);
else if(isCoord(p))cands=[470,398,542,326,614].map(x=>[x,Y]);
else cands=Array.from({length:8},(_,i)=>[922-i*STEP,Y]);
const c=cands.find(c=>free(c[0],c[1]))||cands[0];place(p,c[0],c[1]);});});
/* apply */
const fails=[];
await batch(removed,async r=>{try{await delTag(sid,r.id);}catch(e){fails.push('remove '+r.name);}});
await batch(todo,async s=>{try{await addTag(sid,s.p,s.x,s.y);}catch(e){fails.push('add '+s.p.name);}});
if(removed.length||todo.length)any=true;
const addedNames=todo.map(s=>first(s.p.name)+' ('+s.p.pos+')');
const removedNames=removed.map(r=>first(r.name)+(r.pos?' ('+r.pos+')':''));
say('&#10003; '+link(job,sid)+': '+(removed.length||todo.length?'':'already up to date')+
(todo.length?'<br>Added: '+list(addedNames):'')+(removed.length?'<br>Removed: '+list(removedNames):'')+
(notes.length?'<br><span style="color:#666">'+list(notes)+'</span>':'')+
(fails.length?'<br><span style="color:#a00">Problems: '+list(fails)+'</span>':''));}
if(any)say('Nobody who was already on a plot was moved. Use Reorient if the spacing needs evening out.','color:#666');};

/* ---------- REORIENT ---------- */
const doReorient=async()=>{
for(const job of jobsAll){
if(!job.existing.length)continue;
status.textContent='Reorienting '+job.name+'...';
const sid=job.existing[0].id;
const tags=await loadTags(sid);
const moves=[];
const mv=(t,x,y)=>{x=Math.round(x);y=Math.round(y);if(t.x!==x||t.y!==y)moves.push({t,x,y});};
/* front line: each singer (not the drummer) with any instrument they play, in current left-to-right order */
const band=tags.filter(t=>t.team==='BAND');
const drummers=new Set(band.filter(isDrums).map(t=>t.personId));
const groups={};
band.filter(t=>isVox(t)&&t.personId&&!drummers.has(t.personId)).forEach(t=>{(groups[t.personId]=groups[t.personId]||{vox:[],inst:null}).vox.push(t);});
band.filter(t=>!isVox(t)&&!isDrums(t)&&groups[t.personId]).forEach(t=>{if(!groups[t.personId].inst)groups[t.personId].inst=t;});
const line=Object.values(groups).sort((a,b)=>Math.min(...a.vox.map(v=>v.x))-Math.min(...b.vox.map(v=>v.x)));
const xs=frontXs(line.length);
line.forEach((g,i)=>{g.vox.sort((a,b)=>b.y-a.y);
if(g.inst){g.vox.forEach((v,j)=>mv(v,xs[i],VOXY-20*j));mv(g.inst,xs[i],INSTY);}
else g.vox.forEach((v,j)=>mv(v,xs[i],SOLOY-20*j));});
/* bottom row: leaders left, coordinator center, tech right, in current order */
const byX=(a,b)=>a.x-b.x;
const leaders=tags.filter(t=>t.team==='LEADER').sort(byX);
const coords=tags.filter(isCoord).sort(byX);
const tech=tags.filter(t=>t.team==='WC TECH').sort(byX);
const{lx,cx,tx}=bottomXs(leaders,coords,tech);
leaders.forEach((t,i)=>mv(t,lx[i],Y));coords.forEach((t,i)=>mv(t,cx[i],Y));tech.forEach((t,i)=>mv(t,tx[i],Y));
const fails=[];
await batch(moves,async s=>{try{await moveTag(sid,s.t.id,s.x,s.y);}catch(e){fails.push(s.t.name);}});
say('&#10003; '+link(job,sid)+': '+(moves.length?'evened out '+line.length+' on the front line and '+(leaders.length+coords.length+tech.length)+' on the bottom row':'already evenly spaced')+
(fails.length?'<br><span style="color:#a00">Couldn\'t move: '+list(fails)+'</span>':''));}};

/* ---------- buttons ---------- */
await readSchedule();
const has=jobsAll.some(j=>j.existing.length);
status.textContent=jobsAll.map(j=>j.name+': '+(j.existing.length?'on the plan':'not created yet')).join(' · ');
const actions=[
['create','Create','Build both plots from scratch.'+(has?' Replaces the existing plots and any hand adjustments.':''),!has],
['update','Update','Add newly scheduled people and remove dropped ones. Nobody already placed moves.',has],
['reorient','Reorient','Evenly re-space the front line and bottom row, keeping everyone\'s order.',false]];
let busy=false;
const run=async(key,fn)=>{
if(busy)return;busy=true;btns.querySelectorAll('button').forEach(b=>b.disabled=true);
try{await readSchedule();await fn();status.textContent='Done. Click a plot name to fine-tune it, or reload the page to see it in Files.';}
catch(e){say('Something went wrong: '+esc(e.message),'color:#a00');}
busy=false;btns.querySelectorAll('button').forEach(b=>b.disabled=false);
const nowHas=jobsAll.some(j=>j.existing.length);btns.querySelector('[data-k="reorient"]').disabled=!nowHas;
if(!document.getElementById('__spReload')){const r=document.createElement('button');r.id='__spReload';r.textContent='Reload this page';r.style.cssText='margin-top:10px;padding:6px 14px;font-size:14px;cursor:pointer';r.onclick=()=>location.reload();panel.appendChild(r);}};
const fns={create:doCreate,update:doUpdate,reorient:doReorient};
actions.forEach(([k,label,desc,primary])=>{
const b=document.createElement('button');b.dataset.k=k;
b.style.cssText='text-align:left;padding:8px 12px;border-radius:7px;cursor:pointer;font:inherit;border:1px solid '+(primary?'#1f6f8b':'#c9d2d8')+';background:'+(primary?'#1f6f8b':'#f6f7f8')+';color:'+(primary?'#fff':'#1b2329');
b.innerHTML='<b>'+label+'</b><br><span style="font-size:12.5px;opacity:.85">'+esc(desc)+'</span>';
if(k==='reorient'&&!has)b.disabled=true;
b.onclick=()=>run(k,fns[k]);btns.appendChild(b);});
/* test hook: window.__spAuto='create'|'update'|'reorient' runs that action right away */
if(window.__spAuto&&fns[window.__spAuto]){const k=window.__spAuto;window.__spAuto=null;await run(k,fns[k]);}
}catch(e){say('Something went wrong: '+esc(e.message),'color:#a00');}
})();
