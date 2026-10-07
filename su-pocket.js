/* RUNWAY pocket mode: on a phone the office is the whole game.
   No tab bar. Every part of the company is a thing in the room: tap it and a short sheet slides up.
   Pinch and drag to look around the office. Double tap empty floor to reset. */
(function(){
var UI=window.UI, SU=window.SU, Iso=window.SU.Iso;
var pinsEl=null, pins={}, timer=0, raf=0, lastSig='', lastLayout='', started=false;
function $(s){ return document.querySelector(s); }
function G(){ return UI.G(); }
function T(k,d){ try{ var v=SU.T(G(),k,null); return v||d; }catch(e){ return d; } }
function fm(n){ return SU.fmtMoney?SU.fmtMoney(n):('$'+Math.round(n)); }

function names(){ var g=G(); return {inbox:'Inbox',customers:T('tabCustomers','Customers'),product:T('tabProduct','Build'),sales:T('tabSales','Sales'),team:'Team',money:'Money',you:'You',shop:'Shop',goals:'Goals',dash:'Stats'}; }

/* what each pin shows, and where in the room it lives */
function specs(A){
  var g=G(), N=names(), f=SU.fin(g), out=[];
  var urgent=g.inbox.filter(function(i){ return i.open&&(i.kind==='crisis'||i.kind==='signal'||i.action||(i.kind==='opp'&&i.t>=g.t-1)); }).length;
  var open=g.inbox.filter(function(i){ return i.open; }).length;
  function wall(a){ return a||A.wallFallback; }
  if(A.door) out.push({k:'inbox',a:A.door,y:'top',ic:'inbox',l:N.inbox,v:open?String(open):'0',b:urgent,hot:urgent>0,tab:'inbox'});
  if(wall(A.board)) out.push({k:'customers',a:wall(A.board),y:'top',ic:'users',l:N.customers,v:SU.fmtNum(SU.custCount(g)),tab:'customers'});
  var rm=A.roadmap||(g.biz==='bar'?A.wallFallback:null);
  if(rm){ var bq=g.queue.length; out.push({k:'product',a:rm,y:'top',ic:'cube',l:N.product,v:bq?bq+' in progress':'start',hot:!bq&&!g.shipped.length,tab:'product'}); }
  if(A.tv){ var rv=f.burn<=0?'profit':(f.runway>=99?'99+ mo':f.runway.toFixed(f.runway<10?1:0)+' mo'); out.push({k:'money',a:A.tv,y:'top',ic:'coin',l:N.money,v:rv,hot:f.burn>0&&f.runway<4,tab:(g.feat&&g.feat.dashboard)?'dash':'money'}); }
  var un=function(t){ return UI.tabUnlocked?UI.tabUnlocked(g,t):true; };
  if(A.sales) out.push({k:'sales',a:A.sales,y:'top',ic:'mega',l:N.sales,v:'grow',tab:'sales'});
  if(A.shop&&un('shop')){ var aff=(SU.upgradesFor?SU.upgradesFor(g):[]).filter(function(u){ return !(g.shop&&g.shop[u.id])&&g.cash>=u.cost*2; }).length; out.push({k:'shop',a:A.shop,y:'top',ic:'bag',l:'Shop',v:aff?aff+' to buy':'upgrades',tab:'shop'}); }
  if(A.team) out.push({k:'team',a:A.team,y:'top',ic:'team',l:N.team,v:String(SU.headcount(g)),tab:'team'});
  if(A.you&&un('you')) out.push({k:'you',a:A.you,y:'top',ic:'heart',l:'You',v:Math.round(g.founder.sanity)+'%',hot:g.founder.sanity<35,tab:'you',dy:-8});
  (A.empty||[]).slice(0,3).forEach(function(e,i){ out.push({k:'hire'+i,a:e,y:'top',cls:'hire',l:'Hire',v:'+',hire:true,dy:0}); });
  return out;
}
function pinHtml(s){ return '<span class="pkl">'+(s.ic?UI.icon(s.ic):'')+(s.l||'')+'</span><span class="pkv">'+(s.v||'')+'</span>'+(s.b?'<i class="bdg">'+s.b+'</i>':''); }

function liveAnchor(k,A){ if(k==='inbox') return A.door; if(k==='customers') return A.board||A.wallFallback; if(k==='product') return A.roadmap||A.wallFallback; if(k==='money') return A.tv; if(k==='sales') return A.sales; if(k==='shop') return A.shop; if(k==='team') return A.team; if(k==='you') return A.you; if(k.indexOf('hire')===0) return (A.empty||[])[+k.slice(4)]; return null; }
function onPin(s){
  if(s.hire){ UI.openHireChooser(); return; }
  var S=UI.S||{}; var open=document.body.getAttribute('data-sheet')==='open';
  UI.setTab(s.tab);
}
function ensurePin(s){
  var el=pins[s.k];
  if(!el){ el=document.createElement('button'); el.type='button'; el.className='pk-pin'; el.setAttribute('data-pin',s.k); pinsEl.appendChild(el); pins[s.k]=el; el._spec=s;
    el.addEventListener('click',function(e){ e.stopPropagation(); UI.sfx&&UI.sfx('tick'); onPin(el._spec); }); }
  el._spec=s; el._seen=true; return el;
}

function frame(){
  raf=requestAnimationFrame(frame);
  if(!pinsEl||!UI.pocket||!G()||UI.S&&0) return;
  var A=Iso.anchors(); if(!A) return;
  var now=Date.now(), refresh=now-timer>350; var list=refresh?specs(A):null;
  var w=pinsEl.clientWidth, h=pinsEl.clientHeight;
  var sheetOpen=document.body.getAttribute('data-sheet')==='open';
  var landW=window.innerWidth>window.innerHeight&&window.innerHeight<=520; var sheetTop=(sheetOpen&&!landW)?(($('.rcol')||{getBoundingClientRect:function(){return {top:h};}}).getBoundingClientRect().top):h;
  if(refresh){ timer=now; Object.keys(pins).forEach(function(k){ pins[k]._seen=false; });
    list.forEach(function(s){ var el=ensurePin(s); var html=pinHtml(s); if(el._html!==html){ el.innerHTML=html; el._html=html; } var cls='pk-pin'+(s.cls?' '+s.cls:'')+(s.hot?' hot':''); if(el._cls!==cls){ el.className=cls+(el._off?' off':''); el._cls=cls; } });
    Object.keys(pins).forEach(function(k){ if(!pins[k]._seen){ pins[k].remove(); delete pins[k]; } }); }
  var busy=document.body.classList.contains('running');
  var hudEl=document.querySelector('.hud-top'); var hudBot=hudEl?hudEl.getBoundingClientRect().bottom+2:90; var landNow=window.innerWidth>window.innerHeight&&window.innerHeight<=520; if(landNow) hudBot=(document.querySelector('#hdr')||{getBoundingClientRect:function(){return {bottom:44};}}).getBoundingClientRect().bottom+2;
  var order=['you','inbox','customers','product','money','sales','shop','team','hire0','hire1','hire2'], placed=[], PW=62, PH=40;
  Object.keys(pins).sort(function(a,b){ var ia=order.indexOf(a), ib=order.indexOf(b); return (ia<0?99:ia)-(ib<0?99:ib); }).forEach(function(k){ var el=pins[k], s=el._spec;
    var live=liveAnchor(k,A); if(!live){ el._pos=null; return; }
    var x=Math.max(PW/2+4,Math.min(w-PW/2-4,live.x)), y=(live.top!==undefined?live.top:live.y)-8+(s.dy||0);
    var cands=[[0,0],[PW,0],[-PW,0],[0,-PH],[PW,-PH],[-PW,-PH],[0,PH+10],[PW,PH+10],[-PW,PH+10],[0,-2*PH],[PW,-2*PH],[-PW,-2*PH]], best=null;
    for(var ci=0;ci<cands.length;ci++){ var cx=Math.max(PW/2+4,Math.min(w-PW/2-4,x+cands[ci][0])), cy=y+cands[ci][1]; var clash=placed.some(function(p){ return Math.abs(p.x-cx)<PW&&Math.abs(p.y-cy)<PH; }); if(!clash){ best=[cx,cy]; break; } }
    if(!best) best=[x,y]; placed.push({x:best[0],y:best[1]}); el._pos=best; });
  Object.keys(pins).forEach(function(k){ var el=pins[k]; var pos=el._pos;
    if(!pos){ if(!el._off){ el._off=true; el.classList.add('off'); } return; }
    var hide=(pos[1]>sheetTop-8)||busy||(pos[1]-PH)<hudBot; if(hide!==!!el._off){ el._off=hide; el.classList.toggle('off',hide); }
    var tr='translate('+Math.round(pos[0])+'px,'+Math.round(pos[1])+'px) translate(-50%,-100%)'; if(el._tr!==tr){ el.style.transform=tr; el._tr=tr; } });
  layoutCheck(); return;
}

/* measure the chrome and tell the camera how much room is left for the office */
function measure(){
  var hdr=$('#hdr'), plan=$('#plan'), hud=$('.hud-top'), cw=$('#pkCoachWrap'), rc=$('.rcol');
  var hdrH=hdr?hdr.getBoundingClientRect().height:58, dock=plan?plan.getBoundingClientRect().height:150;
  var hudB=hud?hud.getBoundingClientRect().bottom:hdrH+34; var cH=0; if(cw&&getComputedStyle(cw).display!=='none'){ var c=$('#coach'); cH=c&&c.offsetHeight?c.offsetHeight+10:0; }
  var open=document.body.getAttribute('data-sheet')==='open'; var land=window.innerWidth>window.innerHeight&&window.innerHeight<=520; var sh=open&&rc?(land?rc.getBoundingClientRect().width:rc.getBoundingClientRect().height):0;
  return {hdr:hdrH,dock:dock,dockW:plan?plan.getBoundingClientRect().width:250,hudB:hudB,coach:cH,sheet:sh,open:open,land:land};
}
function layoutCheck(){
  var m=measure(); Iso.setDefaultView((m.open||m.land)?1.0:(window.innerHeight/window.innerWidth>1.35?1.3:1.0),true); var sig=[Math.round(m.hdr),Math.round(m.dock),Math.round(m.sheet),m.open?1:0,Math.round(m.coach)].join('|'); if(sig===lastLayout) return; lastLayout=sig;
  var r=document.documentElement.style; r.setProperty('--hdrh',Math.round(m.hdr)+'px'); r.setProperty('--dock',Math.round(m.dock)+'px'); Iso.resize();
}
UI.pocketLayout=function(){ lastLayout=''; setTimeout(layoutCheck,0); setTimeout(layoutCheck,260); };
UI.pocketInsets=function(){
  var m=measure(); var vh=window.innerHeight;
  if(m.land) return {l:0,t:Math.round(m.hdr+4),r:Math.round(m.dockW+(m.open?m.sheet:0)),b:Math.round(m.coach?m.coach+8:6)};
  var bot=m.open?(m.dock+(m.sheet||Math.min(vh*0.46,400))):(m.dock+m.coach);
  return {l:0,r:0,t:Math.max(m.hudB+4,m.hdr+8),b:Math.round(bot+6)};
};

function setTitle(){ var t=$('#pkShT'); if(!t||!G()) return; var tab=(UI.S&&UI.S.tab)||'customers'; var N=names(); t.textContent=N[tab]||tab; }

UI.pocketBuild=function(){
  if(!UI.pocket){
    var p=$('#pkPins'); if(p) p.remove(); pinsEl=null; pins={};
    var c=$('#coach'), hud=$('.hud'); if(c&&hud&&c.parentNode!==hud) hud.insertBefore(c,$('#ticker')||null);
    return;
  }
  var stage=$('.office .stage'), game=$('.game'); if(!stage||!game) return;
  var old=$('#pkPins'); if(old) old.remove(); pinsEl=document.createElement('div'); pinsEl.id='pkPins'; pinsEl.className='pk-pins'; stage.appendChild(pinsEl); pins={};
  var wrap=$('#pkCoachWrap'); if(!wrap){ wrap=document.createElement('div'); wrap.id='pkCoachWrap'; game.appendChild(wrap); }
  var c2=$('#coach'); if(c2&&c2.parentNode!==wrap) wrap.appendChild(c2);
  var side=$('.side'); if(side&&!$('#pkSh')){ var h=document.createElement('div'); h.id='pkSh'; h.className='pk-sh'; h.innerHTML='<b id="pkShT"></b><button class="pk-x" id="pkClose" type="button" aria-label="Close">×</button>'; side.insertBefore(h,side.firstChild);
    $('#pkClose').addEventListener('click',function(){ UI.setSheet(false); }); }
  setTitle(); lastLayout=''; timer=0; Iso.setDefaultView(window.innerHeight/window.innerWidth>1.35?1.3:1.0,false);
  if(!started){ started=true; raf=requestAnimationFrame(frame); }
};
var rt=UI.renderTabs; UI.renderTabs=function(){ rt.apply(this,arguments); setTitle(); };
window.addEventListener('orientationchange',function(){ lastLayout=''; setTimeout(function(){ Iso.resize(); },250); });
})();
