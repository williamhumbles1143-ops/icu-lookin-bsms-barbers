"use strict";

const OWNER_BARBER_NAME="Tony";
const OWNER_DIARY_KEY="icuOwnerDiaryV1",INCIDENTS_KEY="icuIncidentsV1",INSPECTIONS_KEY="icuInspectionsV1",INSPECTION_ISSUES_KEY="icuInspectionIssuesV1",DOCUMENTS_KEY="icuDocumentsV1",AUDIT_KEY="icuAuditV1",CHECKLISTS_KEY="icuChecklistsV1",SHOP_STATUS_KEY="icuShopStatusV1",OWNER_SETTINGS_KEY="icuOwnerSettingsV1",BARBER_ROSTER_KEY="icuBarberRosterV1",CAMERA_CONFIG_KEY="icuCameraConfigV1",GROWTH_CAMPAIGNS_KEY="icuGrowthCampaignsV1",REFERRALS_KEY="icuReferralsV1",ATTRIBUTION_KEY="icuAttributionV1";

const BARBERS=["Tony","Mike","Will","Henry","Mon","Kody"];window.BARBERS=BARBERS;
const STATUSES=["Scheduled","Confirmed","Checked In","In Progress","Completed","Cancelled","Last Second Cancellation","No Show"];
const SERVICES=[
 {id:"haircut",name:"Haircut",minutes:30,defaultPrice:2500,description:"Classic haircut, styling & edge-up."},
 {id:"beard",name:"Beard trim",minutes:15,defaultPrice:1000,description:"Beard trim and shaping."},
 {id:"edge-up",name:"Edge up",minutes:15,defaultPrice:1000,description:"Hairline and edge detailing, without a haircut."},
 {id:"enhancement",name:"Enhancement",minutes:10,defaultPrice:1000,description:"Temporary enhancement service."},
 {id:"simple-design",name:"Simple design",minutes:10,defaultPrice:500,description:"Basic line or simple design."},
 {id:"detailed-design",name:"Detailed design",minutes:30,defaultPrice:2000,description:"Detailed custom hair design."},
 {id:"start-up-dreadlocks",name:"Start Up Dreadlocks",minutes:120,defaultPrice:12000,description:"Start-up dreadlock installation service.",barberOnly:"Kody"},
 {id:"dreadlock-repair",name:"Dreadlock Repair",minutes:120,defaultPrice:12000,description:"Repair and restoration for damaged dreadlocks.",barberOnly:"Kody"},
 {id:"dreadlock-retwists",name:"Dreadlock Retwists",minutes:90,defaultPrice:7000,description:"Professional dreadlock retwist service.",barberOnly:"Kody"}
];

const APPOINTMENTS_KEY="icuLookinAppointmentsV3";
const PRICING_KEY="icuLookinPricingV1";
const AFTER_HOURS_CUSTOMER_FEE=1500;
const AFTER_HOURS_BARBER_FEE=2500;
const HAIR_SCALP_PREPARATION_FEE=500;
const BARBER_SERVICE_PREFS_KEY="icuBarberServicePrefsV1",CUSTOM_SERVICES_KEY="icuCustomServicesV1",HAIR_SCALP_POLICY_SESSION_KEY="icuHairScalpPolicyAgreedV1";
const NORMAL_CLOSE_MINUTE=19*60;
const LATEST_START_MINUTE=21*60;
const MESSAGES_KEY="icuLookinMessagesV1";
const MESSAGE_GROUPS_KEY="icuLookinMessageGroupsV1";
const MESSAGE_READ_KEY="icuLookinMessageReadsV1";
const CUSTOMER_SESSION_PHONE_KEY="icuCustomerSessionPhoneV1";
let pending=null;

const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];

function esc(value=""){const div=document.createElement("div");div.textContent=value;return div.innerHTML}
function money(cents){return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format((cents||0)/100)}
function today(offset=0){const date=new Date();date.setDate(date.getDate()+offset);return localDate(date)}
function localDate(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`}
function formatDateTime(value){return new Intl.DateTimeFormat("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(value))}
function formatTime(value){return new Intl.DateTimeFormat("en-US",{hour:"numeric",minute:"2-digit"}).format(new Date(value))}
function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),2600)}
function loadAppointments(){try{return JSON.parse(localStorage.getItem(APPOINTMENTS_KEY))||[]}catch{return[]}}
function saveAppointments(items){localStorage.setItem(APPOINTMENTS_KEY,JSON.stringify(items));window.ICUCloud?.saveLegacyKey(APPOINTMENTS_KEY,items)}
function loadCustomServices(){return loadKey(CUSTOM_SERVICES_KEY,[])}
function saveCustomServices(items){saveKey(CUSTOM_SERVICES_KEY,items)}
function allServices(){return [...SERVICES,...loadCustomServices()]}
function loadBarberServicePrefs(){return loadKey(BARBER_SERVICE_PREFS_KEY,{})}
function saveBarberServicePrefs(v){saveKey(BARBER_SERVICE_PREFS_KEY,v)}
function eligibleServicesForBarber(barber){return allServices().filter(service=>!service.barberOnly||service.barberOnly===barber)}
function serviceIsActiveForBarber(barber,serviceId){return !(loadBarberServicePrefs()[barber]?.inactive||[]).includes(serviceId)}
function defaultPricing(){
 const data={};
 BARBERS.forEach(barber=>{
   data[barber]={};
   eligibleServicesForBarber(barber).forEach(service=>{
     data[barber][service.id]={price:service.defaultPrice,locked:false,override:false};
   });
 });
 return data;
}
function loadPricing(){
 const defaults=defaultPricing();
 try{
   const saved=JSON.parse(localStorage.getItem(PRICING_KEY))||{};
   BARBERS.forEach(barber=>{
     defaults[barber]=defaults[barber]||{};
     Object.keys(saved[barber]||{}).forEach(serviceId=>{
       defaults[barber][serviceId]={...defaults[barber][serviceId],...saved[barber][serviceId]};
     });
   });
   return defaults;
 }catch{return defaults}
}
function savePricing(data){localStorage.setItem(PRICING_KEY,JSON.stringify(data));window.ICUCloud?.saveLegacyKey(PRICING_KEY,data)}
function serviceById(id){return allServices().find(service=>service.id===id)}
function servicesForBarber(barber,includeInactive=false){const eligible=eligibleServicesForBarber(barber);return includeInactive?eligible:eligible.filter(service=>serviceIsActiveForBarber(barber,service.id))}
function effectivePrice(barber,serviceId){
 const entry=loadPricing()[barber]?.[serviceId];
 return Number.isFinite(Number(entry?.price))?Number(entry.price):serviceById(serviceId)?.defaultPrice||0;
}
function selectedIds(){return $$("#serviceList input:checked").map(input=>input.value)}
function selectedDuration(){return selectedIds().reduce((sum,id)=>sum+(serviceById(id)?.minutes||0),0)}
function selectedServiceTotal(barber=$("#barber").value){return selectedIds().reduce((sum,id)=>sum+effectivePrice(barber,id),0)}
function serviceNames(ids){return ids.map(id=>serviceById(id)?.name).filter(Boolean).join(", ")}
function isAfterHoursStart(value){
 if(!value)return false;
 const date=new Date(value);
 const minute=date.getHours()*60+date.getMinutes();
 return minute>=NORMAL_CLOSE_MINUTE&&minute<=LATEST_START_MINUTE;
}
function customerTotalForAppointment(appointment){
 if(Number.isFinite(Number(appointment.customerTotal)))return Number(appointment.customerTotal);
 const services=appointment.serviceIds.reduce((sum,id)=>sum+Number(appointment.priceSnapshot?.[id]??effectivePrice(appointment.barber,id)),0);
 return services+(appointment.afterHours?AFTER_HOURS_CUSTOMER_FEE:0);
}
function grossServiceRevenue(appointment){
 return appointment.serviceIds.reduce((sum,id)=>sum+Number(appointment.priceSnapshot?.[id]??effectivePrice(appointment.barber,id)),0);
}
function netBarberRevenue(appointment){return customerTotalForAppointment(appointment)}
function barberDateKey(item){return `${item.barber}|${String(item.startAt).slice(0,10)}`}
function uniqueAfterHoursChargeCount(items){return new Set(items.filter(item=>item.afterHours).map(barberDateKey)).size}
function uniqueAfterHoursCharges(items){return uniqueAfterHoursChargeCount(items)*AFTER_HOURS_BARBER_FEE}
function overlap(aStart,aEnd,bStart,bEnd){return new Date(aStart)<new Date(bEnd)&&new Date(aEnd)>new Date(bStart)}
function activeWalkIns(){return loadKey(WALKIN_KEY,[]).filter(w=>!["Cancelled","Completed"].includes(w.status)&&w.barber&&w.startAt&&w.endAt)}
function hasConflict(barber,start,end){
 return loadAppointments().some(a=>a.barber===barber&&!["Cancelled","Last Second Cancellation"].includes(a.status)&&overlap(start,end,a.startAt,a.endAt))||
 activeWalkIns().some(w=>w.barber===barber&&overlap(start,end,w.startAt,w.endAt))
}
function normalizePhone(value=""){return String(value).replace(/\D/g,"").slice(-10)}
function formatPhone(value=""){
 const digits=normalizePhone(value);
 if(!digits)return"";
 if(digits.length<4)return`(${digits}`;
 if(digits.length<7)return`(${digits.slice(0,3)}) ${digits.slice(3)}`;
 return`(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6,10)}`
}
function applyPhoneMask(input){const formatted=formatPhone(input.value);if(input.value!==formatted)input.value=formatted}
const EMAIL_DOMAINS=["gmail.com","google.com","yahoo.com","hotmail.com","outlook.com","icloud.com","aol.com","proton.me","protonmail.com","live.com","msn.com"];
function updateEmailDomainSuggestions(input){
 const list=$("#emailDomainSuggestions");if(!list)return;
 const value=input.value.trim(),at=value.lastIndexOf("@");if(at<0){list.innerHTML="";return}
 const local=value.slice(0,at),prefix=value.slice(at+1).toLowerCase();
 if(!local||!prefix){list.innerHTML="";return}
 list.innerHTML=(prefix==="g"?[]:EMAIL_DOMAINS.filter(domain=>domain.startsWith(prefix))).map(domain=>`<option value="${esc(local+"@"+domain)}"></option>`).join("")
}

function audit(action,details="",actor="Owner"){const items=loadKey(AUDIT_KEY,[]);items.push({id:`audit-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,actor,action,details,createdAt:new Date().toISOString()});saveKey(AUDIT_KEY,items)}
function loadBarberRoster(){const saved=loadKey(BARBER_ROSTER_KEY,null);if(saved)return saved;const names=(typeof BARBERS!=="undefined"?BARBERS:["Tony","Mike","Will","Henry","Mon","Kody","Selena"]),items=names.map(name=>({id:`barber-${name.toLowerCase()}`,name,active:true,originalRatingCohort:true,newBarber:false,startDate:"2026-01-01",licenseNumber:"",licenseExpiration:"",role:name===OWNER_BARBER_NAME?"Owner/Barber":"Barber"}));saveKey(BARBER_ROSTER_KEY,items);return items}
function saveBarberRoster(items){saveKey(BARBER_ROSTER_KEY,items)}
function activeBarberRoster(){return loadBarberRoster().filter(x=>x.active)}
function originalRatingCohort(){return loadBarberRoster().filter(x=>x.originalRatingCohort&&x.active).map(x=>x.name)}
function ownerSettings(){return{shopName:"ICU Barber Studio",address:"8308 Broadway St, Houston, TX 77061",phone:"",email:"",normalClose:"19:00",latestAfterHours:"21:00",customerAfterHoursFee:1500,barberFacilityFee:2500,bookingInterval:15,...loadKey(OWNER_SETTINGS_KEY,{})}}
function currentShopStatus(){return loadKey(SHOP_STATUS_KEY,{status:"Open",message:"",updatedAt:null})}
function setShopStatus(status,message=""){saveKey(SHOP_STATUS_KEY,{status,message,updatedAt:new Date().toISOString()});audit("Shop status changed",`${status}${message?": "+message:""}`)}
function licenseWarningLevel(expiration){if(!expiration)return null;const d=Math.ceil((new Date(expiration+"T23:59:59")-new Date())/86400000);if(d<0)return{label:"Expired",severity:"danger"};if(d<=7)return{label:`${d} days`,severity:"danger"};if(d<=30)return{label:`${d} days`,severity:"warning"};if(d<=60)return{label:`${d} days`,severity:"notice"};return null}
function ownerDashboardAlerts(){const a=[];activeBarberRoster().forEach(r=>{const w=licenseWarningLevel(r.licenseExpiration);if(w)a.push({type:w.severity,text:`${r.name} license: ${w.label}`})});const issues=loadKey(INSPECTION_ISSUES_KEY,[]).filter(i=>i.status!=="Resolved");if(issues.length)a.push({type:"danger",text:`${issues.length} open inspection issue${issues.length===1?"":"s"}`});const incidents=loadKey(INCIDENTS_KEY,[]).filter(i=>i.status!=="Closed");if(incidents.length)a.push({type:"warning",text:`${incidents.length} incident${incidents.length===1?"":"s"} requiring follow-up`});const s=currentShopStatus();if(s.status!=="Open")a.push({type:"notice",text:`Shop status: ${s.status}${s.message?" — "+s.message:""}`});return a}
function systemHealth(){return[{name:"Supabase Auth",status:"Connected",detail:"Staff authentication is handled by Supabase Auth"},{name:"Database",status:"Connected",detail:"Operational BSMS state is synchronized through Supabase Postgres"},{name:"Realtime",status:"Connected",detail:"Staff state and messages refresh across signed-in devices"},{name:"Social Storage",status:"Connected",detail:"Barber photo/video content is stored privately in Supabase Storage"},{name:"Payments",status:"Processor Not Connected",detail:"POS records are cloud-synced; a live PCI-compliant card processor is not connected yet"},{name:"Cameras",status:"Integration Ready",detail:"Camera/NVR hardware is not connected"},{name:"Backups",status:"Cloud + Export",detail:"Supabase is the shared source of truth; Backup / Export remains available"}]}
function ownerGuideData(){return{
"Dashboard & Roles":"The Owner App opens to Tony's dashboard. Use Owner / Shop Management for administration and Tony the Barber / My Barber Tools for Tony's personal barber work.",
"Add a barber":"Open Barber Management and choose Add Barber. Enter the barber's name, start date, license number, and expiration date. New hires are not part of the Original Review Group.",
"Deactivate a barber":"Use Deactivate when a barber leaves but has historical business records. Their history remains available and they are removed from active operations.",
"Delete a mistaken barber":"Delete Barber is only allowed when the barber has no linked appointments, messages, POS records, reviews, booth-rent history, or Owner Diary history.",
"Original Review Group":"Existing/original barbers unlock their ratings together after each reaches 10 verified reviews. New hires do not delay that unlock and show their own rating after they personally reach 10.",
"Shop settings":"Open Control Center to update shop contact information and emergency shop status.",
"Booth rent":"Tony does not owe booth rent. Use Booth Rent Management to review and record payments for the other barbers. Saturday is preferred; Sunday is the final due date.",
"Owner Diary":"Select a specific barber to add private dated/timed notes or recall that person's history.",
"Memorialize a conversation":"From Owner Diary, select the barber and choose Memorialize Owner ↔ Barber Conversation. A complete snapshot of that conversation is preserved.",
"Incident reports":"Use Incident Reports for formal serious events such as injuries, altercations, property damage, theft, or significant customer issues.",
"Inspections":"Use Inspections to record inspection summaries and individual findings. Active barber license numbers and start dates appear on the inspection roster.",
"Inspection issues":"Open findings remain highlighted until Tony records the corrective action and explicitly resolves the issue.",
"Checklists":"Opening, Closing, and Sanitation checklists record completed tasks and timestamps.",
"Document Center":"Use Document Center to index licenses, inspection documents, agreements, policies, receipts, and other shop records.",
"Growth & Marketing":"Create campaigns, track referral/QR sources, review win-back opportunities, and review marketing attribution.",
"Business reports":"Business Reports summarizes completed appointments, cancellations, no-shows, POS revenue, walk-ins, and deposits.",
"Backup / Export":"Download the full JSON backup and CSV exports from Backup / Export.",
"Audit History":"Audit History records important owner actions and changes.",
"System Health":"System Health shows the status of cloud storage, payments, database, cameras, notifications, and backups.",
"Shop Cameras":"Shop Cameras is integration-ready. Real feeds require Tony's camera/NVR information and a secure production connection.",
"Owner Assistant":"Ask the Assistant questions about Owner-authorized data saved in the BSMS. It will answer from recorded data and say when information is unavailable."
}}
function memorializeOwnerConversation(barber){const all=(typeof loadMessages==="function"?loadMessages():[]),msgs=all.filter(m=>{const p=[m.from,m.to,m.sender,m.recipient].filter(Boolean);return p.includes("Owner")&&p.includes(barber)}),entry={id:`diary-${Date.now()}`,person:barber,category:"Communication",subject:"Memorialized Owner ↔ Barber Conversation",eventAt:new Date().toISOString(),createdAt:new Date().toISOString(),type:"conversation_snapshot",transcript:msgs.map(m=>({sender:m.from||m.sender||"Unknown",text:m.text||m.message||"",createdAt:m.createdAt||m.timestamp||new Date().toISOString()}))};const items=loadKey(OWNER_DIARY_KEY,[]);items.push(entry);saveKey(OWNER_DIARY_KEY,items);audit("Conversation memorialized",`${barber}: ${entry.transcript.length} messages`);return entry}
function exportAllBsmsData(){const keys=[APPOINTMENTS_KEY,WALKIN_KEY,WAITLIST_KEY,MAINTENANCE_KEY,WORKFORCE_KEY,PAYMENTS_KEY,CLIENT_NOTES_KEY,AVAILABILITY_KEY,TIMEOFF_KEY,FAMILY_KEY,PREFERENCES_KEY,DEPOSIT_SETTINGS_KEY,DEPOSIT_PAYMENTS_KEY,BOOTH_RENT_PAYMENTS_KEY,POS_TRANSACTIONS_KEY,OWNER_DIARY_KEY,INCIDENTS_KEY,INSPECTIONS_KEY,INSPECTION_ISSUES_KEY,DOCUMENTS_KEY,AUDIT_KEY,CHECKLISTS_KEY,SHOP_STATUS_KEY,OWNER_SETTINGS_KEY,BARBER_ROSTER_KEY,CAMERA_CONFIG_KEY,GROWTH_CAMPAIGNS_KEY,REFERRALS_KEY,ATTRIBUTION_KEY].filter(Boolean),out={version:"0.17",exportedAt:new Date().toISOString(),data:{}};keys.forEach(k=>out.data[k]=loadKey(k,null));return out}
function downloadTextFile(name,text,type="application/json"){const b=new Blob([text],{type}),u=URL.createObjectURL(b),a=document.createElement("a");a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}

function appMode(){
 const params=new URLSearchParams(location.search),queryMode=params.get("app");
 if(queryMode==="owner"||queryMode==="individual"||queryMode==="customer")return queryMode;
 const stored=sessionStorage.getItem("icuAppMode");
 if(stored==="owner"||stored==="individual"||stored==="customer")return stored;
 const hash=(location.hash||"").replace("#","");
 if(hash==="owner"||hash.startsWith("owner-"))return"owner";
 if(hash.startsWith("barber-"))return"individual";
 return"customer"
}
function activeBarber(){
 if(appMode()==="owner"&&typeof ownerWorkspace==="function"&&ownerWorkspace()==="tony")return"Tony";
 if(appMode()==="owner")return"Tony";
 const params=new URLSearchParams(location.search),queryBarber=params.get("barber");
 if(appMode()==="individual"){
   const q=BARBERS.find(name=>name.toLowerCase()===String(queryBarber||"").toLowerCase());if(q)return q;
   const stored=sessionStorage.getItem("icuBarberName")||"",s=BARBERS.find(name=>name.toLowerCase()===stored.toLowerCase());if(s)return s;
   const hash=(location.hash||"").replace("#","");if(hash.startsWith("barber-")){const candidate=hash.slice(7),h=BARBERS.find(name=>name.toLowerCase()===candidate.toLowerCase());if(h)return h}
 }
 return""
}
function individualAppointments(){const barber=activeBarber();return loadAppointments().filter(a=>a.barber===barber)}

function populateBarberSelects(){
 ["#ownerAppointmentBarber","#ownerPricingBarber","#ownerRevenueBarber","#ownerAnalyticsBarber","#marketingBarber"].forEach(selector=>{
   const el=$(selector);if(!el)return;
   const includeAll=selector==="#ownerAppointmentBarber"||selector==="#marketingBarber";
   el.innerHTML=(includeAll?'<option value="">All barbers</option>':"")+BARBERS.map(name=>`<option>${name}</option>`).join("");
 });
 ["#ownerAppointmentStatus","#individualStatus"].forEach(selector=>{
   const el=$(selector);if(el)el.innerHTML='<option value="">All statuses</option>'+STATUSES.map(status=>`<option>${status}</option>`).join("");
 });
}

function renderCustomerServices(){
 const barber=$("#barber").value;
 const target=$("#serviceList");
 if(!barber){
   target.innerHTML='<div class="notice">Select a barber to view services and prices.</div>';
   return;
 }
 target.innerHTML=servicesForBarber(barber).map(service=>`
  <label class="service-row ${service.barberOnly?"barber-exclusive":""}">
   <input type="checkbox" value="${service.id}">
   <span class="service-copy"><strong>${esc(service.name)}</strong><small>${esc(service.description)}</small>${service.barberOnly?`<span class="exclusive-tag">${esc(service.barberOnly)} only</span>`:""}</span>
   <span class="service-price">${service.minutes} min<strong>${money(effectivePrice(barber,service.id))}</strong></span>
  </label>`).join("");
}
function minutesFromTime(value){
 if(!value)return 0;
 const [hour,minute]=value.split(":").map(Number);
 return hour*60+minute;
}
function weekdayNameForDate(dateValue){
 return new Intl.DateTimeFormat("en-US",{weekday:"long"}).format(new Date(`${dateValue}T12:00:00`));
}
function dateIsBlockedByTimeOff(barber,dateValue){
 return loadKey(TIMEOFF_KEY,[]).some(item=>item.barber===barber&&dateValue>=item.start&&dateValue<=item.end);
}
function availabilityForDate(barber,dateValue){
 const all=loadKey(AVAILABILITY_KEY,{});
 const barberData=all[barber]||{};
 if(barberData.dates&&barberData.dates[dateValue])return barberData.dates[dateValue];
 if(barberData[dateValue])return barberData[dateValue];
 const weekday=weekdayNameForDate(dateValue);
 if(barberData[weekday])return barberData[weekday];
 return defaultAvailability(barber)[weekday];
}
function intervalConflictsWithBreak(startMinute,endMinute,availability){
 if(!availability.breakStart||!availability.breakEnd)return false;
 const breakStart=minutesFromTime(availability.breakStart),breakEnd=minutesFromTime(availability.breakEnd);
 if(breakEnd<=breakStart)return false;
 return startMinute<breakEnd&&endMinute>breakStart;
}
function refreshTimes(){
 const barber=$("#barber").value,date=$("#date").value,ids=selectedIds(),time=$("#time"),message=$("#availabilityMessage");
 time.innerHTML="";

 if(!barber||!date||!ids.length){
   time.disabled=true;
   time.innerHTML='<option value="">Select a barber, date, and services first</option>';
   message.className="notice";
   message.textContent="Available times will appear after you select a barber, date, and services.";
   updateBookingSummary();updateBookingDepositNotice();
   return;
 }

 const availability=availabilityForDate(barber,date);

 if(dateIsBlockedByTimeOff(barber,date)){
   time.disabled=true;
   time.innerHTML='<option value="">Barber is unavailable on this date</option>';
   message.className="notice";
   message.textContent="The selected barber has blocked this date as time off.";
   updateBookingSummary();
   return;
 }

 if(!availability||!availability.enabled){
   time.disabled=true;
   time.innerHTML='<option value="">Barber is not working on this date</option>';
   message.className="notice";
   message.textContent="The selected barber is not scheduled to work on this date.";
   updateBookingSummary();
   return;
 }

 const duration=selectedDuration();
 const now=new Date();
 const workStart=minutesFromTime(availability.start);
 const workEnd=minutesFromTime(availability.end);

 /*
  * After-hours availability is offered only when the barber's
  * scheduled end time reaches the normal 7:00 PM closing time.
  */
 const allowsAfterHours=workEnd>=NORMAL_CLOSE_MINUTE;
 const latestStartMinute=allowsAfterHours?LATEST_START_MINUTE:workEnd;

 let count=0;
 let normalCount=0;
 let afterHoursCount=0;

 time.append(new Option("Select an available time",""));

 for(let startMinute=workStart;startMinute<=latestStartMinute;startMinute+=15){
   const finishMinute=startMinute+duration;
   const isAfterHours=startMinute>=NORMAL_CLOSE_MINUTE;

   /*
    * Normal appointments must finish before the barber's saved
    * departure time.
    */
   if(!isAfterHours&&finishMinute>workEnd)continue;

   /*
    * Barbers who leave before 7:00 PM do not receive after-hours
    * appointment choices.
    */
   if(isAfterHours&&!allowsAfterHours)continue;

   if(intervalConflictsWithBreak(startMinute,finishMinute,availability))continue;

   const start=`${date}T${String(Math.floor(startMinute/60)).padStart(2,"0")}:${String(startMinute%60).padStart(2,"0")}`;
   const end=new Date(new Date(start).getTime()+duration*60000).toISOString();

   if(new Date(start)<=now||hasConflict(barber,start,end))continue;

   const label=`${formatTime(start)}${isAfterHours?" (+$15 After-Hours Fee)":""}`;
   const option=new Option(label,start);
   option.dataset.afterHours=isAfterHours?"true":"false";
   time.append(option);

   count++;
   if(isAfterHours)afterHoursCount++;
   else normalCount++;
 }

 time.disabled=count===0;

 if(!count){
   time.innerHTML='<option value="">No available times</option>';
   message.className="notice";
   message.textContent=`No ${duration}-minute appointment can fit inside ${formatClockLabel(availability.start)}–${formatClockLabel(availability.end)} after breaks, time off, and existing bookings are removed.`;
 }else if(afterHoursCount>0){
   message.className="notice after-hours-notice";
   message.textContent=`${count} available times for ${formatCalendarDate(date)}. ${afterHoursCount} after-hours time${afterHoursCount===1?"":"s"} from 7:00 PM through 9:00 PM include a $15 fee.`;
 }else{
   message.className="notice";
   message.textContent=`${normalCount} available time${normalCount===1?"":"s"} based on ${barber}'s saved hours for ${formatCalendarDate(date)}.`;
 }

 updateBookingSummary();
}
function hairScalpPolicyAgreed(){return Boolean(sessionStorage.getItem(HAIR_SCALP_POLICY_SESSION_KEY))}
function ensureHairScalpPolicyForBooking(){if(appMode()!=="customer"||hairScalpPolicyAgreed())return;const dialog=$("#hairScalpPolicyModal");if(dialog&&!dialog.open)setTimeout(()=>{if(!dialog.open)dialog.showModal()},0)}
function agreeHairScalpPolicy(){sessionStorage.setItem(HAIR_SCALP_POLICY_SESSION_KEY,new Date().toISOString());$("#hairScalpPolicyModal")?.close();toast("Hair & Scalp Preparation Policy acknowledged.")}

