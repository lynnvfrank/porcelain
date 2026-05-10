/* ── Tab bar (Chat / Journal / Files / Notes) ── */
var currentTab='chat';
function switchToTab(tab){
  currentTab=tab;
  if(!appEl)return;
  /* Toggle panel visibility classes */
  appEl.classList.toggle('show-journal',tab==='journal');
  appEl.classList.toggle('show-files',tab==='files');
  appEl.classList.toggle('show-notes',tab==='notes');
  /* Tab button active state */
  var tabs=tabBar?tabBar.querySelectorAll('.tab'):[];
  tabs.forEach(function(t){var isActive=t.getAttribute('data-tab')===tab;t.classList.toggle('active',isActive);t.setAttribute('aria-selected',isActive);});
  /* Update indicator */
  updateTabIndicator();
  /* Load data for the activated tab */
  if(tab==='journal')loadJournal();
  if(tab==='files')loadFiles(_filesCurrentPath||'D:\\');
  if(tab==='notes')loadNotes();
  /* Update header for chat tab */
  if(tab==='chat'){
    if(hdrName)hdrName.textContent=currentConvoTitle||'Chat';
    if(hdrSub)hdrSub.textContent=currentSrc==='mobile'?'AI':(currentSrc||'');
    if(currentId)loadConvo(currentId,currentSrc);
    else{clearChat();showEmpty();}
  }
  updateCopyConvoButtonVisibility();
}
function updateTabIndicator(){
  var indicator=tabBar?tabBar.querySelector('.tab-indicator'):null;
  if(!indicator||!tabBar)return;
  var activeTab=tabBar.querySelector('.tab.active');
  if(!activeTab)return;
  var tabBarRect=tabBar.getBoundingClientRect();
  var tabRect=activeTab.getBoundingClientRect();
  indicator.style.left=(tabRect.left-tabBarRect.left)+'px';
  indicator.style.width=tabRect.width+'px';
}
if(tabBar){
  tabBar.querySelectorAll('.tab').forEach(function(btn){
    btn.addEventListener('click',function(){var t=btn.getAttribute('data-tab');if(t)switchToTab(t);});
  });
  updateTabIndicator();
}
