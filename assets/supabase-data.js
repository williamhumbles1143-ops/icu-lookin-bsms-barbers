(function(){
"use strict";
const cfg=window.ICU_SUPABASE_CONFIG;
const client=window.ICUAuth?.client || (window.supabase&&cfg?window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null);
if(!client){console.error("ICU Cloud: Supabase unavailable");return;}

const EDGE_URL=`${cfg.url}/functions/v1/public-booking`;
const RUNTIME_ARRAY_KEYS={
  "icuLookinAppointmentsV3":"appointments",
  "icuCustomServicesV1":"custom_services",
  "icuWalkinsV1":"walkins",
  "icuTimeOffV1":"time_off",
  "icuDepositPaymentsV1":"deposit_payments",
  "icuBoothRentPaymentsV1":"booth_rent_payments",
  "icuPosTransactionsV1":"pos_transactions",
  "icuReviewsV1":"reviews",
  "icuAppointmentMessagesV1":"appointment_messages"
};
const RUNTIME_MAP_KEYS={
  "icuLookinPricingV1":"pricing",
  "icuBarberServicePrefsV1":"service_prefs",
  "icuPaymentsV1":"payments",
  "icuClientNotesV1":"client_notes",
  "icuAvailabilityV1":"availability",
  "icuDepositSettingsV1":"deposit_settings",
  "icuFamilyV1":"family",
  "icuPreferencesV1":"preferences"
};
const SHOP_KEYS={
  "icuWaitlistV1":"waitlist",
  "icuMaintenanceV1":"maintenance",
  "icuAnnouncementV1":"announcement",
  "icuWorkforceV1":"workforce",
  "icuOwnerDiaryV1":"owner_diary",
  "icuIncidentsV1":"incidents",
  "icuInspectionsV1":"inspections",
  "icuInspectionIssuesV1":"inspection_issues",
  "icuDocumentsV1":"documents",
  "icuAuditV1":"audit",
  "icuChecklistsV1":"checklists",
  "icuShopStatusV1":"shop_status",
  "icuOwnerSettingsV1":"owner_settings",
  "icuBarberRosterV1":"barber_roster",
  "icuCameraConfigV1":"camera_config",
  "icuGrowthCampaignsV1":"growth_campaigns",
  "icuReferralsV1":"referrals",
  "icuAttributionV1":"attribution",
  "icuLookinInventoryV1":"inventory",
  "icuLookinExpensesV1":"expenses",
  "icuLookinLocationsV1":"locations",
  "icuGiftCardsV1":"gift_cards"
};
const IGNORE_KEYS=new Set(["icuLookinMessagesV1","icuLookinMessageGroupsV1","icuLookinMessageReadsV1"]);
let identity=null, barberMap=new Map(), runtimeRows=[], shopRow=null, suppress=false, saveChain=Promise.resolve(), realtimeStarted=false;

const safeParse=(s,f)=>{try{return JSON.parse(s)??f}catch{return f}};
function rawSet(k,v){suppress=true;try{localStorage.setItem(k,typeof v==="string"&&k==="icuAnnouncementV1"?v:JSON.stringify(v))}finally{suppress=false}}
function currentName(){return identity?.display_name||""}
function isOwner(){return identity?.role==="owner"}

async function currentIdentity(){
  if(identity)return identity;
  const cur=window.ICUAuth?await ICUAuth.current():null;
  identity=cur?.identity||null;
  return identity;
}
async function loadBarbers(){
  const {data,error}=await client.from("barbers").select("id,display_name,active,user_id,is_owner").eq("active",true).not("user_id","is",null).order("display_name");
  if(error)throw error;
  barberMap=new Map((data||[]).map(b=>[b.display_name,b]));
  if(Array.isArray(window.BARBERS)){
    const names=(data||[]).map(b=>b.display_name);
    window.BARBERS.splice(0,window.BARBERS.length,...names);
  }
  return data||[];
}
function barberNameForId(id){for(const [name,b] of barberMap.entries())if(b.id===id)return name;return""}
function splitArrayByBarber(items){
  const out=new Map();
  for(const name of barberMap.keys())out.set(name,[]);
  const appts=safeParse(localStorage.getItem("icuLookinAppointmentsV3"),[]);
  const apptBarber=new Map(appts.map(a=>[a.id,a.barber]));
  for(const item of Array.isArray(items)?items:[]){
    let name=item?.barber||item?.barberName||"";
    if(!name&&item?.appointmentId)name=apptBarber.get(item.appointmentId)||"";
    if(!name&&identity?.role==="barber")name=currentName();
    if(name&&out.has(name))out.get(name).push(item);
  }
  return out;
}
function splitMapByBarber(key,obj){
  const out=new Map();
  for(const name of barberMap.keys())out.set(name,{});
  obj=obj&&typeof obj==="object"?obj:{};
  if(["icuLookinPricingV1","icuBarberServicePrefsV1","icuAvailabilityV1","icuDepositSettingsV1"].includes(key)){
    for(const name of barberMap.keys())if(obj[name]!==undefined)out.set(name,obj[name]||{});
    return out;
  }
  if(key==="icuClientNotesV1"){
    for(const [k,v] of Object.entries(obj)){
      const sep=k.indexOf("|"),name=sep>0?k.slice(0,sep):currentName(),inner=sep>0?k.slice(sep+1):k;
      if(out.has(name))out.get(name)[inner]=v;
    }
    return out;
  }
  if(key==="icuPaymentsV1"){
    const appts=safeParse(localStorage.getItem("icuLookinAppointmentsV3"),[]);
    const byId=new Map(appts.map(a=>[a.id,a.barber]));
    for(const [k,v] of Object.entries(obj)){
      const name=byId.get(k)||currentName();
      if(out.has(name))out.get(name)[k]=v;
    }
    return out;
  }
  // Family/preferences are duplicated into the current barber row, or all rows for Owner.
  if(identity?.role==="barber"){out.set(currentName(),obj);return out;}
  for(const name of barberMap.keys())out.set(name,obj);
  return out;
}
function mergeRowsToLocal(){
  const arrays={}; Object.keys(RUNTIME_ARRAY_KEYS).forEach(k=>arrays[k]=[]);
  const maps={}; Object.keys(RUNTIME_MAP_KEYS).forEach(k=>maps[k]={});
  const namesById=new Map([...barberMap.values()].map(b=>[b.id,b.display_name]));
  for(const row of runtimeRows){
    const name=namesById.get(row.barber_id); if(!name)continue;
    for(const [key,col] of Object.entries(RUNTIME_ARRAY_KEYS)){
      const arr=Array.isArray(row[col])?row[col]:[];
      if(key==="icuCustomServicesV1")arrays[key].push(...arr.map(x=>({...x,barberOnly:x.barberOnly||name})));
      else if(key==="icuTimeOffV1"||key==="icuWalkinsV1"||key==="icuDepositPaymentsV1"||key==="icuBoothRentPaymentsV1"||key==="icuPosTransactionsV1"||key==="icuReviewsV1")
        arrays[key].push(...arr.map(x=>x?.barber?x:{...x,barber:name}));
      else arrays[key].push(...arr);
    }
    for(const [key,col] of Object.entries(RUNTIME_MAP_KEYS)){
      const val=row[col]&&typeof row[col]==="object"?row[col]:{};
      if(["icuLookinPricingV1","icuBarberServicePrefsV1","icuAvailabilityV1","icuDepositSettingsV1"].includes(key))maps[key][name]=val;
      else if(key==="icuClientNotesV1")for(const [k,v] of Object.entries(val))maps[key][`${name}|${k}`]=v;
      else Object.assign(maps[key],val);
    }
  }
  if(isOwner()&&shopRow?.unassigned_walkins)arrays["icuWalkinsV1"].push(...shopRow.unassigned_walkins);
  for(const [k,v] of Object.entries(arrays))rawSet(k,v);
  for(const [k,v] of Object.entries(maps))rawSet(k,v);
  if(isOwner()&&shopRow){
    for(const [key,col] of Object.entries(SHOP_KEYS)){
      const v=shopRow[col];
      if(key==="icuAnnouncementV1"){suppress=true;try{localStorage.setItem(key,String(v||""))}finally{suppress=false}}
      else rawSet(key,v??(Array.isArray(v)?[]:{}));
    }
  }
}
async function hydrateMessages(){
  if(!identity)return;
  const [{data:convs,error:ce},{data:parts,error:pe},{data:msgs,error:me},{data:reads,error:re}]=await Promise.all([
    client.from("staff_conversations").select("*").order("created_at"),
    client.from("staff_conversation_participants").select("*"),
    client.from("staff_messages").select("*").order("created_at"),
    client.from("staff_message_reads").select("*")
  ]);
  if(ce||pe||me||re)throw ce||pe||me||re;
  const partMap=new Map();
  for(const p of parts||[]){if(!partMap.has(p.conversation_id))partMap.set(p.conversation_id,[]);partMap.get(p.conversation_id).push(p.persona)}
  const groups=(convs||[]).filter(c=>c.kind==="group").map(c=>({id:c.id.replace(/^group:/,""),name:c.name||"Group Chat",participants:partMap.get(c.id)||[],createdBy:c.created_by_persona,createdAt:c.created_at}));
  const legacy=(msgs||[]).map(m=>{
    const c=(convs||[]).find(x=>x.id===m.conversation_id);
    if(c?.kind==="group")return{id:m.id,type:"group",groupId:m.conversation_id.replace(/^group:/,""),sender:m.sender_persona,body:m.body,createdAt:m.created_at};
    const ps=partMap.get(m.conversation_id)||[],recipient=ps.find(x=>x!==m.sender_persona)||m.sender_persona;
    return{id:m.id,type:"direct",sender:m.sender_persona,recipient,body:m.body,createdAt:m.created_at};
  });
  const readMap={}; for(const r of reads||[]){readMap[r.persona]=readMap[r.persona]||{};readMap[r.persona][r.conversation_id]=new Date(r.last_read_at).getTime()}
  rawSet("icuLookinMessagesV1",legacy);rawSet("icuLookinMessageGroupsV1",groups);rawSet("icuLookinMessageReadsV1",readMap);
}
async function hydrateNotificationReads(){
  if(!identity)return;
  const {data,error}=await client.from("notification_read_state").select("category,last_seen_at");
  if(error)throw error;
  for(const row of data||[]){
    const persona=row.category==="operations"?"Owner":currentName();
    if(!persona)continue;
    const ms=new Date(row.last_seen_at).getTime();
    if(Number.isFinite(ms))localStorage.setItem(`icuLastSeen:${row.category}:${persona}`,String(ms));
  }
}
async function markNotificationSeen(category){
  if(!["appointments","walkins","operations"].includes(category))throw new Error("Unsupported notification category.");
  const {data:{user},error:ue}=await client.auth.getUser();if(ue)throw ue;if(!user)throw new Error("Staff sign-in required.");
  const last_seen_at=new Date().toISOString();
  const {error}=await client.from("notification_read_state").upsert({user_id:user.id,category,last_seen_at},{onConflict:"user_id,category"});
  if(error)throw error;
  const persona=category==="operations"?"Owner":currentName();
  if(persona)localStorage.setItem(`icuLastSeen:${category}:${persona}`,String(new Date(last_seen_at).getTime()));
  return last_seen_at;
}


function nonEmptyLocal(key){
  const raw=localStorage.getItem(key);if(!raw)return false;
  if(key==="icuAnnouncementV1")return raw.trim().length>0;
  const v=safeParse(raw,null);
  if(Array.isArray(v))return v.length>0;
  if(v&&typeof v==="object")return Object.keys(v).length>0;
  return Boolean(v);
}
async function maybeImportLegacyLocal(){
  const cloudHas=runtimeRows.some(r=>(r.appointments?.length||0)||(r.walkins?.length||0)||(r.pos_transactions?.length||0)||(r.reviews?.length||0)||(r.custom_services?.length||0))||
    Boolean(isOwner()&&shopRow&&((shopRow.owner_diary?.length||0)||(shopRow.incidents?.length||0)||(shopRow.inspections?.length||0)||(shopRow.growth_campaigns?.length||0)));
  const businessKeys=["icuLookinAppointmentsV3","icuWalkinsV1","icuPosTransactionsV1","icuReviewsV1","icuOwnerDiaryV1","icuIncidentsV1","icuInspectionsV1","icuGrowthCampaignsV1"];
  if(cloudHas||!businessKeys.some(nonEmptyLocal))return;
  const keys=[...Object.keys(RUNTIME_ARRAY_KEYS),...Object.keys(RUNTIME_MAP_KEYS),...Object.keys(SHOP_KEYS)];
  for(const key of keys){
    const raw=localStorage.getItem(key);if(raw===null)continue;
    const value=key==="icuAnnouncementV1"?raw:safeParse(raw,null);if(value===null)continue;
    saveLegacyKey(key,value);
  }
  await saveChain;
  window.dispatchEvent(new CustomEvent("icuCloudImport",{detail:{message:"Existing browser data was copied into Supabase."}}));
}

async function hydrateStaff(){
  await currentIdentity(); if(!identity)throw new Error("Staff sign-in required.");
  await loadBarbers();
  let r=await client.from("barber_runtime_state").select("*");
  if(r.error)throw r.error; runtimeRows=r.data||[];
  shopRow=null;
  if(isOwner()){const sr=await client.from("shop_runtime_state").select("*").eq("id",true).maybeSingle();if(sr.error)throw sr.error;shopRow=sr.data}
  await maybeImportLegacyLocal();
  r=await client.from("barber_runtime_state").select("*");if(r.error)throw r.error;runtimeRows=r.data||[];
  if(isOwner()){const sr=await client.from("shop_runtime_state").select("*").eq("id",true).maybeSingle();if(sr.error)throw sr.error;shopRow=sr.data}
  mergeRowsToLocal();
  await hydrateMessages();
  await hydrateNotificationReads();
}
async function publicState(){
  const r=await fetch(`${EDGE_URL}?action=state`,{headers:{apikey:cfg.publishableKey}});
  const j=await r.json(); if(!r.ok||!j.ok)throw new Error(j.error||"Booking service unavailable.");
  const names=(j.barbers||[]).map(b=>b.display_name);
  if(Array.isArray(window.BARBERS))window.BARBERS.splice(0,window.BARBERS.length,...names);
  barberMap=new Map((j.barbers||[]).map(b=>[b.display_name,{id:b.id,display_name:b.display_name}]));
  const pricing={},prefs={},availability={},deposit={},custom=[],timeoff=[],blocked=[];
  for(const b of j.barbers||[]){
    pricing[b.display_name]=b.pricing||{};
    prefs[b.display_name]=b.service_prefs||{inactive:[]};
    availability[b.display_name]=b.availability||{};
    deposit[b.display_name]=b.deposit_settings||{required:false,amount:2000};
    custom.push(...(b.custom_services||[]).map(x=>({...x,barberOnly:x.barberOnly||b.display_name})));
    timeoff.push(...(b.time_off||[]).map(x=>x.barber?x:{...x,barber:b.display_name}));
    blocked.push(...(b.appointments||[]));
  }
  // Preserve any full customer records already fetched by phone while adding safe blocked slots.
  const prior=safeParse(localStorage.getItem("icuLookinAppointmentsV3"),[]);
  const cloudIds=new Set(blocked.map(a=>a.id));
  const full=prior.filter(a=>a&&cloudIds.has(a.id)&&((a.phone&&String(a.phone).trim())||a.email));
  const ids=new Set(full.map(a=>a.id)); const merged=[...full,...blocked.filter(a=>!ids.has(a.id))];
  rawSet("icuLookinAppointmentsV3",merged);rawSet("icuLookinPricingV1",pricing);rawSet("icuBarberServicePrefsV1",prefs);rawSet("icuCustomServicesV1",custom);rawSet("icuAvailabilityV1",availability);rawSet("icuTimeOffV1",timeoff);rawSet("icuDepositSettingsV1",deposit);
  window.ICU_PUBLIC_SERVICES=j.services||[];
  return j;
}
async function bootstrap(mode){
  try{
    if(mode==="owner"||mode==="individual"){
      const cur=window.ICUAuth?await ICUAuth.current():null;
      identity=cur?.identity||null;
      if(!identity){location.replace(mode==="owner"?"OWNER_LAUNCHER.html":"BARBER_LAUNCHER.html");return false}
      const expected=new URLSearchParams(location.search).get("barber");
      if(mode==="owner"&&identity.role!=="owner"){await ICUAuth.signOut();location.replace("OWNER_LAUNCHER.html");return false}
      if(mode==="individual"&&(identity.role!=="barber"||identity.display_name!==expected)){await ICUAuth.signOut();location.replace(`BARBER_LAUNCHER.html${expected?`?barber=${encodeURIComponent(expected)}`:""}`);return false}
      await hydrateStaff();startRealtime();return true;
    }
    await publicState();return true;
  }catch(e){console.error("ICU Cloud bootstrap failed",e);window.dispatchEvent(new CustomEvent("icuCloudError",{detail:e}));return false}
}
function queue(fn){saveChain=saveChain.then(fn,fn).catch(e=>{console.error("ICU Cloud save failed",e);window.dispatchEvent(new CustomEvent("icuCloudError",{detail:e}))});return saveChain}
async function updateBarber(name,patch){
  const b=barberMap.get(name);if(!b)return;
  const body={...patch,updated_by:(await client.auth.getUser()).data.user?.id||null};
  const {error}=await client.from("barber_runtime_state").update(body).eq("barber_id",b.id);if(error)throw error;
}
async function updateShop(patch){const user=(await client.auth.getUser()).data.user;const {error}=await client.from("shop_runtime_state").update({...patch,updated_by:user?.id||null}).eq("id",true);if(error)throw error}
function saveLegacyKey(key,value){
  if(suppress||!identity||IGNORE_KEYS.has(key))return;
  if(RUNTIME_ARRAY_KEYS[key]){
    return queue(async()=>{
      const col=RUNTIME_ARRAY_KEYS[key],by=splitArrayByBarber(value);
      const targets=isOwner()?[...barberMap.keys()]:[currentName()];
      for(const name of targets)await updateBarber(name,{[col]:by.get(name)||[]});
      if(key==="icuWalkinsV1"&&isOwner()){const un=(Array.isArray(value)?value:[]).filter(x=>!x.barber);await updateShop({unassigned_walkins:un})}
    });
  }
  if(RUNTIME_MAP_KEYS[key]){
    return queue(async()=>{
      const col=RUNTIME_MAP_KEYS[key],by=splitMapByBarber(key,value);
      const targets=isOwner()?[...barberMap.keys()]:[currentName()];
      for(const name of targets)await updateBarber(name,{[col]:by.get(name)||{}});
    });
  }
  if(SHOP_KEYS[key]&&isOwner())return queue(()=>updateShop({[SHOP_KEYS[key]]:value}));
}
async function refreshStaff(){
  if(!identity)return;await hydrateStaff();window.dispatchEvent(new Event("icuCloudChanged"));
}
function startRealtime(){
  if(realtimeStarted||!identity)return;realtimeStarted=true;
  client.channel("icu-runtime")
    .on("postgres_changes",{event:"*",schema:"public",table:"barber_runtime_state"},()=>refreshStaff())
    .on("postgres_changes",{event:"*",schema:"public",table:"shop_runtime_state"},()=>{if(isOwner())refreshStaff()})
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"staff_messages"},async()=>{await hydrateMessages();window.dispatchEvent(new Event("icuMessagesChanged"));window.dispatchEvent(new Event("icuCloudChanged"))})
    .on("postgres_changes",{event:"*",schema:"public",table:"staff_message_reads"},async()=>{await hydrateMessages();window.dispatchEvent(new Event("icuMessagesChanged"))})
    .on("postgres_changes",{event:"*",schema:"public",table:"notification_read_state"},async()=>{await hydrateNotificationReads();window.dispatchEvent(new Event("icuCloudChanged"))})
    .subscribe();
}
async function createBooking(booking){
  const r=await fetch(EDGE_URL,{method:"POST",headers:{"Content-Type":"application/json",apikey:cfg.publishableKey},body:JSON.stringify({action:"create",booking})});
  const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||"Unable to save appointment.");return j.booking;
}
async function customerLookup(phone){
  const r=await fetch(EDGE_URL,{method:"POST",headers:{"Content-Type":"application/json",apikey:cfg.publishableKey},body:JSON.stringify({action:"lookup",phone})});
  const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||"Unable to find profile.");
  const d=String(phone||"").replace(/\D/g,"").slice(-10),key=`phone:${d}`,family=safeParse(localStorage.getItem("icuFamilyV1"),{}),prefs=safeParse(localStorage.getItem("icuPreferencesV1"),{});
  if(j.profile){family[key]=j.profile.family||[];prefs[key]=j.profile.preferences||{};rawSet("icuFamilyV1",family);rawSet("icuPreferencesV1",prefs)}
  return j.appointments||[];
}
async function saveCustomerProfile(phone,family,preferences){
  const r=await fetch(EDGE_URL,{method:"POST",headers:{"Content-Type":"application/json",apikey:cfg.publishableKey},body:JSON.stringify({action:"save_profile",phone,family,preferences})});const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||"Profile could not be saved.");return true;
}
async function submitCustomerReview(phone,review){
  const r=await fetch(EDGE_URL,{method:"POST",headers:{"Content-Type":"application/json",apikey:cfg.publishableKey},body:JSON.stringify({action:"review",phone,review})});const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||"Review could not be saved.");return j.review;
}
async function sendCustomerAppointmentMessage(phone,message){
  const r=await fetch(EDGE_URL,{method:"POST",headers:{"Content-Type":"application/json",apikey:cfg.publishableKey},body:JSON.stringify({action:"appointment_message",phone,message})});const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||"Message could not be sent.");return j.message;
}
async function createGiftCardCloud(recipient,email,amount){
  const r=await fetch(EDGE_URL,{method:"POST",headers:{"Content-Type":"application/json",apikey:cfg.publishableKey},body:JSON.stringify({action:"gift_create",recipient,email,amount})});const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||"Gift card could not be created.");return j.card;
}
async function lookupGiftCardCloud(code){
  const r=await fetch(EDGE_URL,{method:"POST",headers:{"Content-Type":"application/json",apikey:cfg.publishableKey},body:JSON.stringify({action:"gift_lookup",code})});const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||"Gift card lookup failed.");return j.card||null;
}
async function sendMessage(key,sender,body){
  const id=`msg-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  const {error}=await client.from("staff_messages").insert({id,conversation_id:key,sender_persona:sender,body:String(body).trim()});if(error)throw error;return id;
}
async function markRead(key,persona){
  const {error}=await client.from("staff_message_reads").upsert({conversation_id:key,persona,last_read_at:new Date().toISOString()},{onConflict:"conversation_id,persona"});if(error)throw error;
}
async function createGroup(name,creator,participants,legacyId){
  const id=`group:${legacyId||crypto.randomUUID()}`;
  const {error}=await client.from("staff_conversations").insert({id,kind:"group",name,created_by_persona:creator});if(error)throw error;
  const people=[...new Set([creator,...participants])];
  const p=await client.from("staff_conversation_participants").insert(people.map(persona=>({conversation_id:id,persona})));if(p.error)throw p.error;
  await hydrateMessages();return id.replace(/^group:/,"");
}
async function socialItems(){
  const {data,error}=await client.from("social_media_items").select("*").order("created_at",{ascending:false});if(error)throw error;
  const out=[];
  for(const row of data||[]){
    const d=await client.storage.from("icu-social-media").download(row.storage_path);if(d.error)throw d.error;
    out.push({id:row.id,barber:currentName(),name:row.name,type:row.mime_type,blob:d.data,platform:row.platform||"",caption:row.caption||"",hashtags:row.hashtags||"",createdAt:row.created_at,editedFrom:row.edited_from||null,visibility:row.visibility,consentConfirmed:Boolean(row.consent_confirmed),portfolioVisible:Boolean(row.portfolio_visible),portfolioTitle:row.portfolio_title||"",portfolioCategory:row.portfolio_category||"",portfolioFeatured:Boolean(row.portfolio_featured),portfolioSort:Number(row.portfolio_sort||0)});
  }
  return out;
}
function cleanFileName(name){return String(name||"media").replace(/[^a-zA-Z0-9._-]+/g,"_").slice(-120)}
async function saveSocialFiles(files){
  const idt=await currentIdentity();if(!idt?.barber_id)throw new Error("Barber identity unavailable.");
  for(const file of [...files]){
    const id=`media-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,path=`${idt.barber_id}/${id}/${cleanFileName(file.name||"media")}`;
    const up=await client.storage.from("icu-social-media").upload(path,file,{contentType:file.type,upsert:false});if(up.error)throw up.error;
    const ins=await client.from("social_media_items").insert({id,barber_id:idt.barber_id,storage_path:path,name:file.name||"Captured Media",mime_type:file.type||"application/octet-stream"});if(ins.error){await client.storage.from("icu-social-media").remove([path]);throw ins.error}
  }
}
async function updateSocial(id,changes){const patch={};if(changes.name!==undefined)patch.name=changes.name;if(changes.platform!==undefined)patch.platform=changes.platform;if(changes.caption!==undefined)patch.caption=changes.caption;if(changes.hashtags!==undefined)patch.hashtags=changes.hashtags;if(changes.visibility!==undefined)patch.visibility=changes.visibility;if(changes.consentConfirmed!==undefined)patch.consent_confirmed=Boolean(changes.consentConfirmed);if(changes.portfolioVisible!==undefined)patch.portfolio_visible=Boolean(changes.portfolioVisible);if(changes.portfolioTitle!==undefined)patch.portfolio_title=String(changes.portfolioTitle||"").slice(0,160);if(changes.portfolioCategory!==undefined)patch.portfolio_category=String(changes.portfolioCategory||"").slice(0,80);if(changes.portfolioFeatured!==undefined)patch.portfolio_featured=Boolean(changes.portfolioFeatured);if(changes.portfolioSort!==undefined)patch.portfolio_sort=Math.max(0,Math.min(999,Number(changes.portfolioSort)||0));if(patch.portfolio_visible&&!patch.consent_confirmed){const {data}=await client.from("social_media_items").select("consent_confirmed").eq("id",id).maybeSingle();if(!data?.consent_confirmed)throw new Error("Photo/video consent must be confirmed before publishing to the client portfolio.")}const {error}=await client.from("social_media_items").update(patch).eq("id",id);if(error)throw error}
async function deleteSocial(id){const {data,error}=await client.from("social_media_items").select("storage_path").eq("id",id).single();if(error)throw error;const rm=await client.storage.from("icu-social-media").remove([data.storage_path]);if(rm.error)throw rm.error;const del=await client.from("social_media_items").delete().eq("id",id);if(del.error)throw del.error}
async function saveEditedSocial(source,blob,name){
  const idt=await currentIdentity();const id=`media-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,fileName=cleanFileName(name||"edited.png"),path=`${idt.barber_id}/${id}/${fileName}`;
  const up=await client.storage.from("icu-social-media").upload(path,blob,{contentType:"image/png"});if(up.error)throw up.error;
  const ins=await client.from("social_media_items").insert({id,barber_id:idt.barber_id,storage_path:path,name:fileName,mime_type:"image/png",platform:source.platform||"",caption:source.caption||"",hashtags:source.hashtags||"",edited_from:source.id});if(ins.error)throw ins.error;return id;
}


async function clientPortfolio(barber){
  const url=`${cfg.url}/functions/v1/public-portfolio?barber=${encodeURIComponent(String(barber||""))}`;
  const r=await fetch(url,{headers:{apikey:cfg.publishableKey}});const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||"Portfolio unavailable.");return j.items||[];
}

async function uploadOwnerDocuments(files){
  const out=[];
  for(const file of Array.from(files||[])){
    const id=`doc-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,safeName=String(file.name||"document").replace(/[^\w.\- ]+/g,"_").slice(0,160),path=`owner/${id}/${safeName}`;
    const up=await client.storage.from("icu-owner-documents").upload(path,file,{contentType:file.type||"application/octet-stream",upsert:false});if(up.error)throw up.error;
    out.push({id,name:safeName,originalName:file.name||safeName,category:"Uploaded Document",note:"Stored privately in Supabase Storage",mimeType:file.type||"application/octet-stream",size:file.size||0,storagePath:path,createdAt:new Date().toISOString()});
  }
  return out;
}
async function downloadOwnerDocument(path,name){
  const {data,error}=await client.storage.from("icu-owner-documents").download(path);if(error)throw error;
  const url=URL.createObjectURL(data),a=document.createElement("a");a.href=url;a.download=name||"document";a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
async function deleteOwnerDocument(path){
  const {error}=await client.storage.from("icu-owner-documents").remove([path]);if(error)throw error;return true;
}

async function ownerAdminAction(action,payload={}){
  const {data:{session}}=await client.auth.getSession();if(!session?.access_token)throw new Error("Owner sign-in required.");
  const r=await fetch(`${cfg.url}/functions/v1/owner-account-admin`,{method:"POST",headers:{"Content-Type":"application/json",apikey:cfg.publishableKey,Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({action,...payload})});
  const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||"Owner account action failed.");return j;
}
async function ownerRecoveryAction(barberId,action){await ownerAdminAction(action,{barber_id:barberId});return true}
async function ownerManageBarber(action,payload={}){return ownerAdminAction(action,payload)}
window.ICUCloud={client,bootstrap,hydrateStaff,publicState,saveLegacyKey,createBooking,customerLookup,saveCustomerProfile,submitCustomerReview,sendCustomerAppointmentMessage,createGiftCardCloud,lookupGiftCardCloud,sendMessage,markRead,createGroup,socialItems,saveSocialFiles,updateSocial,deleteSocial,saveEditedSocial,clientPortfolio,uploadOwnerDocuments,downloadOwnerDocument,deleteOwnerDocument,currentIdentity,refreshStaff,markNotificationSeen,ownerRecoveryAction,ownerManageBarber};
})();