function bookingSummaryHtml(){
 const barber=$("#barber").value,ids=selectedIds(),start=$("#time").value,after=isAfterHoursStart(start);
 const name=[$("#firstName").value.trim(),$("#lastName").value.trim()].filter(Boolean).join(" ")||"Not entered";
 const serviceTotal=selectedServiceTotal(barber),fee=after?AFTER_HOURS_CUSTOMER_FEE:0,deposit=barber?depositRequirement(barber,$("#phone").value,$("#email").value):{amount:0};
 return `<div class="summary-list">
  <div class="summary-row"><span>Customer</span><strong>${esc(name)}</strong></div>
  <div class="summary-row"><span>Barber</span><strong>${esc(barber||"Not selected")}</strong></div>
  <div class="summary-row"><span>Services</span><strong>${ids.length?esc(serviceNames(ids)):"Not selected"}</strong></div>
  <div class="summary-row"><span>Date and time</span><strong>${start?esc(formatDateTime(start)):"Not selected"}</strong></div>
  <div class="summary-row"><span>Service total</span><strong>${money(serviceTotal)}</strong></div>
  ${after?`<div class="summary-row"><span>After-Hours Fee</span><strong>${money(fee)}</strong></div>`:""}
  ${deposit.amount?`<div class="summary-row"><span>Non-Refundable Deposit Due Now</span><strong>${money(deposit.amount)}</strong></div>`:""}<div class="summary-row"><span>Duration</span><strong>${selectedDuration()} minutes</strong></div>
 </div><div class="summary-total"><span>Total</span><strong>${money(serviceTotal+fee)}</strong></div>`;
}
function updateBookingSummary(){
 const html=bookingSummaryHtml();
 $("#summaryContent").innerHTML=html;$("#mobileSummary").innerHTML=`<h2>Appointment summary</h2>${html}`;
}
function validateBooking(){
 const fields=[["#firstName","Enter a first name."],["#lastName","Enter a last name."],["#phone","Enter a phone number."],["#barber","Select a barber."],["#date","Select a date."],["#time","Select an available time."]];
 for(const[field,message]of fields){if(!$(field).value){$(field).focus();toast(message);return false}}
 if(normalizePhone($("#phone").value).length!==10){$("#phone").focus();toast("Enter a complete 10-digit phone number.");return false}
 if($("#email").value&&!$("#email").checkValidity()){toast("Enter a valid email address or leave it blank.");return false}
 if(!selectedIds().length){toast("Select at least one service.");return false}
 return true
}
function reviewBooking(){
 if(!validateBooking())return;
 const ids=selectedIds(),barber=$("#barber").value,start=$("#time").value,after=isAfterHoursStart(start),duration=selectedDuration();
 const priceSnapshot={};ids.forEach(id=>priceSnapshot[id]=effectivePrice(barber,id));
 const serviceTotal=Object.values(priceSnapshot).reduce((sum,value)=>sum+Number(value),0);
 const deposit=depositRequirement(barber,$("#phone").value,$("#email").value);
 pending={id:`appt-${Date.now()}-${Math.floor(Math.random()*10000)}`,firstName:$("#firstName").value.trim(),lastName:$("#lastName").value.trim(),email:$("#email").value.trim().toLowerCase(),phone:formatPhone($("#phone").value),serviceIds:ids,barber,startAt:start,endAt:new Date(new Date(start).getTime()+duration*60000).toISOString(),notes:$("#notes").value.trim(),howHeard:$("#howHeard")?.value||"",status:"Scheduled",priceSnapshot,afterHours:after,customerAfterHoursFee:after?AFTER_HOURS_CUSTOMER_FEE:0,barberAfterHoursFee:after?AFTER_HOURS_BARBER_FEE:0,customerTotal:serviceTotal+(after?AFTER_HOURS_CUSTOMER_FEE:0),depositRequired:deposit.amount,depositReason:deposit.reason,depositPriorStatus:deposit.prior?.status||"",depositStatus:deposit.required?"Pending":"Not Required",hairScalpPolicyAcknowledgedAt:sessionStorage.getItem(HAIR_SCALP_POLICY_SESSION_KEY)||"",createdAt:new Date().toISOString()};
 $("#reviewDetails").innerHTML=`<div class="review-grid">
  <div><span>Customer</span><strong>${esc(pending.firstName+" "+pending.lastName)}</strong></div>
  <div><span>Phone</span><strong>${esc(pending.phone)}</strong></div>${pending.email?`<div><span>Email</span><strong>${esc(pending.email)}</strong></div>`:""}
  <div><span>Barber</span><strong>${esc(barber)}</strong></div>
  <div><span>Services</span><strong>${esc(serviceNames(ids))}</strong></div>
  <div><span>Date and time</span><strong>${esc(formatDateTime(start))}</strong></div>
  <div><span>Service total</span><strong>${money(serviceTotal)}</strong></div>
  ${after?`<div><span>After-Hours Fee</span><strong>${money(AFTER_HOURS_CUSTOMER_FEE)}</strong></div>`:""}
  <div><span>Total</span><strong>${money(pending.customerTotal)}</strong></div>
 </div>`;
 const depositBox=$("#depositCheckout"),ack=$("#depositAcknowledgement");
 if(pending.depositRequired){depositBox.classList.remove("hidden");ack.checked=false;const prior=pending.depositPriorStatus||"";let reasonText="";if(prior==="Last Second Cancellation")reasonText=" This requirement is because the previous appointment was cancelled too close to the scheduled service time to give the barber a reasonable opportunity to fill that opening with another client.";else if(pending.depositReason.includes("Prior"))reasonText=" The deposit requirement was triggered by the most recent cancelled/no-show booking.";$("#depositCheckoutText").textContent=`${money(pending.depositRequired)} is due now. This deposit is non-refundable and will be applied toward the appointment balance.${reasonText}`;$("#depositAcknowledgementText").textContent=`I understand that the ${money(pending.depositRequired)} deposit is non-refundable and will be applied toward my appointment balance.`;$("#confirmButton").textContent="Pay Deposit & Confirm Booking"}
 else{depositBox.classList.add("hidden");ack.checked=false;$("#confirmButton").textContent="Confirm booking"}
 $("#reviewPanel").classList.remove("hidden");$("#successPanel").classList.add("hidden");$("#reviewPanel").scrollIntoView({behavior:"smooth",block:"start"});
}
async function confirmBooking(){
 if(!pending)return;
 if(pending.depositRequired&&!$("#depositAcknowledgement").checked){toast("Acknowledge the non-refundable deposit policy before continuing.");return}
 if(hasConflict(pending.barber,pending.startAt,pending.endAt)){toast("That time was just booked. Select another time.");$("#reviewPanel").classList.add("hidden");refreshTimes();return}
 const finalized={...pending};
 if(finalized.depositRequired){
   finalized.depositPaid=finalized.depositRequired;finalized.depositStatus="Paid";finalized.depositPaymentMethod=$("#depositPaymentMethod").value;finalized.depositAcknowledgedAt=new Date().toISOString();finalized.balanceDue=Math.max(0,finalized.customerTotal-finalized.depositPaid);
 }else{finalized.depositPaid=0;finalized.balanceDue=finalized.customerTotal}
 const button=$("#confirmButton"),oldText=button.textContent;button.disabled=true;button.textContent="Saving appointment…";
 try{
   if(!window.ICUCloud)throw new Error("Cloud booking is unavailable. Refresh the page and try again.");
   await ICUCloud.createBooking(finalized);
 }catch(error){
   toast(error?.message||"Unable to save the appointment.");
   button.disabled=false;button.textContent=oldText;$("#reviewPanel").classList.add("hidden");await window.ICUCloud?.publicState?.();refreshTimes();return
 }
 if(finalized.depositPaid){
   const deposits=loadKey(DEPOSIT_PAYMENTS_KEY,[]);deposits.push({id:`dep-${Date.now()}`,appointmentId:finalized.id,barber:finalized.barber,customer:`${finalized.firstName} ${finalized.lastName}`,phone:finalized.phone,amount:finalized.depositPaid,method:finalized.depositPaymentMethod,nonRefundable:true,reason:finalized.depositReason,paidAt:finalized.depositAcknowledgedAt});localStorage.setItem(DEPOSIT_PAYMENTS_KEY,JSON.stringify(deposits))
 }
 const items=loadAppointments().filter(a=>a.id!==finalized.id);items.push(finalized);localStorage.setItem(APPOINTMENTS_KEY,JSON.stringify(items));sessionStorage.removeItem(HAIR_SCALP_POLICY_SESSION_KEY);setCustomerSession(finalized.phone);
 if(finalized.howHeard){const attrs=loadKey(ATTRIBUTION_KEY,[]);attrs.push({id:`attr-${Date.now()}`,appointmentId:finalized.id,source:finalized.howHeard,createdAt:new Date().toISOString()});localStorage.setItem(ATTRIBUTION_KEY,JSON.stringify(attrs))}
 const successHtml=`<div class="review-grid"><div><span>Date</span><strong>${esc(formatDateTime(finalized.startAt))}</strong></div><div><span>Barber</span><strong>${esc(finalized.barber)}</strong></div><div><span>Services</span><strong>${esc(serviceNames(finalized.serviceIds))}</strong></div>${finalized.notes?`<div><span>Customer Notes</span><strong>${esc(finalized.notes)}</strong></div>`:""}${finalized.afterHours?`<div><span>After-Hours Fee</span><strong>${money(AFTER_HOURS_CUSTOMER_FEE)}</strong></div>`:""}${finalized.depositPaid?`<div><span>Non-Refundable Deposit Paid</span><strong>${money(finalized.depositPaid)}</strong></div><div><span>Remaining Balance</span><strong>${money(finalized.balanceDue)}</strong></div>`:""}<div><span>Total</span><strong>${money(finalized.customerTotal)}</strong></div></div>`;
 resetBookingForm();
 $("#successDetails").innerHTML=successHtml;
 $("#successPanel").classList.remove("hidden");if(!$("#successPanel .shop-location-card"))$("#successPanel").insertAdjacentHTML("beforeend",shopLocationCard());
 $("#successPanel").scrollIntoView({behavior:"smooth",block:"start"});button.disabled=false;
}
function resetBookingForm(){
 $("#bookingForm").reset();$("#date").value=today();pending=null;renderCustomerServices();prefillSignedInCustomerBooking();refreshTimes();$("#reviewPanel").classList.add("hidden");$("#depositCheckout").classList.add("hidden");$("#successPanel").classList.add("hidden");updateBookingDepositNotice();updateBookingSummary();
}

function appointmentCard(a,editable){
 const date=new Date(a.startAt),statusOptions=STATUSES.map(status=>`<option ${status===a.status?"selected":""}>${status}</option>`).join("");
 return `<article class="appointment-card">
  <div class="date-badge"><small>${date.toLocaleString("en-US",{month:"short"})}</small><strong>${date.getDate()}</strong></div>
  <div class="appointment-main"><span class="status status-${a.status.toLowerCase().replaceAll(" ","-")}">${esc(a.status)}</span>${a.afterHours?'<span class="after-hours-badge">After hours</span>':""}<h3>${esc(formatDateTime(a.startAt))}</h3><p>${esc(serviceNames(a.serviceIds))} with ${esc(a.barber)}</p><p class="help">${esc(a.firstName+" "+a.lastName)} • ${esc(a.phone||a.email)}</p>${a.notes?`<div class="client-note-box"><strong>Customer Notes</strong><span>${esc(a.notes)}</span></div>`:""}</div>
  <div class="appointment-side"><strong>${money(customerTotalForAppointment(a))}</strong>${editable?`<select data-status-id="${a.id}">${statusOptions}</select>`:""}</div>
 </article>`;
}
function updateAppointmentStatus(id,status){
 const items=loadAppointments(),appointment=items.find(item=>item.id===id);if(!appointment)return;
 appointment.status=status;saveAppointments(items);renderCurrentView();toast("Status updated.");
}

function renderOwnerAppointments(){
 const barber=$("#ownerAppointmentBarber").value,date=$("#ownerAppointmentDate").value,status=$("#ownerAppointmentStatus").value;
 let items=loadAppointments();if(barber)items=items.filter(a=>a.barber===barber);if(date)items=items.filter(a=>a.startAt.startsWith(date));if(status)items=items.filter(a=>a.status===status);
 items.sort((a,b)=>new Date(a.startAt)-new Date(b.startAt));
 $("#ownerAppointmentStats").innerHTML=[["Matching appointments",items.length],["After-hours",items.filter(a=>a.afterHours).length],["Completed",items.filter(a=>a.status==="Completed").length],["Customer value",money(items.reduce((sum,a)=>sum+customerTotalForAppointment(a),0))]].map(([label,value])=>`<div class="stat"><span>${label}</span><strong>${value}</strong></div>`).join("");
 $("#ownerAppointments").innerHTML=items.length?items.map(a=>appointmentCard(a,true)).join(""):'<section class="panel"><h2>No appointments</h2></section>';
}

function pricingRow(service,entry,ownerMode){
 const locked=Boolean(entry.locked);
 return `<div class="pricing-row" data-service-id="${service.id}">
  <div class="price-name"><strong>${esc(service.name)}</strong><small>${esc(service.description)} • Default ${money(service.defaultPrice)}${service.customByBarber?` • Added by ${esc(service.customByBarber)}`:""}</small>${!ownerMode&&locked?'<span class="locked-indicator">Locked by Owner</span>':""}</div>
  <label class="price-input-wrap"><span>$</span><input class="pricing-input" type="number" min="0" step="0.01" value="${(entry.price/100).toFixed(2)}" ${!ownerMode&&locked?"disabled":""}></label>
  ${ownerMode?`<label class="lock-control"><input class="pricing-lock" type="checkbox" ${locked?"checked":""}> Lock price</label>`:"<span></span>"}
 </div>`;
}
function renderOwnerPricing(){
 const barber=$("#ownerPricingBarber").value||BARBERS[0],pricing=loadPricing();
 $("#ownerPricingBarber").value=barber;
 $("#ownerPricingList").innerHTML=servicesForBarber(barber).map(service=>pricingRow(service,pricing[barber][service.id],true)).join("");
}
function saveOwnerPricing(){
 const barber=$("#ownerPricingBarber").value,pricing=loadPricing();
 $$("#ownerPricingList .pricing-row").forEach(row=>{
   const id=row.dataset.serviceId,input=row.querySelector(".pricing-input"),lock=row.querySelector(".pricing-lock");
   pricing[barber][id]={price:Math.max(0,Math.round(Number(input.value||0)*100)),locked:lock.checked,override:true};
 });
 savePricing(pricing);renderOwnerPricing();toast("Owner pricing controls saved.");
}
function renderBarberPricing(){
 const barber=activeBarber(),pricing=loadPricing();$("#barberPricesTitle").textContent=`${barber}'s Prices`;
 $("#barberPricingList").innerHTML=servicesForBarber(barber).map(service=>pricingRow(service,pricing[barber][service.id],false)).join("");
}
function saveBarberPricing(){
 const barber=activeBarber(),pricing=loadPricing();
 $$("#barberPricingList .pricing-row").forEach(row=>{
   const id=row.dataset.serviceId,entry=pricing[barber][id];if(entry.locked)return;
   entry.price=Math.max(0,Math.round(Number(row.querySelector(".pricing-input").value||0)*100));entry.override=false;
 });
 savePricing(pricing);renderBarberPricing();toast("Your prices were saved.");
}

function renderBarberServices(){
 const barber=activeBarber(),prefs=loadBarberServicePrefs(),inactive=new Set(prefs[barber]?.inactive||[]),services=eligibleServicesForBarber(barber);
 $("#barberServicesTitle").textContent=`${barber}'s Services`;
 $("#barberServicesList").innerHTML=services.length?services.map(service=>`<label class="service-management-row"><input type="checkbox" data-barber-service-toggle="${service.id}" ${inactive.has(service.id)?"":"checked"}><span><strong>${esc(service.name)}</strong><small>${service.minutes} min • ${money(effectivePrice(barber,service.id))}${service.customByBarber?" • Added by you":""}</small><small>${esc(service.description||"")}</small></span><em>${inactive.has(service.id)?"Not offered":"Active"}</em></label>`).join(""):'<p class="help">No services are available.</p>'
}
function setBarberServiceActive(serviceId,active){
 const barber=activeBarber(),prefs=loadBarberServicePrefs();prefs[barber]=prefs[barber]||{inactive:[]};const set=new Set(prefs[barber].inactive||[]);active?set.delete(serviceId):set.add(serviceId);prefs[barber].inactive=[...set];saveBarberServicePrefs(prefs);renderBarberServices();toast(active?"Service added to your active menu.":"Service removed from your active menu.")
}
function addCustomBarberService(){
 const barber=activeBarber(),name=$("#newServiceName").value.trim(),minutes=Math.max(5,Math.round(Number($("#newServiceMinutes").value||0))),price=Math.max(0,Math.round(Number($("#newServicePrice").value||0)*100)),description=$("#newServiceDescription").value.trim();
 if(!name){toast("Enter a service name.");$("#newServiceName").focus();return}
 if(!minutes){toast("Enter the service duration.");return}
 const idBase=name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"service",id=`custom-${barber.toLowerCase()}-${idBase}-${Date.now().toString(36)}`;
 const items=loadCustomServices();items.push({id,name,minutes,defaultPrice:price,description:description||`${name} offered by ${barber}.`,barberOnly:barber,customByBarber:barber,createdAt:new Date().toISOString()});saveCustomServices(items);
 const pricing=loadPricing();pricing[barber]=pricing[barber]||{};pricing[barber][id]={price,locked:false,override:false};savePricing(pricing);
 $("#newServiceName").value="";$("#newServiceDescription").value="";$("#newServiceMinutes").value="30";$("#newServicePrice").value="25.00";renderBarberServices();toast(`${name} was added to your services.`)
}

function periodBounds(range,dateValue){
 const ref=new Date(`${dateValue}T12:00:00`),start=new Date(ref),end=new Date(ref);
 if(range==="day"){}
 if(range==="week"){const day=(start.getDay()+6)%7;start.setDate(start.getDate()-day);end.setDate(start.getDate()+6)}
 if(range==="month"){start.setDate(1);end.setMonth(start.getMonth()+1,0)}
 if(range==="year"){start.setMonth(0,1);end.setMonth(11,31)}
 start.setHours(0,0,0,0);end.setHours(23,59,59,999);return{start,end};
}
function revenueData(barber,range,dateValue){
 const bounds=periodBounds(range,dateValue);
 const completed=loadAppointments().filter(a=>a.barber===barber&&a.status==="Completed"&&new Date(a.startAt)>=bounds.start&&new Date(a.startAt)<=bounds.end);
 const gross=completed.reduce((sum,a)=>sum+customerTotalForAppointment(a),0);
 const serviceRevenue=completed.reduce((sum,a)=>sum+grossServiceRevenue(a),0);
 const customerFees=completed.reduce((sum,a)=>sum+(a.afterHours?AFTER_HOURS_CUSTOMER_FEE:0),0);
 const ownerCharges=uniqueAfterHoursCharges(completed);
 return{completed,gross,serviceRevenue,customerFees,ownerCharges,net:gross-ownerCharges,bounds};
}
function revenueLabel(range){return{day:"Daily",week:"Weekly",month:"Monthly",year:"Yearly"}[range]}
function revenueCardsHtml(data){
 return [["Net barber revenue",money(data.net)],["Gross customer revenue",money(data.gross)],["After-hours shop charges",money(data.ownerCharges)],["Completed appointments",data.completed.length]].map(([label,value])=>`<div class="stat"><span>${label}</span><strong>${value}</strong></div>`).join("");
}
function revenueDetailsHtml(data){
 if(!data.completed.length)return'<p class="help">No completed appointments in this timeframe.</p>';
 const chargedDates=new Set();
 return `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Customer</th><th>Services</th><th>Customer total</th><th>Shop charge</th><th>Net</th></tr></thead><tbody>${data.completed.map(a=>{const key=barberDateKey(a),charge=a.afterHours&&!chargedDates.has(key)?AFTER_HOURS_BARBER_FEE:0;if(charge)chargedDates.add(key);return`<tr><td>${esc(formatDateTime(a.startAt))}</td><td>${esc(a.firstName+" "+a.lastName)}</td><td>${esc(serviceNames(a.serviceIds))}</td><td>${money(customerTotalForAppointment(a))}</td><td>${money(charge)}</td><td>${money(customerTotalForAppointment(a)-charge)}</td></tr>`}).join("")}</tbody></table></div>`;
}
function renderBarberRevenue(){
 const barber=activeBarber(),range=$("#barberRevenueRange").value,date=$("#barberRevenueDate").value,data=revenueData(barber,range,date);
 $("#barberRevenueTitle").textContent=`${barber}'s Revenue`;$("#barberRevenueCards").innerHTML=revenueCardsHtml(data);$("#barberRevenueHeading").textContent=`${revenueLabel(range)} revenue`;$("#barberRevenueDetails").innerHTML=revenueDetailsHtml(data);
}
function renderOwnerRevenue(){
 const barber=$("#ownerRevenueBarber").value||BARBERS[0],range=$("#ownerRevenueRange").value,date=$("#ownerRevenueDate").value,data=revenueData(barber,range,date);
 $("#ownerRevenueBarber").value=barber;$("#ownerRevenueCards").innerHTML=revenueCardsHtml(data);$("#ownerRevenueHeading").textContent=`${barber} — ${revenueLabel(range)} revenue`;$("#ownerRevenueDetails").innerHTML=revenueDetailsHtml(data);
}

function startOfWeek(date){const d=new Date(date),day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);d.setHours(0,0,0,0);return d}
function countBetween(items,start,end){return items.filter(a=>new Date(a.startAt)>=start&&new Date(a.startAt)<=end&&a.status!=="Cancelled").length}
function analyticsFor(barber,dateValue){
 const all=loadAppointments().filter(a=>a.barber===barber&&a.status!=="Cancelled"),ref=new Date(`${dateValue}T12:00:00`);
 const days=[];for(let i=6;i>=0;i--){const d=new Date(ref);d.setDate(d.getDate()-i);const start=new Date(d);start.setHours(0,0,0,0);const end=new Date(d);end.setHours(23,59,59,999);days.push({label:d.toLocaleDateString("en-US",{weekday:"short"}),value:countBetween(all,start,end)})}
 const weeks=[];const currentWeek=startOfWeek(ref);for(let i=5;i>=0;i--){const start=new Date(currentWeek);start.setDate(start.getDate()-7*i);const end=new Date(start);end.setDate(end.getDate()+6);end.setHours(23,59,59,999);weeks.push({label:`${start.getMonth()+1}/${start.getDate()}`,value:countBetween(all,start,end)})}
 const months=[];for(let i=5;i>=0;i--){const d=new Date(ref.getFullYear(),ref.getMonth()-i,1);const start=new Date(d),end=new Date(d.getFullYear(),d.getMonth()+1,0,23,59,59,999);months.push({label:d.toLocaleDateString("en-US",{month:"short"}),value:countBetween(all,start,end)})}
 const serviceCounts={};allServices().forEach(s=>serviceCounts[s.id]=0);all.forEach(a=>a.serviceIds.forEach(id=>serviceCounts[id]=(serviceCounts[id]||0)+1));
 const services=Object.entries(serviceCounts).filter(([id])=>servicesForBarber(barber).some(s=>s.id===id)).map(([id,value])=>({label:serviceById(id).name,value})).sort((a,b)=>b.value-a.value);
 const clientMap=new Map();
 all.forEach(a=>{const key=a.email||`${a.firstName}|${a.lastName}|${a.phone}`;const item=clientMap.get(key)||{name:`${a.firstName} ${a.lastName}`,email:a.email,dates:[]};item.dates.push(new Date(a.startAt));clientMap.set(key,item)});
 const recurring=[];
 clientMap.forEach(client=>{
   client.dates.sort((a,b)=>a-b);if(client.dates.length<3)return;
   const gaps=[];for(let i=1;i<client.dates.length;i++)gaps.push((client.dates[i]-client.dates[i-1])/86400000);
   const avg=gaps.reduce((a,b)=>a+b,0)/gaps.length;
   if(avg>=5&&avg<=10)recurring.push({...client,pattern:"Weekly",average:avg});
   else if(avg>10&&avg<=18)recurring.push({...client,pattern:"Biweekly",average:avg});
 });
 return{days,weeks,months,services,recurring};
}
function barsHtml(title,data){
 const max=Math.max(1,...data.map(item=>item.value));
 return `<section class="analytics-card"><h2>${title}</h2><div class="trend-bars">${data.map(item=>`<div class="trend-row"><span>${esc(item.label)}</span><div class="trend-track"><div class="trend-fill" style="width:${Math.max(2,item.value/max*100)}%"></div></div><strong>${item.value}</strong></div>`).join("")}</div></section>`;
}
function analyticsHtml(barber,dateValue){
 const data=analyticsFor(barber,dateValue);
 return `<div class="analytics-grid">${barsHtml("Daily traffic — last 7 days",data.days)}${barsHtml("Weekly traffic — last 6 weeks",data.weeks)}${barsHtml("Monthly traffic — last 6 months",data.months)}${barsHtml("Service trends",data.services)}<section class="analytics-card full"><h2>Weekly and biweekly customers</h2><div class="recurring-list">${data.recurring.length?data.recurring.map(client=>`<div class="recurring-item"><div><strong>${esc(client.name)}</strong><span>${esc(client.email||"No email")}</span></div><div><strong>${client.pattern}</strong><span>Average ${client.average.toFixed(1)} days</span></div></div>`).join(""):'<p class="help">No weekly or biweekly pattern has been established yet. At least three bookings are needed.</p>'}</div></section></div>`;
}
function renderBarberAnalytics(){const barber=activeBarber();$("#barberAnalyticsTitle").textContent=`${barber}'s Analytics`;$("#barberAnalyticsContent").innerHTML=analyticsHtml(barber,$("#barberAnalyticsDate").value)}
function renderOwnerAnalytics(){const barber=$("#ownerAnalyticsBarber").value||BARBERS[0];$("#ownerAnalyticsBarber").value=barber;$("#ownerAnalyticsContent").innerHTML=analyticsHtml(barber,$("#ownerAnalyticsDate").value)}

function renderIndividualAppointments(){
 const barber=activeBarber(),date=$("#individualDate").value,status=$("#individualStatus").value;
 let items=individualAppointments();if(date)items=items.filter(a=>a.startAt.startsWith(date));if(status)items=items.filter(a=>a.status===status);
 items.sort((a,b)=>new Date(a.startAt)-new Date(b.startAt));$("#barberAppointmentsTitle").textContent=`${barber}'s Appointments`;$("#individualAppointments").innerHTML=items.length?items.map(a=>appointmentCard(a,true)).join(""):'<section class="panel"><h2>No appointments</h2></section>';
}
function renderClientele(){
 const barber=activeBarber(),appointments=individualAppointments(),all=clientsForBarber(barber).slice().sort((a,b)=>String(a.lastName||"").localeCompare(String(b.lastName||""))||String(a.firstName||"").localeCompare(String(b.firstName||""))),query=String($("#clienteleSearch")?.value||"").trim().toLowerCase();
 if(!window.__icuSelectedClienteleKey||!all.some(c=>c.key===window.__icuSelectedClienteleKey))window.__icuSelectedClienteleKey=all[0]?.key||"";
 const visible=all.filter(c=>!query||`${c.firstName} ${c.lastName} ${c.email} ${c.phone}`.toLowerCase().includes(query));
 $("#barberClienteleTitle").textContent=`${barber}'s Clientele`;
 $("#clienteleStats").innerHTML=[["Unique clients",all.length],["Total bookings",appointments.length],["Upcoming",appointments.filter(a=>new Date(a.startAt)>=new Date()&&!["Cancelled","Last Second Cancellation"].includes(a.status)).length],["Completed",appointments.filter(a=>a.status==="Completed").length]].map(([l,v])=>`<div class="stat"><span>${l}</span><strong>${v}</strong></div>`).join("");
 $("#clienteleDirectoryList").innerHTML=visible.length?visible.map(c=>`<button class="client-directory-button ${c.key===window.__icuSelectedClienteleKey?"active":""}" type="button" data-clientele-key="${esc(c.key)}"><strong>${esc((c.lastName||"")+", "+(c.firstName||""))}</strong><small>${esc(c.phone||c.email||"No contact information")}</small></button>`).join(""):'<p class="help">No clients match this search.</p>';
 renderSelectedClientele()
}
function renderSelectedClientele(){
 const barber=activeBarber(),c=clientsForBarber(barber).find(x=>x.key===window.__icuSelectedClienteleKey),target=$("#clienteleDetail");
 if(!c){target.innerHTML='<div class="panel"><h2>No client selected</h2><p>Choose a client from the alphabetical list.</p></div>';return}
 $("#clienteleDirectoryList")?.querySelectorAll("[data-clientele-key]").forEach(b=>b.classList.toggle("active",b.dataset.clienteleKey===c.key));
 const appts=c.appointments.filter(a=>a.barber===barber).slice().sort((a,b)=>new Date(b.startAt)-new Date(a.startAt)),completed=appts.filter(a=>a.status==="Completed"),upcoming=appts.filter(a=>new Date(a.startAt)>=new Date()&&!["Cancelled","Last Second Cancellation"].includes(a.status)),value=appts.reduce((s,a)=>s+customerTotalForAppointment(a),0),familyStore=loadKey(FAMILY_KEY,{}),family=familyStore[customerStorageKey(c)]||familyStore[c.email]||[];
 target.innerHTML=`<div class="profile-grid"><section class="profile-card"><p class="eyebrow">Client</p><h2>${esc(c.firstName+" "+c.lastName)}</h2><p>${esc(c.phone||"No phone")}${c.email?`<br>${esc(c.email)}`:""}</p><div class="profile-row"><span>Bookings with ${esc(barber)}</span><strong>${appts.length}</strong></div><div class="profile-row"><span>Completed</span><strong>${completed.length}</strong></div><div class="profile-row"><span>Upcoming</span><strong>${upcoming.length}</strong></div><div class="profile-row"><span>Booked value</span><strong>${money(value)}</strong></div></section><section class="profile-card"><h2>Family Members</h2>${family.length?family.map(f=>`<div class="profile-row"><span>${esc(f.name)}</span><strong>${esc(f.relationship||"Family")}</strong></div>`).join(""):'<p class="help">No family members saved.</p>'}<h2>Recent Appointments</h2>${appts.slice(0,10).map(a=>`<div class="profile-row"><span>${esc(formatDateTime(a.startAt))}<br><small>${esc(serviceNames(a.serviceIds||[]))}</small></span><strong>${esc(a.status)}</strong></div>`).join("")||'<p class="help">No appointments.</p>'}</section></div>`
}

function calendarStatusClass(status){if(status==="Confirmed")return"confirmed";if(status==="Checked In"||status==="In Progress")return"progress";if(status==="Completed")return"completed";if(["Cancelled","Last Second Cancellation","No Show"].includes(status))return"cancelled";return"scheduled"}
function renderCalendarTimes(){
 const target=$("#calendarTimes");if(target.children.length)return;let html="";
 for(let minute=9*60;minute<=23*60;minute+=15){const hour=Math.floor(minute/60),min=minute%60,label=min===0?new Intl.DateTimeFormat("en-US",{hour:"numeric"}).format(new Date(2000,0,1,hour,min)):"";html+=`<div class="calendar-time-label ${min===0?"hour-mark":""}">${label}</div>`}
 target.innerHTML=html;
}
function renderBarberCalendar(){
 const barber=activeBarber(),dateValue=$("#calendarDate").value||today(),items=individualAppointments().filter(a=>a.startAt.startsWith(dateValue)).sort((a,b)=>new Date(a.startAt)-new Date(b.startAt));
 $("#calendarDate").value=dateValue;$("#barberCalendarTitle").textContent=`${barber}'s Calendar`;$("#calendarDateHeading").textContent=new Intl.DateTimeFormat("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"}).format(new Date(`${dateValue}T12:00:00`));$("#calendarAppointmentCount").textContent=`${items.length} appointment${items.length===1?"":"s"}`;renderCalendarTimes();
 const lane=$("#calendarLane");lane.innerHTML='<div class="calendar-grid-lines"></div><div class="after-hours-zone"><span>After-hours period begins at 7:00 PM</span></div>';
 items.forEach(a=>{const start=new Date(a.startAt),end=new Date(a.endAt),startMinute=start.getHours()*60+start.getMinutes(),endMinute=end.getHours()*60+end.getMinutes(),row=Math.floor((Math.max(540,startMinute)-540)/15)+1,span=Math.max(1,Math.ceil((Math.min(1380,endMinute)-Math.max(540,startMinute))/15));const block=document.createElement("article");block.className=`calendar-appointment ${calendarStatusClass(a.status)}`;block.style.gridRow=`${row} / span ${span}`;block.innerHTML=`<div class="calendar-appointment-top"><strong>${esc(formatTime(a.startAt))}–${esc(formatTime(a.endAt))}</strong><span>${esc(a.status)}</span></div><h3>${esc(a.firstName+" "+a.lastName)}</h3><p>${esc(serviceNames(a.serviceIds))}</p><small>${esc(a.phone||a.email)}</small>`;lane.appendChild(block)});
 $("#calendarEmpty").classList.toggle("hidden",items.length!==0);
}
function shiftCalendar(days){const date=new Date(`${$("#calendarDate").value}T12:00:00`);date.setDate(date.getDate()+days);$("#calendarDate").value=localDate(date);renderBarberCalendar()}

function exportCsv(){
 const rows=[["ID","Start","End","Status","Customer","Email","Phone","Barber","Services","Customer Total","After Hours","Barber Shop Charge"]];
 loadAppointments().forEach(a=>rows.push([a.id,a.startAt,a.endAt,a.status,`${a.firstName} ${a.lastName}`,a.email,a.phone,a.barber,serviceNames(a.serviceIds),(customerTotalForAppointment(a)/100).toFixed(2),a.afterHours?"Yes":"No",((a.afterHours?AFTER_HOURS_BARBER_FEE:0)/100).toFixed(2)]));
 const csv=rows.map(row=>row.map(value=>`"${String(value??"").replaceAll('"','""')}"`).join(",")).join("\n"),url=URL.createObjectURL(new Blob([csv],{type:"text/csv"})),link=document.createElement("a");link.href=url;link.download="ICU_Lookin_Appointments.csv";link.click();URL.revokeObjectURL(url);
}


