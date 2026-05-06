/* ── Sidebar Render ── */
function starOrbitHtml(){
  return ' <span class="sb-item-star-wrap" title="Important"><span class="star-orbit-sparkles">'
    +'<span class="star-orbit-wrap star-orbit-inner star-orbit-tilt-in" style="--orbit-duration:2s;--orbit-phase:0"><span class="star-orbit-dot"></span></span>'
    +'<span class="star-orbit-wrap star-orbit-outer star-orbit-tilt-out star-orbit-rev" style="--orbit-duration:2.2s;--orbit-phase:0.3s"><span class="star-orbit-dot"></span></span>'
    +'</span></span>';
}
function renderSidebar(){
  var q=(sbSearch.value||'').trim().toLowerCase();
  /* Archive view */
  if(showArchive){
var archived=archivedConvos.filter(function(c){return !q||(c.title||'').toLowerCase().indexOf(q)!==-1});
var html='<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px 4px">'
  +'<span class="sb-section" style="padding:0">&#128451; Archived ('+archived.length+')</span>'
  +'<button onclick="showArchive=false;renderSidebar()" style="background:none;border:none;color:var(--pink);font-size:12px;cursor:pointer;font-weight:700">&#8592; Back</button>'
  +'</div>';
if(!archived.length)html+='<div style="padding:24px;text-align:center;color:#555;font-size:13px;">No archived chats</div>';
else html+=archived.map(function(c){
  return'<div class="sb-item" style="opacity:.75" role="button" tabindex="0" data-id="'+esc(c.id)+'" data-src="mobile">'
    +'<div class="txt"><div class="ttl">'+esc(c.title||'Chat')+'</div>'
    +'<div class="ts">archived &middot; '+(c.updated_at?fmtDate(c.updated_at):'')+'</div></div>'
    +'<button type="button" class="act restore-btn" data-id="'+esc(c.id)+'" title="Restore" style="background:#000 !important;border:none !important;color:#ff99ee !important;box-shadow:0 0 16px rgba(255,100,235,.65),0 0 32px rgba(230,60,255,.45)">&#8617; Restore</button>'
    +'</div>';
}).join('');
sbList.innerHTML=html;
sbList.querySelectorAll('.restore-btn').forEach(function(btn){ btn.addEventListener('click',function(e){ e.stopPropagation(); restoreConvo(btn.dataset.id); }); });
return;
  }
  var all=allConvos().filter(function(c){
if(!q)return true;
return(c.title||'').toLowerCase().indexOf(q)!==-1||(c.id||'').toLowerCase().indexOf(q)!==-1;
  });
  var pinned=all.filter(function(c){return c.source==='mobile'&&c.pinned});
  var rest=all.filter(function(c){return!(c.source==='mobile'&&c.pinned)});
  var rows=[];
  if(pinned.length){rows.push({type:'section',label:'&#128204; Pinned',height:SB_SECTION_HEIGHT});pinned.forEach(function(c){rows.push({type:'item',convo:c,height:SB_ITEM_HEIGHT});});}
  if(rest.length){if(pinned.length)rows.push({type:'section',label:'Recent',height:SB_SECTION_HEIGHT});rest.forEach(function(c){rows.push({type:'item',convo:c,height:SB_ITEM_HEIGHT});});}
  if(archivedConvos.length)rows.push({type:'footer',height:SB_FOOTER_HEIGHT});
  var totalRows=rows.length;
  if(totalRows>VIRTUAL_THRESHOLD&&totalRows>0){
    var offsets=[];offsets[0]=0;for(var i=0;i<rows.length;i++)offsets[i+1]=offsets[i]+rows[i].height;
    var totalHeight=offsets[rows.length];
    _sidebarRows=rows;_sidebarOffsets=offsets;_sidebarTotalHeight=totalHeight;
    sbList.innerHTML='';
    var inner=document.createElement('div');inner.className='sb-list-inner';inner.style.cssText='height:'+totalHeight+'px;position:relative;';
    var visual=document.createElement('div');visual.className='sb-list-visual';visual.style.cssText='position:absolute;top:0;left:0;right:0;min-height:'+totalHeight+'px;';
    inner.appendChild(visual);sbList.appendChild(inner);
    if(!sbList._virtualScrollOn){sbList._virtualScrollOn=true;sbList.addEventListener('scroll',function(){if(_virtualScrollRaf)return;_virtualScrollRaf=requestAnimationFrame(function(){_virtualScrollRaf=null;updateVisibleRows();});});}
    updateVisibleRows();
    return;
  }
  var html='';
  if(pinned.length){html+='<div class="sb-section">&#128204; Pinned</div>';html+=pinned.map(renderSbItem).join('')}
  if(rest.length){if(pinned.length)html+='<div class="sb-section">Recent</div>';html+=rest.map(renderSbItem).join('')}
  if(!html){var searchTip=(searchResults!==null&&(sbSearch.value||'').trim())?'<br><span style="font-size:11px;color:#888;margin-top:6px;display:inline-block">Tip: type ⭐ or "star" to see starred chats</span>':'';html='<div style="padding:24px;text-align:center;color:#555;font-size:13px;">No chats yet'+searchTip+'</div>';}
  var archivedMatchCount=q?archivedConvos.filter(function(c){return(c.title||'').toLowerCase().indexOf(q)!==-1;}).length:archivedConvos.length;
  if(archivedConvos.length)html+='<button type="button" onclick="showArchive=true;renderSidebar()" role="button" style="width:100%;padding:12px;text-align:center;font-size:13px;color:var(--pink);cursor:pointer;border-top:1px solid var(--border);margin-top:4px;background:rgba(255,122,217,.08);border-left:none;border-right:none;border-bottom:none;font-weight:600">&#128451; '+(archivedMatchCount||archivedConvos.length)+' archived chat'+(archivedConvos.length!==1?'s':'')+(q&&archivedMatchCount?(archivedMatchCount===1?' match':' matches'):'')+' — Tap to open</button>';
  sbList.innerHTML=html;
}
function renderSbItem(c){
  var isActive=c.id===currentId&&c.source===currentSrc;
  var isMobile=c.source==='mobile';
  var ts=fmtDate(c.updated_at);
  var spark=(c.sparkline_data&&Array.isArray(c.sparkline_data)&&c.sparkline_data.length)?c.sparkline_data:[];
  var sparkHtml='';
  if(spark.length){
    sparkHtml='<div class="mini-sparkline-wrapper" title="Tap for activity breakdown (messages, files, code, media)" aria-label="Activity breakdown">'+spark.map(function(v){
      var pct=Math.max(8,(v/10)*100);
      return '<div class="spark-bar" style="height:'+pct+'%"></div>';
    }).join('')+'</div>';
  }
  var fourRoundUrl='/api/asset/file/four-round-point-connection-svgrepo-com.svg';
  var bombUrl='/api/asset/bomb/bomb-svgrepo-com.svg';
  return '<div class="sb-item'+(isActive?' active':'')+(isMobile&&c.pinned?' pinned':'')+(isMobile&&c.important?' important':'')+'" role="button" tabindex="0" data-id="'+esc(c.id)+'" data-src="'+c.source+'">'
+(isMobile
  ?'<div class="sb-item-actions-wrap" data-id="'+esc(c.id)+'">'
  +'<button type="button" class="sb-actions-trigger act" title="Actions" aria-label="Pin, Star, Rename, Delete"><img src="'+fourRoundUrl+'" alt="" class="sb-actions-trigger-icon" width="20" height="20"></button>'
  +'<div class="sb-actions-four">'
  +'<button type="button" class="act pin-btn'+(c.pinned?' pinned':'')+'" data-id="'+esc(c.id)+'" title="'+(c.pinned?'Unpin':'Pin')+'">'+(c.pinned?'&#9670;':'&#9671;')+'</button>'
  +'<button type="button" class="act star-btn'+(c.important?' starred':'')+'" data-id="'+esc(c.id)+'" title="'+(c.important?'Unstar':'Star')+'">'+(c.important?'&#9733;':'&#9734;')+'</button>'
  +'<button type="button" class="act rename-btn" data-id="'+esc(c.id)+'" title="Rename"><img src="'+bombUrl+'" alt="" class="sb-actions-rename-icon" width="18" height="18"></button>'
  +'<button type="button" class="act del-btn" data-id="'+esc(c.id)+'" title="Delete">&#215;</button>'
  +'</div></div>'
  :'')
+'<div class="txt"><div class="ttl">'+esc(c.title||'Chat')+(isMobile&&c.important?starOrbitHtml():'')+'</div>'
+'<div class="ts-row"><div class="ts">'+(ts?ts+' \u00B7 ':'')+srcLabel(c.source)+'</div>'+sparkHtml+'</div></div>'
+(isMobile
  ?''
  :srcBadge(c.source))
+'</div>';
}
function updateVisibleRows(){
  var inner=sbList.querySelector('.sb-list-inner');if(!inner)return;
  var visual=inner.querySelector('.sb-list-visual');if(!visual||!_sidebarRows.length)return;
  var scrollTop=sbList.scrollTop,clientHeight=sbList.clientHeight;
  var start=0,end=_sidebarRows.length-1;
  for(var i=0;i<_sidebarRows.length;i++){if(_sidebarOffsets[i+1]>scrollTop){start=Math.max(0,i-BUFFER_ROWS);break;}}
  for(var j=_sidebarRows.length-1;j>=0;j--){if(_sidebarOffsets[j]<scrollTop+clientHeight){end=Math.min(_sidebarRows.length-1,j+BUFFER_ROWS);break;}}
  visual.innerHTML='';
  for(var i=start;i<=end;i++){
    var r=_sidebarRows[i],off=_sidebarOffsets[i],h=r.height;
    var wrap=document.createElement('div');wrap.style.cssText='position:absolute;left:0;right:0;top:'+off+'px;height:'+h+'px;';
    if(r.type==='section'){wrap.className='sb-section';wrap.style.padding='8px 12px 4px';wrap.innerHTML=r.label;}
    else if(r.type==='item'){wrap.innerHTML=renderSbItem(r.convo);}
    else if(r.type==='footer'){var archCount=archivedConvos.length;wrap.innerHTML='<button type="button" onclick="showArchive=true;renderSidebar()" role="button" style="width:100%;padding:12px;text-align:center;font-size:13px;color:var(--pink);cursor:pointer;border-top:1px solid var(--border);margin-top:4px;background:rgba(255,122,217,.08);border-left:none;border-right:none;border-bottom:none;font-weight:600">&#128451; '+archCount+' archived chat'+(archCount!==1?'s':'')+' — Tap to open</button>';}
    visual.appendChild(wrap);
  }
}
var _sbSearchTimer=null;
sbSearch.addEventListener('input',function(){
  var self=this;
  clearTimeout(_sbSearchTimer);
  _sbSearchTimer=setTimeout(function(){
    var q=(self.value||'').trim();
    if(q){
      fetch('/conversations?q='+encodeURIComponent(q)+'&_='+Date.now(),mergeApiHeaders({cache:'no-store'})).then(function(r){return r.json();}).then(function(data){searchResults=data.conversations||[];renderSidebar();}).catch(function(){searchResults=[];renderSidebar();});
    }else{searchResults=null;renderSidebar();}
  },180);
});
