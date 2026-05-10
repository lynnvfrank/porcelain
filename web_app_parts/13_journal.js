/* ── Journal panel ── */
var _journalAskController=null;
function renderMdJournal(text){
  if(typeof window.marked!=='undefined'&&window.marked){try{return window.marked.parse(text||'');}catch(e){}}
  return escapeHtml(text||'').replace(/\n/g,'<br>');
}
async function journalAsk(){
  var inp=document.getElementById('journalAskInput');
  var result=document.getElementById('journalAskResult');
  var textEl=document.getElementById('journalAskText');
  var btn=document.querySelector('.journal-ask-btn');
  var q=inp?inp.value.trim():'';
  if(!q)return;
  var provider='groq',model=null,project=null;
  try{var gs=await fetch('/api/gateway/status',mergeApiHeaders({})).then(function(r){return r.json();});if(gs.online&&gs.virtual_model){provider='gateway';model=gs.virtual_model;project='transcripts';}}catch(e){}
  if(_journalAskController)_journalAskController.abort();
  _journalAskController=new AbortController();
  if(result)result.style.display='flex';
  if(btn)btn.disabled=true;
  if(textEl)textEl.innerHTML='<span class="locus-cursor"></span>';
  var messages=[{role:'user',content:provider==='gateway'?q:'You are a helpful AI. Ruby is asking about her personal journal. Note: the AI gateway is offline so you don\'t have direct access to her transcripts. Question: '+q}];
  var body={messages:messages,provider:provider};
  if(model)body.model=model;
  if(project)body.project=project;
  var raw='';
  try{
    var resp=await fetch('/api/chat',mergeApiHeaders({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:_journalAskController.signal}));
    var reader=resp.body.getReader();var dec=new TextDecoder();
    if(textEl)textEl.innerHTML='';
    while(true){
      var chunk=await reader.read();if(chunk.done)break;
      var lines=dec.decode(chunk.value).split('\n');
      for(var i=0;i<lines.length;i++){
        var line=lines[i];if(!line.startsWith('data: '))continue;
        var payload=line.slice(6);if(payload==='{"type":"done"}')break;
        try{var d=JSON.parse(payload);if(d.type==='content'){raw+=d.text;if(textEl){textEl.innerHTML=renderMdJournal(raw);textEl.scrollTop=textEl.scrollHeight;}}}catch(e){}
      }
    }
  }catch(err){
    if(err.name!=='AbortError'&&textEl)textEl.innerHTML='<em style="color:var(--muted)">Could not reach AI.</em>';
  }finally{
    if(btn)btn.disabled=false;
    _journalAskController=null;
  }
}
function closeJournalAsk(){
  if(_journalAskController)_journalAskController.abort();
  var result=document.getElementById('journalAskResult');
  var textEl=document.getElementById('journalAskText');
  var inp=document.getElementById('journalAskInput');
  if(result)result.style.display='none';
  if(textEl)textEl.innerHTML='';
  if(inp)inp.value='';
}
async function loadJournal(){
  var list=document.getElementById('journalList');
  if(!list)return;
  list.innerHTML='<div class="panel-loading">Loading…</div>';
  try{
    var convos=await fetch('/api/transcripts',mergeApiHeaders({})).then(function(r){return r.json();});
    if(!convos.length){list.innerHTML='<div class="panel-empty"><div class="panel-emoji">🎙️</div><div>No conversations yet.</div></div>';return;}
    list.innerHTML='';
    convos.forEach(function(c){
      var div=document.createElement('div');
      div.className='panel-list-item';
      div.innerHTML='<div class="pli-title">'+escapeHtml(c.label)+'</div><div class="pli-meta">'+new Date(c.modified*1000).toLocaleDateString()+'</div>';
      div.onclick=function(){openTranscript(c.id,c.label);};
      list.appendChild(div);
    });
  }catch(e){
    list.innerHTML='<div class="panel-empty"><div class="panel-emoji">😔</div><div>Could not load journal.</div></div>';
  }
}
async function openTranscript(id,label){
  var title=document.getElementById('journalDetailTitle');
  var content=document.getElementById('journalDetailContent');
  var detail=document.getElementById('journalDetail');
  if(title)title.textContent=label;
  if(content)content.innerHTML='<div class="panel-loading">Loading…</div>';
  if(detail)detail.classList.add('open');
  try{
    var data=await fetch('/api/transcripts/'+encodeURIComponent(id),mergeApiHeaders({})).then(function(r){return r.json();});
    if(content)content.innerHTML=renderMdJournal(data.content);
  }catch(e){
    if(content)content.innerHTML='<em>Could not load transcript.</em>';
  }
}
function closeJournalDetail(){
  var detail=document.getElementById('journalDetail');
  if(detail)detail.classList.remove('open');
}
(function(){
  var askBtn=document.querySelector('.journal-ask-btn');
  var askInp=document.getElementById('journalAskInput');
  var closeBtn=document.getElementById('journalAskClose');
  if(askBtn)askBtn.onclick=journalAsk;
  if(askInp)askInp.addEventListener('keydown',function(e){if(e.key==='Enter')journalAsk();});
  if(closeBtn)closeBtn.onclick=closeJournalAsk;
  var backBtn=document.getElementById('journalDetailBack');
  if(backBtn)backBtn.onclick=closeJournalDetail;
})();
