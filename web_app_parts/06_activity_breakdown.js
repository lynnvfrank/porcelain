/* ── Activity Breakdown (tap sparkline → overlay; click bucket → bigger view) ── */
var activityOverlay=document.getElementById('activityBreakdownOverlay');
var activityTitleEl=activityOverlay?activityOverlay.querySelector('.activity-breakdown-title'):null;
var activityBucketsEl=activityOverlay?activityOverlay.querySelector('.activity-buckets'):null;
var BUCKETS=[{key:'message_count',label:'Messages',color:'rgba(80,180,255,.9)',icon:'\uD83D\uDCAC'},{key:'files',label:'Files',color:'rgba(80,220,120,.9)',icon:'\uD83D\uDCC4'},{key:'code_snippets',label:'Code Snippets',color:'rgba(255,180,80,.9)',icon:'\uD83D\uDCBB'},{key:'media',label:'Media',color:'rgba(255,100,200,.9)',icon:'\uD83D\uDDBC'},{key:'feedback_liked',label:'Liked',color:'rgba(180,220,100,.9)',icon:'\uD83D\uDC4D'},{key:'feedback_noted',label:'Noted',color:'rgba(255,120,80,.9)',icon:'\uD83D\uDC4E'}];
var ICON_BUBBLE_NEON='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="14" height="14" class="icon-bubble-neon" aria-hidden="true"><style>.st0{fill:currentColor}</style><g><path class="st0" d="M133.048,121.218c-1.663,0-3.296,0.337-4.841,0.996c-20.036,8.606-36.119,24.218-45.306,43.973c-1.381,2.966-1.522,6.3-0.4,9.375c1.122,3.083,3.382,5.546,6.371,6.936c1.64,0.761,3.373,1.146,5.17,1.146c4.762,0,9.14-2.794,11.14-7.116c6.646-14.27,18.256-25.544,32.715-31.726c3.013-1.294,5.342-3.68,6.567-6.732c1.216-3.044,1.177-6.386-0.118-9.398C142.408,124.144,137.967,121.218,133.048,121.218z"/><path class="st0" d="M325.854,203.342c-0.016-89.821-73.11-162.915-162.932-162.931C73.102,40.427,0.015,113.521,0,203.342c0.015,89.821,73.102,162.908,162.923,162.924C252.744,366.25,325.838,293.163,325.854,203.342z M162.923,334.344c-34.974-0.008-67.869-13.636-92.629-38.372c-24.736-24.768-38.364-57.664-38.372-92.63c0.008-34.982,13.635-67.877,38.372-92.63c24.775-24.743,57.671-38.371,92.629-38.379c34.967,0.008,67.862,13.636,92.63,38.379c24.744,24.768,38.372,57.664,38.38,92.63c-0.008,34.959-13.635,67.854-38.38,92.63C230.793,320.708,197.898,334.336,162.923,334.344z"/><path class="st0" d="M427.458,69.815c-46.6,0.008-84.532,37.932-84.549,84.541c0.016,46.601,37.948,84.525,84.549,84.541c46.601-0.016,84.526-37.94,84.542-84.541C511.984,107.747,474.06,69.823,427.458,69.815z M464.661,191.575c-9.963,9.924-23.175,15.392-37.203,15.4c-14.035-0.008-27.247-5.476-37.218-15.408c-9.924-9.963-15.392-23.175-15.4-37.21c0.008-14.035,5.476-27.246,15.408-37.219c9.963-9.924,23.175-15.392,37.21-15.4c14.028,0.008,27.24,5.477,37.211,15.408c9.924,9.964,15.4,23.184,15.408,37.211C480.07,168.383,474.593,181.603,464.661,191.575z"/><path class="st0" d="M349.076,251.325c-2.683,10.434-6.261,20.664-10.654,30.487c16.146,2.808,30.761,10.379,42.428,22.03c15.024,15.047,23.292,35.029,23.301,56.258c-0.008,21.23-8.277,41.212-23.301,56.258c-15.048,15.024-35.03,23.301-56.258,23.309c-21.23-0.008-41.212-8.284-56.266-23.309c-11.015-11.03-18.421-24.822-21.559-40.042c-9.666,4.691-19.746,8.574-30.056,11.572c12.655,49.386,56.699,83.686,107.882,83.701c61.46-0.015,111.473-50.029,111.489-111.489C436.065,308.038,399.608,262.661,349.076,251.325z"/></g></svg>';
var ICON_BUBBLES_POP_NEON='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="20" height="20" class="icon-bubbles-pop-neon" aria-hidden="true"><style>.st0{fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10}</style><circle class="st0" cx="22" cy="22" r="7"/><path class="st0" d="M22,19c1,0,1.9,0.5,2.5,1.3"/><circle class="st0" cx="9" cy="9" r="4"/><circle class="st0" cx="5.5" cy="21.5" r="3.5"/><line class="st0" x1="19" y1="3" x2="19" y2="6"/><line class="st0" x1="26" y1="10" x2="23" y2="10"/><line class="st0" x1="23.9" y1="5.1" x2="21.8" y2="7.2"/></svg>';
var ICON_COPY_NEON='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" class="icon-copy-neon" aria-hidden="true"><rect x="9" y="9" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" rx="1"/><rect x="2" y="2" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" rx="1"/></svg>';
var ICON_FORK='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v8"/><path d="M6 22V10l6-6"/><path d="M18 22V10l-6-6"/></svg>';
function openImageLightbox(src){
  if(!src)return;
  var overlay=document.createElement('div');
  overlay.className='chat-img-lightbox';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Photo full size');
  overlay.style.cssText='position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';
  var img=document.createElement('img');img.src=src;img.alt='';img.style.cssText='max-width:100%;max-height:100%;object-fit:contain;border-radius:8px;';
  overlay.appendChild(img);
  function close(){overlay.remove();document.body.style.overflow='';}
  overlay.addEventListener('click',close);img.addEventListener('click',function(e){e.stopPropagation();});
  document.body.style.overflow='hidden';document.body.appendChild(overlay);
}
function getBubblePlainText(bubble){
  if(!bubble)return'';
  var t=bubble.innerText||bubble.textContent||'';
  return (t.replace(/\r\n/g,'\n').replace(/\r/g,'\n')||'').trim();
}
function copyMessageAndFeedback(btn,bubble){
  var wrap=bubble?bubble.closest('.msg-wrap'):null;
  var el=wrap?wrap.querySelector('.bubble'):bubble;
  var text=getBubblePlainText(el);
  if(!text)return;
  var label=btn.getAttribute('aria-label')||'Copy';
  var origHtml=btn.innerHTML;
  function done(ok){btn.innerHTML=ok?'<span class="copy-feedback">Copied!</span>':origHtml;btn.setAttribute('aria-label',label);if(ok)setTimeout(function(){btn.innerHTML=origHtml;},1600);}
  function tryClipboard(){
    if(navigator.clipboard&&navigator.clipboard.writeText)return navigator.clipboard.writeText(text).then(function(){done(true);}).catch(function(){tryFallback();});
    tryFallback();
  }
  function tryFallback(){
    var ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');ta.style.cssText='position:fixed;left:-9999px;top:0';document.body.appendChild(ta);ta.select();ta.setSelectionRange(0,text.length);
    var ok=false;try{ok=document.execCommand('copy');}catch(e){}document.body.removeChild(ta);done(ok);
  }
  tryClipboard();
}
function copyConversationToClipboard(){
  if(!currentMessages||!currentMessages.length)return;
  var lines=[];
  currentMessages.forEach(function(m){
    var role=(m.role||'').toLowerCase();
    var content=(m.content||'').trim();
    var label=role==='user'?getCurrentUserDisplayName():'AI';
    lines.push(label+': '+content);
  });
  var text=lines.join('\n\n');
  if(!text)return;
  function done(ok){
    if(hdrCopyExportBtn){hdrCopyExportBtn.dataset.copied=ok?'1':'';hdrCopyExportBtn.setAttribute('aria-label',ok?'Copied':(hdrCopyExportBtn.dataset.originalLabel||'Copy or export conversation'));if(ok)setTimeout(function(){hdrCopyExportBtn.dataset.copied='';},1600);}
  }
  function tryFallback(){
    var ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');ta.style.cssText='position:fixed;left:-9999px;top:0';document.body.appendChild(ta);ta.select();ta.setSelectionRange(0,text.length);
    var ok=false;try{ok=document.execCommand('copy');}catch(e){}document.body.removeChild(ta);done(ok);
  }
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text).then(function(){done(true);}).catch(tryFallback);
  else tryFallback();
}
function exportConversationAsMarkdown(){
  if(!currentMessages||!currentMessages.length)return;
  var lines=[];
  currentMessages.forEach(function(m){
    var role=(m.role||'').toLowerCase();
    var content=(m.content||'').trim();
    var label=role==='user'?getCurrentUserDisplayName():'AI';
    lines.push('## '+label+'\n\n'+content+'\n');
  });
  var md=lines.join('\n');
  var now=new Date();
  var y=now.getFullYear(),mo=String(now.getMonth()+1).padStart(2,'0'),d=String(now.getDate()).padStart(2,'0');
  var h=String(now.getHours()).padStart(2,'0'),mi=String(now.getMinutes()).padStart(2,'0');
  var name='conversation-'+y+'-'+mo+'-'+d+'-'+h+mi+'.md';
  var blob=new Blob([md],{type:'text/markdown;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.style.display='none';document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(a.href);
}
function updateCopyConvoButtonVisibility(){
  var show=currentMessages&&currentMessages.length>0;
  if(hdrCopyExportWrap){hdrCopyExportWrap.style.display=show?'inline-flex':'none';if(show&&hdrCopyExportBtn&&!hdrCopyExportBtn.dataset.originalLabel)hdrCopyExportBtn.dataset.originalLabel=hdrCopyExportBtn.getAttribute('aria-label')||'Copy or export';}
  if(forkConvoBtn)forkConvoBtn.style.display=show?'inline-flex':'none';
}
function closeCopyExportDropdown(){
  if(hdrCopyExportDropdown){hdrCopyExportDropdown.classList.remove('open');hdrCopyExportDropdown.setAttribute('aria-hidden','true');}
  if(hdrCopyExportBtn){hdrCopyExportBtn.setAttribute('aria-expanded','false');}
}
function sparkleBurst(container){
  var wrap=document.createElement('div');wrap.className='pop-sparkles';wrap.setAttribute('aria-hidden','true');
  var positions=[[50,0],[85,15],[100,50],[85,85],[50,100],[15,85],[0,50],[15,15]];
  var deltas=[[0,-10],[7,-7],[10,0],[7,7],[0,10],[-7,7],[-10,0],[-7,-7]];
  for(var i=0;i<8;i++){var s=document.createElement('span');s.className='pop-sparkle-dot';s.style.left=positions[i][0]+'%';s.style.top=positions[i][1]+'%';s.style.animationDelay=(i*0.04)+'s';s.style.setProperty('--sparkle-dx',deltas[i][0]+'px');s.style.setProperty('--sparkle-dy',deltas[i][1]+'px');wrap.appendChild(s);}
  container.appendChild(wrap);
  setTimeout(function(){if(wrap.parentNode)wrap.parentNode.removeChild(wrap);},600);
}
function poofDismiss(element,callback){
  if(!element||!element.getBoundingClientRect){if(callback)callback();return;}
  var r=element.getBoundingClientRect();
  var pad=28;var w=Math.max(80,r.width+pad*2);var h=Math.max(80,r.height+pad*2);var x=r.left+r.width/2-w/2;var y=r.top+r.height/2-h/2;
  element.classList.add('poof-dismissing');
  var overlay=document.createElement('div');overlay.className='poof-overlay';overlay.setAttribute('aria-hidden','true');
  overlay.style.left=x+'px';overlay.style.top=y+'px';overlay.style.width=w+'px';overlay.style.height=h+'px';
  var cloud=document.createElement('div');cloud.className='poof-cloud';cloud.style.left='50%';cloud.style.top='50%';cloud.style.width=w+'px';cloud.style.height=h+'px';cloud.style.marginLeft=-w/2+'px';cloud.style.marginTop=-h/2+'px';overlay.appendChild(cloud);
  var colors=['#ff7ad9','#ff99ee','#ffcc66','#ffe066','#ffb6e6'];
  var angles=[0,45,90,135,180,225,270,315,22,67,112,157,202,247,292,337];
  for(var i=0;i<24;i++){var a=(angles[i%16]+(i*7))*(Math.PI/180);var dist=25+Math.random()*35;var dx=Math.cos(a)*dist;var dy=Math.sin(a)*dist;var s=document.createElement('span');s.className='poof-sparkle';s.style.setProperty('--poof-dx',dx+'px');s.style.setProperty('--poof-dy',dy+'px');s.style.animationDelay=(i*0.02)+'s';s.style.color=colors[i%colors.length];overlay.appendChild(s);}
  document.body.appendChild(overlay);
  setTimeout(function(){if(overlay.parentNode)overlay.parentNode.removeChild(overlay);if(callback)callback();},620);
}
var TREE_NODES=7;
var SPARK_COUNT=12;
var ACTIVITY_ORNAMENT_POSITIONS=[{left:10,top:18},{left:28,top:6},{left:48,top:24},{left:68,top:8},{left:82,top:20},{left:18,top:32},{left:55,top:4}];
var ACTIVITY_BRANCHES=['branch-svgrepo-com.svg','leaves-branch-svgrepo-com.svg','naked-trees-branches-svgrepo-com.svg','tree-in-winter-tree-branch-winter-svgrepo-com.svg','tree11-svgrepo-com.svg'];
var ACTIVITY_PETALS=['flower-blossom-svgrepo-com.svg','flower-svgrepo-com.svg','flower-with-petals-svgrepo-com.svg','flower-rose-svgrepo-com.svg','flower-rose-svgrepo-com (1).svg','flower-rose-svgrepo-com (2).svg','flower-smile-svgrepo-com.svg','flower-svgrepo-com (1).svg','flower-svgrepo-com (2).svg','flower-svgrepo-com (3).svg','flower-svgrepo-com (4).svg','flower-svgrepo-com (5).svg','flower-svgrepo-com (6).svg','flower-svgrepo-com (7).svg','flower-svgrepo-com (8).svg','flower-svgrepo-com (9).svg','flower-svgrepo-com (10).svg','flower-svgrepo-com (11).svg','flower-svgrepo-com (12).svg','shamrock-clover-svgrepo-com.svg'];
var ACTIVITY_ASSET_BASE='/api/asset/bucket_tree_flowers/';
function activityTreeHtml(color,pct,count){
  var lit=count>0?Math.min(TREE_NODES,count):0;
  var full=lit>=TREE_NODES;
  var branchFile=ACTIVITY_BRANCHES[Math.floor(Math.random()*ACTIVITY_BRANCHES.length)];
  var branchUrl=ACTIVITY_ASSET_BASE+encodeURIComponent('bucket tree/'+branchFile);
  var html='<div class="activity-tree-wrap activity-branch-wrap'+(full?' tree-full':'')+'" style="--tree-color:'+color+'" aria-hidden="true">';
  html+='<div class="activity-branch-bg" style="-webkit-mask-image:url('+branchUrl+');mask-image:url('+branchUrl+');background:var(--tree-color)"></div>';
  html+='<div class="activity-tree activity-branch-nodes">';
  for(var i=0;i<TREE_NODES;i++){
    var pos=ACTIVITY_ORNAMENT_POSITIONS[i]||{left:50,top:50};
    var isLit=i<lit;
    var petalFile=ACTIVITY_PETALS[Math.floor(Math.random()*ACTIVITY_PETALS.length)];
    var petalUrl=ACTIVITY_ASSET_BASE+encodeURIComponent('pedals/'+petalFile);
    html+='<div class="activity-tree-node activity-branch-node'+(isLit?' lit':'')+'" style="--node-color:'+color+';left:'+pos.left+'%;top:'+pos.top+'%" aria-hidden="true"><img class="activity-node-flower" src="'+petalUrl+'" alt="" role="presentation"></div>';
  }
  html+='</div>';
  if(full){
    html+='<div class="activity-tree-sparks" aria-hidden="true">';
    for(var s=0;s<SPARK_COUNT;s++)html+='<span class="tree-spark" style="animation-delay:'+(s*0.08)+'s;left:'+(15+Math.random()*70)+'%"></span>';
    html+='</div>';
  }
  html+='</div>';
  return html;
}
var _activityBreakdownPreviousFocus=null;
function openActivityBreakdown(convId,source){
  if(!activityOverlay||!activityTitleEl||!activityBucketsEl)return;
  _activityBreakdownPreviousFocus=document.activeElement;
  var src=(source||'mobile').toLowerCase();
  var url=src==='mobile'?'/conversations/'+encodeURIComponent(convId)+'/activity':'/activity?source='+encodeURIComponent(src)+'&id='+encodeURIComponent(convId);
  fetch(url).then(function(r){return r.json();}).then(function(data){
    activityTitleEl.textContent=(data.title||'Chat')+' — Activity Breakdown';
    var maxVal=Math.max(1,data.message_count||0,data.files||0,data.code_snippets||0,data.media||0,data.feedback_liked||0,data.feedback_noted||0);
    activityBucketsEl.innerHTML='';
    var hist=data.title_history;
    if(hist&&hist.length>0){
      var orig=hist[0].from;
      var withDates=hist.map(function(h){var d=h.at?new Date(h.at):null;var ds=d?d.toLocaleDateString(undefined,{month:'short',day:'numeric'})+' '+d.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'}):'';return esc(h.to||'')+(ds?' <span class="activity-title-history-date">('+esc(ds)+')</span>':'');});
      var row=document.createElement('div');row.className='activity-title-history';
      row.innerHTML='<span class="activity-title-history-label">Title history</span><div class="activity-title-history-list">Originally: <strong>'+esc(orig)+'</strong></div><div class="activity-title-history-list">&#8594; '+withDates.join(' &#8594; ')+'</div>';
      activityBucketsEl.appendChild(row);
    }
    BUCKETS.forEach(function(b){
      var count=b.key==='message_count'?(data.message_count||0):(data[b.key]||0);
      var pct=maxVal?Math.max(4,(count/maxVal)*100):0;
      var row=document.createElement('div');row.className='activity-bucket';row.setAttribute('role','listitem');
      row.innerHTML='<span class="activity-bucket-label">'+b.label+'</span><span class="activity-bucket-count">'+count.toLocaleString()+'</span>'+activityTreeHtml(b.color,pct,count)+'<div class="activity-bucket-detail">'+count.toLocaleString()+' '+b.label.toLowerCase()+' in this chat.</div>';
      row.addEventListener('click',function(e){e.stopPropagation();e.currentTarget.classList.toggle('expanded');});
      activityBucketsEl.appendChild(row);
    });
    activityOverlay.classList.add('show');
    activityOverlay.setAttribute('aria-hidden','false');
    activityOverlay.removeAttribute('inert');
    var closeBtn=activityOverlay.querySelector('.activity-breakdown-close');if(closeBtn)closeBtn.focus();
  }).catch(function(){});
}
function closeActivityBreakdown(){
  if(!activityOverlay)return;
  if(_activityBreakdownPreviousFocus&&typeof _activityBreakdownPreviousFocus.focus==='function'&&document.contains(_activityBreakdownPreviousFocus)){
    _activityBreakdownPreviousFocus.focus();
  }else if(sbList){sbList.focus();}
  _activityBreakdownPreviousFocus=null;
  activityOverlay.classList.remove('show');
  activityOverlay.setAttribute('aria-hidden','true');
  activityOverlay.setAttribute('inert','');
}
if(activityOverlay){
  var backdrop=activityOverlay.querySelector('.activity-breakdown-backdrop');if(backdrop)backdrop.addEventListener('click',closeActivityBreakdown);
  var closeBtn=activityOverlay.querySelector('.activity-breakdown-close');if(closeBtn)closeBtn.addEventListener('click',closeActivityBreakdown);
}
