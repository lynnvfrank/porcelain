/* ── Sidebar + viewport auto-detect (mobile = overlay, desktop = sidebar visible; works with Chrome DevTools device emulation) ── */
function openSidebar(){sidebar.classList.add('open');sideOverlay.classList.add('open');
  fetch('/conversations?_='+Date.now(),mergeApiHeaders({cache:'no-store'})).then(function(r){return r.ok?r.json():null;}).then(function(data){if(data&&Array.isArray(data.conversations)){mobileConvos=data.conversations;renderSidebar();}}).catch(function(){});}
function closeSidebar(){sidebar.classList.remove('open');sideOverlay.classList.remove('open')}
var _mq=window.matchMedia&&window.matchMedia('(min-width: 768px)');
function isViewportDesktop(){return _mq&&_mq.matches}
function applyViewport(){
  var desktop=isViewportDesktop();
  document.body.classList.toggle('viewport-desktop',desktop);
  if(appEl){if(desktop)closeSidebar();appEl.classList.remove('sidebar-collapsed');}
}
applyViewport();
if(_mq){_mq.addEventListener('change',applyViewport);}
if(typeof window!=='undefined'){window.addEventListener('load',function(){applyViewport();});}
menuBtn.addEventListener('click',function(){
  if(isViewportDesktop()){if(appEl)appEl.classList.toggle('sidebar-collapsed')}
  else{sidebar.classList.contains('open')?closeSidebar():openSidebar()}
});
sideOverlay.addEventListener('click',closeSidebar);
var sbUserBtn=document.getElementById('sbUserBtn'),sbUserPanel=document.getElementById('sbUserPanel');
function refreshMobileConvos(){
  fetch('/conversations?_='+Date.now(),mergeApiHeaders({cache:'no-store'})).then(function(r){return r.ok?r.json():null;}).then(function(d){if(d&&Array.isArray(d.conversations)){mobileConvos=d.conversations;renderSidebar();}}).catch(function(){});
}
if(sbUserBtn&&sbUserPanel){sbUserBtn.addEventListener('click',function(){var open=sbUserPanel.classList.toggle('open');sbUserBtn.classList.toggle('open',open);sbUserBtn.setAttribute('aria-expanded',open?'true':'false');if(open)refreshMobileConvos();});}
if(typeof document.addEventListener==='function'){document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')refreshMobileConvos();});}
var sbRefreshBtn=document.getElementById('sbRefreshBtn');
if(sbRefreshBtn){sbRefreshBtn.addEventListener('click',function(){sbRefreshBtn.disabled=true;sbRefreshBtn.textContent='…';loadAll().then(function(){sbRefreshBtn.disabled=false;sbRefreshBtn.textContent='Refresh';}).catch(function(){sbRefreshBtn.disabled=false;sbRefreshBtn.textContent='Refresh';});});}
/* ── Header TV icon: mood from last message (thinking/laughing/judgy/silly) ── */
function moodFromText(text){
  if(!text)return 'thinking';
  var t=text.toLowerCase().trim();
  if(/\b(lol|lmao|haha|hehe|xd|😂|🤣|😹|funny|hilarious|dead)\b|\.{2,}h/.test(t))return 'laughing';
  if(/\b(why did you|really\?|seriously|smh|judgy|side.?eye|eyeroll)\b|🙄|👀/.test(t))return 'judgy';
  if(/\b(silly|dumb|goofy|weird|wtf|blah|bleh|:\?|:\/)\b|😛|😜|🤪/.test(t))return 'silly';
  return 'thinking';
}
function setHeaderMood(mood){
  if(!hdrAvatar)return;
  hdrAvatar.classList.remove('state-thinking','state-laughing','state-judgy','state-silly');
  if(mood)hdrAvatar.classList.add('state-'+mood);
}
if(hdrAvatar){
  fetch('/header_icon.svg').then(function(r){return r.text()}).then(function(svg){hdrAvatar.innerHTML=svg}).catch(function(){hdrAvatar.innerHTML='<img src="/icon.svg" alt="">'});
}
try{
/* ── Helpers ── */
function esc(s){return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function allConvos(){
  var mobile=(searchResults!==null&&(sbSearch.value||'').trim())?searchResults:mobileConvos;
  var list=mobile.map(function(c){return Object.assign({},c,{source:c.source||'mobile'})});
  if(signedInUser&&searchResults===null){
    list=list.concat(continueConvos.map(function(c){return Object.assign({},c,{source:'continue'})}))
      .concat(grokConvos.map(function(c){return Object.assign({},c,{source:'grok'})}))
      .concat(cursorConvos.map(function(c){return Object.assign({},c,{source:'cursor'})}));
  }
  return list;
}
function srcLabel(s){return{mobile:'Mobile',continue:'VS Code',grok:'Grok',cursor:'Cursor'}[s]||s}
function srcBadge(s){return'<span class="badge '+s+'">'+srcLabel(s)+'</span>'}
function fmtDate(iso){
  if(!iso)return'';
  try{
var d=new Date(iso),now=new Date(),diff=now-d;
if(diff<60000)return'just now';
if(diff<3600000)return Math.floor(diff/60000)+'m ago';
if(diff<86400000)return Math.floor(diff/3600000)+'h ago';
if(diff<604800000)return['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
return d.toLocaleDateString(undefined,{month:'short',day:'numeric'});
  }catch(e){return''}
}
