(function(){
  "use strict";
  const cfg=window.ICU_SUPABASE_CONFIG;
  if(!cfg||!window.supabase){console.error("ICU Auth: Supabase library/config unavailable");return;}

  // Barber Portal gets its own auth storage key so it cannot collide with
  // Owner/Client sessions that live under the same github.io origin.
  const AUTH_STORAGE_KEY="icu-barber-supabase-auth-v0265";
  const REMEMBER="icuBarberSupabaseRememberDevice";
  const isPasswordReset=/PASSWORD_RESET\.html$/i.test(location.pathname);

  function safeGet(area,key){try{return area.getItem(key)}catch(_){return null}}
  function safeSet(area,key,value){try{area.setItem(key,value)}catch(_){}}
  function safeRemove(area,key){try{area.removeItem(key)}catch(_){}}

  const storage={
    getItem(k){return safeGet(sessionStorage,k) ?? safeGet(localStorage,k)},
    setItem(k,v){
      if(safeGet(localStorage,REMEMBER)==="1"){
        safeSet(localStorage,k,v);safeRemove(sessionStorage,k);
      }else{
        safeSet(sessionStorage,k,v);safeRemove(localStorage,k);
      }
    },
    removeItem(k){safeRemove(sessionStorage,k);safeRemove(localStorage,k)}
  };

  const nativeFetch=globalThis.fetch.bind(globalThis);
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const retryStatuses=new Set([502,503,504,520,522,524]);
  function isTransientNetworkError(err){
    const msg=String(err?.message||err||"");
    return /load failed|failed to fetch|network request failed|networkerror|network connection|connection was lost|fetch failed/i.test(msg);
  }
  async function fetchWithMobileRetry(input,init){
    let lastError=null;
    for(let attempt=0;attempt<3;attempt++){
      try{
        const response=await nativeFetch(input,{...(init||{}),cache:(init&&init.cache)||"no-store"});
        if(attempt<2&&retryStatuses.has(response.status)){
          await wait(300*(2**attempt));
          continue;
        }
        return response;
      }catch(err){
        lastError=err;
        if(attempt>=2||!isTransientNetworkError(err))throw err;
        await wait(350*(2**attempt));
      }
    }
    throw lastError||new TypeError("Network request failed");
  }

  const client=window.supabase.createClient(cfg.url,cfg.publishableKey,{
    auth:{
      persistSession:true,
      autoRefreshToken:true,
      detectSessionInUrl:isPasswordReset,
      storage,
      storageKey:AUTH_STORAGE_KEY
    },
    global:{fetch:fetchWithMobileRetry}
  });

  function setRemember(remember){if(remember)safeSet(localStorage,REMEMBER,"1");else safeRemove(localStorage,REMEMBER)}
  function friendlyError(err){
    if(isTransientNetworkError(err)){
      return new Error("Mobile connection to ICU Lookin could not reach Supabase. Please tap Sign In again. If it continues, switch between Wi-Fi and cellular and retry.");
    }
    return err instanceof Error?err:new Error(String(err||"Unable to complete the request."));
  }

  async function getIdentity(){
    try{
      const {data,error}=await client.rpc("get_my_app_identity");
      if(error)throw error;
      return Array.isArray(data)?(data[0]||null):data;
    }catch(err){throw friendlyError(err)}
  }

  async function signIn(email,password,remember){
    setRemember(Boolean(remember));
    try{
      const {data,error}=await client.auth.signInWithPassword({email:String(email||"").trim(),password});
      if(error)throw error;
      const identity=await getIdentity();
      if(!identity){await client.auth.signOut({scope:"local"});throw new Error("This account is not connected to ICU Lookin BSMS.")}
      if(!identity.active){await client.auth.signOut({scope:"local"});throw new Error("This ICU Lookin account is inactive.")}
      if(identity.account_locked){await client.auth.signOut({scope:"local"});throw new Error("This barber account is locked. Contact the owner.")}
      return {session:data.session,user:data.user,identity};
    }catch(err){throw friendlyError(err)}
  }

  async function changePassword(password){
    try{
      const {error}=await client.auth.updateUser({password});
      if(error)throw error;
      const {error:rpcError}=await client.rpc("complete_my_password_change");
      if(rpcError)throw rpcError;
      return true;
    }catch(err){throw friendlyError(err)}
  }

  async function changePasswordVerified(currentPassword,password){
    try{
      const {data:{user},error:userError}=await client.auth.getUser();
      if(userError||!user?.email)throw new Error("Unable to verify the signed-in account.");
      const {error:verifyError}=await client.auth.signInWithPassword({email:user.email,password:currentPassword});
      if(verifyError)throw new Error("Current password is incorrect.");
      return changePassword(password);
    }catch(err){throw friendlyError(err)}
  }

  async function signOut(){
    try{await client.auth.signOut({scope:"local"})}finally{
      safeRemove(localStorage,REMEMBER);
      try{Object.keys(localStorage).filter(k=>k.startsWith("icuBarberRemembered:")||k.startsWith("icuBarberPasswordHash:")).forEach(k=>safeRemove(localStorage,k))}catch(_){}
      try{Object.keys(sessionStorage).filter(k=>k.startsWith("icuBarberAuth:")).forEach(k=>safeRemove(sessionStorage,k))}catch(_){}
      safeRemove(sessionStorage,"icuBarberName");
    }
  }

  // Avoid an unnecessary getUser() network request every time the mobile
  // launcher opens. getSession() is local unless a refresh is actually needed;
  // the identity RPC still validates authorization before any workspace opens.
  async function current(){
    try{
      const {data:{session},error}=await client.auth.getSession();
      if(error||!session?.user)return null;
      const identity=await getIdentity();
      return identity?{user:session.user,identity}:null;
    }catch(err){throw friendlyError(err)}
  }

  async function requireBarber(expectedName){
    const cur=await current();
    if(!cur||cur.identity.role!=="barber"||cur.identity.display_name!==expectedName||!cur.identity.active||cur.identity.account_locked)return null;
    return cur;
  }
  async function requireOwner(){
    const cur=await current();
    if(!cur||cur.identity.role!=="owner"||!cur.identity.active||cur.identity.account_locked)return null;
    return cur;
  }

  window.ICUAuth={client,signIn,signOut,current,getIdentity,changePassword,changePasswordVerified,requireBarber,requireOwner,setRemember};
})();

// Individual Barber App calendar enhancement loader.
(function(){
  try{
    const params=new URLSearchParams(location.search);
    const mode=params.get("app")||sessionStorage.getItem("icuAppMode")||"";
    if(!/BSMS_APP\.html$/i.test(location.pathname)||mode!=="individual")return;
    if(document.querySelector('script[data-icu-monthly-calendar]'))return;
    const script=document.createElement("script");
    script.src="assets/barber-monthly-calendar.js?v=0.27.3";
    script.async=true;
    script.dataset.icuMonthlyCalendar="1";
    document.head.appendChild(script);
  }catch(error){console.warn("ICU monthly calendar loader",error)}
})();
