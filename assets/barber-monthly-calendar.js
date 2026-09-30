(function(){
  "use strict";

  const VERSION="0.27.4";
  const CANCELLED=new Set(["Cancelled","Last Second Cancellation"]);
  let monthCursor=null,monthPanel=null,dailyBackBar=null,dailySummary=null,calendarView=null,dailyControls=null,dailyCard=null;
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));
  const pad=n=>String(n).padStart(2,"0");
  const localDate=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const parseLocalDate=value=>{const [y,m,d]=String(value||"").split("-").map(Number);return y&&m&&d?new Date(y,m-1,d,12):new Date()};
  const currentBarber=()=>typeof window.activeBarber==="function"?window.activeBarber():(sessionStorage.getItem("icuBarberName")||"");
  const allAppointments=()=>typeof window.loadAppointments==="function"?window.loadAppointments():(()=>{try{return JSON.parse(localStorage.getItem("icuLookinAppointmentsV3"))||[]}catch{return[]}})();
  const barberAppointments=()=>allAppointments().filter(a=>a.barber===currentBarber());
  const monthAppointments=()=>barberAppointments().filter(a=>!CANCELLED.has(a.status));
  const fmtDateTime=v=>typeof window.formatDateTime==="function"?window.formatDateTime(v):new Date(v).toLocaleString();
  const serviceText=a=>typeof window.serviceNames==="function"?window.serviceNames(a.serviceIds||[]):"Appointment";
  const notify=m=>typeof window.toast==="function"?window.toast(m):alert(m);

  function injectStyles(){
    if(document.getElementById("icuMonthlyCalendarStyles"))return;
    const style=document.createElement("style");style.id="icuMonthlyCalendarStyles";style.textContent=`
      .icu-month-panel{margin-bottom:16px}.icu-month-toolbar{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:14px}.icu-month-toolbar h2{margin:0}.icu-month-toolbar .actions{display:flex;gap:8px;flex-wrap:wrap}.icu-month-summary{color:#666;margin:.25rem 0 0}.icu-month-weekdays,.icu-month-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}.icu-month-weekdays span{text-align:center;font-weight:800;font-size:.82rem;color:#666;padding:4px}.icu-month-day{position:relative;min-height:92px;border:1px solid #d7d0c4;background:#fff;border-radius:12px;padding:9px;text-align:left;color:#111;cursor:pointer}.icu-month-day.outside{opacity:.43}.icu-month-day.today{outline:2px solid #173f9e}.icu-month-day.has-bookings{border-color:#111;background:#fbfaf7}.icu-month-day-number{font-weight:900}.icu-month-booking-count{display:inline-flex;margin-top:10px;background:#111;color:#fff;border-radius:999px;padding:4px 8px;font-weight:800;font-size:.76rem}.icu-month-status-dots{display:flex;gap:4px;margin-top:7px}.icu-month-status-dots i{width:8px;height:8px;border-radius:50%;display:block;background:#888}.icu-month-status-dots i.confirmed{background:#1d7a38}.icu-month-status-dots i.scheduled{background:#d78a00}.icu-month-status-dots i.checked-in,.icu-month-status-dots i.in-progress{background:#173f9e}.icu-month-status-dots i.completed{background:#555}.icu-daily-back{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}.icu-day-summary{margin-bottom:12px}.icu-day-list{display:grid;gap:10px}.icu-day-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px;border:1px solid #d8d0c4;border-radius:12px;background:#fff}.icu-day-item-main{display:grid;gap:3px}.icu-day-item-main small{color:#666}.icu-confirm-button{min-height:42px!important;padding:8px 12px!important;border-radius:9px!important;background:#176b32!important;color:#fff!important;border:1px solid #176b32!important;font-weight:900!important}.icu-confirmed-label{display:inline-flex;padding:6px 9px;border-radius:999px;background:#e5f5e9;color:#176b32;font-weight:900;font-size:.8rem}.icu-calendar-help{font-size:.88rem;color:#666}
      @media(max-width:650px){.icu-month-weekdays,.icu-month-grid{gap:3px}.icu-month-weekdays span{font-size:.68rem}.icu-month-day{min-height:72px;padding:6px}.icu-month-booking-count{font-size:.68rem;padding:3px 5px;margin-top:7px}.icu-month-status-dots i{width:6px;height:6px}.icu-month-toolbar .actions>*{width:auto}.icu-daily-back{flex-direction:column;align-items:stretch}.icu-daily-back .button{width:100%}.icu-day-item{grid-template-columns:1fr}.icu-confirm-button{width:100%!important}}
    `;document.head.appendChild(style);
  }

  function renderMonth(){
    if(!monthPanel)return;
    const y=monthCursor.getFullYear(),m=monthCursor.getMonth(),items=monthAppointments().filter(a=>{const d=parseLocalDate(String(a.startAt).slice(0,10));return d.getFullYear()===y&&d.getMonth()===m});
    monthPanel.querySelector("[data-icu-month-title]").textContent=new Intl.DateTimeFormat("en-US",{month:"long",year:"numeric"}).format(monthCursor);
    monthPanel.querySelector("[data-icu-month-summary]").textContent=`${currentBarber()}'s month at a glance • ${items.length} appointment${items.length===1?"":"s"}`;
    const first=new Date(y,m,1,12),start=new Date(first);start.setDate(first.getDate()-first.getDay());
    const byDate=new Map();items.forEach(a=>{const k=String(a.startAt).slice(0,10);if(!byDate.has(k))byDate.set(k,[]);byDate.get(k).push(a)});
    const todayValue=localDate(new Date());let html="";
    for(let i=0;i<42;i++){
      const d=new Date(start);d.setDate(start.getDate()+i);const key=localDate(d),dayItems=byDate.get(key)||[],outside=d.getMonth()!==m;
      const dots=[...new Set(dayItems.map(a=>String(a.status||"Scheduled").toLowerCase().replaceAll(" ","-")))].slice(0,4).map(s=>`<i class="${esc(s)}"></i>`).join("");
      html+=`<button type="button" class="icu-month-day${outside?" outside":""}${key===todayValue?" today":""}${dayItems.length?" has-bookings":""}" data-icu-month-day="${key}"><span class="icu-month-day-number">${d.getDate()}</span>${dayItems.length?`<span class="icu-month-booking-count">${dayItems.length} booked</span><span class="icu-month-status-dots">${dots}</span>`:""}</button>`;
    }
    monthPanel.querySelector("[data-icu-month-grid]").innerHTML=html;
  }

  function selectedDayAppointments(){
    const dateValue=$("#calendarDate")?.value||localDate(new Date());
    return barberAppointments().filter(a=>String(a.startAt).startsWith(dateValue)).sort((a,b)=>new Date(a.startAt)-new Date(b.startAt));
  }

  function renderDailySummary(){
    if(!dailySummary)return;
    const dateValue=$("#calendarDate")?.value||localDate(new Date()),items=selectedDayAppointments();
    const heading=new Intl.DateTimeFormat("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"}).format(parseLocalDate(dateValue));
    dailySummary.innerHTML=`<div class="section-heading-row"><div><p class="eyebrow">Appointments for this day</p><h2>${esc(heading)}</h2></div><strong>${items.length} appointment${items.length===1?"":"s"}</strong></div><div class="icu-day-list">${items.length?items.map(a=>`<article class="icu-day-item"><div class="icu-day-item-main"><strong>${esc(fmtDateTime(a.startAt))} — ${esc(a.firstName+" "+a.lastName)}</strong><span>${esc(serviceText(a))}</span><small>Status: ${esc(a.status)} • ${esc(a.phone||a.email||"")}</small></div><div>${a.status==="Scheduled"?`<button type="button" class="icu-confirm-button" data-icu-confirm="${esc(a.id)}">Confirm Appointment</button>`:a.status==="Confirmed"?'<span class="icu-confirmed-label">✓ Confirmed</span>':`<span class="status">${esc(a.status)}</span>`}</div></article>`).join(""):'<p class="help">No appointments are scheduled on this date.</p>'}</div>`;
  }

  function showMonth(){
    const selected=$("#calendarDate")?.value;if(selected){const d=parseLocalDate(selected);monthCursor=new Date(d.getFullYear(),d.getMonth(),1,12)}
    monthPanel.classList.remove("hidden");dailyBackBar.classList.add("hidden");dailySummary.classList.add("hidden");dailyControls.classList.add("hidden");dailyCard.classList.add("hidden");renderMonth();
  }

  function renderOriginalDay(){
    if(typeof window.renderBarberCalendar==="function")window.renderBarberCalendar();
    else $("#calendarDate")?.dispatchEvent(new Event("change",{bubbles:true}));
    setTimeout(renderDailySummary,20);
  }

  function openDay(dateValue){
    $("#calendarDate").value=dateValue;monthPanel.classList.add("hidden");dailyBackBar.classList.remove("hidden");dailySummary.classList.remove("hidden");dailyControls.classList.remove("hidden");dailyCard.classList.remove("hidden");renderOriginalDay();setTimeout(()=>dailyBackBar.scrollIntoView({behavior:"smooth",block:"start"}),30);
  }

  function shiftDay(days){
    const d=parseLocalDate($("#calendarDate").value||localDate(new Date()));d.setDate(d.getDate()+days);$("#calendarDate").value=localDate(d);renderOriginalDay();
  }

  async function confirmAppointment(id,button){
    const appointment=allAppointments().find(a=>String(a.id)===String(id)&&a.barber===currentBarber());if(!appointment)return notify("Appointment not found.");
    if(appointment.status!=="Scheduled")return renderDailySummary();
    button.disabled=true;button.textContent="Confirming…";
    const message=`Your appointment with ${currentBarber()} for ${fmtDateTime(appointment.startAt)} has been confirmed by your barber. We look forward to seeing you at ICU Lookin Barber Studio.`;
    try{
      if(typeof window.sendAppointmentMessage!=="function")throw new Error("Client messaging is unavailable.");
      await window.sendAppointmentMessage(appointment.id,currentBarber(),message);
      if(typeof window.updateAppointmentStatus!=="function")throw new Error("Appointment status update is unavailable.");
      window.updateAppointmentStatus(appointment.id,"Confirmed");
      notify("Appointment confirmed. The client was sent a confirmation message.");
      setTimeout(()=>{renderOriginalDay();renderMonth()},40);
    }catch(error){button.disabled=false;button.textContent="Confirm Appointment";notify(error?.message||"The appointment could not be confirmed.")}
  }

  function wireControls(){
    const capture=(selector,fn)=>$(selector)?.addEventListener("click",e=>{e.preventDefault();e.stopImmediatePropagation();fn()},true);
    capture("#calendarPreviousDay",()=>shiftDay(-1));capture("#calendarToday",()=>{$("#calendarDate").value=localDate(new Date());renderOriginalDay()});capture("#calendarNextDay",()=>shiftDay(1));
    $("#calendarDate")?.addEventListener("change",()=>setTimeout(renderDailySummary,20));
  }

  function buildUi(){
    calendarView=$("#view-barber-calendar");dailyControls=calendarView?.querySelector(".calendar-controls");dailyCard=calendarView?.querySelector(".calendar-card");if(!calendarView||!dailyControls||!dailyCard||document.getElementById("icuMonthlyCalendarPanel"))return false;
    injectStyles();const d=parseLocalDate($("#calendarDate")?.value||localDate(new Date()));monthCursor=new Date(d.getFullYear(),d.getMonth(),1,12);
    monthPanel=document.createElement("section");monthPanel.id="icuMonthlyCalendarPanel";monthPanel.className="panel icu-month-panel";monthPanel.innerHTML=`<div class="icu-month-toolbar"><div><p class="eyebrow">Monthly calendar</p><h2 data-icu-month-title></h2><p class="icu-month-summary" data-icu-month-summary></p></div><div class="actions"><button type="button" class="button secondary" data-icu-prev-month>← Previous</button><button type="button" class="button secondary" data-icu-current-month>This Month</button><button type="button" class="button secondary" data-icu-next-month>Next →</button></div></div><div class="icu-month-weekdays"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div><div class="icu-month-grid" data-icu-month-grid></div><p class="icu-calendar-help">Dates with bookings show an appointment count. Tap any date to open that day's detailed schedule.</p>`;
    dailyBackBar=document.createElement("section");dailyBackBar.className="panel icu-daily-back hidden";dailyBackBar.innerHTML=`<button type="button" class="button secondary" data-icu-back-month>← Back to Monthly Calendar</button><span class="icu-calendar-help">Daily detail view</span>`;
    dailySummary=document.createElement("section");dailySummary.className="panel icu-day-summary hidden";
    calendarView.insertBefore(monthPanel,dailyControls);calendarView.insertBefore(dailyBackBar,dailyControls);calendarView.insertBefore(dailySummary,dailyCard);
    monthPanel.addEventListener("click",e=>{const day=e.target.closest("[data-icu-month-day]");if(day)return openDay(day.dataset.icuMonthDay);if(e.target.closest("[data-icu-prev-month]")){monthCursor.setMonth(monthCursor.getMonth()-1);return renderMonth()}if(e.target.closest("[data-icu-next-month]")){monthCursor.setMonth(monthCursor.getMonth()+1);return renderMonth()}if(e.target.closest("[data-icu-current-month]")){const n=new Date();monthCursor=new Date(n.getFullYear(),n.getMonth(),1,12);renderMonth()}});
    dailyBackBar.addEventListener("click",e=>{if(e.target.closest("[data-icu-back-month]"))showMonth()});
    dailySummary.addEventListener("click",e=>{const b=e.target.closest("[data-icu-confirm]");if(b)confirmAppointment(b.dataset.icuConfirm,b)});
    document.querySelectorAll('[data-view-link="barber-calendar"]').forEach(link=>link.addEventListener("click",()=>setTimeout(showMonth,30)));
    wireControls();showMonth();setInterval(()=>{if(calendarView.classList.contains("hidden"))return;if(monthPanel.classList.contains("hidden"))renderDailySummary();else renderMonth()},15000);return true;
  }

  function boot(){const mode=window.__ICU_EARLY_MODE__||new URLSearchParams(location.search).get("app");if(mode!=="individual")return;if(buildUi())return;let n=0;const t=setInterval(()=>{n++;if(buildUi()||n>30)clearInterval(t)},200)}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();

(function(){
  try{
    if(document.querySelector('script[data-icu-clientele-selector]'))return;
    const script=document.createElement("script");
    script.src="assets/barber-clientele-selector.js?v=0.27.5";
    script.async=true;
    script.dataset.icuClienteleSelector="1";
    document.head.appendChild(script);
  }catch(error){console.warn("ICU clientele selector loader",error)}
})();