const INVENTORY_KEY="icuLookinInventoryV1";
const EXPENSE_KEY="icuLookinExpensesV1";
const LOCATION_KEY="icuLookinLocationsV1";
function defaultInventory(){return[
 {id:"neck-strips",name:"Neck Strips",category:"Supplies",quantity:42,minimum:50,cost:12.99},
 {id:"barbicide",name:"Barbicide",category:"Supplies",quantity:3,minimum:2,cost:18.50},
 {id:"gloves",name:"Nitrile Gloves",category:"Supplies",quantity:85,minimum:100,cost:14.25},
 {id:"razor-blades",name:"Razor Blades",category:"Supplies",quantity:120,minimum:75,cost:21.00},
 {id:"clipper-oil",name:"Clipper Oil",category:"Supplies",quantity:4,minimum:3,cost:6.50},
 {id:"towels",name:"Shop Towels",category:"Supplies",quantity:64,minimum:40,cost:2.25},
 {id:"clippers",name:"Professional Clippers",category:"Equipment",quantity:9,minimum:7,cost:149.00},
 {id:"trimmers",name:"Detail Trimmers",category:"Equipment",quantity:7,minimum:7,cost:119.00},
 {id:"capes",name:"Barber Capes",category:"Equipment",quantity:10,minimum:8,cost:24.00}
]}
function loadInventory(){return loadKey(INVENTORY_KEY,defaultInventory())}
function saveInventory(items){saveKey(INVENTORY_KEY,items)}
function defaultExpenses(){return[
 {id:"rent",name:"Shop Rent",amount:3500},
 {id:"electric",name:"Electricity",amount:620},
 {id:"water",name:"Water",amount:180},
 {id:"internet",name:"Internet / Phone",amount:160},
 {id:"supplies",name:"Supplies",amount:750},
 {id:"insurance",name:"Insurance",amount:275}
]}
function loadExpenses(){return loadKey(EXPENSE_KEY,defaultExpenses())}
function saveExpenses(items){saveKey(EXPENSE_KEY,items)}
function defaultLocations(){return[
 {id:"houston-main",name:"Houston Main Studio",status:"Active",revenue:0,customers:0,barbers:BARBERS.length},
 {id:"houston-west",name:"Houston West",status:"Future",revenue:0,customers:0,barbers:0},
 {id:"katy",name:"Katy",status:"Future",revenue:0,customers:0,barbers:0}
]}
function loadLocations(){return loadKey(LOCATION_KEY,defaultLocations())}
function saveLocations(items){saveKey(LOCATION_KEY,items)}
function appointmentsForDate(dateValue){return loadAppointments().filter(a=>a.startAt.startsWith(dateValue)&&!["Cancelled","Last Second Cancellation"].includes(a.status))}
function completedInBounds(start,end,barber=""){return loadAppointments().filter(a=>a.status==="Completed"&&(!barber||a.barber===barber)&&new Date(a.startAt)>=start&&new Date(a.startAt)<=end)}
function renderMiniSchedule(items,target){
 target.innerHTML=items.length?items.sort((a,b)=>new Date(a.startAt)-new Date(b.startAt)).map(a=>`<div class="mini-appointment"><span class="time">${esc(formatTime(a.startAt))}</span><div class="meta"><strong>${esc(a.firstName+" "+a.lastName)}</strong><small>${esc(a.barber+" • "+serviceNames(a.serviceIds))}</small><span class="status status-${String(a.status||"").toLowerCase().replaceAll(" ","-")}">${esc(a.status||"Scheduled")}</span></div><strong>${money(customerTotalForAppointment(a))}</strong></div>`).join(""):'<p class="help">No appointments scheduled.</p>'
}
function renderOwnerDashboard(){
 const dateValue=today(),items=appointmentsForDate(dateValue),completed=items.filter(a=>a.status==="Completed"),remaining=items.filter(a=>new Date(a.startAt)>=new Date()&&a.status!=="Completed"),after=items.filter(a=>a.afterHours),cancelled=loadAppointments().filter(a=>a.startAt.startsWith(dateValue)&&a.status==="Cancelled"),lastSecond=loadAppointments().filter(a=>a.startAt.startsWith(dateValue)&&a.status==="Last Second Cancellation"),revenue=completed.reduce((sum,a)=>sum+customerTotalForAppointment(a),0);
 $("#dashboardDateLabel").textContent=new Intl.DateTimeFormat("en-US",{weekday:"long",month:"long",day:"numeric"}).format(new Date(`${dateValue}T12:00:00`));
 $("#ownerDashboardCards").innerHTML=[["Today's revenue",money(revenue)],["Today's customers",items.length],["Appointments remaining",remaining.length],["After-hours today",after.length],["Completed",completed.length],["Cancelled",cancelled.length],["Last Second Cancels",lastSecond.length],["Active barbers",new Set(items.map(a=>a.barber)).size],["Shop charges",money(uniqueAfterHoursCharges(after.filter(a=>a.status==="Completed")))]].map(([l,v])=>`<div class="stat"><span>${l}</span><strong>${v}</strong></div>`).join("");
 renderMiniSchedule(items,$("#ownerDashboardSchedule"));
 const alerts=[];if(after.length)alerts.push({type:"warning",title:`${after.length} after-hours appointment${after.length===1?"":"s"}`,detail:"Review the $25 barber facility charges."});if(cancelled.length||lastSecond.length)alerts.push({type:"danger",title:`${cancelled.length+lastSecond.length} cancellation${cancelled.length+lastSecond.length===1?"":"s"} today`,detail:lastSecond.length?`${lastSecond.length} marked Last Second Cancellation. Consider filling the open times.`:"Consider filling the open times."});const low=loadInventory().filter(i=>i.quantity<i.minimum);if(low.length)alerts.push({type:"warning",title:`${low.length} low-stock item${low.length===1?"":"s"}`,detail:"Inventory reorder is recommended."});if(!alerts.length)alerts.push({type:"success",title:"No urgent issues",detail:"The shop is operating normally."});
 $("#ownerAlerts").innerHTML=alerts.map(a=>`<div class="alert-item ${a.type}"><div><strong>${esc(a.title)}</strong><p>${esc(a.detail)}</p></div></div>`).join("");
 $("#ownerBarberSnapshot").innerHTML=BARBERS.map(b=>{const bItems=items.filter(a=>a.barber===b),bCompleted=bItems.filter(a=>a.status==="Completed"),bRevenue=bCompleted.reduce((s,a)=>s+customerTotalForAppointment(a),0);return`<div class="snapshot-item"><div><strong>${b}</strong><span class="help">${bItems.length} appointments • ${bCompleted.length} completed</span></div><strong>${money(bRevenue)}</strong></div>`}).join("");
}
function renderBarberDashboard(){
 const barber=activeBarber(),dateValue=today(),items=individualAppointments().filter(a=>a.startAt.startsWith(dateValue)&&!["Cancelled","Last Second Cancellation"].includes(a.status)).sort((a,b)=>new Date(a.startAt)-new Date(b.startAt)),completed=items.filter(a=>a.status==="Completed"),upcoming=items.filter(a=>new Date(a.startAt)>=new Date()&&a.status!=="Completed"),revenue=completed.reduce((s,a)=>s+netBarberRevenue(a),0),next=upcoming[0];
 $("#barberDashboardTitle").textContent=`${barber}'s Dashboard`;
 $("#barberDashboardCards").innerHTML=[["Today's revenue",money(revenue)],["Appointments today",items.length],["Completed",completed.length],["Remaining",upcoming.length]].map(([l,v])=>`<div class="stat"><span>${l}</span><strong>${v}</strong></div>`).join("");
 $("#barberNextAppointment").innerHTML=next?`<div class="appointment-main"><span class="status">${esc(next.status)}</span><h2>${esc(formatTime(next.startAt))}</h2><p>${esc(next.firstName+" "+next.lastName)}</p><p class="help">${esc(serviceNames(next.serviceIds))}</p><p class="help">${esc(next.phone||next.email)}</p></div>`:'<p class="help">No upcoming appointments today.</p>';
 const pct=items.length?Math.round(completed.length/items.length*100):0;$("#barberDayProgress").innerHTML=`<p><strong>${completed.length} of ${items.length}</strong> appointments completed</p><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div><p class="help">${pct}% complete</p>`;
 renderMiniSchedule(items,$("#barberDashboardSchedule"));
}
function performanceMetrics(barber,range,dateValue){
 const bounds=periodBounds(range,dateValue),all=loadAppointments().filter(a=>a.barber===barber&&new Date(a.startAt)>=bounds.start&&new Date(a.startAt)<=bounds.end),completed=all.filter(a=>a.status==="Completed"),cancelled=all.filter(a=>a.status==="Cancelled"),lastSecond=all.filter(a=>a.status==="Last Second Cancellation"),noShow=all.filter(a=>a.status==="No Show"),revenue=completed.reduce((s,a)=>s+customerTotalForAppointment(a),0),clients=new Set(completed.map(a=>a.email||`${a.firstName}|${a.lastName}`)),repeatClients=[...clients].filter(key=>loadAppointments().filter(a=>(a.email||`${a.firstName}|${a.lastName}`)===key&&a.barber===barber&&a.status==="Completed").length>1);
 return{appointments:all.length,completed:completed.length,revenue,avg:completed.length?revenue/completed.length:0,customers:clients.size,repeatRate:clients.size?repeatClients.length/clients.size*100:0,cancelRate:all.length?(cancelled.length+lastSecond.length)/all.length*100:0,noShowRate:all.length?noShow.length/all.length*100:0}
}
function renderPerformance(){
 const range=$("#performanceRange").value,date=$("#performanceDate").value;$("#performanceCards").innerHTML=BARBERS.map(b=>{const m=performanceMetrics(b,range,date);return`<article class="performance-card"><div class="performance-head"><div><p class="eyebrow">Barber</p><h2>${b}</h2></div><strong>${money(m.revenue)}</strong></div><div class="metric-grid"><div class="metric"><span>Customers</span><strong>${m.customers}</strong></div><div class="metric"><span>Completed</span><strong>${m.completed}</strong></div><div class="metric"><span>Average ticket</span><strong>${money(m.avg)}</strong></div><div class="metric"><span>Repeat rate</span><strong>${m.repeatRate.toFixed(0)}%</strong></div><div class="metric"><span>Cancellation</span><strong>${m.cancelRate.toFixed(0)}%</strong></div><div class="metric"><span>No-show</span><strong>${m.noShowRate.toFixed(0)}%</strong></div></div></article>`}).join("");
}
function renderInventory(){
 const query=$("#inventorySearch").value.trim().toLowerCase(),filter=$("#inventoryFilter").value,all=loadInventory(),low=all.filter(i=>i.quantity<i.minimum),value=all.reduce((s,i)=>s+i.quantity*i.cost,0);
 $("#inventorySummary").innerHTML=[["Inventory items",all.length],["Low stock",low.length],["Equipment",all.filter(i=>i.category==="Equipment").length],["Estimated value",money(value*100)]].map(([l,v])=>`<div class="stat"><span>${l}</span><strong>${v}</strong></div>`).join("");
 let items=all;if(query)items=items.filter(i=>`${i.name} ${i.category}`.toLowerCase().includes(query));if(filter==="low")items=items.filter(i=>i.quantity<i.minimum);if(filter==="equipment")items=items.filter(i=>i.category==="Equipment");if(filter==="supplies")items=items.filter(i=>i.category==="Supplies");
 $("#inventoryList").innerHTML=items.map(i=>`<article class="inventory-card" data-item-id="${i.id}"><div class="inventory-head"><div><p class="eyebrow">${esc(i.category)}</p><h2>${esc(i.name)}</h2></div><span class="${i.quantity<i.minimum?"stock-low":"stock-ok"}">${i.quantity<i.minimum?"Reorder":"In stock"}</span></div><p>Quantity: <strong>${i.quantity}</strong> • Minimum: ${i.minimum}</p><p class="help">Unit cost: ${money(i.cost*100)}</p><div class="inventory-actions"><button class="button secondary" data-inventory-adjust="-1" type="button">−1</button><button class="button secondary" data-inventory-adjust="1" type="button">+1</button></div></article>`).join("");
}
function marketingCustomers(audience,barber){
 const completed=loadAppointments().filter(a=>a.status==="Completed"&&(!barber||a.barber===barber)),map=new Map(),now=new Date();
 completed.forEach(a=>{const key=a.email||`${a.firstName}|${a.lastName}|${a.phone}`,c=map.get(key)||{name:`${a.firstName} ${a.lastName}`,email:a.email,phone:a.phone,barbers:new Set(),dates:[],services:[],bookings:0};c.barbers.add(a.barber);c.dates.push(new Date(a.startAt));c.services.push(...a.serviceIds);c.bookings++;map.set(key,c)});
 let clients=[...map.values()].map(c=>({...c,lastVisit:new Date(Math.max(...c.dates.map(d=>d.getTime()))),daysSince:(now-new Date(Math.max(...c.dates.map(d=>d.getTime()))))/86400000}));
 if(audience==="inactive30")clients=clients.filter(c=>c.daysSince>=30);if(audience==="inactive60")clients=clients.filter(c=>c.daysSince>=60);if(audience==="loyal")clients=clients.filter(c=>c.bookings>=5);if(audience==="beard")clients=clients.filter(c=>c.services.includes("beard"));if(audience==="overdue")clients=clients.filter(c=>{if(c.dates.length<3)return false;c.dates.sort((a,b)=>a-b);const gaps=[];for(let i=1;i<c.dates.length;i++)gaps.push((c.dates[i]-c.dates[i-1])/86400000);const avg=gaps.reduce((a,b)=>a+b,0)/gaps.length;return c.daysSince>avg*1.25});
 return clients.sort((a,b)=>b.daysSince-a.daysSince)
}
function renderMarketing(){
 const audience=$("#marketingAudience").value,barber=$("#marketingBarber").value,clients=marketingCustomers(audience,barber);$("#marketingSummary").innerHTML=[["Audience size",clients.length],["With email",clients.filter(c=>c.email).length],["With phone",clients.filter(c=>c.phone).length],["Average inactivity",clients.length?`${Math.round(clients.reduce((s,c)=>s+c.daysSince,0)/clients.length)} days`:"0 days"]].map(([l,v])=>`<div class="stat"><span>${l}</span><strong>${v}</strong></div>`).join("");$("#marketingAudienceList").innerHTML=clients.length?clients.map(c=>`<article class="appointment-card"><div class="date-badge"><small>Client</small><strong>${esc(c.name.split(" ").map(x=>x[0]).join("").slice(0,2))}</strong></div><div class="appointment-main"><h3>${esc(c.name)}</h3><p>${esc(c.email||"No email")} • ${esc(c.phone||"No phone")}</p><p class="help">${c.bookings} completed visits • Last visit ${Math.round(c.daysSince)} days ago</p></div><div class="appointment-side"><span>${[...c.barbers].join(", ")}</span></div></article>`).join(""):'<section class="panel"><h2>No customers match this audience</h2></section>'
}
function renderFinancials(){
 const range=$("#financialRange").value,date=$("#financialDate").value,bounds=periodBounds(range,date),completed=completedInBounds(bounds.start,bounds.end),revenue=completed.reduce((s,a)=>s+customerTotalForAppointment(a),0),shopCharges=uniqueAfterHoursCharges(completed),expenses=loadExpenses(),multiplier=range==="year"?12:1,expenseTotal=expenses.reduce((s,e)=>s+e.amount*multiplier,0)*100,profit=revenue+shopCharges-expenseTotal;
 $("#financialCards").innerHTML=[["Customer revenue",money(revenue)],["After-hours shop charges",money(shopCharges)],["Expenses",money(expenseTotal)],["Estimated net profit",money(profit)]].map(([l,v])=>`<div class="stat"><span>${l}</span><strong>${v}</strong></div>`).join("");
 $("#expenseList").innerHTML=expenses.map(e=>`<div class="expense-row" data-expense-id="${e.id}"><span>${esc(e.name)}</span><label class="price-input-wrap"><span>$</span><input class="expense-input" type="number" min="0" step="0.01" value="${e.amount.toFixed(2)}"></label></div>`).join("")+'<button id="saveExpensesButton" class="button primary" type="button">Save expenses</button>';
 const serviceRevenue=completed.reduce((s,a)=>s+grossServiceRevenue(a),0),customerFees=completed.filter(a=>a.afterHours).length*AFTER_HOURS_CUSTOMER_FEE;$("#financialBreakdown").innerHTML=[["Service revenue",serviceRevenue],["Customer after-hours fees",customerFees],["Barber shop charges",shopCharges],["Total revenue streams",serviceRevenue+customerFees+shopCharges]].map(([l,v])=>`<div class="breakdown-row"><span>${l}</span><strong>${money(v)}</strong></div>`).join("");
 $("#saveExpensesButton").addEventListener("click",saveExpenseInputs)
}
function saveExpenseInputs(){const items=loadExpenses();$$("[data-expense-id]").forEach(row=>{const e=items.find(x=>x.id===row.dataset.expenseId);if(e)e.amount=Math.max(0,Number(row.querySelector(".expense-input").value||0))});saveExpenses(items);renderFinancials();toast("Expenses saved.")}
function renderLocations(){
 const locations=loadLocations(),main=locations.find(l=>l.id==="houston-main"),month=periodBounds("month",today()),completed=completedInBounds(month.start,month.end);main.revenue=completed.reduce((s,a)=>s+customerTotalForAppointment(a),0);main.customers=new Set(completed.map(a=>a.email||`${a.firstName}|${a.lastName}`)).size;
 $("#locationCards").innerHTML=locations.map(l=>`<article class="location-card ${l.status==="Future"?"future":""}"><p class="eyebrow">${esc(l.status)}</p><h2>${esc(l.name)}</h2><div class="breakdown-row"><span>Monthly revenue</span><strong>${money(l.revenue)}</strong></div><div class="breakdown-row"><span>Customers</span><strong>${l.customers}</strong></div><div class="breakdown-row"><span>Barbers</span><strong>${l.barbers}</strong></div></article>`).join("")
}
function answerAssistant(question){
 const raw=String(question||"").trim(),q=raw.toLowerCase();if(!q)return"Ask me a question about data saved in the BSMS.";
 const appts=loadAppointments(),completed=appts.filter(a=>a.status==="Completed"),clients=customerRecords(),walkins=loadQueue(WALKIN_KEY),roster=loadBarberRoster(),issues=loadKey(INSPECTION_ISSUES_KEY,[]),incidents=loadKey(INCIDENTS_KEY,[]),pos=loadKey(POS_TRANSACTIONS_KEY,[]),rent=loadKey(BOOTH_RENT_PAYMENTS_KEY,[]),reviews=loadReviews(),deposits=loadKey(DEPOSIT_PAYMENTS_KEY,[]),campaigns=loadKey(GROWTH_CAMPAIGNS_KEY,[]),attrs=loadKey(ATTRIBUTION_KEY,[]),diary=loadKey(OWNER_DIARY_KEY,[]),audits=loadKey(AUDIT_KEY,[]);
 const barberNames=roster.map(r=>r.name),namedBarber=barberNames.find(b=>q.includes(b.toLowerCase()));
 let bounds=null,timeLabel="all saved data";if(q.includes("today")){bounds=periodBounds("day",today());timeLabel="today"}else if(q.includes("this week")){bounds=periodBounds("week",today());timeLabel="this week"}else if(q.includes("this month")||q.includes("month")){bounds=periodBounds("month",today());timeLabel="this month"}else if(q.includes("this year")||q.includes("year")){bounds=periodBounds("year",today());timeLabel="this year"}
 const inBounds=a=>!bounds||(new Date(a.startAt)>=bounds.start&&new Date(a.startAt)<=bounds.end),barberAppts=namedBarber?appts.filter(a=>a.barber===namedBarber&&inBounds(a)):appts.filter(inBounds);
 if(q.includes("attention")||q.includes("need my attention")||q.includes("requires my attention")){const alerts=ownerDashboardAlerts();return alerts.length?alerts.map(a=>a.text).join(" • "):"There are no critical Owner alerts recorded right now."}
 if(q.includes("booth rent")&&(q.includes("owe")||q.includes("outstanding")||q.includes("due"))){const due=barberNames.filter(b=>b!=="Tony").map(b=>boothRentSummary(b)).filter(s=>s.balance>0);return due.length?due.map(s=>`${s.barber}: ${money(s.balance)} (${s.status})`).join(" • "):"No outstanding booth rent is recorded for the current week."}
 if(q.includes("inspection")&&(q.includes("open")||q.includes("unresolved")||q.includes("issue"))){const open=issues.filter(i=>i.status!=="Resolved");return open.length?open.map(i=>`${i.title}${i.responsible?` — ${i.responsible}`:""}`).join(" • "):"There are no unresolved inspection issues recorded."}
 if(q.includes("license")&&(q.includes("expire")||q.includes("expiration")||q.includes("soon"))){const rows=roster.filter(r=>r.active&&r.licenseExpiration).map(r=>({r,w:licenseWarningLevel(r.licenseExpiration)})).filter(x=>x.w).sort((a,b)=>a.w.days-b.w.days);return rows.length?rows.map(x=>`${x.r.name}: ${x.r.licenseExpiration} (${x.w.label})`).join(" • "):"No active barber license expiration warnings are recorded within 60 days."}
 if(namedBarber&&q.includes("license")){const r=roster.find(x=>x.name===namedBarber);return r?.licenseNumber?`${r.name}'s recorded license number is ${r.licenseNumber}${r.licenseExpiration?`, expiring ${r.licenseExpiration}`:""}.`:`No license number is recorded for ${namedBarber}.`}
 if(namedBarber&&(q.includes("start date")||q.includes("started"))){const r=roster.find(x=>x.name===namedBarber);return r?.startDate?`${r.name}'s recorded start date is ${r.startDate}.`:`No start date is recorded for ${namedBarber}.`}
 if(q.includes("client")||q.includes("customer")){
   const rows=namedBarber?clientsForBarber(namedBarber).filter(c=>c.appointments.some(a=>a.barber===namedBarber&&inBounds(a))):clients.filter(c=>c.appointments.some(inBounds));
   const sorted=rows.slice().sort((a,b)=>`${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)),names=sorted.map(c=>`${c.firstName} ${c.lastName}`).filter(Boolean);
   if(namedBarber)return`${namedBarber} has ${sorted.length} client(s) in ${timeLabel}${names.length?`: ${names.slice(0,20).join(", ")}${names.length>20?` … and ${names.length-20} more`:""}`:"."}`;
   return`${sorted.length} unique client profile(s) match ${timeLabel}${names.length&&q.includes("list")?`: ${names.slice(0,20).join(", ")}`:"."}`
 }
 if(q.includes("last second")){const list=barberAppts.filter(a=>a.status==="Last Second Cancellation");return`${namedBarber?namedBarber+" has":"There are"} ${list.length} Last Second Cancellation appointment(s) in ${timeLabel}.`}
 if(q.includes("no-show")||q.includes("no show")){const list=barberAppts.filter(a=>a.status==="No Show");return`${namedBarber?namedBarber+" has":"There are"} ${list.length} no-show appointment(s) in ${timeLabel}.`}
 if(q.includes("cancel")){const regular=barberAppts.filter(a=>a.status==="Cancelled").length,last=barberAppts.filter(a=>a.status==="Last Second Cancellation").length;return`${namedBarber?namedBarber+" has":"There are"} ${regular} regular cancellation(s) and ${last} Last Second Cancellation(s) in ${timeLabel}.`}
 if(namedBarber&&q.includes("revenue")){const total=barberAppts.filter(a=>a.status==="Completed").reduce((s,a)=>s+customerTotalForAppointment(a),0);return`${namedBarber} has ${money(total)} in recorded completed appointment value for ${timeLabel}.`}
 if(q.includes("most revenue")||q.includes("highest revenue")){const data=barberNames.map(b=>({b,total:appts.filter(a=>a.barber===b&&a.status==="Completed"&&inBounds(a)).reduce((s,a)=>s+customerTotalForAppointment(a),0)})).sort((a,b)=>b.total-a.total)[0];return data?`${data.b} has the highest completed appointment value for ${timeLabel} at ${money(data.total)}.`:"There is no completed appointment revenue recorded."}
 if(q.includes("review")){const list=namedBarber?reviews.filter(r=>r.barber===namedBarber):reviews;return`${namedBarber?namedBarber+" has":"There are"} ${list.length} verified review record(s) saved.`}
 if(q.includes("service")&&namedBarber){const list=servicesForBarber(namedBarber);return`${namedBarber} currently offers ${list.length} service(s): ${list.map(s=>s.name).join(", ")||"none"}.`}
 if(q.includes("appointment")){const list=barberAppts;const summary=`${list.filter(a=>a.status==="Completed").length} completed, ${list.filter(a=>a.status==="Scheduled").length} scheduled, ${list.filter(a=>a.status==="Cancelled").length} cancelled, ${list.filter(a=>a.status==="Last Second Cancellation").length} last-second cancellations, ${list.filter(a=>a.status==="No Show").length} no-show`;return`${namedBarber?namedBarber+" has":"There are"} ${list.length} saved appointment(s) for ${timeLabel}: ${summary}.`}
 if(q.includes("popular service")||q.includes("most service")){const counts={};completed.filter(inBounds).forEach(a=>(a.serviceIds||[]).forEach(id=>counts[id]=(counts[id]||0)+1));const top=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];return top?`${serviceById(top[0])?.name||top[0]} is the most frequently recorded completed service for ${timeLabel} with ${top[1]} occurrence(s).`:"No completed service data is recorded."}
 if(q.includes("walk-in")||q.includes("walk in"))return`${walkins.length} walk-in record(s) are currently saved. ${walkins.filter(w=>w.status==="Completed").length} are marked Completed.`;
 if(q.includes("deposit"))return`${deposits.length} deposit payment record(s) are saved, totaling ${money(deposits.reduce((s,d)=>s+Number(d.amount||0),0))}.`;
 if(q.includes("incident"))return`${incidents.length} incident report(s) are saved; ${incidents.filter(i=>i.status!=="Closed").length} are not closed.`;
 if(q.includes("campaign")||q.includes("marketing"))return`${campaigns.length} growth campaign(s) are saved and ${attrs.length} booking attribution record(s) are saved.`;
 if(q.includes("diary")||q.includes("notes about")){if(namedBarber){const n=diary.filter(d=>d.person===namedBarber).length;return`${n} Owner Diary record(s) are saved for ${namedBarber}.`}return`${diary.length} Owner Diary record(s) are saved.`}
 if(q.includes("audit"))return`${audits.length} audit-history record(s) are saved.`;
 if(q.includes("pos")||q.includes("sales")||q.includes("transactions")){const list=namedBarber?pos.filter(t=>t.barber===namedBarber):pos;return`${namedBarber?namedBarber+" has":"There are"} ${list.length} POS transaction(s) saved, with ${money(list.reduce((s,t)=>s+Number(t.amountCollected||0),0))} recorded as amount collected.`}
 if(q.includes("what data")||q.includes("what can you answer")||q.includes("help"))return"I can query saved Owner-authorized data about appointments, clients, barbers and licenses, active services, availability, walk-ins, deposits, POS/sales, booth rent, reviews, Owner Diary records, incidents, inspections, checklists, audit history, campaigns, referrals, attribution, and shop status. I do not expose private Barber ↔ Barber messages.";
 return`I could not map that question confidently to a saved BSMS dataset. The system currently has ${appts.length} appointments, ${clients.length} derived clients, ${walkins.length} walk-ins, ${pos.length} POS transactions, ${issues.filter(i=>i.status!=="Resolved").length} open inspection issues, and ${roster.filter(r=>r.active).length} active roster records. Try naming the data you want, the barber, and the timeframe.`
}
function askAssistant(question){
 if(!question.trim())return;const messages=$("#assistantMessages");messages.insertAdjacentHTML("beforeend",`<div class="assistant-message user">${esc(question)}</div>`);messages.insertAdjacentHTML("beforeend",`<div class="assistant-message system">${esc(answerAssistant(question))}</div>`);messages.scrollTop=messages.scrollHeight;$("#assistantQuestion").value=""
}


const WALKIN_KEY="icuWalkinsV1",WAITLIST_KEY="icuWaitlistV1",MAINTENANCE_KEY="icuMaintenanceV1",ANNOUNCEMENT_KEY="icuAnnouncementV1",WORKFORCE_KEY="icuWorkforceV1",PAYMENTS_KEY="icuPaymentsV1",CLIENT_NOTES_KEY="icuClientNotesV1",AVAILABILITY_KEY="icuAvailabilityV1",TIMEOFF_KEY="icuTimeOffV1",GIFTCARD_KEY="icuGiftCardsV1",FAMILY_KEY="icuFamilyV1",PREFERENCES_KEY="icuPreferencesV1";
const DEPOSIT_SETTINGS_KEY="icuDepositSettingsV1",DEPOSIT_PAYMENTS_KEY="icuDepositPaymentsV1",BOOTH_RENT_PAYMENTS_KEY="icuBoothRentPaymentsV1",POS_TRANSACTIONS_KEY="icuPosTransactionsV1",REVIEWS_KEY="icuReviewsV1",APPT_MESSAGES_KEY="icuAppointmentMessagesV1";
const SHOP={name:"ICU Barber Studio",address:"8308 Broadway St, Houston, TX 77061"};
function loadKey(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function saveKey(key,value){localStorage.setItem(key,JSON.stringify(value));window.ICUCloud?.saveLegacyKey(key,value)}

function loadDepositSettings(){const saved=loadKey(DEPOSIT_SETTINGS_KEY,{}),result={};BARBERS.forEach(b=>result[b]={required:Boolean(saved[b]?.required),amount:Number(saved[b]?.amount||2000)});return result}
function saveDepositSettingsData(settings){saveKey(DEPOSIT_SETTINGS_KEY,settings)}
function depositRequirement(barber,phone,email){
 const settings=loadDepositSettings()[barber]||{required:false,amount:0};
 const prior=latestPriorAppointmentForCustomer(phone,email);
 let amount=settings.required?Math.max(0,Number(settings.amount||0)):0,reason=settings.required?"Barber Requirement":"";
 if(prior&&["Cancelled","No Show","Last Second Cancellation"].includes(prior.status)){
   if(amount<1000)amount=1000;
   reason=reason?`${reason}; Prior ${prior.status}`:`Prior ${prior.status}`
 }
 return{required:amount>0,amount,reason,prior}
}
function updateBookingDepositNotice(){
 const barber=$("#barber").value,box=$("#bookingDepositNotice");if(!barber){box.classList.add("hidden");return}
 const req=depositRequirement(barber,$("#phone").value,$("#email").value);
 if(!req.required){box.classList.add("hidden");box.innerHTML="";return}
 box.classList.remove("hidden");
 let why="";
 if(req.prior?.status==="Last Second Cancellation")why=" A $10 minimum deposit is required because the previous appointment was cancelled too close to the scheduled service time to give the barber a reasonable opportunity to fill the vacated time with another client.";
 else if(req.reason.includes("Prior"))why=` A deposit is required because the customer's most recent booking was ${req.prior.status.toLowerCase()}.`;
 box.innerHTML=`<strong>Non-Refundable Deposit Required: ${money(req.amount)}</strong><p>This deposit is required to secure the appointment and will be applied toward the appointment balance.${esc(why)}</p>`
}
function renderDepositSettings(){
 const barber=activeBarber(),settings=loadDepositSettings()[barber];
 $("#depositSettingsTitle").textContent=`${barber}'s Deposit Settings`;$("#requireDeposit").checked=settings.required;$("#depositAmount").value=(settings.amount/100).toFixed(2);$("#depositAmount").disabled=!settings.required
}
function saveCurrentDepositSettings(){
 const barber=activeBarber(),all=loadDepositSettings(),required=$("#requireDeposit").checked,amount=Math.max(0,Math.round(Number($("#depositAmount").value||0)*100));
 all[barber]={required,amount};saveDepositSettingsData(all);renderDepositSettings();toast("Deposit settings saved.")
}


function loadReviews(){return loadKey(REVIEWS_KEY,[])}
function saveReviews(x){saveKey(REVIEWS_KEY,x)}
function reviewsForBarber(b){return loadReviews().filter(r=>r.barber===b)}
function reviewerDisplayName(review){
 const a=loadAppointments().find(x=>x.id===review?.appointmentId);
 const first=String(review?.reviewerFirstName||a?.firstName||"").trim(),last=String(review?.reviewerLastName||a?.lastName||"").trim();
 if(first)return `${first}${last?` ${last.charAt(0).toUpperCase()}.`:""}`;
 return "Verified Client";
}
function ratingsUnlocked(){const cohort=originalRatingCohort();return cohort.length>0&&cohort.every(b=>verifiedReviewsFor(b).length>=10)}
function barberDisplayName(b){const r=reviewsForBarber(b);return ratingsUnlocked()?`${b} — ★ ${(r.reduce((s,x)=>s+Number(x.stars),0)/r.length).toFixed(1)} (${r.length} reviews)`:b}
function appointmentMessages(id){return loadKey(APPT_MESSAGES_KEY,[]).filter(m=>m.appointmentId===id).sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt))}
async function sendAppointmentMessage(id,sender,text){
 text=String(text||"").trim();if(!text)return null;
 const item={id:`am-${Date.now()}`,appointmentId:id,sender,text,createdAt:new Date().toISOString()};
 if(appMode()==="customer"&&window.ICUCloud){
   const phone=customerSessionPhone()||normalizePhone($("#customerProfileEmail")?.value||"");
   if(!phone)throw new Error("Customer session phone is required.");
   await ICUCloud.sendCustomerAppointmentMessage(phone,item);
 }
 const a=loadKey(APPT_MESSAGES_KEY,[]);a.push(item);
 if(appMode()==="customer")localStorage.setItem(APPT_MESSAGES_KEY,JSON.stringify(a));else saveKey(APPT_MESSAGES_KEY,a);
 return item
}
function shopLocationCard(){return`<div class="shop-location-card"><strong>Shop Location</strong><span>${esc(SHOP.address)}</span><button class="button secondary" type="button" data-directions>Get Directions</button></div>`}
function completedUnreviewed(c){const r=loadReviews();return c.appointments.filter(a=>a.status==="Completed"&&!r.some(x=>x.appointmentId===a.id))}

