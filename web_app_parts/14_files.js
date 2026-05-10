/* ── Files panel ── */
var _filesCurrentPath='D:\\';
var _filesPathStack=['D:\\'];
function fileIcon(entry){
  if(entry.is_dir)return '📁';
  var e=entry.ext||'';
  if(['.md','.txt'].includes(e))return '📄';
  if(['.py','.js','.ts','.jsx','.tsx','.html','.css'].includes(e))return '💻';
  if(['.json','.yaml','.yml','.toml','.env'].includes(e))return '⚙️';
  if(['.png','.jpg','.jpeg','.gif','.webp','.svg'].includes(e))return '🖼️';
  if(['.mp3','.aac','.wav','.flac'].includes(e))return '🎵';
  if(['.mp4','.mov','.mkv'].includes(e))return '🎬';
  return '📎';
}
function formatFileSize(bytes){
  if(!bytes)return '';
  if(bytes<1024)return bytes+' B';
  if(bytes<1048576)return (bytes/1024).toFixed(1)+' KB';
  return (bytes/1048576).toFixed(1)+' MB';
}
async function loadFiles(path){
  _filesCurrentPath=path;
  var list=document.getElementById('fileList');
  var crumb=document.getElementById('fileBreadcrumb');
  if(!list)return;
  if(crumb)crumb.textContent=path;
  list.innerHTML='<div class="panel-loading">Loading…</div>';
  try{
    var entries=await fetch('/api/files?path='+encodeURIComponent(path),mergeApiHeaders({})).then(function(r){return r.json();});
    list.innerHTML='';
    if(_filesPathStack.length>1){
      var up=document.createElement('div');
      up.className='file-up-row';
      up.innerHTML='⬆ Up';
      up.onclick=function(){_filesPathStack.pop();loadFiles(_filesPathStack[_filesPathStack.length-1]);};
      list.appendChild(up);
    }
    if(!entries.length){
      list.innerHTML+='<div class="panel-empty"><div class="panel-emoji">📭</div><div>Empty folder</div></div>';
      return;
    }
    entries.forEach(function(entry){
      var div=document.createElement('div');
      div.className='file-entry-row';
      div.innerHTML='<span class="file-row-icon">'+fileIcon(entry)+'</span>'
        +'<span class="file-row-name">'+escapeHtml(entry.name)+'</span>'
        +'<span class="file-row-meta">'+(entry.is_dir?'':formatFileSize(entry.size))+'</span>';
      if(entry.is_dir){
        div.onclick=function(){_filesPathStack.push(entry.path);loadFiles(entry.path);};
      }else if(entry.readable){
        div.onclick=function(){openFile(entry.path,entry.name);};
      }else{
        div.style.opacity='0.45';
        div.style.cursor='default';
      }
      list.appendChild(div);
    });
  }catch(e){
    list.innerHTML='<div class="panel-empty"><div class="panel-emoji">🚫</div><div>'+(e.message||'Could not load folder')+'</div></div>';
  }
}
async function openFile(path,name){
  var title=document.getElementById('fileDetailTitle');
  var content=document.getElementById('fileDetailContent');
  var detail=document.getElementById('fileDetail');
  if(title)title.textContent=name;
  if(content)content.innerHTML='<div class="panel-loading">Loading…</div>';
  if(detail)detail.classList.add('open');
  try{
    var data=await fetch('/api/files/read?path='+encodeURIComponent(path),mergeApiHeaders({})).then(function(r){return r.json();});
    var ext=(name.split('.').pop()||'').toLowerCase();
    if(ext==='md'&&typeof window.marked!=='undefined'&&window.marked){
      if(content)content.innerHTML=window.marked.parse(data.content||'');
    }else{
      if(content)content.innerHTML='<pre><code>'+escapeHtml(data.content||'')+'</code></pre>';
    }
  }catch(e){
    if(content)content.innerHTML='<em>Could not read file: '+escapeHtml(e.message)+'</em>';
  }
}
function closeFileDetail(){
  var detail=document.getElementById('fileDetail');
  if(detail)detail.classList.remove('open');
}
(function(){
  var backBtn=document.getElementById('fileDetailBack');
  if(backBtn)backBtn.onclick=closeFileDetail;
})();
