(function(){
  "use strict";
  const cfg=window.ICU_SUPABASE_CONFIG;
  if(!cfg||!window.supabase){console.error("ICU Auth: Supabase library/config unavailable");return;}
  const REMEMBER="icuSupabaseRememberDevice";
  const storage={
    getItem(k){return sessionStorage.getItem(k) ?? localStorage.getItem(k)},
    setItem(k,v){if(localStorage.getItem(REMEMBER)==="1"){localStorage.setItem(k,v);sessionStorage.removeItem(k)}else{sessionStorage.setItem(k,v);localStorage.removeItem(k)}},
    removeItem(k){sessionStorage.removeItem(k);localStorage.removeItem(k)}
  };
  const client=window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage}});
  function setRemember(remember){if(remember)localStorage.setItem(REMEMBER,"1");else localStorage.removeItem(REMEMBER)}
  async function getIdentity(){
    const {data,error}=await client.rpc("get_my_app_identity");
    if(error)throw error;
    return Array.isArray(data)?(data[0]||null):data;
  }
  async function signIn(email,password,remember){
    setRemember(Boolean(remember));
    const {data,error}=await client.auth.signInWithPassword({email:String(email||"").trim(),password});
    if(error)throw error;
    const identity=await getIdentity();
    if(!identity){await client.auth.signOut();throw new Error("This account is not connected to ICU Lookin BSMS.")}
    if(!identity.active){await client.auth.signOut();throw new Error("This ICU Lookin account is inactive.")}
    if(identity.account_locked){await client.auth.signOut();throw new Error("This barber account is locked. Contact the owner.")}
    return {session:data.session,user:data.user,identity};
  }
  async function changePassword(password){
    const {error}=await client.auth.updateUser({password});
    if(error)throw error;
    const {error:rpcError}=await client.rpc("complete_my_password_change");
    if(rpcError)throw rpcError;
    return true;
  }

  async function changePasswordVerified(currentPassword,password){
    const {data:{user},error:userError}=await client.auth.getUser();
    if(userError||!user?.email)throw new Error("Unable to verify the signed-in account.");
    const {error:verifyError}=await client.auth.signInWithPassword({email:user.email,password:currentPassword});
    if(verifyError)throw new Error("Current password is incorrect.");
    return changePassword(password);
  }
  async function signOut(){
    try{await client.auth.signOut()}finally{
      localStorage.removeItem(REMEMBER);
      Object.keys(localStorage).filter(k=>k.startsWith("icuBarberRemembered:")||k.startsWith("icuBarberPasswordHash:")).forEach(k=>localStorage.removeItem(k));
      Object.keys(sessionStorage).filter(k=>k.startsWith("icuBarberAuth:")).forEach(k=>sessionStorage.removeItem(k));
      sessionStorage.removeItem("icuBarberName");
    }
  }
  async function current(){
    const {data:{user},error}=await client.auth.getUser();
    if(error||!user)return null;
    const identity=await getIdentity();
    return identity?{user,identity}:null;
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