function customerRecords(){
 const map=new Map();
 function ensure(raw={}){
   let first=String(raw.firstName||"").trim(),last=String(raw.lastName||"").trim();
   if((!first&&!last)&&raw.name){const parts=String(raw.name).trim().split(/\s+/);first=parts.shift()||"";last=parts.join(" ")}
   const phone=normalizePhone(raw.phone),email=String(raw.email||"").trim();
   const key=phone?`phone:${phone}`:email?`email:${email.toLowerCase()}`:`${first}|${last}`;
   let c=map.get(key)||{key,firstName:first,lastName:last,email,phone:formatPhone(raw.phone),appointments:[],barbers:new Set(),total:0,last:null};
   if(!c.firstName&&first)c.firstName=first;if(!c.lastName&&last)c.lastName=last;if(!c.email&&email)c.email=email;if(!c.phone&&raw.phone)c.phone=formatPhone(raw.phone);
   map.set(key,c);return c
 }
 loadAppointments().forEach(a=>{if(appMode()==="customer"&&!normalizePhone(a.phone)&&!a.email)return;const c=ensure(a);c.appointments.push(a);if(a.barber)c.barbers.add(a.barber);c.total+=customerTotalForAppointment(a);if(!c.last||new Date(a.startAt)>new Date(c.last))c.last=a.startAt});
 loadQueue(WALKIN_KEY).forEach(w=>{if(!normalizePhone(w.phone)&&!w.email)return;const c=ensure(w);if(w.barber)c.barbers.add(w.barber);const when=w.startAt||w.createdAt;if(when&&(!c.last||new Date(when)>new Date(c.last)))c.last=when});
 loadKey(POS_TRANSACTIONS_KEY,[]).forEach(t=>{if(!normalizePhone(t.phone))return;const c=ensure({name:t.customer,phone:t.phone});if(t.barber)c.barbers.add(t.barber);if(t.createdAt&&(!c.last||new Date(t.createdAt)>new Date(c.last)))c.last=t.createdAt});
 return[...map.values()]
}
function customerByEmail(email){return customerRecords().find(c=>c.email&&c.email.toLowerCase()===String(email).toLowerCase())}
function customerByLookup(value){const digits=normalizePhone(value);if(digits.length===10)return customerRecords().find(c=>normalizePhone(c.phone)===digits);return customerByEmail(String(value).trim())}
function customerStorageKey(c){return normalizePhone(c.phone)?`phone:${normalizePhone(c.phone)}`:`email:${String(c.email||"").toLowerCase()}`}
function customerSessionPhone(){return normalizePhone(sessionStorage.getItem(CUSTOMER_SESSION_PHONE_KEY)||"")}
function signedInCustomer(){const phone=customerSessionPhone();return phone?customerByLookup(phone):null}
function setCustomerSession(customerOrPhone){const phone=normalizePhone(typeof customerOrPhone==="string"?customerOrPhone:customerOrPhone?.phone);if(phone)sessionStorage.setItem(CUSTOMER_SESSION_PHONE_KEY,phone);updateCustomerSessionUi();return phone}
function clearCustomerSession(){sessionStorage.removeItem(CUSTOMER_SESSION_PHONE_KEY);localStorage.removeItem("icuLauncherPhone");localStorage.removeItem("icuNewClientPhone");updateCustomerSessionUi()}
function updateCustomerSessionUi(){const c=signedInCustomer(),status=$("#customerSessionStatus"),signOut=$("#customerSignOutButton");if(status)status.textContent=c?`Signed in: ${c.firstName} ${c.lastName}`:"";if(signOut)signOut.classList.toggle("hidden",!c)}
function prefillSignedInCustomerBooking(){const c=signedInCustomer();if(!c)return false;$("#firstName").value=c.firstName||"";$("#lastName").value=c.lastName||"";$("#phone").value=formatPhone(c.phone);$("#email").value=c.email||"";updateBookingDepositNotice();updateBookingSummary();return true}
function latestPriorAppointmentForCustomer(phone,email){
 const digits=normalizePhone(phone),mail=String(email||"").trim().toLowerCase();
 return loadAppointments().filter(a=>(digits&&normalizePhone(a.phone)===digits)||(!digits&&mail&&String(a.email||"").toLowerCase()===mail)).sort((a,b)=>new Date(b.startAt)-new Date(a.startAt))[0]||null
}
function renderCustomerProfile(){
 const lookupInput=$("#customerProfileEmail"),lookupPanel=$("#customerProfileLookup"),target=$("#customerProfileContent");
 let c=signedInCustomer();
 if(!c){const lookup=lookupInput.value.trim();if(!lookup){lookupPanel?.classList.remove("hidden");target.innerHTML='<section class="panel"><h2>Enter an email address or phone number</h2></section>';updateCustomerSessionUi();return}c=customerByLookup(lookup);if(!c){lookupPanel?.classList.remove("hidden");target.innerHTML='<section class="panel"><h2>No profile found</h2><p>Book an appointment first to create a profile.</p></section>';updateCustomerSessionUi();return}setCustomerSession(c)}
 if(lookupInput)lookupInput.value=formatPhone(c.phone)||c.email||"";
 lookupPanel?.classList.add("hidden");updateCustomerSessionUi();
 const storageKey=customerStorageKey(c),prefs=loadKey(PREFERENCES_KEY,{})[storageKey]||{},familyStore=loadKey(FAMILY_KEY,{}),family=familyStore[storageKey]||familyStore[c.email]||[],myReviews=loadReviews().filter(r=>c.appointments.some(a=>a.id===r.appointmentId));
 target.innerHTML=`<div class="profile-grid"><section class="profile-card"><p class="eyebrow">Customer</p><h2>${esc(c.firstName+" "+c.lastName)}</h2><p>${esc(formatPhone(c.phone)||"No phone")}${c.email?`<br>${esc(c.email)}`:""}</p><button class="button primary" id="bookPrimaryCustomer">Book Appointment</button>${shopLocationCard()}<div class="profile-row"><span>Total appointments</span><strong>${c.appointments.length}</strong></div></section><section class="profile-card"><h2>Saved preferences</h2><label>Preferred haircut / guard<textarea id="profileHairPreference">${esc(prefs.hair||"")}</textarea></label><label>Beard preference<textarea id="profileBeardPreference">${esc(prefs.beard||"")}</textarea></label><label>Sensitivities or notes<textarea id="profileSensitivity">${esc(prefs.sensitivity||"")}</textarea></label><button class="button primary" id="saveProfilePrefs">Save preferences</button></section><section class="profile-card full"><div class="section-heading-row"><h2>Family account</h2><button class="button secondary" id="addFamilyMember">Add member</button></div>${family.map((f,i)=>`<div class="family-book-row"><div><strong>${esc(f.name)}</strong><span class="help">${esc(f.relationship)}</span></div><button class="button secondary" data-family-book-index="${i}">Book an Appointment</button></div>`).join("")||'<p class="help">No family members added.</p>'}</section><section class="profile-card full"><h2>Reviews</h2>${completedUnreviewed(c).map(a=>`<div class="review-card"><strong>${esc(a.barber)} • ${esc(formatDateTime(a.startAt))}</strong><label>Rating<select data-review-stars="${a.id}"><option value="5">★★★★★ 5</option><option value="4">★★★★ 4</option><option value="3">★★★ 3</option><option value="2">★★ 2</option><option value="1">★ 1</option></select></label><label>Review<textarea data-review-text="${a.id}"></textarea></label><button class="button primary" data-submit-review="${a.id}">Submit Review</button></div>`).join("")||'<p class="help">Reviews can be left after a completed appointment.</p>'}${myReviews.map(r=>`<div class="review-card"><strong>★ ${r.stars} — ${esc(r.barber)}</strong><p class="reviewer-name">${esc(reviewerDisplayName(r))}</p><p>${esc(r.text)}</p>${r.response?`<div class="barber-response"><strong>${esc(r.barber)} — Barber Response</strong><p>${esc(r.response)}</p></div>`:""}</div>`).join("")}</section><section class="profile-card full"><h2>Appointment Messages</h2>${c.appointments.filter(a=>!["Cancelled","Last Second Cancellation"].includes(a.status)).map(a=>`<div class="appointment-message-card"><strong>${esc(a.barber)} • ${esc(formatDateTime(a.startAt))}</strong>${shopLocationCard()}<div class="appointment-thread">${appointmentMessages(a.id).map(m=>`<div class="message-bubble"><strong>${esc(m.sender)}</strong><p>${esc(m.text)}</p><small>${esc(formatDateTime(m.createdAt))}</small></div>`).join("")||'<p class="help">No messages yet.</p>'}</div><div class="lookup-row"><input data-client-message-input="${a.id}" placeholder="Message barber"><button class="button secondary" data-client-message-send="${a.id}">Send</button></div></div>`).join("")}</section><section class="profile-card full"><h2>Appointment history</h2>${c.appointments.slice().sort((a,b)=>new Date(b.startAt)-new Date(a.startAt)).map(a=>`<div class="profile-row"><span>${esc(formatDateTime(a.startAt))} — ${esc(a.barber)}</span><strong>${money(customerTotalForAppointment(a))}</strong></div>`).join("")}</section></div>`;
 $("#saveProfilePrefs").onclick=async()=>{const all=loadKey(PREFERENCES_KEY,{}),familyAll=loadKey(FAMILY_KEY,{}),next={hair:$("#profileHairPreference").value,beard:$("#profileBeardPreference").value,sensitivity:$("#profileSensitivity").value};try{await ICUCloud.saveCustomerProfile(c.phone,familyAll[storageKey]||family,next);all[storageKey]=next;localStorage.setItem(PREFERENCES_KEY,JSON.stringify(all));toast("Preferences saved.")}catch(error){toast(error?.message||"Preferences could not be saved.")}};
 $("#addFamilyMember").onclick=async()=>{const name=prompt("Family member name:");if(!name)return;const relationship=prompt("Relationship:","Child")||"Family",all=loadKey(FAMILY_KEY,{}),prefsAll=loadKey(PREFERENCES_KEY,{});const updated=[...(all[storageKey]||family),{name,relationship}];try{await ICUCloud.saveCustomerProfile(c.phone,updated,prefsAll[storageKey]||prefs);all[storageKey]=updated;localStorage.setItem(FAMILY_KEY,JSON.stringify(all));renderCustomerProfile();toast("Family member saved.")}catch(error){toast(error?.message||"Family member could not be saved.")}};
 $("#bookPrimaryCustomer").onclick=()=>{showView("book");$("#firstName").value=c.firstName;$("#lastName").value=c.lastName;$("#phone").value=formatPhone(c.phone);$("#email").value=c.email||"";$("#notes").value="";updateBookingDepositNotice();updateBookingSummary()};
 $$('[data-family-book-index]').forEach(b=>b.onclick=()=>{const m=family[+b.dataset.familyBookIndex];showView("book");$("#firstName").value=c.firstName;$("#lastName").value=c.lastName;$("#phone").value=formatPhone(c.phone);$("#email").value=c.email||"";$("#notes").value=`This is for ${m.name}.`;updateBookingDepositNotice();updateBookingSummary()});
 $$('[data-submit-review]').forEach(b=>b.onclick=async()=>{const a=c.appointments.find(x=>x.id===b.dataset.submitReview),text=document.querySelector(`[data-review-text="${a.id}"]`).value.trim();if(!text)return toast("Enter your review.");const review={id:`review-${Date.now()}`,appointmentId:a.id,barber:a.barber,reviewerFirstName:c.firstName,reviewerLastName:c.lastName,stars:+document.querySelector(`[data-review-stars="${a.id}"]`).value,text,createdAt:new Date().toISOString(),response:""};try{const saved=await ICUCloud.submitCustomerReview(c.phone,review);const r=loadReviews();r.push(saved||review);localStorage.setItem(REVIEWS_KEY,JSON.stringify(r));renderCustomerProfile();toast("Review submitted.")}catch(error){toast(error?.message||"Review could not be submitted.")}});
 $$('[data-client-message-send]').forEach(b=>b.onclick=async()=>{const i=document.querySelector(`[data-client-message-input="${b.dataset.clientMessageSend}"]`);if(i.value.trim()){try{await sendAppointmentMessage(b.dataset.clientMessageSend,c.firstName+" "+c.lastName,i.value);i.value="";renderCustomerProfile()}catch(error){toast(error?.message||"Message could not be sent.")}}})
}

function renderLoyalty(){const target=$("#loyaltyContent"),lookupPanel=$("#loyaltyLookup"),email=$("#loyaltyEmail").value.trim();let c=signedInCustomer()||customerByEmail(email);if(!c){lookupPanel?.classList.remove("hidden");target.innerHTML='<section class="panel"><h2>No loyalty account found</h2></section>';return}if(!signedInCustomer())setCustomerSession(c);lookupPanel?.classList.add("hidden");if($("#loyaltyEmail"))$("#loyaltyEmail").value=c.email||"";updateCustomerSessionUi();const completed=c.appointments.filter(a=>a.status==="Completed").length,points=completed*100,next=1000,percent=Math.min(100,points%next/next*100),refCode=`ICU-${(c.firstName[0]||"X")}${(c.lastName[0]||"X")}${String(c.appointments.length).padStart(3,"0")}`;target.innerHTML=`<div class="profile-grid"><section class="profile-card"><h2>Rewards points</h2><div class="loyalty-ring" style="--loyalty:${percent}%"><strong>${points}</strong></div><p class="help" style="text-align:center">${next-(points%next)} points until the next reward</p></section><section class="profile-card"><h2>Membership</h2><p class="portal-badge">Standard Member</p><div class="profile-row"><span>Completed visits</span><strong>${completed}</strong></div><div class="profile-row"><span>Referral code</span><strong>${refCode}</strong></div><div class="profile-row"><span>Reward status</span><strong>${points>=1000?"Reward available":"Keep earning"}</strong></div><button class="button secondary" type="button" onclick="alert('Membership plans are ready for production payment integration.')">View membership plans</button></section></div>`}
async function createGiftCard(){
 const email=$("#giftEmail").value.trim(),recipient=$("#giftRecipient").value.trim(),amount=Number($("#giftAmount").value),result=$("#giftBalanceResult");
 if(!email||!recipient){toast("Enter recipient information.");return}
 try{const card=await ICUCloud.createGiftCardCloud(recipient,email,amount);const cards=loadKey(GIFTCARD_KEY,[]);cards.push(card);localStorage.setItem(GIFTCARD_KEY,JSON.stringify(cards));result.classList.remove("hidden");result.textContent=`Gift card ${card.code} created for ${money(card.amount)}.`}
 catch(error){result.classList.remove("hidden");result.textContent=error?.message||"Gift card could not be created."}
}
async function checkGiftCard(){
 const code=$("#giftCode").value.trim().toUpperCase(),result=$("#giftBalanceResult");result.classList.remove("hidden");
 if(!code){result.textContent="Enter a gift-card code.";return}
 try{const card=await ICUCloud.lookupGiftCardCloud(code);result.textContent=card?`${card.recipient}'s balance is ${money(card.balance)}.`:"Gift card not found."}
 catch(error){result.textContent=error?.message||"Gift card lookup failed."}
}

function loadQueue(key){return loadKey(key,[])}function saveQueue(key,items){saveKey(key,items)}

function renderOwnerCustomers(){const query=$("#ownerCustomerSearch").value.trim().toLowerCase(),segment=$("#ownerCustomerSegment").value,now=new Date();let clients=customerRecords().map(c=>({...c,daysSince:c.last?(now-new Date(c.last))/86400000:999}));if(query)clients=clients.filter(c=>`${c.firstName} ${c.lastName} ${c.email} ${c.phone} ${[...c.barbers].join(" ")}`.toLowerCase().includes(query));if(segment==="loyal")clients=clients.filter(c=>c.appointments.length>=5);if(segment==="inactive")clients=clients.filter(c=>c.daysSince>=30);if(segment==="weekly")clients=clients.filter(c=>{const dates=c.appointments.map(a=>new Date(a.startAt)).sort((a,b)=>a-b);if(dates.length<3)return false;const gaps=[];for(let i=1;i<dates.length;i++)gaps.push((dates[i]-dates[i-1])/86400000);const avg=gaps.reduce((a,b)=>a+b,0)/gaps.length;return avg>=5&&avg<=18});$("#ownerCustomerStats").innerHTML=[["Customers",clients.length],["Loyal",clients.filter(c=>c.appointments.length>=5).length],["Inactive 30+ days",clients.filter(c=>c.daysSince>=30).length],["Lifetime value",money(clients.reduce((s,c)=>s+c.total,0))]].map(([l,v])=>`<div class="stat"><span>${l}</span><strong>${v}</strong></div>`).join("");$("#ownerCustomerList").innerHTML=clients.length?clients.map(c=>`<article class="appointment-card"><div class="date-badge"><small>Client</small><strong>${esc((c.firstName[0]||"")+(c.lastName[0]||""))}</strong></div><div class="appointment-main"><h3>${esc(c.firstName+" "+c.lastName)}</h3><p>${esc(c.email||"No email")} • ${esc(c.phone||"No phone")}</p><p class="help">${c.appointments.length} appointments • ${[...c.barbers].join(", ")} • Last visit ${Math.round(c.daysSince)} days ago</p></div><div class="appointment-side"><strong>${money(c.total)}</strong></div></article>`).join(""):'<section class="panel"><h2>No customers match</h2></section>'}

function walkInServiceDuration(serviceIds){return (serviceIds||[]).reduce((sum,id)=>sum+(serviceById(id)?.minutes||0),0)}
function walkInCustomerTotal(walkin){return (walkin.serviceIds||[]).reduce((sum,id)=>sum+effectivePrice(walkin.barber,id),0)+(walkin.afterHours?AFTER_HOURS_CUSTOMER_FEE:0)}
function walkInsForBarber(barber,date=""){return loadQueue(WALKIN_KEY).filter(w=>w.barber===barber&&(!date||String(w.startAt||w.createdAt).startsWith(date)))}
function nextBusyEnd(barber,at){
 const items=[...loadAppointments().filter(a=>a.barber===barber&&a.status!=="Cancelled").map(a=>({start:a.startAt,end:a.endAt})),...activeWalkIns().filter(w=>w.barber===barber).map(w=>({start:w.startAt,end:w.endAt}))].sort((a,b)=>new Date(a.start)-new Date(b.start));
 let cursor=new Date(at),changed=true;
 while(changed){changed=false;for(const item of items){if(new Date(item.start)<=cursor&&new Date(item.end)>cursor){cursor=new Date(item.end);changed=true}}}
 return cursor
}
function nextScheduledStart(barber,after){
 return [...loadAppointments().filter(a=>a.barber===barber&&a.status!=="Cancelled").map(a=>a.startAt),...activeWalkIns().filter(w=>w.barber===barber).map(w=>w.startAt)].map(x=>new Date(x)).filter(d=>d>after).sort((a,b)=>a-b)[0]||null
}
function barberEligibilityForWalkIn(barber,serviceIds,requestedAt=new Date()){
 const dateValue=localDate(requestedAt),availability=availabilityForDate(barber,dateValue);
 if(!availability?.enabled||dateIsBlockedByTimeOff(barber,dateValue))return{barber,eligible:false,reason:"Not working / time off"};
 const duration=walkInServiceDuration(serviceIds),start=nextBusyEnd(barber,requestedAt),workStart=minutesFromTime(availability.start),workEnd=minutesFromTime(availability.end);
 if(start.getHours()*60+start.getMinutes()<workStart)start.setHours(Math.floor(workStart/60),workStart%60,0,0);
 const startMinute=start.getHours()*60+start.getMinutes(),finishMinute=startMinute+duration;
 if(finishMinute>workEnd&&startMinute<NORMAL_CLOSE_MINUTE)return{barber,eligible:false,reason:"Not enough time before leaving"};
 if(intervalConflictsWithBreak(startMinute,finishMinute,availability))return{barber,eligible:false,reason:"Break conflict"};
 const end=new Date(start.getTime()+duration*60000),next=nextScheduledStart(barber,start);
 if(next&&end>next)return{barber,eligible:false,reason:`Next appointment at ${formatTime(next)}`};
 return{barber,eligible:true,startAt:start.toISOString(),endAt:end.toISOString(),reason:start<=requestedAt?"Available now":`Available ${formatTime(start)}`}
}
function createWalkInFromPrompts(defaultBarber=""){
 const name=prompt("Walk-in name (optional):","")||"Walk-in Customer",email=prompt("Email address (optional):","")||"",phone=prompt("Phone number (optional):","")||"";
 const serviceText=prompt(`Service IDs separated by commas:\n${allServices().map(s=>`${s.id} = ${s.name}`).join("\n")}`,"haircut")||"haircut";
 const serviceIds=serviceText.split(",").map(x=>x.trim()).filter(id=>allServices().some(s=>s.id===id));
 if(!serviceIds.length){toast("Select at least one valid service.");return null}
 let barber=defaultBarber,eligibility=null;
 if(barber){eligibility=barberEligibilityForWalkIn(barber,serviceIds,new Date());if(!eligibility.eligible){toast(`${barber} is not eligible: ${eligibility.reason}`);return null}}
 else{
  const eligible=BARBERS.map(b=>barberEligibilityForWalkIn(b,serviceIds,new Date())).filter(x=>x.eligible).sort((a,b)=>new Date(a.startAt)-new Date(b.startAt));
  if(!eligible.length){toast("No barber currently has enough open time for this walk-in.");return null}
  const choice=prompt(`Eligible barbers:\n${eligible.map(x=>`${x.barber} — ${x.reason}`).join("\n")}\n\nEnter barber name:`,eligible[0].barber);
  barber=BARBERS.find(b=>b.toLowerCase()===String(choice||"").toLowerCase())||"";eligibility=eligible.find(x=>x.barber===barber);
  if(!eligibility){toast("Select an eligible barber.");return null}
 }
 const duration=walkInServiceDuration(serviceIds),startAt=eligibility.startAt,endAt=new Date(new Date(startAt).getTime()+duration*60000).toISOString();
 return{id:`walk-${Date.now()}`,name,email,phone,serviceIds,barber,startAt,endAt,status:"Assigned",notes:prompt("Notes (optional):","")||"",afterHours:isAfterHoursStart(startAt),createdAt:new Date().toISOString(),assignedAt:new Date().toISOString(),createdBy:appMode()==="owner"?"Owner":activeBarber()}
}
function renderWalkInEligibility(){
 const target=$("#walkinEligibility");if(!target)return;
 const serviceIds=["haircut"],eligible=BARBERS.map(b=>barberEligibilityForWalkIn(b,serviceIds,new Date()));
 target.innerHTML=eligible.map(x=>`<div class="queue-item"><div><strong>${x.barber}</strong><span class="help">${esc(x.reason)}</span></div><span class="${x.eligible?"status status-completed":"status status-cancelled"}">${x.eligible?"Eligible":"Unavailable"}</span></div>`).join("")
}
function renderOperations(){
 const walkins=loadQueue(WALKIN_KEY),wait=loadQueue(WAITLIST_KEY),maintenance=loadQueue(MAINTENANCE_KEY),todayAppts=appointmentsForDate(today());
 $("#operationsCards").innerHTML=[["Scheduled today",todayAppts.length],["Walk-ins today",walkins.filter(x=>String(x.startAt||x.createdAt).startsWith(today())).length],["Assigned / in chair",walkins.filter(x=>["Assigned","In Chair"].includes(x.status)).length],["Open maintenance",maintenance.filter(x=>x.status!=="Resolved").length]].map(([l,v])=>`<div class="stat"><span>${l}</span><strong>${v}</strong></div>`).join("");
 $("#walkinQueue").innerHTML=walkins.length?walkins.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).map(x=>`<div class="queue-item operations-item"><div class="operations-copy"><strong class="operations-title">${esc(x.name)}</strong><div class="operations-detail">${esc(serviceNames(x.serviceIds||[]))}</div><div class="operations-meta">${esc(x.barber||"Unassigned")} • ${esc(x.status)}${x.startAt?` • ${esc(formatDateTime(x.startAt))}`:""}</div></div><div class="queue-actions">${x.barber?`<button class="button secondary" data-walkin-status="${x.id}:In Chair">Start</button>`:""}<button class="button primary" data-walkin-status="${x.id}:Completed">Complete</button></div></div>`).join(""):'<p class="help">No walk-ins in the queue.</p>';
 $("#waitlist").innerHTML=wait.length?wait.map(x=>`<div class="queue-item operations-item"><div class="operations-copy"><strong class="operations-title">${esc(x.name)}</strong><div class="operations-detail">${esc(x.phone||"No phone")}</div><div class="operations-meta">${esc(x.date||"Any date")}</div></div><button class="button secondary" data-remove-wait="${x.id}">Remove</button></div>`).join(""):'<p class="help">Waiting list is empty.</p>';
 $("#maintenanceList").innerHTML=maintenance.length?maintenance.map(x=>`<div class="queue-item operations-item"><div class="operations-copy"><strong class="operations-title">${esc(x.item)}</strong><div class="operations-detail">${esc(x.note||"No note")}</div><div class="operations-meta">${esc(x.status)}</div></div><button class="button secondary" data-resolve-maint="${x.id}">Resolve</button></div>`).join(""):'<p class="help">No maintenance issues.</p>';
 $("#shopAnnouncement").value=loadKey(ANNOUNCEMENT_KEY,"")||"";$("#announcementPreview").textContent=loadKey(ANNOUNCEMENT_KEY,"")||"No active announcement.";renderWalkInEligibility()
}
function renderBarberWalkIns(){
 const barber=activeBarber(),date=$("#barberWalkinDate").value,status=$("#barberWalkinStatus").value;let items=walkInsForBarber(barber,date);if(status)items=items.filter(w=>w.status===status);
 $("#barberWalkinsTitle").textContent=`${barber}'s Walk-Ins`;
 $("#barberWalkinSummary").innerHTML=[["Today's walk-ins",walkInsForBarber(barber,today()).length],["Assigned",items.filter(w=>w.status==="Assigned").length],["In chair",items.filter(w=>w.status==="In Chair").length],["Completed",items.filter(w=>w.status==="Completed").length]].map(([l,v])=>`<div class="stat"><span>${l}</span><strong>${v}</strong></div>`).join("");
 $("#barberWalkinList").innerHTML=items.length?items.map(w=>`<article class="appointment-card"><div class="date-badge"><small>Walk-in</small><strong>${w.startAt?esc(formatTime(w.startAt)):"--"}</strong></div><div class="appointment-main"><span class="status">${esc(w.status)}</span><h3>${esc(w.name)}</h3><p>${esc(serviceNames(w.serviceIds||[]))}</p><p class="help">${esc(w.email||"No email")} • ${esc(w.phone||"No phone")}</p>${w.notes?`<div class="client-note-box"><strong>Notes</strong><span>${esc(w.notes)}</span></div>`:""}</div><div class="appointment-side"><strong>${money(walkInCustomerTotal(w))}</strong><select data-barber-walkin-status="${w.id}">${["Assigned","In Chair","Completed","Cancelled"].map(s=>`<option ${s===w.status?"selected":""}>${s}</option>`).join("")}</select></div></article>`).join(""):'<section class="panel"><h2>No walk-ins</h2></section>'
}


