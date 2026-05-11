/* ── Fork (continue read-only chat with Claudia) ── */
async function forkConvoMobile(){
  if(!currentMessages||currentMessages.length===0)return;
  var btn=document.getElementById('forkBtn')||forkConvoBtn;
  if(btn){btn.disabled=true;}
  try{
  var title=(currentConvoTitle||'Chat')+' (continued)';
  var r=await fetch('/conversations/fork',mergeApiHeaders({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:title,messages:currentMessages})}));
  if(!r.ok)throw new Error('fork failed');
  var nc=await r.json();
  mobileConvos=[nc].concat(mobileConvos.filter(function(x){return x.id!==nc.id;}));
  currentId=nc.id;currentSrc='mobile';currentMessages=nc.messages||[];currentConvoTitle=nc.title||'New chat';
  renderSidebar();renderMessages(currentMessages,false,'mobile',{cascade:true});
  updateCopyConvoButtonVisibility();closeSidebar();msgInput.focus();
  }catch(e){if(btn){btn.disabled=false;}alert('Could not fork: '+(e.message||e));}
}
async function forkConvo(){
  var ep={continue:'/continue/conversations/',grok:'/grok/conversations/',cursor:'/cursor/conversations/'};
  var base=ep[currentSrc];if(!base)return;
  var btn=document.getElementById('forkBtn')||forkConvoBtn;
  if(btn){btn.textContent='Creating...';btn.disabled=true;}
  try{
var branchQ=(currentSrc==='grok'&&branchCount>1)?'?branch=0':'';
var r=await fetch(base+encodeURIComponent(currentId)+branchQ);
if(!r.ok)throw new Error('fetch failed');
var data=await r.json();
var msgs=data.messages||[];
var title=(data.title||'Chat')+' (continued)';
var body={title:title};
if(data.branches&&Array.isArray(data.branches)&&data.branches.length>1){body.branches=data.branches;}else{body.messages=msgs;}
var r2=await fetch('/conversations/fork',mergeApiHeaders({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
if(!r2.ok)throw new Error('fork failed');
var nc=await r2.json();
mobileConvos=[nc].concat(mobileConvos.filter(function(x){return x.id!==nc.id;}));
currentId=nc.id;currentSrc='mobile';currentMessages=nc.messages||[];currentConvoTitle=nc.title||'New chat';
currentBranchIndex=nc.branch_index!==undefined?nc.branch_index:0;branchCount=nc.branch_count||1;
renderSidebar();renderMessages(currentMessages,false,'mobile',{cascade:true});updateThreadSwitcher();
closeSidebar();msgInput.focus();
  }catch(e){
if(btn){if(btn.id==='forkBtn')btn.textContent='\u25B6\uFE0F Continue with Locus';else if(forkConvoBtn&&btn===forkConvoBtn)btn.innerHTML=ICON_FORK;btn.disabled=false;}
alert('Could not fork conversation: '+(e.message||e));
  }
}
if(forkConvoBtn)forkConvoBtn.addEventListener('click',function(){if(!confirm('Fork to new chat?'))return;setTimeout(function(){if(currentSrc==='mobile')forkConvoMobile();else forkConvo();},0);});
/* ── New chat ── */
async function newChat(){
  var r=await fetch('/conversations',mergeApiHeaders({method:'POST'}));if(!r.ok)return;
  var c=await r.json();
  mobileConvos=[c].concat(mobileConvos.filter(function(x){return x.id!==c.id}));
  currentId=c.id;currentSrc='mobile';currentMessages=[];currentConvoTitle=c.title||'New chat';
  currentBranchIndex=0;branchCount=1;
  renderSidebar();renderMessages([],false,'mobile');
  updateThreadSwitcher();updateCopyConvoButtonVisibility();closeSidebar();msgInput.focus();
}
sbNew.addEventListener('click',newChat);
var headerNewBtn=document.getElementById('headerNewBtn');
if(headerNewBtn)headerNewBtn.addEventListener('click',newChat);
if(hdrCopyExportBtn){
  hdrCopyExportBtn.addEventListener('click',function(e){e.stopPropagation();var open=!hdrCopyExportDropdown.classList.contains('open');hdrCopyExportDropdown.classList.toggle('open',open);hdrCopyExportDropdown.setAttribute('aria-hidden',open?'false':'true');hdrCopyExportBtn.setAttribute('aria-expanded',open?'true':'false');});
}
if(copyConvoAction)copyConvoAction.addEventListener('click',function(){copyConversationToClipboard();closeCopyExportDropdown();});
if(exportConvoAction)exportConvoAction.addEventListener('click',function(){exportConversationAsMarkdown();closeCopyExportDropdown();});
var refreshAppAction=document.getElementById('refreshAppAction');
if(refreshAppAction)refreshAppAction.addEventListener('click',function(){closeCopyExportDropdown();location.reload();});
var refreshAppBtn=document.getElementById('refreshAppBtn');
if(refreshAppBtn)refreshAppBtn.addEventListener('click',function(){location.reload();});
document.addEventListener('click',function(){closeCopyExportDropdown();});
/* ── Input auto-resize & keyboard ── */
function autoResize(){msgInput.style.height='auto';msgInput.style.height=Math.min(msgInput.scrollHeight,130)+'px'}
function updateContextIndicator(){
  var el=document.getElementById('contextIndicator'),arc=document.getElementById('contextIndicatorArc');
  if(!el||!arc||!msgInput)return;
  var len=(msgInput.value||'').length;
  var cap=1000;
  var pct=cap<=0?0:Math.min(1,len/cap);
  arc.setAttribute('stroke-dashoffset',String(Math.round(88*(1-pct))));
  el.classList.remove('medium','high');
  if(pct>=.5)el.classList.add('medium');
  if(pct>=.85)el.classList.add('high');
}
msgInput.addEventListener('input',function(){ autoResize(); saveDraftDebounced(); hideDraftRestoredHint(); updateContextIndicator(); });
msgInput.addEventListener('keydown',function(e){
  if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){
e.preventDefault();send();
  }
});
sendBtn.addEventListener('click',send);
  msgInput.addEventListener('focus',function(){setTimeout(scrollBottom,350)});
