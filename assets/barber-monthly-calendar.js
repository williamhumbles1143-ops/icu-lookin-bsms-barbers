(function(){
  "use strict";

  const VERSION="0.27.3";
  const CANCELLED=new Set(["Cancelled","Last Second Cancellation"]);
  let monthCursor=null;
  let monthPanel=null;
  let dailyBackBar=null;
  let calendarView=null;
  let dailyControls=null;
  let dailyCard=null;
  let laneObserver=null;
  let refreshTimer=null;

  const $=s=>document.querySelector(s);
  const esc=v=>String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));
  const pad=n=>String(n).padStart(2,"0");
  const localDate=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const parseLocalDate=value=>{const [y,m,d]=String(value||"").split("-").map(Number);return y&&m&&d?new Date(y,m-1,d,12,0,0):new Date()};
  const currentBarber=()=>typeof window.activeBarber==="function"?window.activeBarber():(sessionStorage.getItem("icuBarberName")||"");
  const allAppointments=()=>typeof window.loadAppointments==="function"?window.loadAppointments():[];
  const usableAppointments=()=>allAppointments().filter(a=>a.barber===currentBarber()&&!CANCELLED.has(a.status));

  function injectStyles(){
    if(document.getElementById("icuMonthlyCalendarStyles"))return;
    const style=document.createElement("style");
    style.id="icuMonthlyCalendarStyles";
    style.textContent=`
      .icu-month-panel{margin-bottom:16px}.icu-month-toolbar{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:14px}.icu-month-toolbar h2{margin:0}.icu-month-toolbar .actions{display:flex;gap:8px;flex-wrap:wrap}.icu-month-summary{color:#666;margin:.25rem 0 0}.icu-month-weekdays,.icu-month-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}.icu-month-weekdays span{text-align:center;font-weight:800;font-size:.82rem;color:#666;padding:4px}.icu-month-day{position:relative;min-height:92px;border:1px solid #d7d0c4;background:#fff;border-radius:12px;padding:9px;text-align:left;color:#111;cursor:pointer}.icu-month-day:hover{border-color:#111}.icu-month-day.outside{opacity:.43}.icu-month-day.today{outline:2px solid #173f9e}.icu-month-day.has-bookings{border-color:#111;background:#fbfaf7}.icu-month-day-number{font-weight:900;font-size:1rem}.icu-month-booking-count{display:inline-flex;margin-top:10px;background:#111;color:#fff;border-radius:999px;padding:4px 8px;font-weight:800;font-size:.76rem}.icu-month-status-dots{display:flex;gap:4px;margin-top:7px;flex-wrap:wrap}.icu-month-status-dots i{width:8px;height:8px;border-radius:50%;display:block;background:#888}.icu-month-status-dots i.confirmed{background:#1d7a38}.icu-month-status-dots i.scheduled{background:#d78a00}.icu-month-status-dots i.checked-in,.icu-month-status-dots i.in-progress{background:#173f9e}.icu-month-status-dots i.completed{background:#555}.icu-daily-back{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}.icu-confirm-button{margin-top:8px;padding:7px 10px!important;border-radius:9px!important;width:auto!important;font-size:.84rem!important;background:#176b32!important}.icu-confirmed-label{display:inline-block;margin-top:8px;padding:5px 8px;border-radius:999px;background:#e5f5e9;color:#176b32;font-weight:800;font-size:.78rem}.icu-calendar-help{font-size:.88rem;color:#666}
      @media(max-width:650px){.icu-month-weekdays,.icu-month-grid{gap:3px}.icu-month-weekdays span{font-size:.68rem;padding:2px}.icu-month-day{min-height:72px;padding:6px;border-radius:9px}.icu-month-day-number{font-size:.9rem}.icu-month-booking-count{font-size:.68rem;padding:3px 5px;margin-top:7px}.icu-month-status-dots{gap:3px;margin-top:5px}.icu-month-status-dots i{width:6px;height:6px}.icu-month-toolbar .actions>*{width:auto}.icu-daily-back{align-items:stretch;flex-direction:column}.icu-daily-back .button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function monthItems(){
    if(!monthCursor)monthCursor=new Date();
    const y=monthCursor.getFullYear(),m=monthCursor.getMonth();
    return usableAppointments().filter(a=>{const d=parseLocalDate(String(a.startAt).slice(0,10));return d.getFullYear()===y&&d.getMonth()===m});
  }

  function renderMonth(){
    if(!monthPanel)return;
    const barber=currentBarber(),items=monthItems();
    const title=monthPanel.querySelector("[data-icu-month-title]");
    const summary=monthPanel.querySelector("[data-icu-month-summary]");
    const grid=monthPanel.querySelector("[data-icu-month-grid]");
    title.textContent=new Intl.DateTimeFormat("en-US",{month:"long",year:"numeric"}).format(monthCursor);
    summary.textContent=`${barber}'s month at a glance • ${items.length} appointment${items.length===1?"":"s"}`;
    const first=new Date(monthCursor.getFullYear(),monthCursor.getMonth(),1,12);
    const start=new Date(first);start.setDate(first.getDate()-first.getDay());
    const todayValue=localDate(new Date());
    const byDate=new Map();
    items.forEach(a=>{const key=String(a.startAt).slice(0,10);if(!byDate.has(key))byDate.set(key,[]);byDate.get(key).push(a)});
    let html="";
    for(let i=0;i<42;i++){
      const d=new Date(start);d.setDate(start.getDate()+i);
      const key=localDate(d),dayItems=(byDate.get(key)||[]).sort((a,b)=>new Date(a.startAt)-new Date(b.startAt));
      const outside=d.getMonth()!==monthCursor.getMonth();
      const dots=[...new Set(dayItems.map(a=>String(a.status||"scheduled").toLowerCase().replaceAll(" ","-")))].slice(0,4).map(s=>`<i class="${esc(s)}"></i>`).join("");
      html+=`<button type="button" class="icu-month-day${outside?" outside":""}${key===todayValue?" today":""}${dayItems.length?" has-bookings":""}" data-icu-month-day="${key}" aria-label="${esc(new Intl.DateTimeFormat("en-US",{month:"long",day:"numeric",year:"numeric"}).format(d))}${dayItems.length?`, ${dayItems.length} appointments`:""}"><span class="icu-month-day-number">${d.getDate()}</span>${dayItems.length?`<span class="icu-month-booking-count">${dayItems.length} booked</span><span class="icu-month-status-dots">${dots}</span>`:""}</button>`;
    }
    grid.innerHTML=html;
  }

  function showMonth(){
    if(!monthPanel)return;
    const selected=$("#calendarDate")?.value;
    if(selected){const d=parseLocalDate(selected);monthCursor=new Date(d.getFullYear(),d.getMonth(),1,12)}
    monthPanel.classList.remove("hidden");
    dailyBackBar.classList.add("hidden");
    dailyControls.classList.add("hidden");
    dailyCard.classList.add("hidden");
    renderMonth();
  }

  function openDay(dateValue){
    const input=$("#calendarDate");
    if(!input)return;
    input.value=dateValue;
    monthPanel.classList.add("hidden");
    dailyBackBar.classList.remove("hidden");
    dailyControls.classList.remove("hidden");
    dailyCard.classList.remove("hidden");
    input.dispatchEvent(new Event("change",{bubbles:true}));
    setTimeout(()=>{decorateDailyAppointments();dailyBackBar.scrollIntoView({behavior:"smooth",block:"start"})},40);
  }

  function currentDayAppointments(){
    const dateValue=$("#calendarDate")?.value;
    return usableAppointments().filter(a=>String(a.startAt).startsWith(dateValue)).sort((a,b)=>new Date(a.startAt)-new Date(b.startAt));
  }

  function decorateDailyAppointments(){
    const lane=$("#calendarLane");if(!lane)return;
    const items=currentDayAppointments();
    const blocks=[...lane.querySelectorAll(".calendar-appointment")];
    blocks.forEach((block,index)=>{
      const appointment=items[index];if(!appointment)return;
      block.dataset.icuAppointmentId=appointment.id;
      block.querySelectorAll("[data-icu-confirm],.icu-confirmed-label").forEach(el=>el.remove());
      if(appointment.status==="Scheduled"){
        const button=document.createElement("button");
        button.type="button";button.className="button icu-confirm-button";button.dataset.icuConfirm=appointment.id;button.textContent="Confirm Appointment";
        block.appendChild(button);
      }else if(appointment.status==="Confirmed"){
        const label=document.createElement("span");label.className="icu-confirmed-label";label.textContent="✓ Confirmed";block.appendChild(label);
      }
    });
  }

  async function confirmAppointment(id,button){
    const appointment=allAppointments().find(a=>a.id===id&&a.barber===currentBarber());
    if(!appointment)return;
    if(appointment.status==="Confirmed"){decorateDailyAppointments();return}
    const barber=currentBarber();
    button.disabled=true;button.textContent="Confirming…";
    const when=typeof window.formatDateTime==="function"?window.formatDateTime(appointment.startAt):new Date(appointment.startAt).toLocaleString();
    const message=`Your appointment with ${barber} for ${when} has been confirmed by your barber. We look forward to seeing you at ICU Lookin Barber Studio.`;
    try{
      if(typeof window.sendAppointmentMessage==="function")await window.sendAppointmentMessage(id,barber,message);
      if(typeof window.updateAppointmentStatus==="function")window.updateAppointmentStatus(id,"Confirmed");
      if(typeof window.toast==="function")window.toast("Appointment confirmed. The client was sent a confirmation message.");
      renderMonth();
      setTimeout(decorateDailyAppointments,60);
    }catch(error){
      button.disabled=false;button.textContent="Confirm Appointment";
      if(typeof window.toast==="function")window.toast(error?.message||"The appointment could not be confirmed.");
    }
  }

  function buildUi(){
    calendarView=$("#view-barber-calendar");
    dailyControls=calendarView?.querySelector(".calendar-controls");
    dailyCard=calendarView?.querySelector(".calendar-card");
    if(!calendarView||!dailyControls||!dailyCard||document.getElementById("icuMonthlyCalendarPanel"))return false;
    injectStyles();
    const selected=$("#calendarDate")?.value||localDate(new Date());
    const d=parseLocalDate(selected);monthCursor=new Date(d.getFullYear(),d.getMonth(),1,12);

    monthPanel=document.createElement("section");
    monthPanel.id="icuMonthlyCalendarPanel";monthPanel.className="panel icu-month-panel";
    monthPanel.innerHTML=`<div class="icu-month-toolbar"><div><p class="eyebrow">Monthly calendar</p><h2 data-icu-month-title></h2><p class="icu-month-summary" data-icu-month-summary></p></div><div class="actions"><button type="button" class="button secondary" data-icu-prev-month>← Previous</button><button type="button" class="button secondary" data-icu-current-month>This Month</button><button type="button" class="button secondary" data-icu-next-month>Next →</button></div></div><div class="icu-month-weekdays"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div><div class="icu-month-grid" data-icu-month-grid></div><p class="icu-calendar-help">Dates with bookings show an appointment count. Tap any date to open that day's detailed schedule.</p>`;
    dailyBackBar=document.createElement("section");
    dailyBackBar.className="panel icu-daily-back hidden";
    dailyBackBar.innerHTML=`<button type="button" class="button secondary" data-icu-back-month>← Back to Monthly Calendar</button><span class="icu-calendar-help">Daily detail view</span>`;
    calendarView.insertBefore(monthPanel,dailyControls);
    calendarView.insertBefore(dailyBackBar,dailyControls);

    monthPanel.addEventListener("click",event=>{
      const day=event.target.closest("[data-icu-month-day]");if(day){openDay(day.dataset.icuMonthDay);return}
      if(event.target.closest("[data-icu-prev-month]")){monthCursor.setMonth(monthCursor.getMonth()-1);renderMonth();return}
      if(event.target.closest("[data-icu-next-month]")){monthCursor.setMonth(monthCursor.getMonth()+1);renderMonth();return}
      if(event.target.closest("[data-icu-current-month]")){const now=new Date();monthCursor=new Date(now.getFullYear(),now.getMonth(),1,12);renderMonth()}
    });
    dailyBackBar.addEventListener("click",event=>{if(event.target.closest("[data-icu-back-month]"))showMonth()});
    $("#calendarLane")?.addEventListener("click",event=>{const button=event.target.closest("[data-icu-confirm]");if(button)confirmAppointment(button.dataset.icuConfirm,button)});

    laneObserver=new MutationObserver(()=>setTimeout(decorateDailyAppointments,0));
    const lane=$("#calendarLane");if(lane)laneObserver.observe(lane,{childList:true,subtree:true});

    document.querySelectorAll('[data-view-link="barber-calendar"]').forEach(link=>link.addEventListener("click",()=>setTimeout(showMonth,30)));
    const viewObserver=new MutationObserver(()=>{if(!calendarView.classList.contains("hidden")&&monthPanel&&!dailyBackBar.classList.contains("hidden")===false){renderMonth()}});
    viewObserver.observe(calendarView,{attributes:true,attributeFilter:["class"]});

    refreshTimer=setInterval(()=>{if(!calendarView.classList.contains("hidden")){if(!monthPanel.classList.contains("hidden"))renderMonth();else decorateDailyAppointments()}},15000);
    showMonth();
    return true;
  }

  function boot(){
    const mode=window.__ICU_EARLY_MODE__||new URLSearchParams(location.search).get("app");
    if(mode!=="individual")return;
    if(buildUi())return;
    let attempts=0;const retry=setInterval(()=>{attempts++;if(buildUi()||attempts>30)clearInterval(retry)},200);
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
