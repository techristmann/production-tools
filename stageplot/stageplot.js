/* PCO Stage Plot - main code. Loaded by the small "Stage Plot" bookmark (see stageplot/index.html).
   Adds "Stage Plot AM" and "Stage Plot PM" to a Bentonville plan on the Bentonville Stage Plot template,
   with each service's band placed roughly in position, leaders along the bottom left,
   the production coordinator bottom center, and the tech team bottom right. */
(async()=>{
const ST=1014028,TPL=16286,TZ='America/Chicago',B=location.origin,API=B+'/~api/services/v2/';
const COLORS={BAND:'blue',LEADER:'green',PRODUCTION:'orange','WC TECH':'red'};
const PLOTS=[['Stage Plot AM',h=>h<12],['Stage Plot PM',h=>h>=12]];

/* ---------- small panel on the page ---------- */
const old=document.getElementById('__spPanel');if(old)old.remove();
const panel=document.createElement('div');panel.id='__spPanel';
panel.style.cssText='position:fixed;top:16px;right:16px;z-index:2147483647;width:340px;max-height:80vh;overflow:auto;background:#fff;color:#222;border-radius:10px;box-shadow:0 6px 28px rgba(0,0,0,.28);font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;padding:16px 18px';
panel.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b style="font-size:16px">Stage Plot</b><button id="__spX" style="border:0;background:none;font-size:20px;cursor:pointer;color:#666" title="Close">&times;</button></div><div id="__spLog"></div>';
document.body.appendChild(panel);
panel.querySelector('#__spX').onclick=()=>panel.remove();
const logEl=panel.querySelector('#__spLog');
const say=(t,style)=>{const p=document.createElement('div');p.style.cssText='margin:3px 0;'+(style||'');p.innerHTML=t;logEl.appendChild(p);return p;};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- API helpers (run inside your own Planning Center session) ---------- */
const csrf=()=>{const m=document.querySelector('meta[name="csrf-token"]');return m?m.content:'';};
const fix=u=>u.replace(/^https:\/\/api\.planningcenteronline\.com\/services\/v2\//,API);
const req=async(method,path,body)=>{
const r=await fetch(path.startsWith('http')?fix(path):API+path,{method,credentials:'same-origin',headers:{Accept:'application/json','Content-Type':'application/json','X-CSRF-Token':csrf()},body:body?JSON.stringify(body):undefined});
if(!r.ok){let t='';try{t=(await r.text()).slice(0,200);}catch(e){}throw new Error('Planning Center answered '+r.status+' ('+method+' '+path.split('?')[0].replace(API,'')+') '+t);}
if(r.status===204)return null;try{return await r.json();}catch(e){return null;}};
const all=async path=>{let url=API+path;const data=[],inc=[];while(url){const r=await req('GET',url);data.push(...r.data);inc.push(...(r.included||[]));url=r.links&&r.links.next?fix(r.links.next):null;}return{data,included:inc};};

/* ---------- layout (Bentonville Stage Plot template is 1000 x 515; x,y = tag's top-left) ---------- */
const isVox=p=>/vocal|voice|singer|bgv|choir/i.test(p.pos);
const isDrums=p=>/^drum/i.test(p.pos);
const isKeys=p=>/key|piano|synth|organ|aux/i.test(p.pos);
const isGuitar=p=>/acoustic|electric|guitar/i.test(p.pos);
const SLOTS={R1:[630,145],R2:[770,200],L1:[180,200],L2:[70,225],R3:[620,265],L3:[330,260],C2:[476,240],L4:[60,300],R4:[860,280]};
const PREF=p=>{const s=p.pos;
if(isKeys(p))return['R1','C2','R2','L1'];
if(/electric 1|electric$/i.test(s))return['R2','R1','L1'];
if(/electric/i.test(s))return['L1','R1','R2'];
if(/acoustic|guitar/i.test(s))return['R1','R2','L1'];
if(/violin|viola|cello|fiddle|string/i.test(s))return['L1','L2','L3'];
if(/cajon|perc|drum|bass/i.test(s))return['R3','L3','C2'];
return[];};
const ORDER=['R1','R2','L1','L2','R3','L3','C2','L4','R4'];
const rank=(list,pos)=>{for(let i=0;i<list.length;i++)if(list[i].test(pos))return i;return list.length;};

function layout(people){
const out=[];const put=(p,x,y)=>out.push({p,x:Math.round(x),y:Math.round(y)});
const band=people.filter(p=>p.team==='BAND');
const singerIds=new Set(band.filter(isVox).map(p=>p.personId));
const instr=band.filter(p=>!isVox(p));
const used=new Set();let drumsDone=false,bassDone=false;
const back=[];
/* front line: one spot per singer, instrument tag tucked under their vocal tag */
const front=[];
const bySinger={};
band.filter(isVox).forEach(p=>{(bySinger[p.personId]=bySinger[p.personId]||{vox:[],inst:null}).vox.push(p);});
instr.forEach(p=>{
if(singerIds.has(p.personId)&&!isDrums(p)&&!bySinger[p.personId].inst){bySinger[p.personId].inst=p;return;}
back.push(p);});
Object.values(bySinger).forEach(e=>front.push(e));
/* back line */
back.sort((a,b)=>rank([/^drum/i,/bass/i,/key|piano|synth|organ/i,/electric 1/i,/electric/i,/acoustic/i],a.pos)-rank([/^drum/i,/bass/i,/key|piano|synth|organ/i,/electric 1/i,/electric/i,/acoustic/i],b.pos));
back.forEach(p=>{
let xy=null;
if(isDrums(p)&&!drumsDone){drumsDone=true;xy=[476,118];}
else if(/^bass/i.test(p.pos)&&!bassDone){bassDone=true;xy=[325,138];}
else{const k=PREF(p).concat(ORDER).find(k=>!used.has(k));if(k){used.add(k);xy=SLOTS[k];}else xy=[476+(out.length%5)*40-80,280];}
put(p,xy[0],xy[1]);
/* a drummer who also sings: vocal tag stacked on top of the drums tag */
if(isDrums(p)&&bySinger[p.personId]){bySinger[p.personId].vox.forEach((v,i)=>put(v,xy[0],xy[1]-20*(i+1)));front.splice(front.indexOf(bySinger[p.personId]),1);}
});
/* order the front line: first guitar singer far left, keys singers right, extra guitar singers far right, vocalists in the middle */
const g=front.filter(e=>e.inst&&isGuitar(e.inst)),k=front.filter(e=>e.inst&&isKeys(e.inst)),o=front.filter(e=>!(e.inst&&(isGuitar(e.inst)||isKeys(e.inst))));
const line=[...g.slice(0,1),...o,...k,...g.slice(1)];
const n=line.length;
const L=n<=2?330:n<=4?270:n<=6?220:160,R=n<=2?610:n<=4?670:n<=6?730:790;
line.forEach((e,i)=>{const x=n===1?470:L+(R-L)*i/(n-1);
if(e.inst){e.vox.forEach((v,j)=>put(v,x,338-20*j));put(e.inst,x,358);}
else e.vox.forEach((v,j)=>put(v,x,340-20*j));});
/* bottom row */
const Y=477,STEP=72;
const leaders=people.filter(p=>p.team==='LEADER').sort((a,b)=>rank([/teach/i,/host/i,/point/i],a.pos)-rank([/teach/i,/host/i,/point/i],b.pos));
leaders.forEach((p,i)=>put(p,i*(STEP+2),Y));
const coords=people.filter(p=>p.team==='PRODUCTION'&&/coord/i.test(p.pos));
coords.forEach((p,i)=>put(p,470-(coords.length-1)*STEP/2+i*STEP,Y));
const tech=people.filter(p=>p.team==='WC TECH').sort((a,b)=>{const r=[/engineer/i,/audio 1/i,/audio 2/i,/audio/i,/graphic|gfx|propres/i,/light/i,/livestream$/i,/livestream/i];return rank(r,a.pos)-rank(r,b.pos);});
const coordEnd=coords.length?470+(coords.length-1)*STEP/2+80:leaders.length*STEP;
const tStep=tech.length>1?Math.min(STEP,(922-coordEnd)/(tech.length-1)):STEP;
tech.forEach((p,i)=>put(p,922-(tech.length-1-i)*tStep,Y));
return out;}

/* ---------- main ---------- */
try{
let pid;
const m=location.pathname.match(/\/plans\/(\d+)/);
if(m)pid=m[1];
else{const p=(await req('GET','service_types/'+ST+'/plans?filter=future&per_page=1&fields[Plan]=dates')).data[0];if(!p)throw new Error('No upcoming Bentonville plan found.');pid=p.id;}
let plan;
try{plan=(await req('GET','service_types/'+ST+'/plans/'+pid+'?fields[Plan]=dates,title')).data.attributes;}
catch(e){throw new Error('This plan isn\'t in Bentonville Worship Gatherings. Open a Bentonville plan and click the bookmark again.');}
say('<b>'+esc(plan.dates)+'</b>'+(plan.title?'<br><span style="color:#666">'+esc(plan.title)+'</span>':''));
const status=say('Reading the schedule...','color:#666');

const [times,members,stages]=await Promise.all([
all('service_types/'+ST+'/plans/'+pid+'/plan_times?per_page=100'),
all('service_types/'+ST+'/plans/'+pid+'/team_members?per_page=100&include=team'),
all('service_types/'+ST+'/plans/'+pid+'/stages?per_page=100&fields[Stage]=name')]);
const hourOf={};
times.data.forEach(t=>{if(t.attributes.time_type==='service'&&t.attributes.starts_at)hourOf[t.id]=+new Date(t.attributes.starts_at).toLocaleString('en-US',{timeZone:TZ,hour:'numeric',hour12:false}).replace(/\D/g,'')%24;});
const teamName={};members.included.filter(x=>x.type==='Team').forEach(t=>{teamName[t.id]=t.attributes.name.trim().toUpperCase();});
const people=members.data.filter(d=>d.attributes.status!=='D').map(d=>({
ppid:d.id,team:teamName[d.relationships.team.data&&d.relationships.team.data.id]||'',pos:d.attributes.team_position_name||'',name:d.attributes.name||'',
personId:d.relationships.person.data?d.relationships.person.data.id:d.id,
hours:((d.relationships.service_times&&d.relationships.service_times.data)||[]).map(x=>hourOf[x.id]).filter(h=>h!==undefined)})).filter(p=>COLORS[p.team]);

/* which plots to build */
const jobs=PLOTS.map(([name,test])=>({name,people:people.filter(p=>p.hours.length?p.hours.some(test):true),existing:stages.data.filter(s=>s.attributes.name.trim().toLowerCase()===name.toLowerCase())}))
.filter(j=>Object.values(hourOf).some(PLOTS.find(x=>x[0]===j.name)[1])&&j.people.length);
if(!jobs.length)throw new Error('Nobody from Band, Leader, Production Coordinator or WC Tech is scheduled on this plan yet.');
if(window.__spDry){window.__spDry=jobs.map(j=>({name:j.name,spots:layout(j.people).map(s=>[s.p.team,s.p.pos,s.p.name,s.x,s.y])}));status.textContent='Dry run only.';return;}
const dup=jobs.filter(j=>j.existing.length);
if(dup.length&&!confirm('This plan already has '+dup.map(j=>'"'+j.name+'"').join(' and ')+'.\n\nReplace '+(dup.length>1?'them':'it')+' with freshly placed plot'+(dup.length>1?'s':'')+'? Any hand adjustments on '+(dup.length>1?'those plots':'that plot')+' will be lost.')){status.textContent='Cancelled. Nothing was changed.';return;}

for(const job of jobs){
status.textContent='Building '+job.name+'...';
for(const s of job.existing)await req('DELETE','service_types/'+ST+'/plans/'+pid+'/stages/'+s.id);
const created=await req('POST','service_types/'+ST+'/plans/'+pid+'/stages',{data:{type:'Stage',attributes:{name:job.name},relationships:{stage_template:{data:{type:'StageTemplate',id:String(TPL)}}}}});
const sid=created.data.id;
if((created.data.attributes||{}).name!==job.name)await req('PATCH','service_types/'+ST+'/plans/'+pid+'/stages/'+sid,{data:{type:'Stage',attributes:{name:job.name}}});
const spots=layout(job.people);
let done=0;const fails=[];
for(let i=0;i<spots.length;i+=4){
await Promise.all(spots.slice(i,i+4).map(async s=>{
try{await req('POST','service_types/'+ST+'/plans/'+pid+'/stages/'+sid+'/stage_members',{fields:{StageMember:[]},data:{attributes:{x:s.x,y:s.y,color:COLORS[s.p.team],size:'1.0',variant:'name_small'},relationships:{plan_person:{data:{id:s.p.ppid}}}}});done++;}
catch(e){fails.push(s.p.name+' ('+s.p.pos+')');}}));
status.textContent='Building '+job.name+'... '+done+' of '+spots.length;}
const url=B+'/plans/'+pid+'/stages/'+sid+'/edit';
const band=job.people.filter(p=>p.team==='BAND').length;
say('&#10003; <a href="'+url+'" target="_blank" style="color:#2a7a3b;font-weight:600">'+esc(job.name)+'</a>: '+done+' tags ('+band+' band)'+(fails.length?'<br><span style="color:#a00">Couldn\'t place: '+esc(fails.join(', '))+'</span>':''));}
const skipped=PLOTS.map(p=>p[0]).filter(n=>!jobs.some(j=>j.name===n));
if(skipped.length)say('Skipped '+skipped.join(', ')+': no one scheduled for that service.','color:#666');
status.textContent='Done. Click a plot above to fine-tune it in the stage editor.';
const btn=document.createElement('button');btn.textContent='Reload this page';btn.style.cssText='margin-top:10px;padding:6px 14px;font-size:14px;cursor:pointer';btn.onclick=()=>location.reload();logEl.appendChild(btn);
}catch(e){say('Something went wrong: '+esc(e.message),'color:#a00');}
})();
