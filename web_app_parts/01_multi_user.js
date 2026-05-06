(function(){
/* ── Multi-user: Ruby, Lynn, Raven (X-User header + localStorage + cookie for dashboard) ── */
function getCurrentUser(){ try{ var u=localStorage.getItem('claudia_user'); if(u==='lynn'||u==='raven'||u==='ruby')return u; }catch(e){} return 'ruby'; }
var userDisplayNames={ruby:'Ruby',lynn:'Lynn',raven:'Raven'};
function getCurrentUserDisplayName(){ return userDisplayNames[getCurrentUser()]||'Ruby'; }
function setClaudiaUserCookie(u){ var v=(u==='lynn'||u==='raven'||u==='ruby')?u:'ruby'; try{ document.cookie='claudia_user='+encodeURIComponent(v)+'; path=/; max-age=31536000'; }catch(e){} }
function apiHeaders(){ var h={'X-User':getCurrentUser()}; try{ var t=localStorage.getItem('claudia_access_token'); if(t&&t.length>0) h['X-Vibe-Token']=t; }catch(e){} return h; }
function mergeApiHeaders(opts){ var h=opts&&opts.headers?Object.assign({},opts.headers):{}; Object.assign(h,apiHeaders()); return Object.assign({},opts,{headers:h}); }
