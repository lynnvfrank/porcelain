/* ── Load ── */
async function loadAll(){
  /* Fast path: load only mobile conversations first so chat appears immediately (iPhone/slow networks). */
  try{
    var r=await fetch('/conversations?_='+Date.now(),mergeApiHeaders({cache:'no-store'}));
    if(!r.ok&&r.status===403){ try{ var j=await r.json(); if(j&&j.detail==='account_locked')showAccountLocked(); }catch(_){} return; }
    var data=r.ok?await r.json():null;
    mobileConvos=(data&&data.conversations)?data.conversations:[];
    if(!mobileConvos.length&&!r.ok){ var r2=await fetch('/conversations?_='+Date.now(),mergeApiHeaders({cache:'no-store'})); if(r2.ok){ var d2=await r2.json(); mobileConvos=(d2&&d2.conversations)?d2.conversations:[]; } }
  }catch(e){ mobileConvos=[]; }
  if(!mobileConvos.length){
    try{ var cr=await fetch('/conversations',mergeApiHeaders({method:'POST'})); if(cr.ok)mobileConvos=[(await cr.json())]; }catch(_){}
  }
  if(!currentId&&mobileConvos.length){ currentId=mobileConvos[0].id; currentSrc='mobile'; }
  renderSidebar();
  if(currentId){ await loadConvo(currentId,currentSrc); } else { clearChat(); showEmpty(); currentBranchIndex=0; branchCount=1; updateThreadSwitcher(); }
  /* Load other sources in background only when signed in (VS Code/Grok/Cursor hidden when signed out). */
  var promises=[fetch('/conversations/archive',mergeApiHeaders({}))];
  if(signedInUser){
    promises.push(fetch('/continue/conversations'),fetch('/grok/conversations'),fetch('/cursor/conversations'));
  }else{
    continueConvos=[];grokConvos=[];cursorConvos=[];
  }
  Promise.allSettled(promises).then(async function(results){
    var i=0;
    try{ if(results[i].status==='fulfilled'&&results[i].value.ok)archivedConvos=(await results[i].value.json()).conversations||[]; }catch(_){}
    i++;
    if(signedInUser&&results[i]){
      try{ if(results[i].status==='fulfilled'&&results[i].value.ok)continueConvos=(await results[i].value.json()).conversations||[]; }catch(_){}
      i++;
      try{ if(results[i].status==='fulfilled'&&results[i].value.ok)grokConvos=(await results[i].value.json()).conversations||[]; }catch(_){}
      i++;
      try{ if(results[i].status==='fulfilled'&&results[i].value.ok)cursorConvos=(await results[i].value.json()).conversations||[]; }catch(_){}
    }
    renderSidebar();
  }).catch(function(){});
}
async function loadConvo(id,src){
  currentId=id;currentSrc=src||'mobile';renderSidebar();
  hideEngagementBanner();
  currentFeedback={};
  if(src==='mobile'){
    try{
      var fr=await fetch('/conversations/'+encodeURIComponent(id)+'/feedback',mergeApiHeaders({}));
      if(fr.ok){var fd=await fr.json();if(fd&&fd.feedback&&typeof fd.feedback==='object'){for(var k in fd.feedback){var idx=parseInt(k,10);if(!isNaN(idx))currentFeedback[idx]=fd.feedback[k];}}}
    }catch(_){}
  }
  var ep={mobile:'/conversations/'+encodeURIComponent(id),continue:'/continue/conversations/'+encodeURIComponent(id),grok:'/grok/conversations/'+encodeURIComponent(id),cursor:'/cursor/conversations/'+encodeURIComponent(id)};
  if(src==='mobile'){ep.mobile=ep.mobile+'?branch='+currentBranchIndex;}
  if(src==='grok'){ep.grok=ep.grok+'?branch='+currentBranchIndex;}
  try{
var r=await fetch(ep[src]||ep.mobile,(src==='mobile')?mergeApiHeaders({}):{});
if(!r.ok){clearChat();showEmpty();currentMessages=[];currentConvoTitle='';currentBranchIndex=0;branchCount=1;updateCopyConvoButtonVisibility();updateThreadSwitcher();return;}
var c=await r.json();
currentMessages=c.messages||[];currentConvoTitle=(src==='mobile'?(c.title||'Chat'):(c.title||'Grok chat'));
if(src==='mobile'||src==='grok'){branchCount=c.branch_count||1;currentBranchIndex=typeof c.branch_index==='number'?c.branch_index:0;}else{branchCount=1;currentBranchIndex=0;}
var branchCountNow=c.branch_count||1;
var cascadeOpts=(branchCountNow>1)?{cascade:true}:{};
renderMessages(c.messages||[],src!=='mobile',src,cascadeOpts);
updateThreadSwitcher();
recordEngagementAndMaybePrompt(id,src);
restoreDraftForConvo(id,src);
var searchQ=(searchResults!==null&&sbSearch&&(sbSearch.value||'').trim())?(sbSearch.value||'').trim():'';
if(searchQ){setTimeout(function(){scrollToAndHighlightFirstMatch(searchQ);},120);}
  }catch(e){console.error(e);clearChat();showEmpty();currentMessages=[];currentConvoTitle='';currentBranchIndex=0;branchCount=1;updateCopyConvoButtonVisibility();updateThreadSwitcher();}
}
function hideEngagementBanner(){
  var b=document.getElementById('engagementBanner');if(b){b.classList.remove('show');b.style.display='none';}
}
function recordEngagementAndMaybePrompt(convId,src){
  fetch('/conversations/engagement/record',mergeApiHeaders({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source:src,id:convId})})).then(function(r){return r.json();}).then(function(data){
    if(!data.suggest_important)return;
    var banner=document.getElementById('engagementBanner');if(!banner)return;
    var text=banner.querySelector('.engagement-banner-text');var yesBtn=banner.querySelector('.engagement-banner-yes');var noBtn=banner.querySelector('.engagement-banner-no');
    if(text)text.textContent="You've returned to this chat a few times. Star this chat?";
    if(yesBtn){yesBtn.onclick=function(){yesBtn.disabled=true;fetch('/conversations/engagement/mark_important',mergeApiHeaders({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source:src,id:convId,important:true})})).then(function(){hideEngagementBanner();if(src==='mobile'){var idx=mobileConvos.findIndex(function(c){return c.id===convId});if(idx>=0){mobileConvos[idx]=Object.assign({},mobileConvos[idx],{important:true});renderSidebar();}};});};}
    if(noBtn){noBtn.onclick=function(){hideEngagementBanner();};}
    banner.classList.add('show');banner.style.display='flex';
  }).catch(function(){});
}
function switchConvo(id,src){currentId=id;currentSrc=src;loadConvo(id,src)}
function scrollToAndHighlightFirstMatch(term){
  if(!term||!chatArea)return;
  var bubbles=chatArea.querySelectorAll('.bubble');
  var lower=term.toLowerCase();
  for(var i=0;i<bubbles.length;i++){
    var bubble=bubbles[i];
    var text=(bubble.textContent||'');
    var idx=text.toLowerCase().indexOf(lower);
    if(idx===-1)continue;
    bubble.querySelectorAll('mark.search-highlight').forEach(function(m){var t=document.createTextNode(m.textContent);m.parentNode.replaceChild(t,m);});
    var walker=document.createTreeWalker(bubble,NodeFilter.SHOW_TEXT,null,false);
    var node;
    while((node=walker.nextNode())){
      var t=node.textContent;
      var pos=t.toLowerCase().indexOf(lower);
      if(pos===-1)continue;
      var before=t.slice(0,pos);
      var match=t.slice(pos,pos+term.length);
      var after=t.slice(pos+term.length);
      var frag=document.createDocumentFragment();
      if(before)frag.appendChild(document.createTextNode(before));
      var mark=document.createElement('mark');
      mark.className='search-highlight';
      mark.textContent=match;
      frag.appendChild(mark);
      if(after)frag.appendChild(document.createTextNode(after));
      node.parentNode.replaceChild(frag,node);
      break;
    }
    bubble.scrollIntoView({behavior:'smooth',block:'center'});
    return;
  }
}