function boothWeekBounds(dateValue=today()){
 const ref=new Date(`${dateValue}T12:00:00`),day=(ref.getDay()+6)%7,start=new Date(ref);start.setDate(ref.getDate()-day);start.setHours(0,0,0,0);const end=new Date(start);end.setDate(start.getDate()+6);end.setHours(23,59,59,999);return{start,end,weekStart:localDate(start),saturday:new Date(start.getFullYear(),start.getMonth(),start.getDate()+5,23,59,59,999),sunday:end}
}
function boothRentAmount(barber){if(barber==="Tony")return 0;return Math.round(Number(loadWorkforce().find(w=>w.name===barber)?.boothRent||0)*100)}
function boothRentPaymentsFor(barber,bounds=boothWeekBounds()){return loadKey(BOOTH_RENT_PAYMENTS_KEY,[]).filter(p=>p.barber===barber&&p.weekStart===bounds.weekStart)}
function boothRentSummary(barber,dateValue=today()){
 const bounds=boothWeekBounds(dateValue),due=boothRentAmount(barber),payments=boothRentPaymentsFor(barber,bounds),paid=payments.reduce((s,p)=>s+Number(p.amount||0),0),balance=Math.max(0,due-paid),now=new Date(),status=balance<=0?"Paid":now>bounds.sunday?"Overdue":now>=new Date(bounds.sunday.getFullYear(),bounds.sunday.getMonth(),bounds.sunday.getDate(),0,0,0,0)?"Due Today":now>=new Date(bounds.saturday.getFullYear(),bounds.saturday.getMonth(),bounds.saturday.getDate(),0,0,0,0)?"Payment Preferred Today":"Upcoming";
 return{barber,bounds,due,paid,balance,payments,status}
}
function recordBoothRentPayment(barber,amount,method,recordedBy,note=""){
 const summary=boothRentSummary(barber),items=loadKey(BOOTH_RENT_PAYMENTS_KEY,[]);items.push({id:`rent-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,barber,weekStart:summary.bounds.weekStart,amount,method,note,recordedBy,paidAt:new Date().toISOString()});saveKey(BOOTH_RENT_PAYMENTS_KEY,items)
}
function renderBarberBoothRent(){
 const barber=activeBarber(),s=boothRentSummary(barber);$("#barberBoothRentTitle").textContent=`${barber}'s Booth Rent`;$("#barberBoothRentCards").innerHTML=[["Weekly rent",money(s.due)],["Paid this week",money(s.paid)],["Balance",money(s.balance)],["Status",s.status]].map(([l,v])=>`<div class="stat"><span>${l}</span><strong>${v}</strong></div>`).join("");$("#boothRentPayAmount").value=(s.balance/100).toFixed(2);$("#barberBoothRentHistory").innerHTML=s.payments.length?s.payments.sort((a,b)=>new Date(b.paidAt)-new Date(a.paidAt)).map(p=>`<div class="queue-item"><div><strong>${money(p.amount)} — ${esc(p.method)}</strong><span class="help">${esc(formatDateTime(p.paidAt))} • ${p.recordedBy==="Owner"?"Recorded by Owner":"Paid through barber app"}${p.note?` • ${esc(p.note)}`:""}</span></div></div>`).join(""):'<p class="help">No booth-rent payments recorded for this week.</p>'
}
function renderOwnerBoothRent(){
 const summaries=BARBERS.filter(b=>b!=="Tony").map(b=>boothRentSummary(b)),totalDue=summaries.reduce((s,x)=>s+x.due,0),totalPaid=summaries.reduce((s,x)=>s+x.paid,0);
 $("#ownerBoothRentCards").innerHTML=[["Weekly rent due",money(totalDue)],["Received",money(totalPaid)],["Outstanding",money(Math.max(0,totalDue-totalPaid))],["Paid in full",summaries.filter(x=>x.balance===0).length]].map(([l,v])=>`<div class="stat"><span>${l}</span><strong>${v}</strong></div>`).join("");
 $("#ownerBoothRentList").innerHTML=summaries.map(s=>`<article class="performance-card"><div class="performance-head"><div><p class="eyebrow">${esc(s.status)}</p><h2>${s.barber}</h2></div><strong>${money(s.balance)} due</strong></div><div class="metric-grid"><div class="metric"><span>Weekly rent</span><strong>${money(s.due)}</strong></div><div class="metric"><span>Paid</span><strong>${money(s.paid)}</strong></div><div class="metric"><span>Final due date</span><strong>Sunday</strong></div></div><div class="owner-rent-actions"><button class="button secondary" type="button" data-owner-rent-record="${s.barber}">Record Outside Payment</button></div>${s.payments.map(p=>`<p class="help">${money(p.amount)} • ${esc(p.method)} • ${esc(formatDateTime(p.paidAt))} • ${esc(p.recordedBy)}</p>`).join("")}</article>`).join("")
}

function defaultWorkforce(){
 return BARBERS.map(name=>({
   name,
   boothRent:name==="Tony"?0:200,
   hourly:0,
   schedule:"Tue–Sun 9 AM–7 PM",
   role:name==="Tony"?"Owner":"Barber"
 }))
}
function loadWorkforce(){
 const saved=loadKey(WORKFORCE_KEY,defaultWorkforce());
 return saved.map(w=>({...w,role:w.name==="Tony"?"Owner":"Barber",boothRent:w.name==="Tony"?0:Number(w.boothRent||0)}))
}
function saveWorkforce(v){saveKey(WORKFORCE_KEY,v)}
function workforceRevenue(barber){
 return loadAppointments().filter(a=>a.barber===barber&&a.status==="Completed").reduce((sum,a)=>sum+customerTotalForAppointment(a),0)
}
function renderWorkforce(){
 const workers=loadWorkforce(),rentWorkers=workers.filter(w=>w.name!=="Tony"),todayBarbers=new Set(appointmentsForDate(today()).map(a=>a.barber).filter(Boolean));
 $("#workforceCards").innerHTML=[["Independent contractors",workers.filter(w=>w.name!=="Tony").length],["Barbers scheduled today",todayBarbers.size],["Weekly booth rent",money(rentWorkers.reduce((s,w)=>s+w.boothRent*100,0))],["Owner","Tony"]].map(([l,v])=>`<div class="stat"><span>${l}</span><strong>${v}</strong></div>`).join("");
 $("#workforceTable").innerHTML=`<table><thead><tr><th>Barber</th><th>Role</th><th>Schedule / Availability</th><th>Booth Rent</th><th>Gross Revenue</th></tr></thead><tbody>${workers.map(w=>`<tr><td>${esc(w.name)}</td><td>${esc(w.name==="Tony"?"Owner":"Independent Contractor")}</td><td>${esc(w.schedule)}</td><td>${w.name==="Tony"?"Owner — N/A":money(w.boothRent*100)}</td><td>${money(workforceRevenue(w.name))}</td></tr>`).join("")}</tbody></table>`
}
let posCurrentSource="quick";
function posCandidates(barber){
 const date=today(),
 appointments=loadAppointments()
   .filter(a=>a.barber===barber&&a.startAt.startsWith(date)&&!["Cancelled","Completed"].includes(a.status))
   .map(a=>({key:`appt:${a.id}`,label:`${formatTime(a.startAt)} — ${a.firstName} ${a.lastName}`,type:"appointment",record:a}));
 const walkins=loadQueue(WALKIN_KEY)
   .filter(w=>w.barber===barber&&String(w.startAt||"").startsWith(date)&&!["Cancelled","Completed"].includes(w.status))
   .map(w=>({key:`walk:${w.id}`,label:`${w.startAt?formatTime(w.startAt):"Walk-in"} — ${w.name}`,type:"walkin",record:w}));
 return[...appointments,...walkins].sort((a,b)=>String(a.label).localeCompare(String(b.label)))
}
function posSourceRecord(){
 const value=$("#posSource").value;if(value==="quick")return{type:"quick",record:null};
 const[type,id]=value.split(":");const record=type==="appt"?loadAppointments().find(a=>a.id===id):loadQueue(WALKIN_KEY).find(w=>w.id===id);return{type:type==="appt"?"appointment":"walkin",record}
}
function renderPos(){
 const barber=activeBarber();$("#barberPosTitle").textContent=`${barber}'s POS / Checkout`;const candidates=posCandidates(barber),current=$("#posSource").value||"quick";$("#posSource").innerHTML='<option value="quick">Quick Sale / No Appointment</option>'+candidates.map(c=>`<option value="${c.key}">${esc(c.label)}</option>`).join("");$("#posSource").value=[...$("#posSource").options].some(o=>o.value===current)?current:"quick";renderPosTransaction();renderRecentPos()
}
function renderPosTransaction(){
 const barber=activeBarber(),source=posSourceRecord(),quick=source.type==="quick";$("#posCustomerFields").classList.toggle("hidden",!quick);
 const selected=source.record?.serviceIds||[],posServices=servicesForBarber(barber,true).filter(s=>serviceIsActiveForBarber(barber,s.id)||selected.includes(s.id));$("#posServiceList").innerHTML=posServices.map(s=>`<label class="service-row"><input class="pos-service" type="checkbox" value="${s.id}" ${selected.includes(s.id)?"checked":""}><span class="service-copy"><strong>${esc(s.name)}</strong><small>${s.minutes} min${!serviceIsActiveForBarber(barber,s.id)?" • currently inactive":""}</small></span><span class="service-price"><strong>${money(effectivePrice(barber,s.id))}</strong></span></label>`).join("");$("#posHairScalpFee").checked=Boolean(source.record?.hairScalpPreparationFee);updatePosSummary()
}
function posSelectedServices(){return $$(".pos-service:checked").map(x=>x.value)}
function updatePosSummary(){
 const barber=activeBarber(),source=posSourceRecord(),ids=posSelectedServices(),services=ids.reduce((s,id)=>s+effectivePrice(barber,id),0),tip=Math.max(0,Math.round(Number($("#posTip").value||0)*100)),deposit=Number(source.record?.depositPaid||0),after=source.record?.afterHours?AFTER_HOURS_CUSTOMER_FEE:0,prep=$("#posHairScalpFee")?.checked?HAIR_SCALP_PREPARATION_FEE:0,total=services+after+prep+tip,balance=Math.max(0,total-deposit);
 $("#posSummary").innerHTML=`<div class="summary-list"><div class="summary-row"><span>Services</span><strong>${money(services)}</strong></div>${after?`<div class="summary-row"><span>After-hours fee</span><strong>${money(after)}</strong></div>`:""}${prep?`<div class="summary-row"><span>Hair &amp; Scalp Preparation Fee</span><strong>${money(prep)}</strong></div>`:""}${deposit?`<div class="summary-row"><span>Deposit already paid</span><strong>−${money(deposit)}</strong></div>`:""}<div class="summary-row"><span>Tip</span><strong>${money(tip)}</strong></div></div><div class="summary-total"><span>Amount to collect</span><strong>${money(balance)}</strong></div>`
}
function completePosTransaction(){
 const barber=activeBarber(),source=posSourceRecord(),ids=posSelectedServices();if(!ids.length){toast("Select at least one service.");return}
 const quick=source.type==="quick",name=quick?($("#posQuickName").value.trim()||"Quick Sale Customer"):`${source.record.firstName||source.record.name||"Customer"} ${source.record.lastName||""}`.trim(),phone=quick?formatPhone($("#posQuickPhone").value):(source.record.phone||""),tip=Math.max(0,Math.round(Number($("#posTip").value||0)*100)),serviceTotal=ids.reduce((s,id)=>s+effectivePrice(barber,id),0),after=source.record?.afterHours?AFTER_HOURS_CUSTOMER_FEE:0,prep=$("#posHairScalpFee")?.checked?HAIR_SCALP_PREPARATION_FEE:0,deposit=Number(source.record?.depositPaid||0),gross=serviceTotal+after+prep+tip,balance=Math.max(0,gross-deposit),method=$("#posPaymentMethod").value;
 const tx={id:`pos-${Date.now()}`,barber,sourceType:source.type,sourceId:source.record?.id||null,customer:name,phone,serviceIds:ids,serviceTotal,afterHoursFee:after,hairScalpPreparationFee:prep,depositApplied:deposit,tip,amountCollected:balance,grossTotal:gross,method,createdAt:new Date().toISOString(),status:"Completed"};const txs=loadKey(POS_TRANSACTIONS_KEY,[]);txs.push(tx);saveKey(POS_TRANSACTIONS_KEY,txs);
 if(source.type==="appointment"){const items=loadAppointments(),a=items.find(x=>x.id===source.record.id);if(a){a.status="Completed";a.serviceIds=ids;a.posTransactionId=tx.id;a.tip=tip;a.paymentMethod=method;a.hairScalpPreparationFee=prep;a.customerTotal=serviceTotal+after+prep;a.balanceDue=0}saveAppointments(items)}
 if(source.type==="walkin"){const items=loadQueue(WALKIN_KEY),w=items.find(x=>x.id===source.record.id);if(w){w.status="Completed";w.serviceIds=ids;w.posTransactionId=tx.id;w.tip=tip;w.paymentMethod=method}saveQueue(WALKIN_KEY,items)}
 $("#posTip").value="0";$("#posHairScalpFee").checked=false;$("#posQuickName").value="";$("#posQuickPhone").value="";renderPos();toast("Sale completed.")
}
function renderRecentPos(){const barber=activeBarber(),items=loadKey(POS_TRANSACTIONS_KEY,[]).filter(t=>t.barber===barber).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,12);$("#posRecentTransactions").innerHTML=items.length?items.map(t=>`<div class="queue-item"><div><strong>${esc(t.customer)} — ${money(t.amountCollected)}</strong><span class="help">${esc(t.method)} • Tip ${money(t.tip)} • ${esc(formatDateTime(t.createdAt))}</span></div><button class="button secondary" type="button" data-pos-receipt="${t.id}">Receipt</button></div>`).join(""):'<p class="help">No POS transactions yet.</p>'}


function renderBarberReviews(){const b=activeBarber(),r=reviewsForBarber(b);$("#barberReviewsList").innerHTML=r.map(x=>`<article class="performance-card"><div class="review-heading"><strong>★ ${x.stars}</strong><span class="reviewer-name">${esc(reviewerDisplayName(x))}</span></div><p>${esc(x.text)}</p>${x.response?`<div class="barber-response"><strong>${esc(b)} — Barber Response</strong><p>${esc(x.response)}</p></div>`:`<textarea data-review-response="${x.id}" placeholder="Write a response"></textarea><button class="button primary" data-review-respond="${x.id}">Respond</button>`}</article>`).join("")||'<section class="panel"><p>No reviews yet.</p></section>'}
function renderBarberClientMessages(){const b=activeBarber(),a=loadAppointments().filter(x=>x.barber===b&&!["Cancelled","Last Second Cancellation"].includes(x.status));$("#barberClientMessagesList").innerHTML=a.map(x=>`<article class="performance-card"><strong>${esc(x.firstName+" "+x.lastName)} • ${esc(formatDateTime(x.startAt))}</strong><div class="appointment-thread">${appointmentMessages(x.id).map(m=>`<div class="message-bubble"><strong>${esc(m.sender)}</strong><p>${esc(m.text)}</p><small>${esc(formatDateTime(m.createdAt))}</small></div>`).join("")||'<p class="help">No messages yet.</p>'}</div><div class="lookup-row"><input data-bcm-input="${x.id}" placeholder="Message client"><button class="button secondary" data-bcm-send="${x.id}">Send</button></div></article>`).join("")||'<section class="panel"><p>No appointment conversations yet.</p></section>'}

function clientsForBarber(barber){return customerRecords().filter(c=>c.appointments.some(a=>a.barber===barber))}
function renderClientTools(){
 const barber=activeBarber(),all=clientsForBarber(barber).slice().sort((a,b)=>String(a.lastName||"").localeCompare(String(b.lastName||""))||String(a.firstName||"").localeCompare(String(b.firstName||""))),query=String($("#clientToolsSearch")?.value||"").trim().toLowerCase();
 if(!window.__icuSelectedClientToolKey||!all.some(c=>c.key===window.__icuSelectedClientToolKey))window.__icuSelectedClientToolKey=all[0]?.key||"";
 const visible=all.filter(c=>!query||`${c.firstName} ${c.lastName} ${c.email} ${c.phone}`.toLowerCase().includes(query));
 $("#clientToolsTitle").textContent=`${barber}'s Client Tools`;
 $("#clientToolsList").innerHTML=visible.length?visible.map(c=>`<button class="client-directory-button ${c.key===window.__icuSelectedClientToolKey?"active":""}" type="button" data-client-tool-key="${esc(c.key)}"><strong>${esc((c.lastName||"")+", "+(c.firstName||""))}</strong><small>${esc(c.phone||c.email||"No contact information")}</small></button>`).join(""):'<p class="help">No clients match this search.</p>';
 if(window.__icuSelectedClientToolKey)renderSelectedClientTool(window.__icuSelectedClientToolKey);else $("#clientToolsContent").innerHTML='<section class="panel"><h2>No clients yet</h2><p>Clients appear after they have booked this barber.</p></section>'
}
function renderSelectedClientTool(key=window.__icuSelectedClientToolKey){
 const barber=activeBarber(),c=clientsForBarber(barber).find(x=>x.key===key);if(!c)return;window.__icuSelectedClientToolKey=c.key;
 $("#clientToolsList")?.querySelectorAll("[data-client-tool-key]").forEach(b=>b.classList.toggle("active",b.dataset.clientToolKey===c.key));
 const all=loadKey(CLIENT_NOTES_KEY,{}),id=`${barber}|${c.key}`,notes=all[id]||{},familyStore=loadKey(FAMILY_KEY,{}),family=familyStore[customerStorageKey(c)]||familyStore[c.email]||[];
 const recentNotes=c.appointments.filter(a=>a.barber===barber&&a.notes).sort((a,b)=>new Date(b.startAt)-new Date(a.startAt)).slice(0,6);
 $("#clientToolsContent").innerHTML=`<div class="consultation-grid"><section class="panel"><h2>${esc(c.firstName+" "+c.lastName)}</h2><p>${esc(c.phone||"No phone")}${c.email?`<br>${esc(c.email)}`:""}</p><label>Hair / guard preference<input id="consultHair" value="${esc(notes.hair||"")}"></label><label>Beard preference<input id="consultBeard" value="${esc(notes.beard||"")}"></label><label>Private barber consultation notes<textarea id="consultNotes">${esc(notes.notes||"")}</textarea></label><button id="saveConsultation" class="button primary" type="button">Save consultation</button></section><section class="panel"><h2>Family Members</h2>${family.length?family.map(f=>`<div class="profile-row"><span>${esc(f.name)}</span><strong>${esc(f.relationship||"Family")}</strong></div>`).join(""):'<p class="help">This customer has not added family members.</p>'}<h2>Customer Appointment Notes</h2>${recentNotes.length?recentNotes.map(a=>`<div class="client-note-box"><strong>${esc(formatDateTime(a.startAt))}</strong><span>${esc(a.notes)}</span></div>`).join(""):'<p class="help">No customer-entered appointment notes.</p>'}</section><section class="panel"><h2>Before / after gallery</h2><div class="field-grid"><div class="photo-placeholder">Before photo placeholder</div><div class="photo-placeholder">After photo placeholder</div></div><label>Photo reference note<input id="photoNote" value="${esc(notes.photo||"")}" placeholder="Example: low taper, 1.5 guard"></label><p class="help">Actual photo storage will be connected in the production cloud version.</p></section></div>`;
 $("#saveConsultation").onclick=()=>{all[id]={hair:$("#consultHair").value,beard:$("#consultBeard").value,notes:$("#consultNotes").value,photo:$("#photoNote").value};saveKey(CLIENT_NOTES_KEY,all);toast("Consultation saved.")}
}
function defaultAvailability(barber){
 const days=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],all={};
 days.forEach((day,index)=>all[day]={enabled:index<6,start:"09:00",end:"19:00",breakStart:"13:00",breakEnd:"13:30"});
 return all
}
let availabilityWeekStart="";
function mondayForDate(value){
 const date=new Date(`${value||today()}T12:00:00`),day=(date.getDay()+6)%7;
 date.setDate(date.getDate()-day);
 return localDate(date)
}
function weekDates(startValue){
 const start=new Date(`${startValue}T12:00:00`);
 return Array.from({length:7},(_,index)=>{const date=new Date(start);date.setDate(start.getDate()+index);return localDate(date)})
}
function formatCalendarDate(value){
 return new Intl.DateTimeFormat("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"}).format(new Date(`${value}T12:00:00`))
}
function formatClockLabel(value){
 if(!value)return"";
 return new Intl.DateTimeFormat("en-US",{hour:"numeric",minute:"2-digit"}).format(new Date(`2000-01-01T${value}`))
}
function renderAvailability(){
 const barber=activeBarber(),all=loadKey(AVAILABILITY_KEY,{}),barberData=all[barber]||{};
 if(!availabilityWeekStart)availabilityWeekStart=mondayForDate(today());
 const dates=weekDates(availabilityWeekStart),last=dates.at(-1);
 $("#availabilityTitle").textContent=`${barber}'s Availability`;
 $("#availabilityWeekLabel").textContent=`${new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric"}).format(new Date(`${dates[0]}T12:00:00`))} – ${new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric"}).format(new Date(`${last}T12:00:00`))}`;
 $("#availabilityGrid").innerHTML=dates.map(dateValue=>{
   const day=weekdayNameForDate(dateValue);
   const value=barberData.dates?.[dateValue]||barberData[dateValue]||barberData[day]||defaultAvailability(barber)[day];
   return`<section class="availability-day" data-date="${dateValue}">
    <h3><span>${esc(formatCalendarDate(dateValue))}</span><label><input class="day-enabled" type="checkbox" ${value.enabled?"checked":""}> Working</label></h3>
    <div class="availability-fields">
     <label>Start<input class="day-start" type="time" step="900" value="${value.start}"></label>
     <label>End<input class="day-end" type="time" step="900" value="${value.end}"></label>
     <label>Break start<input class="break-start" type="time" step="900" value="${value.breakStart||""}"></label>
     <label>Break end<input class="break-end" type="time" step="900" value="${value.breakEnd||""}"></label>
    </div>
   </section>`
 }).join("");
 renderTimeOff()
}
function saveAvailabilityData(){
 const barber=activeBarber(),all=loadKey(AVAILABILITY_KEY,{});
 all[barber]=all[barber]||{};
 all[barber].dates=all[barber].dates||{};
 $$(".availability-day").forEach(card=>{
   const start=card.querySelector(".day-start").value,end=card.querySelector(".day-end").value;
   if(start&&end&&minutesFromTime(end)<=minutesFromTime(start)){toast(`${formatCalendarDate(card.dataset.date)} must end after it starts.`);throw new Error("Invalid availability range")}
   all[barber].dates[card.dataset.date]={
    enabled:card.querySelector(".day-enabled").checked,
    start,end,
    breakStart:card.querySelector(".break-start").value,
    breakEnd:card.querySelector(".break-end").value
   }
 });
 saveKey(AVAILABILITY_KEY,all);toast("Date-specific availability saved.")
}
function moveAvailabilityWeek(offset){
 const start=new Date(`${availabilityWeekStart||mondayForDate(today())}T12:00:00`);
 start.setDate(start.getDate()+offset*7);
 availabilityWeekStart=localDate(start);
 renderAvailability()
}
function renderTimeOff(){const barber=activeBarber(),items=loadKey(TIMEOFF_KEY,[]).filter(x=>x.barber===barber);$("#timeOffList").innerHTML=items.length?items.map(x=>`<div class="queue-item"><div><strong>${x.start} through ${x.end}</strong><span class="help">${esc(x.reason)}</span></div><button class="button secondary" data-timeoff-remove="${x.id}">Remove</button></div>`).join(""):'<p class="help">No time off scheduled.</p>'}
async function saveSocialFiles(files){
 if(!window.ICUCloud){toast("Cloud storage is unavailable.");return}
 await ICUCloud.saveSocialFiles(files);await renderSocialMedia();toast("Media added to your private Supabase content library.")
}
async function getSocialMediaItems(){return window.ICUCloud?await ICUCloud.socialItems():[]}
async function updateSocialItem(id,changes){if(window.ICUCloud)await ICUCloud.updateSocial(id,changes)}
async function deleteSocialItem(id){if(window.ICUCloud)await ICUCloud.deleteSocial(id);await renderSocialMedia()}
async function renderSocialMedia(){
 if(!$("#socialMediaGrid"))return;const barber=activeBarber();$("#socialContentTitle").textContent=`${barber}'s Social Media Content`;const platform=$("#socialPlatformFilter").value,typeFilter=$("#socialTypeFilter").value;let items=[];try{items=await getSocialMediaItems()}catch(error){$("#socialMediaGrid").innerHTML=`<section class="panel"><h2>Cloud media unavailable</h2><p>${esc(error?.message||"Unable to load media.")}</p></section>`;return}if(platform)items=items.filter(x=>x.platform===platform);if(typeFilter)items=items.filter(x=>x.type.startsWith(typeFilter));
 $("#socialMediaGrid").innerHTML="";
 if(!items.length){$("#socialMediaGrid").innerHTML='<section class="panel"><h2>No media yet</h2><p>Take a photo/video or upload media from your device. Files are stored privately in Supabase.</p></section>';return}
 items.forEach(item=>{const url=URL.createObjectURL(item.blob),card=document.createElement("article");card.className="social-media-card";card.dataset.mediaId=item.id;card.innerHTML=`<div class="social-preview">${item.type.startsWith("video")?`<video controls preload="metadata" src="${url}"></video>`:`<img src="${url}" alt="${esc(item.name)}">`}</div><div class="social-card-body"><label>Title<input class="social-title" value="${esc(item.name)}"></label><label>Platform<select class="social-platform"><option value="">Not assigned</option>${["TikTok","Instagram","Facebook","X/Twitter","YouTube"].map(p=>`<option ${p===item.platform?"selected":""}>${p}</option>`).join("")}</select></label><label>Caption<textarea class="social-caption">${esc(item.caption||"")}</textarea></label><label>Hashtags<input class="social-hashtags" value="${esc(item.hashtags||"")}" placeholder="#barber #freshcut"></label><section class="social-portfolio-controls"><div class="section-heading-row"><h3>Client Portfolio</h3><span>${item.portfolioVisible?"Visible to clients":"Private"}</span></div><label class="check"><input class="social-portfolio-consent" type="checkbox" ${item.consentConfirmed?"checked":""}><span><strong>Photo / Video Consent Confirmed</strong><br><small>Required before this media can be shown to booking clients.</small></span></label><label class="check"><input class="social-portfolio-visible" type="checkbox" ${item.portfolioVisible?"checked":""}><span><strong>Show in Client Portfolio</strong><br><small>Clients who select this barber can view this item while booking.</small></span></label><label>Portfolio title<input class="social-portfolio-title" value="${esc(item.portfolioTitle||item.name||"")}" placeholder="Burst Fade"></label><div class="field-grid"><label>Category<select class="social-portfolio-category"><option value="">Uncategorized</option>${["Haircut","Beard","Design","Dreadlocks","Kids","Before & After","Other"].map(c=>`<option ${c===item.portfolioCategory?"selected":""}>${c}</option>`).join("")}</select></label><label>Display order<input class="social-portfolio-sort" type="number" min="0" max="999" step="1" value="${Number(item.portfolioSort||0)}"></label></div><label class="check"><input class="social-portfolio-featured" type="checkbox" ${item.portfolioFeatured?"checked":""}><span><strong>Featured</strong><br><small>Featured work is shown first.</small></span></label></section><p class="help">${esc(formatDateTime(item.createdAt))} • Supabase Storage</p><div class="social-card-actions"><button class="button primary" data-social-preview="${item.id}" type="button">Preview Post</button>${item.type.startsWith("image")?`<button class="button secondary" data-social-edit="${item.id}" type="button">Edit Image</button>`:""}<button class="button secondary" data-social-save="${item.id}" type="button">Save Details</button><button class="button secondary" data-social-download="${item.id}" type="button">Download</button><button class="button secondary" data-social-copy="${item.id}" type="button">Copy Caption</button><button class="button danger" data-social-delete="${item.id}" type="button">Delete</button></div></div>`;$("#socialMediaGrid").appendChild(card)})
}
async function socialItemById(id){return(await getSocialMediaItems()).find(x=>x.id===id)}

let barberPortfolioCache=new Map();
async function loadClientPortfolio(barber,force=false){
 if(!barber)return[];if(!force&&barberPortfolioCache.has(barber))return barberPortfolioCache.get(barber);
 if(!window.ICUCloud?.clientPortfolio)return[];
 try{const items=await ICUCloud.clientPortfolio(barber);barberPortfolioCache.set(barber,items||[]);return items||[]}catch(error){console.warn("Portfolio unavailable",error);return[]}
}
async function updateBarberPortfolioPrompt(){
 const prompt=$("#barberPortfolioPrompt"),barber=$("#barber")?.value;if(!prompt)return;
 if(!barber){prompt.classList.add("hidden");return}
 $("#barberPortfolioPromptTitle").textContent=`See some of ${barber}’s work`;$("#barberPortfolioPromptText").textContent=`Take a look at ${barber}’s selected photos and videos before choosing your service.`;
 const items=await loadClientPortfolio(barber,true);prompt.classList.toggle("hidden",!items.length);
 if(items.length)$("#openBarberPortfolio").textContent=`View ${barber}’s Portfolio (${items.length})`;
}
function portfolioMediaMarkup(item,viewer=false){
 const title=esc(item.title||"Portfolio work"),url=esc(item.url||"");
 if(String(item.mimeType||"").startsWith("video")){const attrs=viewer?"controls autoplay":'muted playsinline preload="metadata"';return`<video ${attrs} src="${url}" aria-label="${title}"></video>${viewer?'':'<span class="portfolio-play-badge">▶</span>'}`}
 return`<img src="${url}" alt="${title}" loading="lazy">`;
}
async function openBarberPortfolio(){
 const barber=$("#barber")?.value;if(!barber)return;const items=await loadClientPortfolio(barber,true);
 $("#barberPortfolioTitle").textContent=`${barber}’s Work`;$("#barberPortfolioSubtitle").textContent=`Select a photo or video to view it larger. Only work ${barber} approved for client viewing appears here.`;
 const grid=$("#barberPortfolioGrid");grid.innerHTML=items.length?items.map(item=>`<button type="button" class="portfolio-thumb" data-portfolio-item="${esc(item.id)}"><div class="portfolio-thumb-media">${portfolioMediaMarkup(item,false)}</div><span class="portfolio-thumb-copy"><strong>${esc(item.title||"Recent Work")}</strong><small>${esc(item.category||"")}</small></span></button>`).join(""):'<p class="help">No portfolio items are currently available.</p>';
 $("#barberPortfolioDialog").showModal();
}
function openPortfolioViewer(item){
 if(!item)return;$("#portfolioViewerTitle").textContent=item.title||"Portfolio";$("#portfolioViewerCategory").textContent=item.category||"";$("#portfolioViewerMedia").innerHTML=portfolioMediaMarkup(item,true);$("#barberPortfolioViewer").showModal();
}

let socialPostPreviewState={item:null,url:null};
function postPreviewRatioForPlatform(platform){
 if(platform==="TikTok")return"9/16";
 if(platform==="Instagram")return"4/5";
 if(platform==="Facebook")return"4/5";
 if(platform==="X/Twitter")return"16/9";
 if(platform==="YouTube")return"16/9";
 return"9/16";
}
function hexToRgba(hex,alpha){
 const h=String(hex||"#000000").replace("#","");const n=parseInt(h.length===3?h.split("").map(x=>x+x).join(""):h,16);
 return`rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${Math.max(0,Math.min(1,alpha))})`;
}
function syncSocialPostPreview(){
 const item=socialPostPreviewState.item;if(!item)return;
 const frame=$("#socialPostPreviewFrame"),media=frame?.querySelector("img,video"),overlay=$("#socialPostOverlay");
 if(frame)frame.style.aspectRatio=$("#postPreviewRatio").value||"9/16";
 if(media)media.style.objectFit=$("#postPreviewFit").value||"cover";
 const text=$("#postPreviewText").value||"";overlay.textContent=text;overlay.style.display=text?"block":"none";
 overlay.style.fontFamily=`"${$("#postPreviewFont").value}", Arial, sans-serif`;
 overlay.style.fontSize=`${Math.max(14,Math.min(160,Number($("#postPreviewFontSize").value)||48))}px`;
 overlay.style.color=$("#postPreviewColor").value;overlay.style.fontWeight=$("#postPreviewBold").checked?"800":"400";overlay.style.fontStyle=$("#postPreviewItalic").checked?"italic":"normal";overlay.style.textDecoration=$("#postPreviewUnderline").checked?"underline":"none";overlay.style.textShadow=$("#postPreviewShadow").checked?"0 2px 7px rgba(0,0,0,.9)":"none";overlay.style.textAlign=$("#postPreviewAlign").value;
 overlay.style.background=$("#postPreviewHighlight").checked?hexToRgba($("#postPreviewHighlightColor").value,Number($("#postPreviewHighlightOpacity").value)/100):"transparent";
 const pos=$("#postPreviewPosition").value;overlay.style.top=pos==="top"?"10%":pos==="bottom"?"90%":"50%";overlay.style.transform=pos==="top"?"translateY(0)":pos==="bottom"?"translateY(-100%)":"translateY(-50%)";
 $("#socialPostPreviewCaption").textContent=$("#postPreviewCaptionInput").value||"";$("#socialPostPreviewHashtags").textContent=$("#postPreviewHashtagsInput").value||"";
}
async function openSocialPostPreview(id){
 const item=await socialItemById(id);if(!item)return;
 if(socialPostPreviewState.url)URL.revokeObjectURL(socialPostPreviewState.url);
 socialPostPreviewState.item=item;socialPostPreviewState.url=URL.createObjectURL(item.blob);
 $("#socialPostPreviewTitle").textContent=`Preview: ${item.name||"Social media"}`;$("#socialPostPreviewBarber").textContent=activeBarber();
 $("#postPreviewPlatform").value=item.platform||"";$("#postPreviewRatio").value=postPreviewRatioForPlatform(item.platform||"");$("#postPreviewFit").value="cover";$("#postPreviewText").value="";$("#postPreviewFont").value="Impact";$("#postPreviewFontSize").value=48;$("#postPreviewColor").value="#ffffff";$("#postPreviewBold").checked=true;$("#postPreviewItalic").checked=false;$("#postPreviewUnderline").checked=false;$("#postPreviewShadow").checked=true;$("#postPreviewHighlight").checked=false;$("#postPreviewAlign").value="center";$("#postPreviewPosition").value="middle";$("#postPreviewHighlightColor").value="#000000";$("#postPreviewHighlightOpacity").value=60;$("#postPreviewCaptionInput").value=item.caption||"";$("#postPreviewHashtagsInput").value=item.hashtags||"";
 $("#socialPostPreviewMedia").innerHTML=item.type.startsWith("video")?`<video controls playsinline preload="metadata" src="${socialPostPreviewState.url}"></video>`:`<img src="${socialPostPreviewState.url}" alt="${esc(item.name||"Social media preview")}">`;
 $("#socialPostVideoNote").classList.toggle("hidden",!item.type.startsWith("video"));$("#postPreviewOpenImageEditor").classList.toggle("hidden",!item.type.startsWith("image"));syncSocialPostPreview();$("#socialPostPreview").showModal();
}
function closeSocialPostPreview(){
 const dlg=$("#socialPostPreview");if(dlg?.open)dlg.close();if(socialPostPreviewState.url){URL.revokeObjectURL(socialPostPreviewState.url);socialPostPreviewState.url=null}socialPostPreviewState.item=null;
}

