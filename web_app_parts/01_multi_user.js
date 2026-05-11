(function(){
/* ── Multi-user: Ruby, Lynn, Raven (X-User header + localStorage + cookie for dashboard) ── */
function getCurrentUser(){ try{ var u=localStorage.getItem('locus_user'); if(u!=null)return u; }catch(e){} return ''; }
function getCurrentUserDisplayName(){ var u=getCurrentUser(); return u||''; }
function setLocusUserCookie(u){ try{ document.cookie='locus_user='+encodeURIComponent(u||'')+'; path=/; max-age=31536000'; }catch(e){} }
function apiHeaders(){ return {'X-User':getCurrentUser()}; }
function mergeApiHeaders(opts){ var h=opts&&opts.headers?Object.assign({},opts.headers):{}; Object.assign(h,apiHeaders()); return Object.assign({},opts,{headers:h}); }
