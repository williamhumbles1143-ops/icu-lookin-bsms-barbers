(function(){
  "use strict";

  const VERSION="0.27.5";
  let root,input,list,toggle,label,isOpen=false;

  function openDropdown(){
    if(!root||!input||!list)return;
    if(input.dataset.icuSelectedKey){
      input.value="";
      delete input.dataset.icuSelectedKey;
      input.dispatchEvent(new Event("input",{bubbles:true}));
    }
    root.classList.add("open");
    input.setAttribute("aria-expanded","true");
    toggle?.setAttribute("aria-expanded","true");
    isOpen=true;
  }

  function closeDropdown(){
    if(!root||!input)return;
    root.classList.remove("open");
    input.setAttribute("aria-expanded","false");
    toggle?.setAttribute("aria-expanded","false");
    isOpen=false;
  }

  function selectedLabel(button){
    const name=button?.querySelector("strong")?.textContent?.trim()||"";
    const contact=button?.querySelector("small")?.textContent?.trim()||"";
    return contact&&contact!=="No contact information"?`${name} — ${contact}`:name;
  }

  function syncSelectedDisplay(){
    if(!input||isOpen)return;
    const key=window.__icuSelectedClienteleKey;
    if(!key)return;
    const button=list?.querySelector(`[data-clientele-key="${CSS.escape(String(key))}"]`);
    if(!button)return;
    input.value=selectedLabel(button);
    input.dataset.icuSelectedKey=String(key);
  }

  function injectStyles(){
    if(document.getElementById("icuClienteleSelectorStyles"))return;
    const style=document.createElement("style");
    style.id="icuClienteleSelectorStyles";
    style.textContent=`
      .icu-client-combobox{position:relative;z-index:12}.icu-client-combobox label{margin:0}.icu-client-combo-row{display:grid;grid-template-columns:minmax(0,1fr) 50px;gap:6px;align-items:stretch}.icu-client-combo-row input{margin:0}.icu-client-combo-toggle{min-height:48px;border:2px solid #bcb3a6;border-radius:11px;background:#fff;color:#111;font-size:1.1rem;font-weight:900;cursor:pointer}.icu-client-combo-toggle:focus-visible{outline:3px solid rgba(23,63,158,.23);outline-offset:2px;border-color:#173f9e}.icu-client-combobox #clienteleDirectoryList{display:none;position:absolute;left:0;right:0;top:calc(100% + 7px);z-index:80;max-height:360px;overflow:auto;padding:7px;border:1px solid #d8d0c4;border-radius:12px;background:#fff;box-shadow:0 18px 42px rgba(0,0,0,.18)}.icu-client-combobox.open #clienteleDirectoryList{display:grid;gap:5px}.icu-client-combobox #clienteleDirectoryList .client-directory-button{width:100%;text-align:left}.icu-client-selector-help{display:block;margin:.45rem 0 0;color:#686159;font-size:.8rem;font-weight:600}.client-directory{overflow:visible!important}
      @media(max-width:760px){.icu-client-combobox #clienteleDirectoryList{max-height:52vh}.icu-client-combo-row{grid-template-columns:minmax(0,1fr) 48px}}
    `;
    document.head.appendChild(style);
  }

  function build(){
    input=document.getElementById("clienteleSearch");
    list=document.getElementById("clienteleDirectoryList");
    if(!input||!list||document.getElementById("icuClientCombobox"))return false;
    const mode=window.__ICU_EARLY_MODE__||new URLSearchParams(location.search).get("app")||sessionStorage.getItem("icuAppMode")||"";
    if(mode!=="individual")return true;

    injectStyles();
    const oldLabel=input.closest("label");
    root=document.createElement("div");
    root.id="icuClientCombobox";
    root.className="icu-client-combobox";
    oldLabel.parentNode.insertBefore(root,oldLabel);
    root.appendChild(oldLabel);
    root.appendChild(list);

    label=document.createElement("span");
    label.textContent="Select or search client";
    oldLabel.replaceChildren(label);

    const row=document.createElement("div");
    row.className="icu-client-combo-row";
    input.placeholder="Name, phone number, or email";
    input.autocomplete="off";
    input.setAttribute("role","combobox");
    input.setAttribute("aria-controls","clienteleDirectoryList");
    input.setAttribute("aria-autocomplete","list");
    input.setAttribute("aria-expanded","false");
    row.appendChild(input);

    toggle=document.createElement("button");
    toggle.type="button";
    toggle.className="icu-client-combo-toggle";
    toggle.setAttribute("aria-label","Show all clients");
    toggle.setAttribute("aria-expanded","false");
    toggle.textContent="▾";
    row.appendChild(toggle);
    oldLabel.appendChild(row);

    const help=document.createElement("small");
    help.className="icu-client-selector-help";
    help.textContent="Tap the arrow to see every client, or type any part of the client’s name, phone number, or email address.";
    oldLabel.appendChild(help);

    input.addEventListener("focus",openDropdown);
    input.addEventListener("click",()=>{if(!isOpen)openDropdown()});
    input.addEventListener("input",()=>{
      delete input.dataset.icuSelectedKey;
      if(!isOpen){root.classList.add("open");input.setAttribute("aria-expanded","true");toggle.setAttribute("aria-expanded","true");isOpen=true}
    });
    input.addEventListener("keydown",event=>{
      if(event.key==="Escape"){event.preventDefault();closeDropdown();syncSelectedDisplay();return}
      if(event.key==="ArrowDown"){
        event.preventDefault();
        if(!isOpen)openDropdown();
        setTimeout(()=>list.querySelector("[data-clientele-key]")?.focus(),0);
      }
    });
    toggle.addEventListener("click",event=>{
      event.preventDefault();event.stopPropagation();
      if(isOpen){closeDropdown();syncSelectedDisplay()}else{input.focus();openDropdown()}
    });

    list.addEventListener("click",event=>{
      const button=event.target.closest("[data-clientele-key]");
      if(!button)return;
      window.__icuSelectedClienteleKey=button.dataset.clienteleKey;
      if(typeof window.renderSelectedClientele==="function")window.renderSelectedClientele();
      input.value=selectedLabel(button);
      input.dataset.icuSelectedKey=button.dataset.clienteleKey;
      closeDropdown();
    });
    list.addEventListener("keydown",event=>{
      const button=event.target.closest("[data-clientele-key]");if(!button)return;
      const buttons=[...list.querySelectorAll("[data-clientele-key]")],index=buttons.indexOf(button);
      if(event.key==="ArrowDown"){event.preventDefault();buttons[Math.min(buttons.length-1,index+1)]?.focus()}
      if(event.key==="ArrowUp"){event.preventDefault();if(index<=0)input.focus();else buttons[index-1]?.focus()}
      if(event.key==="Escape"){event.preventDefault();closeDropdown();input.focus();syncSelectedDisplay()}
    });

    document.addEventListener("click",event=>{if(root&&!root.contains(event.target)){closeDropdown();syncSelectedDisplay()}});
    document.querySelectorAll('[data-view-link="barber-clientele"]').forEach(link=>link.addEventListener("click",()=>setTimeout(()=>{closeDropdown();syncSelectedDisplay()},80)));

    const observer=new MutationObserver(()=>{if(!isOpen)setTimeout(syncSelectedDisplay,0)});
    observer.observe(list,{childList:true,subtree:true});
    setTimeout(syncSelectedDisplay,120);
    return true;
  }

  function boot(){
    if(build())return;
    let tries=0;
    const timer=setInterval(()=>{tries++;if(build()||tries>40)clearInterval(timer)},200);
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