let socialEditorState={sourceItem:null,image:null,layers:[],selectedId:null,dragging:false,dragOffsetX:0,dragOffsetY:0};

function defaultTextLayer(text="Your Text"){
 return{
  id:`layer-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
  text,
  x:540,y:180,
  font:"Impact",
  size:64,
  color:"#ffffff",
  bold:false,
  italic:false,
  underline:false,
  align:"center",
  shadow:true,
  highlight:false,
  highlightColor:"#000000",
  highlightOpacity:.6
 }
}
function selectedTextLayer(){return socialEditorState.layers.find(l=>l.id===socialEditorState.selectedId)||null}
function fontString(layer){
 const italic=layer.italic?"italic ":"",bold=layer.bold?"bold ":"";
 return`${italic}${bold}${layer.size}px "${layer.font}"`
}
function drawWrappedText(ctx,layer){
 const maxWidth=900,words=String(layer.text||"").split(/\s+/),lines=[];let line="";
 ctx.font=fontString(layer);
 words.forEach(word=>{const test=line?`${line} ${word}`:word;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=word}else line=test});
 if(line)lines.push(line);if(!lines.length)lines.push("");
 const lineHeight=layer.size*1.2,totalHeight=lines.length*lineHeight;
 let startY=layer.y-totalHeight/2+lineHeight*.78;
 ctx.textAlign=layer.align;ctx.textBaseline="alphabetic";
 lines.forEach((text,index)=>{
   const metrics=ctx.measureText(text),width=metrics.width,padX=18,padY=10,y=startY+index*lineHeight;
   let left=layer.x;
   if(layer.align==="center")left=layer.x-width/2;
   if(layer.align==="right")left=layer.x-width;
   if(layer.highlight){
     const alpha=Math.max(0,Math.min(1,Number(layer.highlightOpacity)||0));
     const hex=layer.highlightColor.replace("#",""),r=parseInt(hex.slice(0,2),16)||0,g=parseInt(hex.slice(2,4),16)||0,b=parseInt(hex.slice(4,6),16)||0;
     ctx.fillStyle=`rgba(${r},${g},${b},${alpha})`;
     ctx.fillRect(left-padX,y-layer.size-padY,width+padX*2,layer.size+padY*2);
   }
   if(layer.shadow){ctx.shadowColor="rgba(0,0,0,.75)";ctx.shadowBlur=Math.max(4,layer.size*.12);ctx.shadowOffsetX=2;ctx.shadowOffsetY=3}else{ctx.shadowColor="transparent";ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0}
   ctx.fillStyle=layer.color;ctx.fillText(text,layer.x,y);
   ctx.shadowColor="transparent";ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
   if(layer.underline){
     const underlineY=y+Math.max(3,layer.size*.08);ctx.strokeStyle=layer.color;ctx.lineWidth=Math.max(2,layer.size*.045);ctx.beginPath();ctx.moveTo(left,underlineY);ctx.lineTo(left+width,underlineY);ctx.stroke()
   }
 })
}
function renderSocialEditorCanvas(){
 const canvas=$("#socialEditorCanvas"),ctx=canvas.getContext("2d"),img=socialEditorState.image;if(!img)return;
 ctx.clearRect(0,0,canvas.width,canvas.height);
 const scale=Math.min(canvas.width/img.width,canvas.height/img.height),w=img.width*scale,h=img.height*scale,x=(canvas.width-w)/2,y=(canvas.height-h)/2;
 ctx.fillStyle="#111";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,x,y,w,h);
 socialEditorState.layers.forEach(layer=>drawWrappedText(ctx,layer));
 const selected=selectedTextLayer();if(selected){ctx.save();ctx.strokeStyle="rgba(255,255,255,.8)";ctx.setLineDash([8,6]);ctx.lineWidth=2;const width=Math.min(900,Math.max(120,ctx.measureText(selected.text||"Text").width+60));ctx.strokeRect(selected.x-width/2,selected.y-selected.size*.85,width,selected.size*1.35);ctx.restore()}
}
function renderTextLayerList(){
 const target=$("#textLayerList");target.innerHTML=socialEditorState.layers.map((l,i)=>`<button class="conversation-button ${l.id===socialEditorState.selectedId?"active":""}" type="button" data-editor-layer="${l.id}"><span><strong>Layer ${i+1}</strong><small>${esc((l.text||"Text").slice(0,34))}</small></span></button>`).join("");
 const layer=selectedTextLayer(),disabled=!layer;
 ["overlayText","overlayFont","overlayFontSize","overlayColor","overlayBold","overlayItalic","overlayUnderline","overlayShadow","overlayHighlight","overlayAlign","overlayHighlightColor","overlayHighlightOpacity","duplicateTextLayer","bringTextForward","sendTextBackward","deleteTextLayer"].forEach(id=>{const el=$("#"+id);if(el)el.disabled=disabled});
 if(layer){
   $("#overlayText").value=layer.text;$("#overlayFont").value=layer.font;$("#overlayFontSize").value=layer.size;$("#overlayColor").value=layer.color;$("#overlayBold").checked=layer.bold;$("#overlayItalic").checked=layer.italic;$("#overlayUnderline").checked=layer.underline;$("#overlayShadow").checked=layer.shadow;$("#overlayHighlight").checked=layer.highlight;$("#overlayAlign").value=layer.align;$("#overlayHighlightColor").value=layer.highlightColor;$("#overlayHighlightOpacity").value=Math.round(layer.highlightOpacity*100)
 }
}
function syncSelectedLayerFromControls(){
 const layer=selectedTextLayer();if(!layer)return;
 layer.text=$("#overlayText").value;layer.font=$("#overlayFont").value;layer.size=Math.max(12,Math.min(240,Number($("#overlayFontSize").value)||64));layer.color=$("#overlayColor").value;layer.bold=$("#overlayBold").checked;layer.italic=$("#overlayItalic").checked;layer.underline=$("#overlayUnderline").checked;layer.shadow=$("#overlayShadow").checked;layer.highlight=$("#overlayHighlight").checked;layer.align=$("#overlayAlign").value;layer.highlightColor=$("#overlayHighlightColor").value;layer.highlightOpacity=Number($("#overlayHighlightOpacity").value)/100;
 renderSocialEditorCanvas();renderTextLayerList()
}
async function openSocialImageEditor(id){
 const item=await socialItemById(id);if(!item||!item.type.startsWith("image"))return;
 const url=URL.createObjectURL(item.blob),img=new Image();
 img.onload=()=>{URL.revokeObjectURL(url);socialEditorState={sourceItem:item,image:img,layers:[defaultTextLayer("Your Text")],selectedId:null,dragging:false,dragOffsetX:0,dragOffsetY:0};socialEditorState.selectedId=socialEditorState.layers[0].id;$("#socialEditorTitle").textContent=`Edit: ${item.name}`;$("#socialExportTitle").value=`Edited - ${item.name.replace(/\.[^.]+$/,"")}`;renderTextLayerList();renderSocialEditorCanvas();$("#socialImageEditor").showModal()};
 img.src=url
}
function canvasPointerPosition(event){
 const canvas=$("#socialEditorCanvas"),rect=canvas.getBoundingClientRect();
 return{x:(event.clientX-rect.left)*(canvas.width/rect.width),y:(event.clientY-rect.top)*(canvas.height/rect.height)}
}
function layerHitTest(x,y){
 const canvas=$("#socialEditorCanvas"),ctx=canvas.getContext("2d");
 for(let i=socialEditorState.layers.length-1;i>=0;i--){const l=socialEditorState.layers[i];ctx.font=fontString(l);const width=Math.min(900,Math.max(120,ctx.measureText(l.text||"Text").width+70)),height=l.size*1.5;if(x>=l.x-width/2&&x<=l.x+width/2&&y>=l.y-height&&y<=l.y+height/2)return l}
 return null
}
async function exportEditedSocialImage(){
 if(!socialEditorState.image||!socialEditorState.sourceItem)return;
 const canvas=$("#socialEditorCanvas"),exportCanvas=document.createElement("canvas"),img=socialEditorState.image;
 exportCanvas.width=img.width;exportCanvas.height=img.height;const ctx=exportCanvas.getContext("2d");ctx.drawImage(img,0,0);
 const sx=img.width/canvas.width,sy=img.height/canvas.height;
 socialEditorState.layers.forEach(original=>{const layer={...original,x:original.x*sx,y:original.y*sy,size:original.size*((sx+sy)/2)};drawWrappedText(ctx,layer)});
 const blob=await new Promise(resolve=>exportCanvas.toBlob(resolve,"image/png",.95));if(!blob)return;
 const item=socialEditorState.sourceItem,name=($("#socialExportTitle").value.trim()||`Edited - ${item.name}`)+".png";
 if(!window.ICUCloud){toast("Cloud storage is unavailable.");return}await ICUCloud.saveEditedSocial(item,blob,name);$("#socialImageEditor").close();await renderSocialMedia();toast("Edited image saved as a new cloud copy.")
}

function messageUser(){return appMode()==="owner"?"Owner":activeBarber()}
function loadMessages(){return loadKey(MESSAGES_KEY,[])}
function saveMessages(items){saveKey(MESSAGES_KEY,items)}
function loadMessageGroups(){return loadKey(MESSAGE_GROUPS_KEY,[])}
function saveMessageGroups(items){saveKey(MESSAGE_GROUPS_KEY,items)}
function directConversationKey(a,b){return `direct:${[a,b].sort().join("|")}`}
function groupConversationKey(id){return `group:${id}`}
function conversationMessages(key){
 const messages=loadMessages();
 if(key.startsWith("direct:")){const users=key.slice(7).split("|");return messages.filter(m=>m.type==="direct"&&users.includes(m.sender)&&users.includes(m.recipient))}
 const id=key.slice(6);return messages.filter(m=>m.type==="group"&&m.groupId===id)
}
function userCanAccessConversation(user,key){
 if(key.startsWith("direct:"))return key.slice(7).split("|").includes(user);
 const group=loadMessageGroups().find(g=>g.id===key.slice(6));return Boolean(group&&group.participants.includes(user))
}
function conversationLabel(user,key){
 if(key.startsWith("direct:"))return key.slice(7).split("|").find(name=>name!==user)||user;
 const group=loadMessageGroups().find(g=>g.id===key.slice(6));return group?.name||"Group Chat"
}
function conversationParticipants(key){
 if(key.startsWith("direct:"))return key.slice(7).split("|");
 return loadMessageGroups().find(g=>g.id===key.slice(6))?.participants||[]
}
function messageReadMap(){return loadKey(MESSAGE_READ_KEY,{})}
function conversationLastRead(user,key){return Number(messageReadMap()[user]?.[key]||0)}
function unreadForConversation(user,key){return conversationMessages(key).filter(m=>m.sender!==user&&new Date(m.createdAt).getTime()>conversationLastRead(user,key)).length}
function markConversationRead(user,key){const reads=messageReadMap();reads[user]=reads[user]||{};reads[user][key]=Date.now();localStorage.setItem(MESSAGE_READ_KEY,JSON.stringify(reads));window.ICUCloud?.markRead(key,user).catch(()=>{});updateUnifiedNotifications()}
function accessibleConversationKeys(user){
 const keys=[];
 if(user==="Owner")BARBERS.forEach(b=>keys.push(directConversationKey("Owner",b)));
 else{keys.push(directConversationKey("Owner",user));BARBERS.filter(b=>b!==user).forEach(b=>keys.push(directConversationKey(user,b)))}
 loadMessageGroups().filter(g=>g.participants.includes(user)).forEach(g=>keys.push(groupConversationKey(g.id)));
 return keys
}
function unreadMessageCount(user){return accessibleConversationKeys(user).reduce((sum,key)=>sum+unreadForConversation(user,key),0)}
function newestUnreadSender(user){
 const unread=accessibleConversationKeys(user).flatMap(key=>conversationMessages(key).filter(m=>m.sender!==user&&new Date(m.createdAt).getTime()>conversationLastRead(user,key)));
 unread.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));return unread[0]?.sender||""
}
let selectedBarberConversation="";
let selectedOwnerConversation="";
function renderConversationButtons(user,targetSelector,selectedKey){
 const target=$(targetSelector);const keys=accessibleConversationKeys(user);
 target.innerHTML=keys.map(key=>{const unread=unreadForConversation(user,key),last=conversationMessages(key).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))[0];return`<button class="conversation-button ${key===selectedKey?"active":""}" type="button" data-conversation-key="${esc(key)}"><span><strong>${esc(conversationLabel(user,key))}</strong><small>${last?esc(last.body.slice(0,46)):"No messages yet"}</small></span>${unread?`<span class="unread-pill">${unread>99?"99+":unread}</span>`:""}</button>`}).join("")
}
function renderMessageThread(user,key,prefix){
 if(!key||!userCanAccessConversation(user,key)){ $(`#${prefix}ThreadTitle`).textContent="Choose a conversation";$(`#${prefix}MessageThread`).innerHTML="";return}
 const messages=conversationMessages(key).sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
 $(`#${prefix}ThreadTitle`).textContent=conversationLabel(user,key);
 $(`#${prefix}ThreadParticipants`).textContent=conversationParticipants(key).join(", ");
 const sender=newestUnreadSender(user),notice=$(`#${prefix}MessageSenderNotice`);notice.textContent=sender?`New message from ${sender}`:"";notice.classList.toggle("hidden",!sender);
 $(`#${prefix}MessageThread`).innerHTML=messages.length?messages.map(m=>`<div class="chat-message ${m.sender===user?"mine":""}"><div class="chat-meta"><span>${esc(m.sender)}</span><span>${esc(formatDateTime(m.createdAt))}</span></div><div>${esc(m.body)}</div></div>`).join(""):'<p class="help">No messages in this conversation.</p>';
 markConversationRead(user,key);
 $(`#${prefix}MessageThread`).scrollTop=$(`#${prefix}MessageThread`).scrollHeight
}
function renderBarberMessages(){
 const user=activeBarber();$("#barberMessagesTitle").textContent=`${user}'s Messages`;
 if(!selectedBarberConversation)selectedBarberConversation=directConversationKey("Owner",user);
 renderConversationButtons(user,"#barberConversationList",selectedBarberConversation);renderMessageThread(user,selectedBarberConversation,"barber")
}
function renderOwnerMessages(){
 const user="Owner";if(!selectedOwnerConversation)selectedOwnerConversation=directConversationKey("Owner",BARBERS[0]);
 renderConversationButtons(user,"#ownerConversationList",selectedOwnerConversation);renderMessageThread(user,selectedOwnerConversation,"owner")
}
function sendMessage(user,key,text){
 const body=text.trim();if(!body||!key||!userCanAccessConversation(user,key))return;
 const id=`msg-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,messages=loadMessages(),createdAt=new Date().toISOString();
 if(key.startsWith("direct:")){const recipient=key.slice(7).split("|").find(name=>name!==user);messages.push({id,type:"direct",sender:user,recipient,body,createdAt})}
 else messages.push({id,type:"group",groupId:key.slice(6),sender:user,body,createdAt});
 localStorage.setItem(MESSAGES_KEY,JSON.stringify(messages));window.ICUCloud?.sendMessage(key,user,body).catch(error=>toast(error?.message||"Message could not be sent."));markConversationRead(user,key);window.dispatchEvent(new Event("icuMessagesChanged"))
}
function createGroupChat(creator){
 const name=prompt("Group chat name:");if(!name)return;
 const choices=["Owner",...BARBERS].filter(x=>x!==creator);const selected=prompt(`Enter participants separated by commas:\n${choices.join(", ")}`,"");
 if(!selected)return;const participants=[creator,...selected.split(",").map(x=>x.trim()).filter(x=>choices.includes(x))],unique=[...new Set(participants)];
 if(unique.length<2){toast("Select at least one other participant.");return}
 const id=`group-${Date.now()}`,groups=loadMessageGroups();groups.push({id,name,participants:unique,createdBy:creator,createdAt:new Date().toISOString()});localStorage.setItem(MESSAGE_GROUPS_KEY,JSON.stringify(groups));
 window.ICUCloud?.createGroup(name,creator,unique.filter(x=>x!==creator),id).catch(error=>toast(error?.message||"Group chat could not be created."));toast("Group chat created.");return groupConversationKey(id)
}
function barberMarketingClients(){
 const barber=activeBarber(),audience=$("#barberMarketingAudience").value,service=$("#barberMarketingService").value,clients=marketingCustomers(audience==="service"?"loyal":audience,barber);
 if(audience!=="service")return clients;
 return clientsForBarber(barber).filter(c=>c.appointments.some(a=>a.barber===barber&&a.serviceIds.includes(service)))
}
function renderBarberMarketing(){
 const barber=activeBarber();$("#barberMarketingTitle").textContent=`${barber}'s Marketing`;
 $("#barberMarketingService").innerHTML=servicesForBarber(barber).map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("");
 const isService=$("#barberMarketingAudience").value==="service";$("#barberMarketingServiceLabel").classList.toggle("hidden",!isService);
 const clients=barberMarketingClients();
 $("#barberMarketingSummary").innerHTML=[["Audience size",clients.length],["With email",clients.filter(c=>c.email).length],["With phone",clients.filter(c=>c.phone).length],["Private clientele only",barber]].map(([l,v])=>`<div class="stat"><span>${l}</span><strong>${v}</strong></div>`).join("");
 $("#barberMarketingList").innerHTML=clients.length?clients.map(c=>`<article class="appointment-card"><div class="date-badge"><small>Client</small><strong>${esc((c.firstName[0]||"")+(c.lastName[0]||""))}</strong></div><div class="appointment-main"><h3>${esc(c.firstName+" "+c.lastName)}</h3><p>${esc(c.email||"No email")} • ${esc(c.phone||"No phone")}</p><p class="help">${c.appointments.filter(a=>a.barber===barber).length} bookings with ${barber}</p></div></article>`).join(""):'<section class="panel"><h2>No matching clients</h2></section>'
}
function baseFaviconPath(){
 const mode=appMode();if(mode==="owner")return"assets/icons/owner.png";if(mode==="customer")return"assets/icons/customer.png";return`assets/icons/${activeBarber().toLowerCase()}.png`
}

function drawFaviconBadge(count){
 const img=new Image();img.onload=()=>{const canvas=document.createElement("canvas");canvas.width=128;canvas.height=128;const ctx=canvas.getContext("2d");ctx.drawImage(img,0,0,128,128);if(count>0){ctx.fillStyle="#d71920";ctx.beginPath();ctx.arc(99,29,28,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#fff";ctx.lineWidth=6;ctx.stroke();ctx.fillStyle="#fff";ctx.font=`bold ${count>9?25:34}px Arial`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(count>99?"99+":String(count),99,31)}let link=document.querySelector('link[rel="icon"]');if(!link){link=document.createElement("link");link.rel="icon";document.head.appendChild(link)}link.type="image/png";link.href=canvas.toDataURL("image/png")};img.src=baseFaviconPath()
}
function categoryLastSeen(barber,category){return Number(localStorage.getItem(`icuLastSeen:${category}:${barber}`)||0)}
function markCategorySeen(barber,category){const ts=Date.now();localStorage.setItem(`icuLastSeen:${category}:${barber}`,String(ts));window.ICUCloud?.markNotificationSeen(category).catch(error=>console.error("Notification read sync failed",error))}
function newAppointmentCount(barber){const last=categoryLastSeen(barber,"appointments");return loadAppointments().filter(a=>a.barber===barber&&new Date(a.createdAt||a.startAt).getTime()>last).length}
function newWalkInCount(barber){const last=categoryLastSeen(barber,"walkins");return loadQueue(WALKIN_KEY).filter(w=>w.barber===barber&&new Date(w.assignedAt||w.createdAt).getTime()>last).length}
function ownerOperationsUnread(){const last=Number(localStorage.getItem("icuLastSeen:operations:Owner")||0);return loadQueue(WALKIN_KEY).filter(w=>new Date(w.createdAt).getTime()>last).length}
function markAllMessagesRead(user){accessibleConversationKeys(user).forEach(key=>markConversationRead(user,key))}
function updateUnifiedNotifications(){
 const mode=appMode();
 if(mode==="individual"){
  const barber=activeBarber(),appointmentCount=newAppointmentCount(barber),walkinCount=newWalkInCount(barber),messageCount=unreadMessageCount(barber),total=appointmentCount+walkinCount+messageCount;
  $("#barberNotificationCount").textContent=total>99?"99+":total;$("#barberNotification").classList.toggle("hidden",total===0);
  $("#barberAppointmentNavBadge").textContent=appointmentCount>99?"99+":appointmentCount;$("#barberAppointmentNavBadge").classList.toggle("hidden",appointmentCount===0);
  $("#barberWalkinNavBadge").textContent=walkinCount>99?"99+":walkinCount;$("#barberWalkinNavBadge").classList.toggle("hidden",walkinCount===0);
  $("#barberMessageNavBadge").textContent=messageCount>99?"99+":messageCount;$("#barberMessageNavBadge").classList.toggle("hidden",messageCount===0);
  drawFaviconBadge(total);document.title=total?`(${total}) ${barber} Barber App | ICU Lookin`:`${barber} Barber App | ICU Lookin`
 }
 if(mode==="owner"){
  const messageCount=unreadMessageCount("Owner"),operationsCount=ownerOperationsUnread(),total=messageCount+operationsCount;
  $("#ownerMessageNavBadge").textContent=messageCount>99?"99+":messageCount;$("#ownerMessageNavBadge").classList.toggle("hidden",messageCount===0);
  $("#ownerOperationsNavBadge").textContent=operationsCount>99?"99+":operationsCount;$("#ownerOperationsNavBadge").classList.toggle("hidden",operationsCount===0);
  drawFaviconBadge(total);document.title=total?`(${total}) ICU Barber Studio Owner App`:"ICU Barber Studio Owner App"
 }
 if(mode==="customer")drawFaviconBadge(0)
}
function updateBarberNotifications(){updateUnifiedNotifications()}
function markBarberSeen(){}
let ownerViewHistory=[];
let customerViewHistory=[];
function currentViewName(){const v=$$(".view").find(x=>!x.classList.contains("hidden"));return v?.id?.replace(/^view-/,"")||""}
function ownerGoBack(){const workspace=ownerWorkspace();while(ownerViewHistory.length){const item=ownerViewHistory.pop();if(item.workspace===workspace&&item.view){showView(item.view,true,true);return}}showView(workspace==="tony"?"barber-dashboard":"owner-dashboard",true,true)}
function customerGoBack(){const prev=customerViewHistory.pop();if(prev){showView(prev,false,true);return}location.href="CLIENT_LAUNCHER.html"}
function showView(name,preserveOwnerContext=false,skipHistory=false){
 const mode=appMode(),ownerContext=isOwnerAppContext(),previous=currentViewName(),target=$("#view-"+name);if(!target)return;
 if(!skipHistory&&previous&&previous!==name){if(ownerContext&&ownerWorkspace()!=="home")ownerViewHistory.push({view:previous,workspace:ownerWorkspace()});else if(mode==="customer")customerViewHistory.push(previous)}
 $$(".view").forEach(v=>v.classList.add("hidden"));target.classList.remove("hidden");
 if(ownerContext){sessionStorage.setItem("icuAppMode","owner");sessionStorage.setItem("icuBarberName","Tony");document.documentElement.setAttribute("data-app-mode","owner");document.body?.setAttribute("data-app-mode","owner");applyOwnerWorkspaceNavigation()}else{document.documentElement.setAttribute("data-app-mode",mode);document.body?.setAttribute("data-app-mode",mode)}
 history.replaceState(null,"",`#${name}`);$$('[data-view-link]').forEach(a=>a.classList.toggle("active",a.dataset.viewLink===name));renderCurrentView(name);window.scrollTo({top:0,behavior:"smooth"})
}
function renderOwnerDashboardEnhancements(){const a=ownerDashboardAlerts(),t=$("#ownerAlertStrip");if(t)t.innerHTML=a.map(x=>`<div class="owner-alert ${x.type}">${esc(x.text)}</div>`).join("")||'<div class="owner-alert notice">No critical owner alerts.</div>'}
function renderOwnerControlCenter(){const s=ownerSettings();$("#settingShopName").value=s.shopName;$("#settingAddress").value=s.address;$("#settingPhone").value=s.phone;$("#settingEmail").value=s.email;const st=currentShopStatus();$("#shopStatusSelect").value=st.status;$("#shopStatusMessage").value=st.message||""}

function barberLinkedHistory(name){
 const counts={
  appointments:loadAppointments().filter(a=>a.barber===name).length,
  walkIns:loadQueue(WALKIN_KEY).filter(w=>w.barber===name).length,
  pos:loadKey(POS_TRANSACTIONS_KEY,[]).filter(t=>t.barber===name).length,
  reviews:loadReviews().filter(r=>r.barber===name).length,
  boothRent:loadKey(BOOTH_RENT_PAYMENTS_KEY,[]).filter(p=>p.barber===name).length,
  diary:loadKey(OWNER_DIARY_KEY,[]).filter(d=>d.person===name).length,
  messages:loadMessages().filter(m=>[m.from,m.to,m.sender,m.recipient].includes(name)).length
 };
 counts.total=Object.values(counts).reduce((s,n)=>s+Number(n||0),0);
 return counts
}
function canPermanentlyDeleteBarber(name){return name!=="Tony"&&barberLinkedHistory(name).total===0}

function renderBarberManagement(){
 const t=$("#barberManagementList");
 t.innerHTML=loadBarberRoster().map(r=>`<article class="performance-card"><div class="performance-head"><div><p class="eyebrow">${r.pendingAuth?"Pending Login":r.active?"Active":"Inactive"}</p><h2>${esc(r.name)}</h2></div><strong>${esc(r.role)}</strong></div><div class="field-grid"><label>License #<input data-roster-license="${r.id}" value="${esc(r.licenseNumber||"")}"></label><label>Expiration<input type="date" data-roster-exp="${r.id}" value="${esc(r.licenseExpiration||"")}"></label><label>Start date<input type="date" data-roster-start="${r.id}" value="${esc(r.startDate||"")}"></label><label>Original Review Group<select data-roster-cohort="${r.id}"><option value="yes" ${r.originalRatingCohort?"selected":""}>Yes</option><option value="no" ${!r.originalRatingCohort?"selected":""}>No</option></select></label></div>${r.pendingAuth?'<p class="help">This barber is saved in Supabase as pending. Create/link the barber Auth account before activating customer booking.</p>':""}<div class="social-card-actions"><button class="button secondary" data-save-roster="${r.id}">Save</button>${r.name!==OWNER_BARBER_NAME&&!r.pendingAuth?`<button class="button ${r.active?"danger":"primary"}" data-toggle-roster="${r.id}">${r.active?"Deactivate":"Reactivate"}</button>`:""}${r.name!==OWNER_BARBER_NAME?`<button class="button danger" data-delete-roster="${r.id}">Delete Barber</button>`:""}</div></article>`).join("")
}

function renderOwnerDiary(){const p=loadBarberRoster();$("#diaryPerson").innerHTML=p.map(r=>`<option>${esc(r.name)}</option>`).join("");if(!$("#diaryDate").value)$("#diaryDate").value=today();if(!$("#diaryTime").value)$("#diaryTime").value=new Date().toTimeString().slice(0,5);const person=$("#diaryPerson").value,cat=$("#diaryCategoryFilter").value,kw=$("#diaryKeyword").value.trim().toLowerCase();let items=loadKey(OWNER_DIARY_KEY,[]).filter(x=>x.person===person);if(cat)items=items.filter(x=>x.category===cat);if(kw)items=items.filter(x=>JSON.stringify(x).toLowerCase().includes(kw));items.sort((a,b)=>new Date(b.eventAt)-new Date(a.eventAt));$("#diaryHistory").innerHTML=items.length?items.map(x=>`<div class="queue-item"><div><strong>${esc(x.subject||x.category)}</strong><span class="help">Event: ${esc(formatDateTime(x.eventAt))} • Entered: ${esc(formatDateTime(x.createdAt))}</span>${x.type==="conversation_snapshot"?`<details><summary>Conversation transcript (${x.transcript.length} messages)</summary>${x.transcript.map(m=>`<div class="message-bubble"><strong>${esc(m.sender)}</strong><p>${esc(m.text)}</p><small>${esc(formatDateTime(m.createdAt))}</small></div>`).join("")}</details>`:`<p>${esc(x.note||"")}</p>`}</div></div>`).join(""):'<p class="help">No diary entries for this person.</p>'}
function renderIncidents(){const items=loadKey(INCIDENTS_KEY,[]).sort((a,b)=>new Date(b.occurredAt)-new Date(a.occurredAt));$("#incidentList").innerHTML=items.length?items.map(x=>`<article class="performance-card"><div class="performance-head"><div><p class="eyebrow">${esc(x.status)}</p><h2>${esc(x.title)}</h2></div><strong>${esc(formatDateTime(x.occurredAt))}</strong></div><p>${esc(x.description)}</p><p class="help">People: ${esc(x.people||"")} • Witnesses: ${esc(x.witnesses||"")}</p><p><strong>Actions:</strong> ${esc(x.actions||"")}</p><button class="button secondary" data-close-incident="${x.id}">Mark Closed</button></article>`).join(""):'<section class="panel"><p>No incident reports.</p></section>'}
function renderInspections(){const r=activeBarberRoster();$("#inspectionRoster").innerHTML=`<table><thead><tr><th>Barber</th><th>License #</th><th>Expiration</th><th>Start Date</th></tr></thead><tbody>${r.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.licenseNumber||"Not entered")}</td><td>${esc(x.licenseExpiration||"Not entered")}</td><td>${esc(x.startDate||"Not entered")}</td></tr>`).join("")}</tbody></table>`;const items=loadKey(INSPECTIONS_KEY,[]).sort((a,b)=>new Date(b.inspectedAt)-new Date(a.inspectedAt));$("#inspectionHistory").innerHTML=items.map(i=>`<article class="performance-card"><div class="performance-head"><div><p class="eyebrow">${esc(i.status)}</p><h2>${esc(i.agency)}</h2></div><strong>${esc(formatDateTime(i.inspectedAt))}</strong></div><p>${esc(i.summary)}</p></article>`).join("")||'<section class="panel"><p>No inspections recorded.</p></section>'}
function renderInspectionIssues(){const items=loadKey(INSPECTION_ISSUES_KEY,[]).sort((a,b)=>(a.status==="Resolved")-(b.status==="Resolved"));$("#inspectionIssueList").innerHTML=items.length?items.map(i=>`<article class="performance-card ${i.status!=="Resolved"?"inspection-open":""}"><div class="performance-head"><div><p class="eyebrow">${esc(i.status)}</p><h2>${esc(i.title)}</h2></div><strong>${esc(i.dueDate||"No due date")}</strong></div><p>${esc(i.description)}</p>${i.status!=="Resolved"?`<label>Corrective action<textarea data-issue-resolution="${i.id}"></textarea></label><button class="button primary" data-resolve-issue="${i.id}">Resolve Issue</button>`:`<p><strong>Resolution:</strong> ${esc(i.resolution||"")}</p>`}</article>`).join(""):'<section class="panel"><p>No inspection issues.</p></section>'}
function checklistDefinitions(){return{Opening:["Unlock/open customer areas","Check restroom condition","Sanitize stations","Verify appointment schedule","Check waiting area"],Closing:["Disinfect stations","Remove trash","Secure equipment","Check restroom","Lock/secure shop"],Sanitation:["Disinfect tools","Clean chairs/work surfaces","Restock sanitation supplies","Sweep/mop as needed","Verify clean capes/towels"]}}
function renderChecklists(){const defs=checklistDefinitions(),saved=loadKey(CHECKLISTS_KEY,[]),date=today();$("#checklistWorkspace").innerHTML=Object.entries(defs).map(([name,tasks])=>`<section class="panel"><h2>${name}</h2>${tasks.map((task,idx)=>{const rec=saved.find(x=>x.date===date&&x.type===name&&x.task===task);return`<label class="checklist-row"><input type="checkbox" data-checklist="${name}|${idx}" ${rec?.completed?"checked":""}><span>${esc(task)}</span>${rec?.completed?`<small>${esc(formatDateTime(rec.completedAt))}</small>`:""}</label>`}).join("")}</section>`).join("")}
function renderDocuments(){
 const items=loadKey(DOCUMENTS_KEY,[]).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
 $("#documentList").innerHTML=items.map(d=>`<article class="performance-card"><div class="performance-head"><div><p class="eyebrow">${esc(d.category||"Document")}</p><h2>${esc(d.name)}</h2></div><strong>${esc(formatDateTime(d.createdAt))}</strong></div><p class="help">${esc(d.note||"")}</p>${d.storagePath?`<p class="help">${d.size?`${Math.max(1,Math.round(d.size/1024))} KB • `:""}Private Supabase Storage</p><div class="social-card-actions"><button class="button secondary" type="button" data-owner-document-download="${esc(d.id)}">Download</button><button class="button danger" type="button" data-owner-document-delete="${esc(d.id)}">Delete</button></div>`:"<p class=\"help\">Legacy metadata record — no cloud file attached.</p>"}</article>`).join("")||'<section class="panel"><p>No documents uploaded yet.</p></section>'
}
function renderAudit(){const items=loadKey(AUDIT_KEY,[]).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,300);$("#auditList").innerHTML=items.map(a=>`<div class="queue-item"><div><strong>${esc(a.action)}</strong><span class="help">${esc(a.actor)} • ${esc(formatDateTime(a.createdAt))}</span><p>${esc(a.details||"")}</p></div></div>`).join("")||'<p class="help">No audit entries.</p>'}
function renderSystemHealth(){$("#systemHealthCards").innerHTML=systemHealth().map(x=>`<article class="performance-card"><div class="performance-head"><h2>${esc(x.name)}</h2><strong>${esc(x.status)}</strong></div><p>${esc(x.detail)}</p></article>`).join("")}
function renderCameras(){const defs=loadKey(CAMERA_CONFIG_KEY,["Front Entrance","Waiting Area","Barber Floor","Camera 4"].map((n,i)=>({id:i+1,name:n,status:"Not Connected"})));$("#cameraGrid").innerHTML=defs.map(c=>`<article class="camera-card"><div class="camera-preview">LIVE FEED PLACEHOLDER</div><div class="camera-card-body"><strong>${esc(c.name)}</strong><span class="status">${esc(c.status)}</span><button class="button secondary" disabled>Full Screen (after integration)</button></div></article>`).join("")}
function renderOwnerGuide(){
 const input=$("#ownerGuideSearch"),q=(input?.value||"").trim().toLowerCase(),items=Object.entries(ownerGuideData()).filter(([k,v])=>!q||(k+" "+v).toLowerCase().includes(q));
 const target=$("#ownerGuideList");if(!target)return;
 target.innerHTML=items.length?items.map(([k,v])=>`<article class="performance-card"><h2>${esc(k)}</h2><p>${esc(v)}</p></article>`).join(""):'<section class="panel"><p>No help topics match that search.</p></section>'
}
function renderGrowth(){
 const clients=customerRecords(),now=Date.now(),inactive=clients.filter(c=>c.last&&now-new Date(c.last).getTime()>60*86400000).length,camps=loadKey(GROWTH_CAMPAIGNS_KEY,[]),refs=loadKey(REFERRALS_KEY,[]),attrs=loadKey(ATTRIBUTION_KEY,[]);
 $("#growthOpportunityCards").innerHTML=[["Known clients",clients.length],["60+ day win-back",inactive],["Campaigns",camps.length],["Referral/QR sources",refs.length]].map(([l,v])=>`<div class="stat"><span>${l}</span><strong>${v}</strong></div>`).join("");
 const opportunities=[
   {title:inactive?`${inactive} clients have not returned in 60+ days`:"No 60+ day win-back list today",action:"View Win-Back Clients"},
   {title:"Create content for open appointment slots",action:"Open Social Content"},
   {title:"Promote new barber portfolios",action:"Review Barber Management"},
   {title:"Track referral and QR source performance",action:"Review Attribution"}
 ];
 $("#growthOpportunities").innerHTML=opportunities.map((x,i)=>`<div class="queue-item growth-opportunity"><div><strong>${esc(x.title)}</strong><span class="help">${esc(x.action)}</span></div></div>`).join("");
 $("#campaignList").innerHTML=camps.length?camps.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).map(c=>`<div class="queue-item"><div><strong>${esc(c.name)}</strong><span class="help">${esc(c.status)} • ${esc(c.startDate||"No start")} → ${esc(c.endDate||"Open-ended")}${c.code?` • Code: ${esc(c.code)}`:""}</span>${c.message?`<p>${esc(c.message)}</p>`:""}</div><button class="button danger" data-delete-campaign="${c.id}" type="button">Delete</button></div>`).join(""):'<p class="help">No campaigns yet.</p>';
 $("#referralSourceList").innerHTML=refs.length?refs.map(r=>`<div class="queue-item"><div><strong>${esc(r.name)}</strong><span class="help">Code: ${esc(r.code)}${r.note?` • ${esc(r.note)}`:""}</span></div><button class="button danger" data-delete-referral="${r.id}" type="button">Delete</button></div>`).join(""):'<p class="help">No sources yet.</p>';
 const grouped={};attrs.forEach(a=>grouped[a.source]=(grouped[a.source]||0)+1);$("#attributionSummary").innerHTML=Object.entries(grouped).length?Object.entries(grouped).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="queue-item"><div><strong>${esc(k)}</strong><span>${v} booking${v===1?"":"s"}</span></div></div>`).join(""):'<p class="help">No attribution data yet.</p>';
 if($("#growthCampaignStart")&&!$("#growthCampaignStart").value)$("#growthCampaignStart").value=today()
}
function renderBusinessReports(){const a=loadAppointments(),pos=loadKey(POS_TRANSACTIONS_KEY,[]),walk=loadQueue(WALKIN_KEY),completed=a.filter(x=>x.status==="Completed"),cancelled=a.filter(x=>x.status==="Cancelled"),lastSecond=a.filter(x=>x.status==="Last Second Cancellation"),noshow=a.filter(x=>x.status==="No Show"),rev=pos.reduce((s,t)=>s+Number(t.amountCollected||0)+Number(t.depositApplied||0),0);$("#businessReportCards").innerHTML=[["Completed",completed.length],["Cancelled",cancelled.length],["Last Second Cancellations",lastSecond.length],["No Shows",noshow.length],["POS Revenue",money(rev)]].map(([l,v])=>`<div class="stat"><span>${l}</span><strong>${v}</strong></div>`).join("");$("#businessReportHighlights").innerHTML=[`Appointments: ${a.length}`,`Walk-ins: ${walk.length}`,`POS transactions: ${pos.length}`,`Deposits: ${loadKey(DEPOSIT_PAYMENTS_KEY,[]).length}`].map(x=>`<div class="queue-item"><div><strong>${esc(x)}</strong></div></div>`).join("")}

function renderPayments(){const date=$("#paymentDate").value,barber=$("#paymentBarber").value;let items=loadAppointments().filter(a=>a.status==="Completed"&&(!date||a.startAt.startsWith(date))&&(!barber||a.barber===barber));const payments=loadKey(PAYMENTS_KEY,{});const totals=items.reduce((sum,a)=>sum+customerTotalForAppointment(a),0),tips=items.reduce((sum,a)=>sum+Number(payments[a.id]?.tip||0),0);$("#paymentCards").innerHTML=[["Transactions",items.length],["Service revenue",money(totals)],["Tips",money(tips)],["Total collected",money(totals+tips)]].map(([l,v])=>`<div class="stat"><span>${l}</span><strong>${v}</strong></div>`).join("");$("#paymentList").innerHTML=items.length?items.map(a=>{const pay=payments[a.id]||{method:"Card",tip:0};return`<article class="appointment-card"><div class="date-badge"><small>Paid</small><strong>$</strong></div><div class="appointment-main"><h3>${esc(a.firstName+" "+a.lastName)}</h3><p>${esc(serviceNames(a.serviceIds))} with ${esc(a.barber)}</p><p class="help">${esc(pay.method)} • Receipt ${a.id.slice(-6)}</p></div><div class="appointment-side"><label>Tip<input data-tip-id="${a.id}" type="number" min="0" step="1" value="${(pay.tip/100).toFixed(2)}"></label><strong>${money(customerTotalForAppointment(a)+pay.tip)}</strong><button class="button secondary" data-receipt-id="${a.id}">Receipt</button></div></article>`}).join(""):'<section class="panel"><h2>No completed transactions</h2></section>'}

async function renderAccountSecurity(){
 const box=$("#securityIdentity"),panel=$("#ownerRecoveryPanel"),list=$("#ownerRecoveryList");
 try{
   const cur=await window.ICUAuth?.current();if(!cur){if(box)box.textContent="Not signed in.";return}
   const role=cur.identity.role==="owner"?"Owner":`Barber — ${cur.identity.display_name||""}`;
   if(box)box.innerHTML=`<strong>${esc(cur.user.email||"Signed-in staff account")}</strong><br><span class="help">${esc(role)} • Supabase Auth</span>`;
   if(panel)panel.classList.toggle("hidden",cur.identity.role!=="owner");
   if(cur.identity.role==="owner"&&list&&window.ICUCloud){
     const {data,error}=await ICUCloud.client.from("barbers").select("id,display_name,is_owner,account_locked,must_change_password,active").order("display_name");
     if(error)throw error;
     list.innerHTML=(data||[]).map(b=>`<div class="queue-item"><div><strong>${esc(b.display_name)}</strong><span class="help">${b.is_owner?"Owner / Barber":"Barber"} • ${b.account_locked?"Locked":"Active"}${b.must_change_password?" • Password change required":""}</span></div><div class="social-card-actions">${!b.is_owner?`<button class="button ${b.account_locked?"primary":"danger"}" type="button" data-recovery-action="${b.account_locked?"unlock":"lock"}" data-recovery-barber="${b.id}">${b.account_locked?"Unlock":"Lock"}</button>`:""}<button class="button secondary" type="button" data-recovery-action="force_password_change" data-recovery-barber="${b.id}">Require Password Change</button></div></div>`).join("");
   }
 }catch(error){if(box)box.textContent=error?.message||"Unable to load account security."}
}
async function changeMyPassword(){
 const current=$("#securityCurrentPassword").value,newPassword=$("#securityNewPassword").value,confirmPassword=$("#securityConfirmPassword").value,status=$("#securityPasswordStatus"),button=$("#securityChangePassword");
 if(!current){status.textContent="Enter your current password.";return}
 if(newPassword.length<8){status.textContent="New password must be at least 8 characters.";return}
 if(newPassword!==confirmPassword){status.textContent="The new passwords do not match.";return}
 button.disabled=true;status.textContent="Updating password…";
 try{await ICUAuth.changePasswordVerified(current,newPassword);$("#securityCurrentPassword").value="";$("#securityNewPassword").value="";$("#securityConfirmPassword").value="";status.textContent="Password changed successfully.";toast("Password changed successfully.")}
 catch(error){status.textContent=error?.message||"Password could not be changed."}
 finally{button.disabled=false}
}

function renderCurrentView(name){
 if(name==="account-security")renderAccountSecurity();
 if(name==="owner-control-center")renderOwnerControlCenter();
 if(name==="owner-barber-management")renderBarberManagement();
 if(name==="owner-diary")renderOwnerDiary();
 if(name==="owner-incidents")renderIncidents();
 if(name==="owner-inspections")renderInspections();
 if(name==="owner-inspection-issues")renderInspectionIssues();
 if(name==="owner-checklists")renderChecklists();
 if(name==="owner-documents")renderDocuments();
 if(name==="owner-audit")renderAudit();
 if(name==="owner-health")renderSystemHealth();
 if(name==="owner-cameras")renderCameras();
 if(name==="owner-guide")renderOwnerGuide();
 if(name==="owner-growth")renderGrowth();
 if(name==="owner-reports")renderBusinessReports();
 if(name==="owner-dashboard"){renderOwnerDashboard();renderOwnerDashboardEnhancements();}
 if(name==="barber-dashboard")renderBarberDashboard();
 if(name==="owner-appointments")renderOwnerAppointments();
 if(name==="owner-pricing")renderOwnerPricing();
 if(name==="owner-revenue")renderOwnerRevenue();
 if(name==="owner-analytics")renderOwnerAnalytics();
 if(name==="owner-performance")renderPerformance();
 if(name==="owner-inventory")renderInventory();
 if(name==="owner-marketing")renderMarketing();
 if(name==="owner-financials")renderFinancials();
 if(name==="owner-locations")renderLocations();
 if(name==="owner-assistant"){}
 if(name==="owner-customers")renderOwnerCustomers();
 if(name==="owner-operations"){renderOperations();localStorage.setItem("icuLastSeen:operations:Owner",String(Date.now()));window.ICUCloud?.markNotificationSeen("operations").catch(error=>console.error("Notification read sync failed",error));updateUnifiedNotifications();}
 if(name==="owner-workforce")renderWorkforce();
 if(name==="owner-booth-rent")renderOwnerBoothRent();
 if(name==="owner-payments")renderPayments();
 if(name==="owner-messages")renderOwnerMessages();
 if(name==="book"){prefillSignedInCustomerBooking();ensureHairScalpPolicyForBooking();}
 if(name==="customer-profile")renderCustomerProfile();
 if(name==="customer-loyalty")renderLoyalty();
 if(name==="customer-gifts"){}
 if(name==="barber-dashboard")renderBarberDashboard();
 if(name==="barber-walkins"){renderBarberWalkIns();if(activeBarber()){markCategorySeen(activeBarber(),"walkins");updateUnifiedNotifications();}}
 if(name==="barber-appointments"){renderIndividualAppointments();if(activeBarber()){markCategorySeen(activeBarber(),"appointments");updateUnifiedNotifications();}}
 if(name==="barber-calendar")renderBarberCalendar();
 if(name==="barber-clientele")renderClientele();
 if(name==="barber-services")renderBarberServices();
 if(name==="barber-prices")renderBarberPricing();
 if(name==="barber-deposits")renderDepositSettings();
 if(name==="barber-revenue")renderBarberRevenue();
 if(name==="barber-analytics")renderBarberAnalytics();
 if(name==="barber-client-tools")renderClientTools();
 if(name==="barber-availability")renderAvailability();
  if(name==="barber-booth-rent")renderBarberBoothRent();
 if(name==="barber-pos")renderPos();
 if(name==="barber-social")renderSocialMedia();
 if(name==="barber-reviews")renderBarberReviews();
 if(name==="barber-client-messages")renderBarberClientMessages();
 if(name==="barber-marketing")renderBarberMarketing();
 if(name==="barber-messages")renderBarberMessages();
}
function configureMode(){
 const mode=appMode(),barber=activeBarber(),hash=(location.hash||"").replace("#","");
 window.__ICU_EARLY_MODE__=mode;document.documentElement.setAttribute("data-app-mode",mode);document.body?.setAttribute("data-app-mode",mode);sessionStorage.setItem("icuAppMode",mode);if(barber)sessionStorage.setItem("icuBarberName",barber);
 const customerNav=$("#customerNav"),ownerNav=$("#ownerNav"),barberNav=$("#barberNav");$("#customerHeader")?.classList.toggle("hidden",mode!=="customer");$("#customerNavigationBar")?.classList.toggle("hidden",mode!=="customer");
 if(mode==="owner"){
   sessionStorage.setItem("icuBarberName","Tony");if(!sessionStorage.getItem(OWNER_WORKSPACE_KEY))sessionStorage.setItem(OWNER_WORKSPACE_KEY,"home");customerNav?.classList.add("hidden");$("#appSubtitle").textContent="OWNER APP";document.title="ICU Barber Studio Owner App";
   const workspace=ownerWorkspace();if(workspace==="management"&&hash.startsWith("owner-")&&$("#view-"+hash))showView(hash,true,true);else if(workspace==="tony"&&hash.startsWith("barber-")&&$("#view-"+hash))showView(hash,true,true);else if(workspace==="tony")showView("barber-dashboard",true,true);else showView("owner-dashboard",true,true);applyOwnerWorkspaceNavigation();updateUnifiedNotifications();return
 }
 if(mode==="individual"){
   customerNav?.classList.add("hidden");ownerNav?.classList.add("hidden");barberNav?.classList.remove("hidden");$("#appSubtitle").textContent=`${barber} Barber App`;document.title=`${barber} Barber App | ICU Lookin`;showView(hash.startsWith("barber-")&&$("#view-"+hash)?hash:"barber-dashboard",false,true);updateBarberNotifications();return
 }
 customerNav?.classList.remove("hidden");ownerNav?.classList.add("hidden");barberNav?.classList.add("hidden");$("#appSubtitle").textContent="Customer Booking App";document.title="ICU Barber Studio Booking";const requested=sessionStorage.getItem("icuCustomerStartView")||(["book","customer-profile","customer-loyalty","customer-gifts"].includes(hash)?hash:"book");sessionStorage.removeItem("icuCustomerStartView");showView(requested,false,true);updateUnifiedNotifications()
}
const OWNER_WORKSPACE_KEY="icuOwnerWorkspaceV1";

function ownerWorkspace(){
 const stored=sessionStorage.getItem(OWNER_WORKSPACE_KEY);if(stored==="home"||stored==="management"||stored==="tony")return stored;
 const q=new URLSearchParams(location.search).get("workspace");if(q==="home"||q==="management"||q==="tony")return q;
 const hash=(location.hash||"").replace("#","");if(hash.startsWith("owner-"))return"management";if(hash.startsWith("barber-"))return"tony";return"home"
}
function setOwnerWorkspace(value){
  sessionStorage.setItem(OWNER_WORKSPACE_KEY,value);
  applyOwnerWorkspaceNavigation();
}
function isOwnerAppContext(){return appMode()==="owner"||sessionStorage.getItem("icuAppMode")==="owner"||document.documentElement.getAttribute("data-app-mode")==="owner"}
function applyOwnerWorkspaceNavigation(){
 if(!isOwnerAppContext())return;const workspace=ownerWorkspace(),ownerNav=document.getElementById("ownerNav"),barberNav=document.getElementById("barberNav"),customerNav=document.getElementById("customerNav"),bar=document.getElementById("ownerWorkspaceBar"),label=document.getElementById("ownerWorkspaceLabel"),subtitle=document.getElementById("appSubtitle");
 customerNav?.classList.add("hidden");sessionStorage.setItem("icuBarberName","Tony");document.documentElement.setAttribute("data-owner-workspace",workspace);document.body?.setAttribute("data-owner-workspace",workspace);
 if(workspace==="management"){ownerNav?.classList.remove("hidden");barberNav?.classList.add("hidden");bar?.classList.remove("hidden");if(label)label.textContent="Owner / Shop Management";if(subtitle)subtitle.textContent="OWNER APP"}
 else if(workspace==="tony"){ownerNav?.classList.add("hidden");barberNav?.classList.remove("hidden");bar?.classList.remove("hidden");if(label)label.textContent="Tony the Barber / My Barber Tools";if(subtitle)subtitle.textContent="OWNER APP • TONY THE BARBER"}
 else{ownerNav?.classList.add("hidden");barberNav?.classList.add("hidden");bar?.classList.add("hidden");if(label)label.textContent="";if(subtitle)subtitle.textContent="OWNER APP"}
}
function openOwnerHome(){ownerViewHistory=[];sessionStorage.setItem("icuAppMode","owner");sessionStorage.setItem("icuBarberName","Tony");setOwnerWorkspace("home");showView("owner-dashboard",true,true)}
function openOwnerManagement(){ownerViewHistory=[];sessionStorage.setItem("icuAppMode","owner");sessionStorage.setItem("icuBarberName","Tony");setOwnerWorkspace("management");showView("owner-dashboard",true,true)}
function openTonyBarberWorkspace(){ownerViewHistory=[];sessionStorage.setItem("icuAppMode","owner");sessionStorage.setItem("icuBarberName","Tony");setOwnerWorkspace("tony");showView("barber-dashboard",true,true)}
async function init(){
 if(window.ICUCloud){const ok=await ICUCloud.bootstrap(appMode());if(ok===false&&["owner","individual"].includes(appMode()))return;if(ok===false)toast("Cloud connection unavailable. Showing cached data.")}
 $("#customerBackButton")?.addEventListener("click",customerGoBack);
 const launcherPhone=localStorage.getItem("icuLauncherPhone");if(launcherPhone){setCustomerSession(launcherPhone);if($("#customerProfileEmail"))$("#customerProfileEmail").value=launcherPhone;localStorage.removeItem("icuLauncherPhone");setTimeout(renderCustomerProfile,0)}const newClientPhone=localStorage.getItem("icuNewClientPhone");if(newClientPhone&&$("#phone")){$("#phone").value=formatPhone(newClientPhone);localStorage.removeItem("icuNewClientPhone")}updateCustomerSessionUi()
 const more=$("#barberMoreButton"),bn=$("#barberNav");if(more)more.onclick=()=>{const open=bn.classList.toggle("mobile-more-open");more.setAttribute("aria-expanded",String(open));};bn?.addEventListener("click",e=>{if(e.target.closest("[data-view-link]")){bn.classList.remove("mobile-more-open");more?.setAttribute("aria-expanded","false");}});const ownerMore=$("#ownerMoreButton"),on=$("#ownerNav");if(ownerMore)ownerMore.onclick=()=>{const open=on.classList.toggle("owner-mobile-more-open");ownerMore.setAttribute("aria-expanded",String(open));};on?.addEventListener("click",e=>{if(e.target.closest("[data-view-link]")){on.classList.remove("owner-mobile-more-open");ownerMore?.setAttribute("aria-expanded","false");}});
 populateBarberSelects();renderCustomerServices();
 const todayValue=today();
 $("#date").min=todayValue;$("#date").value=todayValue;$("#barberWalkinDate").value=todayValue;$("#ownerAppointmentDate").value=todayValue;$("#individualDate").value=todayValue;$("#calendarDate").value=todayValue;$("#ownerRevenueDate").value=todayValue;$("#barberRevenueDate").value=todayValue;$("#ownerAnalyticsDate").value=todayValue;$("#barberAnalyticsDate").value=todayValue;$("#performanceDate").value=todayValue;$("#financialDate").value=todayValue;updateBookingSummary();
 $("#barber").addEventListener("change",()=>{renderCustomerServices();refreshTimes();updateBookingDepositNotice();updateBarberPortfolioPrompt()});$("#date").addEventListener("change",refreshTimes);$("#serviceList").addEventListener("change",event=>{event.target.closest(".service-row")?.classList.toggle("selected",event.target.checked);refreshTimes()});$("#time").addEventListener("change",updateBookingSummary);["firstName","lastName"].forEach(id=>$("#"+id).addEventListener("input",updateBookingSummary));
 $("#reviewButton").addEventListener("click",reviewBooking);$("#editButton").addEventListener("click",()=>$("#reviewPanel").classList.add("hidden"));$("#confirmButton").addEventListener("click",confirmBooking);$("#newBookingButton").addEventListener("click",resetBookingForm);
 $("#brandHome").addEventListener("click",event=>{event.preventDefault();if(isOwnerAppContext())openOwnerHome();else if(appMode()==="individual")showView("barber-dashboard",false,true);else showView("book",false,true)});$("#menuButton").addEventListener("click",()=>{const nav=appMode()==="owner"?$("#ownerNav"):appMode()==="individual"?$("#barberNav"):$("#customerNav");const open=nav.classList.toggle("open");$("#menuButton").setAttribute("aria-expanded",String(open))});
 ["ownerAppointmentBarber","ownerAppointmentDate","ownerAppointmentStatus"].forEach(id=>$("#"+id).addEventListener("change",renderOwnerAppointments));$("#exportButton").addEventListener("click",exportCsv);
 $("#ownerPricingBarber").addEventListener("change",renderOwnerPricing);$("#ownerSavePricing").addEventListener("click",saveOwnerPricing);$("#barberSavePrices").addEventListener("click",saveBarberPricing);$("#addBarberService")?.addEventListener("click",addCustomBarberService);$("#barberServicesList")?.addEventListener("change",e=>{const t=e.target.closest("[data-barber-service-toggle]");if(t)setBarberServiceActive(t.dataset.barberServiceToggle,t.checked)});
 ["ownerRevenueBarber","ownerRevenueRange","ownerRevenueDate"].forEach(id=>$("#"+id).addEventListener("change",renderOwnerRevenue));["barberRevenueRange","barberRevenueDate"].forEach(id=>$("#"+id).addEventListener("change",renderBarberRevenue));
 ["ownerAnalyticsBarber","ownerAnalyticsDate"].forEach(id=>$("#"+id).addEventListener("change",renderOwnerAnalytics));$("#barberAnalyticsDate").addEventListener("change",renderBarberAnalytics);
 ["individualDate","individualStatus"].forEach(id=>$("#"+id).addEventListener("change",renderIndividualAppointments));$("#clienteleSearch").addEventListener("input",renderClientele);$("#calendarDate").addEventListener("change",renderBarberCalendar);$("#calendarPreviousDay").addEventListener("click",()=>shiftCalendar(-1));$("#calendarToday").addEventListener("click",()=>{$("#calendarDate").value=today();renderBarberCalendar()});$("#calendarNextDay").addEventListener("click",()=>shiftCalendar(1));
 document.addEventListener("change",event=>{if(event.target.matches("[data-status-id]"))updateAppointmentStatus(event.target.dataset.statusId,event.target.value);if(event.target.matches("[data-barber-walkin-status]")){const items=loadQueue(WALKIN_KEY),w=items.find(x=>x.id===event.target.dataset.barberWalkinStatus);if(w){w.status=event.target.value;saveQueue(WALKIN_KEY,items);renderBarberWalkIns();updateUnifiedNotifications()}}});
 $$("[data-owner-jump]").forEach(button=>button.addEventListener("click",()=>showView(button.dataset.ownerJump,isOwnerAppContext())));
 $("#performanceRange").addEventListener("change",renderPerformance);$("#performanceDate").addEventListener("change",renderPerformance);
 $("#inventorySearch").addEventListener("input",renderInventory);$("#inventoryFilter").addEventListener("change",renderInventory);
 $("#addInventoryButton").addEventListener("click",()=>{const name=prompt("Inventory item name:");if(!name)return;const items=loadInventory();items.push({id:`item-${Date.now()}`,name,category:"Supplies",quantity:0,minimum:1,cost:0});saveInventory(items);renderInventory()});
 document.addEventListener("click",event=>{const button=event.target.closest("[data-inventory-adjust]");if(!button)return;const card=button.closest("[data-item-id]"),items=loadInventory(),item=items.find(i=>i.id===card.dataset.itemId);if(item){item.quantity=Math.max(0,item.quantity+Number(button.dataset.inventoryAdjust));saveInventory(items);renderInventory()}});
 ["marketingAudience","marketingBarber"].forEach(id=>$("#"+id).addEventListener("change",renderMarketing));
 $("#previewCampaignButton").addEventListener("click",()=>{const clients=marketingCustomers($("#marketingAudience").value,$("#marketingBarber").value);$("#campaignPreview").classList.remove("hidden");$("#campaignPreview").innerHTML=`<strong>${esc($("#campaignName").value)} — ${clients.length} recipients</strong><p>${esc($("#campaignMessage").value)} ${esc($("#campaignOffer").value)}</p>`});
 $("#financialRange").addEventListener("change",renderFinancials);$("#financialDate").addEventListener("change",renderFinancials);
 $("#addExpenseButton").addEventListener("click",()=>{const name=prompt("Expense name:");if(!name)return;const amount=Number(prompt("Monthly amount:", "0")||0),items=loadExpenses();items.push({id:`expense-${Date.now()}`,name,amount});saveExpenses(items);renderFinancials()});
 $("#addLocationButton").addEventListener("click",()=>{const name=prompt("Future location name:");if(!name)return;const items=loadLocations();items.push({id:`location-${Date.now()}`,name,status:"Future",revenue:0,customers:0,barbers:0});saveLocations(items);renderLocations()});
 $("#assistantAskButton").addEventListener("click",()=>askAssistant($("#assistantQuestion").value));$("#assistantQuestion").addEventListener("keydown",event=>{if(event.key==="Enter")askAssistant($("#assistantQuestion").value)});$$("[data-question]").forEach(button=>button.addEventListener("click",()=>askAssistant(button.dataset.question)));
 $("#customerProfileEmail").value="";$("#loyaltyEmail").value="";$("#paymentDate").value=today();BARBERS.forEach(b=>$("#paymentBarber").append(new Option(b,b)));
 $("#loadCustomerProfile").addEventListener("click",async()=>{const value=$("#customerProfileEmail").value.trim(),phone=normalizePhone(value);if(phone.length===10&&window.ICUCloud){try{const cloudAppointments=await ICUCloud.customerLookup(phone);if(Array.isArray(cloudAppointments)&&cloudAppointments.length){const blocked=loadAppointments().filter(a=>!normalizePhone(a.phone)&&!a.email),merged=[...blocked];cloudAppointments.forEach(a=>{if(!merged.some(x=>x.id===a.id))merged.push(a)});localStorage.setItem(APPOINTMENTS_KEY,JSON.stringify(merged));setCustomerSession(phone)}}catch(error){toast(error?.message||"Profile lookup failed.")}}renderCustomerProfile()});$("#customerProfileEmail").addEventListener("input",e=>{if(/^\D*\d/.test(e.target.value)&&!e.target.value.includes("@"))applyPhoneMask(e.target)});$("#loadLoyalty").addEventListener("click",renderLoyalty);$("#customerSignOutButton")?.addEventListener("click",()=>{clearCustomerSession();location.href="CLIENT_LAUNCHER.html"});$("#customerExitButton")?.addEventListener("click",()=>clearCustomerSession());$("#createGiftCard").addEventListener("click",createGiftCard);$("#checkGiftCard").addEventListener("click",checkGiftCard);
 ["ownerCustomerSearch","ownerCustomerSegment"].forEach(id=>$("#"+id).addEventListener(id==="ownerCustomerSearch"?"input":"change",renderOwnerCustomers));
 $("#addWalkin").addEventListener("click",()=>{const item=createWalkInFromPrompts("");if(!item)return;const items=loadQueue(WALKIN_KEY);items.push(item);saveQueue(WALKIN_KEY,items);renderOperations();updateUnifiedNotifications()});
 $("#barberAddWalkin").addEventListener("click",()=>{const item=createWalkInFromPrompts(activeBarber());if(!item)return;const items=loadQueue(WALKIN_KEY);items.push(item);saveQueue(WALKIN_KEY,items);renderBarberWalkIns();updateUnifiedNotifications()});
 ["barberWalkinDate","barberWalkinStatus"].forEach(id=>$("#"+id).addEventListener("change",renderBarberWalkIns));
 $("#addWaitlist").addEventListener("click",()=>{const name=prompt("Customer name:");if(!name)return;const phone=prompt("Phone number:","")||"",date=prompt("Preferred date (optional):","")||"";const items=loadQueue(WAITLIST_KEY);items.push({id:`wait-${Date.now()}`,name,phone,date});saveQueue(WAITLIST_KEY,items);renderOperations()});
 $("#addMaintenance").addEventListener("click",()=>{const item=prompt("Equipment or issue:");if(!item)return;const note=prompt("Description:","")||"";const items=loadQueue(MAINTENANCE_KEY);items.push({id:`maint-${Date.now()}`,item,note,status:"Open"});saveQueue(MAINTENANCE_KEY,items);renderOperations()});
 $("#saveAnnouncement").addEventListener("click",()=>{saveKey(ANNOUNCEMENT_KEY,$("#shopAnnouncement").value);renderOperations();toast("Announcement published.")});
 document.addEventListener("click",e=>{let b=e.target.closest("[data-walkin-status]");if(b){const[id,status]=b.dataset.walkinStatus.split(":");const items=loadQueue(WALKIN_KEY),x=items.find(v=>v.id===id);if(x)x.status=status;saveQueue(WALKIN_KEY,items);renderOperations()}b=e.target.closest("[data-remove-wait]");if(b){saveQueue(WAITLIST_KEY,loadQueue(WAITLIST_KEY).filter(x=>x.id!==b.dataset.removeWait));renderOperations()}b=e.target.closest("[data-resolve-maint]");if(b){const items=loadQueue(MAINTENANCE_KEY),x=items.find(v=>v.id===b.dataset.resolveMaint);if(x)x.status="Resolved";saveQueue(MAINTENANCE_KEY,items);renderOperations()}b=e.target.closest("[data-timeoff-remove]");if(b){saveKey(TIMEOFF_KEY,loadKey(TIMEOFF_KEY,[]).filter(x=>x.id!==b.dataset.timeoffRemove));renderTimeOff()}b=e.target.closest("[data-receipt-id]");if(b)alert(`Receipt ${b.dataset.receiptId.slice(-6)}\\nICU Barber Studio\\nThank you for your business.`)});
 $("#exportPayroll").addEventListener("click",()=>{
 const rows=[["Barber","Role","Schedule","Booth Rent","Gross Revenue"]];
 loadWorkforce().forEach(w=>rows.push([
   w.name,
   w.name==="Tony"?"Owner":w.role,
   w.schedule,
   w.name==="Tony"?"N/A":Number(w.boothRent||0).toFixed(2),
   (workforceRevenue(w.name)/100).toFixed(2)
 ]));
 const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\\n");
 const url=URL.createObjectURL(new Blob([csv],{type:"text/csv"})),a=document.createElement("a");
 a.href=url;a.download="ICU_Workforce.csv";a.click();URL.revokeObjectURL(url)
});
 ["paymentDate","paymentBarber"].forEach(id=>$("#"+id).addEventListener("change",renderPayments));document.addEventListener("change",e=>{if(e.target.matches("[data-tip-id]")){const all=loadKey(PAYMENTS_KEY,{});all[e.target.dataset.tipId]=all[e.target.dataset.tipId]||{method:"Card"};all[e.target.dataset.tipId].tip=Math.round(Number(e.target.value||0)*100);saveKey(PAYMENTS_KEY,all);renderPayments()}});
 $("#clientToolsSearch").addEventListener("input",renderClientTools);$("#saveAvailability").addEventListener("click",()=>{try{saveAvailabilityData()}catch(error){}});$("#availabilityPreviousWeek").addEventListener("click",()=>moveAvailabilityWeek(-1));$("#availabilityCurrentWeek").addEventListener("click",()=>{availabilityWeekStart=mondayForDate(today());renderAvailability()});$("#availabilityNextWeek").addEventListener("click",()=>moveAvailabilityWeek(1));$("#addTimeOff").addEventListener("click",()=>{const start=$("#timeOffStart").value,end=$("#timeOffEnd").value,reason=$("#timeOffReason").value;if(!start||!end){toast("Select start and end dates.");return}const items=loadKey(TIMEOFF_KEY,[]);items.push({id:`off-${Date.now()}`,barber:activeBarber(),start,end,reason});saveKey(TIMEOFF_KEY,items);renderTimeOff()})


 $("#payBoothRent").addEventListener("click",()=>{const barber=activeBarber(),amount=Math.max(0,Math.round(Number($("#boothRentPayAmount").value||0)*100));if(!amount){toast("Enter a payment amount.");return}recordBoothRentPayment(barber,amount,$("#boothRentPayMethod").value,"Barber App");renderBarberBoothRent();toast("Booth-rent payment recorded.")});
 document.addEventListener("click",e=>{const b=e.target.closest("[data-owner-rent-record]");if(!b)return;const barber=b.dataset.ownerRentRecord,summary=boothRentSummary(barber),amount=Math.max(0,Math.round(Number(prompt(`Amount received from ${barber}:`,(summary.balance/100).toFixed(2))||0)*100));if(!amount)return;const method=prompt("Payment method (Cash, Zelle, Cash App, Venmo, Bank Transfer, Other):","Cash")||"Cash",note=prompt("Optional note/reference:","")||"";recordBoothRentPayment(barber,amount,method,"Owner",note);renderOwnerBoothRent();toast("Outside payment recorded by Owner.")});

 $("#posSource").addEventListener("change",renderPosTransaction);$("#posTip").addEventListener("input",updatePosSummary);$("#posHairScalpFee")?.addEventListener("change",updatePosSummary);$("#posServiceList").addEventListener("change",updatePosSummary);$("#posQuickPhone").addEventListener("input",e=>applyPhoneMask(e.target));$("#completePosSale").addEventListener("click",completePosTransaction);
 document.addEventListener("click",e=>{const b=e.target.closest("[data-pos-receipt]");if(!b)return;const t=loadKey(POS_TRANSACTIONS_KEY,[]).find(x=>x.id===b.dataset.posReceipt);if(t)alert(`ICU Barber Studio\\nReceipt ${t.id.slice(-8)}\\n${t.customer}\\n${serviceNames(t.serviceIds)}\\nCollected: ${money(t.amountCollected)}\\nTip: ${money(t.tip)}\\nMethod: ${t.method}`)});

 $("#socialCaptureInput").addEventListener("change",async e=>{if(e.target.files?.length)await saveSocialFiles(e.target.files);e.target.value=""});$("#socialUploadInput").addEventListener("change",async e=>{if(e.target.files?.length)await saveSocialFiles(e.target.files);e.target.value=""});["socialPlatformFilter","socialTypeFilter"].forEach(id=>$("#"+id).addEventListener("change",renderSocialMedia));
 document.addEventListener("click",async e=>{let b=e.target.closest("[data-social-preview]");if(b){await openSocialPostPreview(b.dataset.socialPreview);return}b=e.target.closest("[data-social-edit]");if(b){await openSocialImageEditor(b.dataset.socialEdit);return}b=e.target.closest("[data-social-save]");if(b){const card=b.closest("[data-media-id]");const consent=card.querySelector(".social-portfolio-consent").checked,visible=card.querySelector(".social-portfolio-visible").checked;if(visible&&!consent){toast("Confirm photo/video consent before showing this item to clients.");return}await updateSocialItem(b.dataset.socialSave,{name:card.querySelector(".social-title").value,platform:card.querySelector(".social-platform").value,caption:card.querySelector(".social-caption").value,hashtags:card.querySelector(".social-hashtags").value,consentConfirmed:consent,portfolioVisible:visible,portfolioTitle:card.querySelector(".social-portfolio-title").value,portfolioCategory:card.querySelector(".social-portfolio-category").value,portfolioFeatured:card.querySelector(".social-portfolio-featured").checked,portfolioSort:Number(card.querySelector(".social-portfolio-sort").value||0)});toast(visible?"Media details saved and client portfolio updated.":"Media details saved.");await renderSocialMedia();return}b=e.target.closest("[data-social-delete]");if(b){if(confirm("Delete this media item from your private content library?"))await deleteSocialItem(b.dataset.socialDelete);return}b=e.target.closest("[data-social-download]");if(b){const item=await socialItemById(b.dataset.socialDownload);if(item){const url=URL.createObjectURL(item.blob),a=document.createElement("a");a.href=url;a.download=item.name||"ICU-media";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}return}b=e.target.closest("[data-social-copy]");if(b){const item=await socialItemById(b.dataset.socialCopy);if(item){await navigator.clipboard.writeText([item.caption,item.hashtags].filter(Boolean).join("\\n"));toast("Caption copied.")}}});

 $("#closeSocialEditor").addEventListener("click",()=>$("#socialImageEditor").close());
 $("#closeSocialPostPreview").addEventListener("click",closeSocialPostPreview);
 $("#socialPostPreview").addEventListener("close",()=>{if(socialPostPreviewState.url){URL.revokeObjectURL(socialPostPreviewState.url);socialPostPreviewState.url=null}socialPostPreviewState.item=null});
 ["postPreviewRatio","postPreviewFit","postPreviewText","postPreviewFont","postPreviewFontSize","postPreviewColor","postPreviewBold","postPreviewItalic","postPreviewUnderline","postPreviewShadow","postPreviewHighlight","postPreviewAlign","postPreviewPosition","postPreviewHighlightColor","postPreviewHighlightOpacity","postPreviewCaptionInput","postPreviewHashtagsInput"].forEach(id=>$("#"+id).addEventListener(["postPreviewText","postPreviewFontSize","postPreviewColor","postPreviewHighlightColor","postPreviewHighlightOpacity","postPreviewCaptionInput","postPreviewHashtagsInput"].includes(id)?"input":"change",syncSocialPostPreview));
 $("#postPreviewPlatform").addEventListener("change",()=>{$("#postPreviewRatio").value=postPreviewRatioForPlatform($("#postPreviewPlatform").value);syncSocialPostPreview()});
 $("#savePostPreviewDetails").addEventListener("click",async()=>{const item=socialPostPreviewState.item;if(!item)return;await updateSocialItem(item.id,{platform:$("#postPreviewPlatform").value,caption:$("#postPreviewCaptionInput").value,hashtags:$("#postPreviewHashtagsInput").value});item.platform=$("#postPreviewPlatform").value;item.caption=$("#postPreviewCaptionInput").value;item.hashtags=$("#postPreviewHashtagsInput").value;toast("Post details saved to Supabase.");await renderSocialMedia()});
 $("#postPreviewOpenImageEditor").addEventListener("click",async()=>{const id=socialPostPreviewState.item?.id;if(!id)return;closeSocialPostPreview();await openSocialImageEditor(id)});
 $("#addTextLayer").addEventListener("click",()=>{const layer=defaultTextLayer("New Text");layer.y=220+socialEditorState.layers.length*80;socialEditorState.layers.push(layer);socialEditorState.selectedId=layer.id;renderTextLayerList();renderSocialEditorCanvas()});
 $("#textLayerList").addEventListener("click",e=>{const b=e.target.closest("[data-editor-layer]");if(!b)return;socialEditorState.selectedId=b.dataset.editorLayer;renderTextLayerList();renderSocialEditorCanvas()});
 ["overlayText","overlayFont","overlayFontSize","overlayColor","overlayBold","overlayItalic","overlayUnderline","overlayShadow","overlayHighlight","overlayAlign","overlayHighlightColor","overlayHighlightOpacity"].forEach(id=>$("#"+id).addEventListener(id==="overlayText"||id==="overlayFontSize"||id==="overlayColor"||id==="overlayHighlightColor"||id==="overlayHighlightOpacity"?"input":"change",syncSelectedLayerFromControls));
 $("#duplicateTextLayer").addEventListener("click",()=>{const layer=selectedTextLayer();if(!layer)return;const copy={...layer,id:`layer-${Date.now()}`,x:layer.x+40,y:layer.y+40};socialEditorState.layers.push(copy);socialEditorState.selectedId=copy.id;renderTextLayerList();renderSocialEditorCanvas()});
 $("#deleteTextLayer").addEventListener("click",()=>{if(!socialEditorState.selectedId)return;socialEditorState.layers=socialEditorState.layers.filter(l=>l.id!==socialEditorState.selectedId);socialEditorState.selectedId=socialEditorState.layers.at(-1)?.id||null;renderTextLayerList();renderSocialEditorCanvas()});
 $("#bringTextForward").addEventListener("click",()=>{const i=socialEditorState.layers.findIndex(l=>l.id===socialEditorState.selectedId);if(i<0||i===socialEditorState.layers.length-1)return;[socialEditorState.layers[i],socialEditorState.layers[i+1]]=[socialEditorState.layers[i+1],socialEditorState.layers[i]];renderTextLayerList();renderSocialEditorCanvas()});
 $("#sendTextBackward").addEventListener("click",()=>{const i=socialEditorState.layers.findIndex(l=>l.id===socialEditorState.selectedId);if(i<=0)return;[socialEditorState.layers[i],socialEditorState.layers[i-1]]=[socialEditorState.layers[i-1],socialEditorState.layers[i]];renderTextLayerList();renderSocialEditorCanvas()});
 $("#exportSocialImage").addEventListener("click",exportEditedSocialImage);
 $("#socialEditorCanvas").addEventListener("pointerdown",e=>{const p=canvasPointerPosition(e),layer=layerHitTest(p.x,p.y);if(!layer)return;socialEditorState.selectedId=layer.id;socialEditorState.dragging=true;socialEditorState.dragOffsetX=p.x-layer.x;socialEditorState.dragOffsetY=p.y-layer.y;$("#socialEditorCanvas").setPointerCapture(e.pointerId);renderTextLayerList();renderSocialEditorCanvas()});
 $("#socialEditorCanvas").addEventListener("pointermove",e=>{if(!socialEditorState.dragging)return;const p=canvasPointerPosition(e),layer=selectedTextLayer();if(!layer)return;layer.x=p.x-socialEditorState.dragOffsetX;layer.y=p.y-socialEditorState.dragOffsetY;renderSocialEditorCanvas()});
 ["pointerup","pointercancel"].forEach(type=>$("#socialEditorCanvas").addEventListener(type,()=>{socialEditorState.dragging=false}));
 $("#barberConversationList").addEventListener("click",e=>{const b=e.target.closest("[data-conversation-key]");if(!b)return;selectedBarberConversation=b.dataset.conversationKey;renderBarberMessages()});
 $("#ownerConversationList").addEventListener("click",e=>{const b=e.target.closest("[data-conversation-key]");if(!b)return;selectedOwnerConversation=b.dataset.conversationKey;renderOwnerMessages()});
 $("#barberSendMessage").addEventListener("click",()=>{sendMessage(activeBarber(),selectedBarberConversation,$("#barberMessageText").value);$("#barberMessageText").value="";renderBarberMessages()});
 $("#ownerSendMessage").addEventListener("click",()=>{sendMessage("Owner",selectedOwnerConversation,$("#ownerMessageText").value);$("#ownerMessageText").value="";renderOwnerMessages()});
 $("#barberNewGroup").addEventListener("click",()=>{const key=createGroupChat(activeBarber());if(key){selectedBarberConversation=key;renderBarberMessages()}});
 $("#ownerNewGroup").addEventListener("click",()=>{const key=createGroupChat("Owner");if(key){selectedOwnerConversation=key;renderOwnerMessages()}});
 ["barberMarketingAudience","barberMarketingService"].forEach(id=>$("#"+id).addEventListener("change",renderBarberMarketing));
 $("#barberPreviewCampaign").addEventListener("click",()=>{const clients=barberMarketingClients();$("#barberCampaignPreview").classList.remove("hidden");$("#barberCampaignPreview").innerHTML=`<strong>${esc($("#barberCampaignName").value)} — ${clients.length} recipients</strong><p>${esc($("#barberCampaignMessage").value)} ${esc($("#barberCampaignOffer").value)}</p>`});
 window.addEventListener("icuMessagesChanged",()=>{updateUnifiedNotifications();if(appMode()==="individual"&&!$("#view-barber-messages").classList.contains("hidden"))renderBarberMessages();if(appMode()==="owner"&&!$("#view-owner-messages").classList.contains("hidden"))renderOwnerMessages()});
 window.addEventListener("storage",e=>{if([APPOINTMENTS_KEY,WALKIN_KEY,MESSAGES_KEY,MESSAGE_GROUPS_KEY,MESSAGE_READ_KEY].includes(e.key))updateUnifiedNotifications()});
 $("#ownerDocumentUpload")?.addEventListener("change",async e=>{const files=e.target.files;if(!files?.length)return;try{const uploaded=await ICUCloud.uploadOwnerDocuments(files),items=loadKey(DOCUMENTS_KEY,[]);items.push(...uploaded);saveKey(DOCUMENTS_KEY,items);renderDocuments();audit("Documents uploaded",uploaded.map(x=>x.name).join(", "));toast(`${uploaded.length} document${uploaded.length===1?"":"s"} uploaded to Supabase.`)}catch(error){toast(error?.message||"Document upload failed.")}finally{e.target.value=""}});
 $("#openBarberPortfolio")?.addEventListener("click",openBarberPortfolio);$("#closeBarberPortfolio")?.addEventListener("click",()=>$("#barberPortfolioDialog")?.close());$("#closePortfolioViewer")?.addEventListener("click",()=>$("#barberPortfolioViewer")?.close());$("#barberPortfolioGrid")?.addEventListener("click",async e=>{const b=e.target.closest("[data-portfolio-item]");if(!b)return;const barber=$("#barber")?.value,items=await loadClientPortfolio(barber);openPortfolioViewer(items.find(x=>String(x.id)===String(b.dataset.portfolioItem)))});
 $("#agreeHairScalpPolicy")?.addEventListener("click",agreeHairScalpPolicy);$("#securityChangePassword")?.addEventListener("click",changeMyPassword);$("#barberSignOutButton")?.addEventListener("click",async()=>{if(window.ICUAuth)await ICUAuth.signOut();location.href=appMode()==="owner"?"OWNER_LAUNCHER.html":"BARBER_LAUNCHER.html"});$("#ownerSignOutButton")?.addEventListener("click",async()=>{if(window.ICUAuth)await ICUAuth.signOut();location.href="OWNER_LAUNCHER.html"});
 configureMode();
}
document.addEventListener("input",e=>{if(e.target.matches('input[type="tel"]'))applyPhoneMask(e.target)});

document.addEventListener("click",e=>{const d=e.target.closest("[data-directions]");if(d){window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(SHOP.address)}`,"_blank","noopener");return}const r=e.target.closest("[data-review-respond]");if(r){const all=loadReviews(),x=all.find(v=>v.id===r.dataset.reviewRespond),t=document.querySelector(`[data-review-response="${x.id}"]`);if(t&&t.value.trim()){x.response=t.value.trim();saveReviews(all);renderBarberReviews()}return}const s=e.target.closest("[data-bcm-send]");if(s){const i=document.querySelector(`[data-bcm-input="${s.dataset.bcmSend}"]`);if(i&&i.value.trim()){sendAppointmentMessage(s.dataset.bcmSend,activeBarber(),i.value);renderBarberClientMessages()}return}});
document.addEventListener("click",async e=>{
 const download=e.target.closest("[data-owner-document-download]"),del=e.target.closest("[data-owner-document-delete]");if(!download&&!del)return;
 const id=(download||del).dataset.ownerDocumentDownload||(download||del).dataset.ownerDocumentDelete,items=loadKey(DOCUMENTS_KEY,[]),doc=items.find(x=>x.id===id);if(!doc||!doc.storagePath)return;
 try{
   if(download){await ICUCloud.downloadOwnerDocument(doc.storagePath,doc.originalName||doc.name);return}
   if(del&&confirm(`Delete ${doc.name} from the private Document Center?`)){await ICUCloud.deleteOwnerDocument(doc.storagePath);saveKey(DOCUMENTS_KEY,items.filter(x=>x.id!==id));renderDocuments();audit("Document deleted",doc.name);toast("Document deleted.")}
 }catch(error){toast(error?.message||"Document action failed.")}
});
document.addEventListener("DOMContentLoaded",init);


/* ============================================================
   BARBER MANAGEMENT — SUPABASE-BACKED ACTIONS
   ============================================================ */
document.addEventListener("click", async function(event){
  const addButton=event.target.closest("#addBarberBtn");
  if(addButton){
    const name=(prompt("New barber name:")||"").trim();if(!name)return;
    const items=loadBarberRoster();
    if(items.some(item=>item.name.toLowerCase()===name.toLowerCase())){toast("That barber is already in Barber Management.");return}
    const startDate=prompt("Starting date (YYYY-MM-DD):",today())||today();
    const licenseNumber=(prompt("Barber license number (optional for now):","")||"").trim();
    const licenseExpiration=prompt("License expiration date (YYYY-MM-DD, optional):","")||"";
    try{
      const result=await ICUCloud.ownerManageBarber("create_pending",{display_name:name,start_date:startDate,license_number:licenseNumber,license_expires_on:licenseExpiration||null});
      items.push({id:`barber-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,cloudBarberId:result.barber?.id||"",name,active:false,pendingAuth:true,originalRatingCohort:false,newBarber:true,startDate,licenseNumber,licenseExpiration,role:"Barber",createdAt:new Date().toISOString()});
      saveBarberRoster(items);audit("New barber added",`${name} added as a pending Supabase barber.`);renderBarberManagement();toast(`${name} was added. A login must be linked before activation.`)
    }catch(error){toast(error?.message||"Barber could not be added.")}
    return
  }

  const saveButton=event.target.closest("[data-save-roster]");
  if(saveButton){
    const id=saveButton.dataset.saveRoster,items=loadBarberRoster(),barber=items.find(item=>item.id===id);if(!barber)return;
    const license=document.querySelector(`[data-roster-license="${id}"]`),expiration=document.querySelector(`[data-roster-exp="${id}"]`),startInput=document.querySelector(`[data-roster-start="${id}"]`),cohort=document.querySelector(`[data-roster-cohort="${id}"]`);
    const next={licenseNumber:license?license.value.trim():barber.licenseNumber,licenseExpiration:expiration?expiration.value:barber.licenseExpiration,startDate:startInput?startInput.value:barber.startDate,originalRatingCohort:cohort?cohort.value==="yes":barber.originalRatingCohort};
    try{
      await ICUCloud.ownerManageBarber("update_record",{barber_id:barber.cloudBarberId||undefined,display_name:barber.name,start_date:next.startDate||null,license_number:next.licenseNumber||"",license_expires_on:next.licenseExpiration||null});
      Object.assign(barber,next);saveBarberRoster(items);audit("Barber record updated",`${barber.name}'s Barber Management record was updated.`);renderBarberManagement();toast(`${barber.name}'s record was saved.`)
    }catch(error){toast(error?.message||"Barber record could not be saved.")}
    return
  }

  const toggleButton=event.target.closest("[data-toggle-roster]");
  if(toggleButton){
    const id=toggleButton.dataset.toggleRoster,items=loadBarberRoster(),barber=items.find(item=>item.id===id);if(!barber)return;
    const action=barber.active?"deactivate":"reactivate";
    if(!confirm(`${action==="deactivate"?"Deactivate":"Reactivate"} ${barber.name}?`))return;
    try{
      await ICUCloud.ownerManageBarber(action,{barber_id:barber.cloudBarberId||undefined,display_name:barber.name});
      barber.active=!barber.active;barber.deactivatedAt=barber.active?null:new Date().toISOString();saveBarberRoster(items);audit(barber.active?"Barber reactivated":"Barber deactivated",barber.name);await ICUCloud.refreshStaff();renderBarberManagement();toast(`${barber.name} is now ${barber.active?"active":"inactive"}.`)
    }catch(error){toast(error?.message||"Barber status could not be changed.")}
    return
  }

  const deleteButton=event.target.closest("[data-delete-roster]");
  if(deleteButton){
    const items=loadBarberRoster(),barber=items.find(x=>x.id===deleteButton.dataset.deleteRoster);if(!barber)return;
    const history=barberLinkedHistory(barber.name);
    if(history.total>0){alert(`${barber.name} cannot be permanently deleted because linked business history exists.\n\nAppointments: ${history.appointments}\nWalk-ins: ${history.walkIns}\nPOS: ${history.pos}\nReviews: ${history.reviews}\nBooth rent: ${history.boothRent}\nOwner Diary: ${history.diary}\nMessages: ${history.messages}\n\nUse Deactivate instead.`);return}
    if(!confirm(`Permanently delete ${barber.name}? This is intended only for mistaken or pending additions with no business history.`))return;
    try{
      await ICUCloud.ownerManageBarber("delete_pending",{barber_id:barber.cloudBarberId||undefined,display_name:barber.name});
      saveBarberRoster(items.filter(x=>x.id!==barber.id));audit("Barber permanently deleted",barber.name);renderBarberManagement();toast(`${barber.name} was deleted.`)
    }catch(error){toast(error?.message||"This barber cannot be permanently deleted. Use Deactivate instead.")}
  }
});

