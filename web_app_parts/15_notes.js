/* ── Notes panel ── */
var _notesAskController=null;
var _currentNoteName=null;
function showNotesToast(msg){
  var t=document.getElementById('notesToast');
  if(!t)return;
  t.textContent=msg;t.classList.add('show');
  setTimeout(function(){t.classList.remove('show');},2200);
}
async function notesAsk(){
  var inp=document.getElementById('notesAskInput');
  var result=document.getElementById('notesAskResult');
  var textEl=document.getElementById('notesAskText');
  var btn=document.querySelector('#notesAskBar .notes-ask-submit');
  var q=inp?inp.value.trim():'';
  if(!q)return;
  var provider='groq',model=null,project=null;
  try{var gs=await fetch('/api/gateway/status',mergeApiHeaders({})).then(function(r){return r.json();});if(gs.online&&gs.virtual_model){provider='gateway';model=gs.virtual_model;project='notes';}}catch(e){}
  if(_notesAskController)_notesAskController.abort();
  _notesAskController=new AbortController();
  if(result)result.style.display='flex';
  if(btn)btn.disabled=true;
  if(textEl)textEl.innerHTML='<span class="locus-cursor"></span>';
  var messages=[{role:'user',content:q}];
  var body={messages:messages,provider:provider};
  if(model)body.model=model;
  if(project)body.project=project;
  var raw='';
  try{
    var resp=await fetch('/api/chat',mergeApiHeaders({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:_notesAskController.signal}));
    var reader=resp.body.getReader();var dec=new TextDecoder();
    if(textEl)textEl.innerHTML='';
    while(true){
      var chunk=await reader.read();if(chunk.done)break;
      var lines=dec.decode(chunk.value).split('\n');
      for(var i=0;i<lines.length;i++){
        var line=lines[i];if(!line.startsWith('data: '))continue;
        var payload=line.slice(6);if(payload==='{"type":"done"}')break;
        try{var d=JSON.parse(payload);if(d.type==='content'){raw+=d.text;if(textEl){textEl.innerHTML=(typeof window.marked!=='undefined'&&window.marked)?window.marked.parse(raw):escapeHtml(raw).replace(/\n/g,'<br>');textEl.scrollTop=textEl.scrollHeight;}}}catch(e){}
      }
    }
  }catch(err){
    if(err.name!=='AbortError'&&textEl)textEl.innerHTML='<em style="color:var(--muted)">Could not reach AI.</em>';
  }finally{
    if(btn)btn.disabled=false;
    _notesAskController=null;
  }
}
function toggleNotesAsk(){
  var bar=document.getElementById('notesAskBar');
  if(!bar)return;
  var hidden=bar.style.display==='none'||!bar.style.display;
  bar.style.display=hidden?'flex':'none';
  if(hidden){var inp=document.getElementById('notesAskInput');if(inp)inp.focus();}
  else{closeNotesAsk();}
}
function closeNotesAsk(){
  if(_notesAskController)_notesAskController.abort();
  var result=document.getElementById('notesAskResult');
  var textEl=document.getElementById('notesAskText');
  if(result)result.style.display='none';
  if(textEl)textEl.innerHTML='';
}
async function loadNotes(){
  var list=document.getElementById('notesList');
  if(!list)return;
  list.innerHTML='<div class="panel-loading">Loading…</div>';
  try{
    var notes=await fetch('/api/notes',mergeApiHeaders({})).then(function(r){return r.json();});
    if(!notes.length){list.innerHTML='<div class="panel-empty"><div class="panel-emoji">📝</div><div>No notes yet.<br>Tap + New to start!</div></div>';return;}
    list.innerHTML='';
    notes.forEach(function(n){
      var div=document.createElement('div');
      div.className='panel-list-item';
      var name=(n.filename||'').replace('.md','').replace(/-/g,' ');
      div.innerHTML='<div class="pli-title">'+escapeHtml(name)+'</div><div class="pli-meta">'+new Date(n.modified*1000).toLocaleDateString()+' · '+formatFileSize(n.size)+'</div>';
      div.onclick=function(){openNote(n.filename);};
      list.appendChild(div);
    });
  }catch(e){
    list.innerHTML='<div class="panel-empty"><div class="panel-emoji">😔</div><div>Could not load notes.</div></div>';
  }
}
function openNewNote(){
  _currentNoteName=null;
  var t=document.getElementById('noteDetailTitle');var ta=document.getElementById('noteTextarea');var sb=document.getElementById('noteSaveBtn');
  if(t)t.textContent='New Note';
  if(ta)ta.value='';
  if(sb)sb.textContent='Save';
  var detail=document.getElementById('noteDetail');
  if(detail)detail.classList.add('open');
  setTimeout(function(){var ta=document.getElementById('noteTextarea');if(ta)ta.focus();},300);
}
async function openNote(filename){
  _currentNoteName=filename;
  var t=document.getElementById('noteDetailTitle');var ta=document.getElementById('noteTextarea');var sb=document.getElementById('noteSaveBtn');
  if(t)t.textContent=(filename||'').replace('.md','').replace(/-/g,' ');
  if(ta)ta.value='Loading…';
  if(sb)sb.textContent='Save';
  var detail=document.getElementById('noteDetail');
  if(detail)detail.classList.add('open');
  try{
    var data=await fetch('/api/notes/'+encodeURIComponent(filename),mergeApiHeaders({})).then(function(r){return r.json();});
    if(ta)ta.value=data.content||'';
  }catch(e){if(ta)ta.value='';}
}
async function saveNote(){
  var ta=document.getElementById('noteTextarea');
  var sb=document.getElementById('noteSaveBtn');
  var content=ta?ta.value.trim():'';
  if(!content){showNotesToast('Nothing to save!');return;}
  if(sb)sb.textContent='Saving…';
  try{
    if(_currentNoteName){
      await fetch('/api/notes/'+encodeURIComponent(_currentNoteName),mergeApiHeaders({method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:content})}));
      showNotesToast('✅ Saved!');
    }else{
      if(sb)sb.textContent='Naming…';
      var data=await fetch('/api/notes',mergeApiHeaders({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:content})})).then(function(r){return r.json();});
      _currentNoteName=data.filename;
      var t=document.getElementById('noteDetailTitle');
      if(t)t.textContent=(data.filename||'').replace('.md','').replace(/-/g,' ');
      showNotesToast('✅ Saved as "'+((data.filename||'').replace('.md',''))+'"!');
    }
  }catch(e){showNotesToast('❌ Save failed');}
  if(sb)sb.textContent='Save';
}
function closeNoteDetail(){
  var detail=document.getElementById('noteDetail');
  if(detail)detail.classList.remove('open');
  _currentNoteName=null;
}
(function(){
  var newBtn=document.getElementById('notesNewBtn');
  var askToggleBtn=document.getElementById('notesAskToggleBtn');
  var askSubmitBtn=document.querySelector('#notesAskBar .notes-ask-submit');
  var askInp=document.getElementById('notesAskInput');
  var noteBackBtn=document.getElementById('noteDetailBack');
  var noteSaveBtn=document.getElementById('noteSaveBtn');
  if(newBtn)newBtn.onclick=openNewNote;
  if(askToggleBtn)askToggleBtn.onclick=toggleNotesAsk;
  if(askSubmitBtn)askSubmitBtn.onclick=notesAsk;
  if(askInp)askInp.addEventListener('keydown',function(e){if(e.key==='Enter')notesAsk();});
  if(noteBackBtn)noteBackBtn.onclick=closeNoteDetail;
  if(noteSaveBtn)noteSaveBtn.onclick=saveNote;
})();
