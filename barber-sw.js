const ICU_SW_VERSION="0.27.0";
const DEFAULT_ICON="assets/icu-lookin-logo.jpeg";
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));
async function setBadge(value=1){try{if(self.registration&&typeof self.registration.setAppBadge==="function")await self.registration.setAppBadge(Math.max(1,Number(value)||1))}catch(_){}}
async function clearBadge(){try{if(self.registration&&typeof self.registration.clearAppBadge==="function")await self.registration.clearAppBadge()}catch(_){}}
self.addEventListener("push",event=>{let data={};try{data=event.data?event.data.json():{}}catch(_){data={body:event.data?event.data.text():"You have a new ICU Lookin notification."}}const title=data.title||"ICU Lookin Barber";const options={body:data.body||"Open the Barber App to view the update.",icon:data.icon||DEFAULT_ICON,tag:data.tag||`icu-${Date.now()}`,renotify:true,data:{url:data.url||"BARBER_LAUNCHER.html",type:data.type||"notification"}};event.waitUntil(Promise.all([setBadge(data.badge||1),self.registration.showNotification(title,options)]))});
self.addEventListener("notificationclick",event=>{event.notification.close();event.waitUntil((async()=>{await clearBadge();const target=new URL(event.notification?.data?.url||"BARBER_LAUNCHER.html",self.registration.scope).href;const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});for(const client of windows){if("focus" in client){try{if("navigate" in client)await client.navigate(target);return client.focus()}catch(_){}}}if(self.clients.openWindow)return self.clients.openWindow(target)})())});
self.addEventListener("message",event=>{if(event.data?.type==="ICU_CLEAR_BADGE")event.waitUntil(clearBadge())});
self.addEventListener("fetch",event=>{if(event.request.mode==="navigate")event.waitUntil(clearBadge())});
