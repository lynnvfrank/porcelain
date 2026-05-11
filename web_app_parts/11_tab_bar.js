/* ── Tab bar (Chat / Room) ── */
var currentTab='chat';
var bedroomTick=null;
var bedroomWalkEnd=null;
var WAYPOINTS=[{id:'bed',x:52,y:72},{id:'tv',x:48,y:40},{id:'plants',x:20,y:52},{id:'window',x:76,y:48},{id:'center',x:44,y:58}];
var ACTIVITIES={bed:'\uD83D\uDCA4',tv:'\uD83D\uDCFA',plants:'\uD83C\uDF3F',window:'\u2615',center:''};
function setSpritePosition(xPct,yPct){
  if(!locusSprite)return;
  locusSprite.style.left=xPct+'%';locusSprite.style.top=yPct+'%';
}
function showActivity(emoji){
  if(!activityBubble)return;
  activityBubble.textContent=emoji||'';
  activityBubble.className='show'+(emoji==='\uD83D\uDCA4'?' zzz':'');
  activityBubble.setAttribute('aria-label',emoji?'Activity: '+emoji:'');
}
function hideActivity(){
  if(!activityBubble)return;
  activityBubble.className='';activityBubble.textContent='';
}
function pickNext(){
  var idx=Math.floor(Math.random()*WAYPOINTS.length);
  return WAYPOINTS[idx];
}
function runBedroomLoop(){
  if(currentTab!=='room'||!locusSprite||!roomPanel)return;
  var dest=pickNext();
  locusSprite.classList.remove('sleep');locusSprite.classList.add('walk');
  setSpritePosition(dest.x,dest.y);
  if(bedroomWalkEnd)clearTimeout(bedroomWalkEnd);
  bedroomWalkEnd=setTimeout(function(){
    bedroomWalkEnd=null;
    locusSprite.classList.remove('walk');
    var emoji=ACTIVITIES[dest.id];
    if(emoji){showActivity(emoji);if(dest.id==='bed')locusSprite.classList.add('sleep');}
    var duration=4000+Math.random()*4000;
    setTimeout(function(){
      hideActivity();locusSprite.classList.remove('sleep');
      bedroomTick=setTimeout(runBedroomLoop,800+Math.random()*1200);
    },duration);
  },2600);
}
function startBedroom(){runBedroomLoop();}
function stopBedroom(){
  if(bedroomTick){clearTimeout(bedroomTick);bedroomTick=null;}
  if(bedroomWalkEnd){clearTimeout(bedroomWalkEnd);bedroomWalkEnd=null;}
  hideActivity();
  if(locusSprite){locusSprite.classList.remove('walk','sleep');}
}
function switchToTab(tab){
  currentTab=tab;
  if(!appEl)return;
  appEl.classList.toggle('show-room',tab==='room');
  if(roomPanel)roomPanel.setAttribute('aria-hidden',tab!=='room');
  var tabs=tabBar?tabBar.querySelectorAll('.tab'):[];
  tabs.forEach(function(t){var isActive=t.getAttribute('data-tab')===tab;t.classList.toggle('active',isActive);t.setAttribute('aria-selected',isActive);});
  if(tab==='room'){startBedroom();}else{stopBedroom();}
  isGroupView=(tab==='social');
  if(isGroupView){
    if(hdrName)hdrName.textContent='Group';
    if(hdrSub)hdrSub.textContent='Ruby, Lynn, Locus, Raven';
    loadGroupChat();
  }else{
    if(hdrName)hdrName.textContent=currentConvoTitle||'Chat';
    if(hdrSub)hdrSub.textContent=currentSrc==='mobile'?'Locus':(currentSrc||'');
    if(currentId)loadConvo(currentId,currentSrc);
    else{clearChat();showEmpty();}
  }
  updateCopyConvoButtonVisibility();
}
async function loadGroupChat(){
  try{
    var r=await fetch('/api/group_chat',mergeApiHeaders({cache:'no-store'}));
    if(!r.ok){clearChat();showEmpty(true);currentMessages=[];return;}
    var d=await r.json();
    currentMessages=d.messages||[];
    if(!currentMessages.length){clearChat();showEmpty(true);}
    else{renderMessages(currentMessages,false,'mobile',{group:true});scrollBottom();}
  }catch(e){clearChat();showEmpty(true);currentMessages=[];}
  updateCopyConvoButtonVisibility();
}
if(tabBar){
  tabBar.querySelectorAll('.tab').forEach(function(btn){
    btn.addEventListener('click',function(){var t=btn.getAttribute('data-tab');if(t)switchToTab(t);});
  });
}