document.addEventListener("input",event=>{
 if(event.target?.id==="ownerGuideSearch")renderOwnerGuide()
});


document.addEventListener("click",event=>{
 const saveCampaign=event.target.closest("#saveGrowthCampaign");
 if(saveCampaign){
   const name=$("#growthCampaignName").value.trim();if(!name){toast("Enter a campaign name.");$("#growthCampaignName").focus();return}
   const items=loadKey(GROWTH_CAMPAIGNS_KEY,[]);items.push({
     id:`campaign-${Date.now()}`,name,startDate:$("#growthCampaignStart").value||today(),endDate:$("#growthCampaignEnd").value,
     status:$("#growthCampaignStatus").value,message:$("#growthCampaignMessage").value.trim(),code:$("#growthCampaignCode").value.trim().toUpperCase(),createdAt:new Date().toISOString()
   });saveKey(GROWTH_CAMPAIGNS_KEY,items);if(typeof audit==="function")audit("Growth campaign created",name);
   ["growthCampaignName","growthCampaignEnd","growthCampaignMessage","growthCampaignCode"].forEach(id=>$("#"+id).value="");renderGrowth();toast("Campaign saved.");return
 }
 const saveReferral=event.target.closest("#saveReferralSource");
 if(saveReferral){
   const name=$("#growthReferralName").value.trim();if(!name){toast("Enter a source name.");$("#growthReferralName").focus();return}
   const items=loadKey(REFERRALS_KEY,[]);items.push({id:`ref-${Date.now()}`,name,note:$("#growthReferralNote").value.trim(),code:`ICU-${Math.random().toString(36).slice(2,8).toUpperCase()}`,createdAt:new Date().toISOString()});saveKey(REFERRALS_KEY,items);if(typeof audit==="function")audit("Referral/QR source created",name);$("#growthReferralName").value="";$("#growthReferralNote").value="";renderGrowth();toast("Referral source added.");return
 }
 const delCampaign=event.target.closest("[data-delete-campaign]");
 if(delCampaign&&confirm("Delete this campaign?")){saveKey(GROWTH_CAMPAIGNS_KEY,loadKey(GROWTH_CAMPAIGNS_KEY,[]).filter(c=>c.id!==delCampaign.dataset.deleteCampaign));renderGrowth();return}
 const delReferral=event.target.closest("[data-delete-referral]");
 if(delReferral&&confirm("Delete this referral source?")){saveKey(REFERRALS_KEY,loadKey(REFERRALS_KEY,[]).filter(r=>r.id!==delReferral.dataset.deleteReferral));renderGrowth();return}
});


document.addEventListener("click",event=>{
  const role=event.target.closest("[data-owner-role-choice]");
  if(role&&role.closest("#ownerRoleButtons")&&isOwnerAppContext()){
    event.preventDefault();event.stopImmediatePropagation();
    role.dataset.ownerRoleChoice==="management"?openOwnerManagement():openTonyBarberWorkspace();return
  }
  if(event.target.closest("#ownerWorkspaceHome")&&isOwnerAppContext()){event.preventDefault();event.stopImmediatePropagation();openOwnerHome();return}
  if(event.target.closest("#ownerWorkspaceBack")&&isOwnerAppContext()){event.preventDefault();event.stopImmediatePropagation();ownerGoBack();return}
  const link=event.target.closest("[data-view-link]");if(!link)return;
  // v0.22.2: this handler runs in the capture phase and stops propagation,
  // so close the mobile More panel here before routing the selected page.
  if(link.closest("#barberNav")){const bn=document.getElementById("barberNav"),more=document.getElementById("barberMoreButton");bn?.classList.remove("mobile-more-open");more?.setAttribute("aria-expanded","false")}if(link.closest("#ownerNav")){const on=document.getElementById("ownerNav"),om=document.getElementById("ownerMoreButton");on?.classList.remove("owner-mobile-more-open");om?.setAttribute("aria-expanded","false")}
  event.preventDefault();event.stopImmediatePropagation();const view=link.dataset.viewLink;
  if(isOwnerAppContext()){
    if(link.closest("#ownerNav")){if(ownerWorkspace()!=="management"){ownerViewHistory=[];setOwnerWorkspace("management")}showView(view,true);return}
    if(link.closest("#barberNav")&&ownerWorkspace()==="tony"){sessionStorage.setItem("icuBarberName","Tony");showView(view,true);return}
    return
  }
  showView(view,false)
},true);


document.addEventListener("click",event=>{
 const tool=event.target.closest("[data-client-tool-key]");if(tool){window.__icuSelectedClientToolKey=tool.dataset.clientToolKey;renderSelectedClientTool();return}
 const clientele=event.target.closest("[data-clientele-key]");if(clientele){window.__icuSelectedClienteleKey=clientele.dataset.clienteleKey;renderSelectedClientele();return}
});

document.addEventListener("click",async event=>{
 const b=event.target.closest("[data-recovery-action]");if(!b)return;
 const action=b.dataset.recoveryAction,barberId=b.dataset.recoveryBarber,label=action==="force_password_change"?"require a password change":action;
 if(!confirm(`Confirm: ${label} for this account?`))return;
 b.disabled=true;
 try{await ICUCloud.ownerRecoveryAction(barberId,action);await renderAccountSecurity();toast("Account recovery setting updated.")}
 catch(error){toast(error?.message||"Account recovery action failed.");b.disabled=false}
});

let pendingCloudViewRefresh=false,cloudControlHoldUntil=0;
function cloudRefreshControlActive(){
 const a=document.activeElement;
 return Date.now()<cloudControlHoldUntil||Boolean(a&&(a.matches?.("select,input,textarea,[contenteditable=true]")||a.closest?.("dialog[open]")));
}
function applyCloudViewRefresh(){const v=currentViewName();if(v)renderCurrentView(v);updateUnifiedNotifications()}
document.addEventListener("pointerdown",e=>{if(e.target.closest?.("select,[data-status-id]"))cloudControlHoldUntil=Date.now()+12000},{capture:true});
document.addEventListener("change",e=>{if(e.target.matches?.("select,[data-status-id]"))cloudControlHoldUntil=0},{capture:true});
document.addEventListener("focusout",()=>{if(!pendingCloudViewRefresh)return;setTimeout(()=>{if(!cloudRefreshControlActive()){pendingCloudViewRefresh=false;try{applyCloudViewRefresh()}catch(_){}}},120)});
window.addEventListener("icuCloudChanged",()=>{try{if(cloudRefreshControlActive()){pendingCloudViewRefresh=true;updateUnifiedNotifications();return}pendingCloudViewRefresh=false;applyCloudViewRefresh()}catch(_){}});
window.addEventListener("icuCloudError",event=>{const message=event.detail?.message||"Supabase synchronization error.";try{toast(message)}catch(_){}});

window.ICU_BSMS_VERSION="0.25-supabase-runtime";
