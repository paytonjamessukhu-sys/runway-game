/* RUNWAY - UI panels (one screen, tiles and drawers), the monthly report, deal modals and the ending. */
(function(){
'use strict';
var SU = window.SU, UI = window.UI, Iso = SU.Iso, CAT = SU.CAT, M = SU.Money, fm = SU.fmtMoney, esc = UI.esc, $ = UI.$, $$ = UI.$$, S = UI.S;
function G(){ return UI.G(); }
var ROLECOL={eng:'#4c78c9',design:'#e0597a',pm:'#7b5fc4',sdr:'#3aa38b',ae:'#2e9bb5',cs:'#e0922d',mkt:'#c4553a',cos:'#5a6b7d',vp:'#2b2f3a',mgr:'#8a6d3b',ml:'#1f8f8a'};
function pctS(x,d){ return SU.pct(x,d||0); }

/* ------------------------------------------------------------ small building blocks */
function stat(l,v,s,cls){ return '<div class="st'+(cls?' '+cls:'')+'"><div class="l">'+l+'</div><div class="v">'+v+'</div>'+(s?'<div class="s">'+s+'</div>':'')+'</div>'; }
function bar(v,cls){ return '<div class="bar '+(cls||'')+'"><i style="width:'+Math.max(0,Math.min(100,Math.round(v)))+'%"></i></div>'; }
function good(v){ return bar(v,v<35?'bad':v<60?'warn':'good'); }
function empty(t){ return '<div class="empty">'+t+'</div>'; }
function avatar(name,col){ return '<div class="av" style="background:'+col+'">'+esc((name||'?').charAt(0))+'</div>'; }
function cfgFor(aid){ if(!S.cfg[aid]) S.cfg[aid]=CAT.defaults(G(),aid,{}); return S.cfg[aid]; }
function focusOf(aid,v){ try{ return CAT.item(G(),{aid:aid,values:v}).focus; }catch(e){ return 0; } }
function tileAction(aid){
  var a=CAT.actions[aid], v=cfgFor(aid), ok=CAT.validate(G(),aid,v), f=focusOf(aid,v);
  return '<button class="tile'+(a.danger?' danger':'')+(ok.ok?'':' no')+'" data-act="open-act" data-aid="'+aid+'"><span class="tt">'+esc(a.title)+'</span><span class="tf">'+(f?f+' focus':'free')+'</span><span class="tb2">'+esc(ok.ok?a.blurb:ok.why)+'</span></button>';
}
function tiles(ids){ return '<div class="tilegrid">'+ids.map(tileAction).join('')+'</div>'; }
function sub(tab,opts,def){ var cur=S.sub[tab]||def; return {cur:cur,html:'<div class="subtabs">'+opts.map(function(o){ return '<button class="'+(cur===o[0]?'on':'')+'" data-act="sub" data-tab="'+tab+'" data-v="'+o[0]+'">'+o[1]+'</button>'; }).join('')+'</div>'}; }

/* ------------------------------------------------------------ pane and drawer plumbing */
UI.renderPane=function(){
  var g=G(); var pn=$('#pnIn'); if(!g||!pn) return; var keep=(S.lastTab===S.tab)?pn.scrollTop:0;
  var fn=PANELS[S.tab]||PANELS.customers; pn.innerHTML=fn(g); pn.scrollTop=keep; S.lastTab=S.tab; renderDrawer(); if(S.tab==='shop') UI.paintBuildings(g);
};
function renderDrawer(){
  var d=$('#drawer'); if(!d) return; var dr=S.drawer; if(!dr){ d.innerHTML=''; return; }
  var h='';
  if(dr.type==='act') h=drawerAct(dr.aid); else if(dr.type==='person') h=drawerPerson(dr.id); else if(dr.type==='view') h=drawerView(dr.id);
  d.innerHTML='<div class="drawer">'+h+'</div>';
  if(dr.type==='view'&&dr.id==='cap') wfUpdate();
}
UI.renderDrawer=renderDrawer;
function closeDrawer(){ S.drawer=null; renderDrawer(); }

/* ------------------------------------------------------------ INBOX */
function inbItem(i){
  var h='<div class="inb k-'+esc(i.kind)+(i.open?'':' closed')+'"><span class="when">'+esc(i.date||'')+'</span><h5>'+esc(i.title)+'</h5>'+(i.body?'<div class="body">'+esc(i.body)+'</div>':'');
  var acts=[];
  if(i.action){ var a=i.action;
    if(a.type==='pitch') acts.push('<button class="btn sm primary" data-act="pitch" data-inv="'+esc(a.inv)+'" data-id="'+esc(i.id)+'">Go to the meeting</button>');
    else if(a.type==='sheet') acts.push('<button class="btn sm primary" data-act="sheet" data-id="'+esc(a.id)+'">Open the term sheet</button>');
    else if(a.type==='offer') acts.push('<button class="btn sm primary" data-act="offer">Review the offer</button>');
    else if(a.type==='cands') acts.push('<button class="btn sm primary" data-act="cands" data-id="'+esc(a.id)+'">Meet the candidates</button>'); }
  if(i.chips&&i.chips.length&&i.open) acts.push(i.chips.map(function(c){ return '<button class="chip" data-act="chip" data-text="'+esc(c.text)+'">+ '+esc(c.label)+'</button>'; }).join(''));
  if(i.open&&!i.action) acts.push('<button class="btn sm ghost" data-act="dismiss" data-id="'+esc(i.id)+'">Dismiss</button>');
  if(acts.length) h+='<div class="chips">'+acts.join('')+'</div>';
  return h+'</div>';
}
function pInbox(g){
  var open=g.inbox.filter(function(i){ return i.open; }), done=g.inbox.filter(function(i){ return !i.open; });
  var shown=open.slice(0,S.page.inbox?12:5), h='';
  if(!open.length) h+=empty('Nothing needs you right now. Customers, investors, rivals and trouble all show up here.');
  h+=shown.map(inbItem).join('');
  if(open.length>shown.length) h+='<button class="btn sm ghost" data-act="more-inbox">Show '+(open.length-shown.length)+' older</button>';
  else if(done.length&&open.length<4) h+='<div class="sec"><h4 class="muted">Earlier</h4>'+done.slice(0,3).map(inbItem).join('')+'</div>';
  return h;
}

/* ------------------------------------------------------------ CLIENTS */

function moneyMapCard(g){
  var m=CAT.moneyMap(g); if(!m.nodes.length) return ''; S.mmFix=m.fix;
  var flow=m.nodes.map(function(n,i){ return (i?'<i class="mm-op">'+(i===3?'=':(i===2?'x':'&rarr;'))+'</i>':'')+'<div class="mm-n"><span>'+esc(n.l)+'</span><b>'+esc(n.v)+'</b><em>'+esc(n.s)+'</em></div>'; }).join('');
  return '<div class="sec mmap '+m.stage+'"><div class="row" style="justify-content:space-between"><h4>How you make money</h4><span class="pill '+(m.stage==='idea'?'warn':m.stage==='beta'?'blue':'good')+'">'+(m.stage==='idea'?'before launch':m.stage==='beta'?'beta':'live')+'</span></div><div class="mm-flow">'+flow+'</div>'+
    '<div class="mm-why"><b>'+esc(m.headline)+'</b><ul>'+m.why.map(function(w){ return '<li>'+esc(w)+'</li>'; }).join('')+'</ul>'+(m.fix.length?'<div class="row" style="gap:6px;flex-wrap:wrap">'+m.fix.map(function(f,i){ return '<button class="chip idea" data-act="mm-add" data-i="'+i+'">'+(f.tab?esc(f.go||'Open')+': ':'+ ')+esc(f.label)+'</button>'; }).join('')+'</div>':'')+'</div></div>';
}
function pCustomers(g){
  var S0=SU.seg(g), band=SU.pmfBand(g), churn=g.stat.churnRate||0;
  var label=g.arch==='consumer'?'Subscribers':(g.arch==='market'?'Both sides':(g.arch==='venue'?'Regulars':'Customers'));
  var h='<div class="strip">'+stat(label,SU.fmtNum(SU.custCount(g)),'+'+Math.round(g.stat.newLast||0)+' / -'+Math.round(g.stat.churnLast||0)+' last month')+stat('Churn / month',pctS(churn,1),churn>0.08?'Too high':churn>0.04?'Watch it':'Healthy',churn>0.08?'bad':'')+stat('Product fit',band.lo+'-'+band.hi,'of 100')+'</div>';
  h+=moneyMapCard(g);
  h+='<div class="sec"><div class="row" style="justify-content:space-between"><b class="sm">How well you know them</b><span class="mono xs">'+Math.round(g.insight)+' / 100</span></div>'+bar(g.insight,'')+'</div>';
  var real=g.needs.filter(function(n){ return n.real&&n.revealed; }), herr=g.needs.filter(function(n){ return n.herring&&n.revealed; }), hidden=g.needs.filter(function(n){ return n.real&&!n.revealed; }).length;
  h+='<div class="sec"><h4>What '+esc(S0.who)+' pay for</h4>';
  if(!real.length) h+=empty('You do not know yet. Interview them. Every conversation can reveal a real need.');
  real.forEach(function(n){ var built=n.cov>=0.3; h+='<div class="rw"><div class="rm"><div class="row" style="gap:6px"><b>'+esc(n.name)+'</b><span class="pill blue">matters '+'●'.repeat(n.w)+'○'.repeat(3-n.w)+'</span></div>'+bar(n.cov*100,n.cov>0.6?'good':'')+'</div>'+(built?'<span class="pill good">built</span>':'<button class="btn sm" data-act="build-need" data-id="'+n.id+'">Build it</button>')+'</div>'; });
  herr.forEach(function(n){ h+='<div class="rw"><div class="rm"><b>'+esc(n.name)+'</b></div><span class="pill warn">asked for, will not pay</span></div>'; });
  if(hidden>0) h+='<div class="xs muted">'+(real.length?'There are more needs you have not found.':'Some of what they want is still hidden.')+'</div>';
  h+='</div>'+tiles(['talk','survey','townhall','promise']);
  return h;
}


/* ------------------------------------------------------------ PRICING card (shown on Build and Sales) */
function priceStep(p){ return p<10?0.5:p<30?1:p<100?5:p<500?10:50; }
function pricingCard(g){
  var c=g.cust, mk=g.arch==='market', S0=SU.seg(g), q=null;
  S.plan.forEach(function(it){ if(it.aid==='price') q=it; });
  var hint='';
  if(mk) hint='Providers tolerate about '+Math.round(S0.takeTol*100)+'%. Above that they start to leave.';
  else if(g.insight>=15){ var cc=g.wtpMed*(1+g.pmfOff*g.wtpBand*0.5); hint='Customers hint at '+fm(cc*(1-g.wtpBand))+' to '+fm(cc*(1+g.wtpBand))+' a month.'; }
  else hint='You do not know what they will pay yet. Interview more customers.';
  var now=mk?Math.round(c.take*100)+'% cut':fm(c.price)+(g.arch==='venue'?' per guest':' / mo');
  var queued=q?'<div class="pq">Queued: '+esc(mk?q.values.take+'% cut':fm(q.values.price)+' / mo')+' <button class="pb" data-act="unplan" data-uid="'+q.uid+'" title="Remove">'+UI.icon('x')+'</button></div>':'';
  var btns;
  if(mk) btns=[-2,-1,1,2].map(function(d){ return '<button class="btn sm" data-act="price-quick" data-d="'+d+'">'+(d>0?'+':'')+d+' pts</button>'; }).join('');
  else btns=[-0.2,-0.1,0.1,0.2].map(function(m){ return '<button class="btn sm" data-act="price-quick" data-m="'+m+'">'+(m>0?'+':'')+Math.round(m*100)+'%</button>'; }).join('');
  var extra='';
  if(!mk&&g.arch!=='venue'){
    extra+='<button class="btn sm'+(c.annual?' ghost':'')+'" data-act="price-opt" data-o="annual"'+(c.annual?' disabled':'')+'>'+(c.annual?'Annual plans: on':'Offer annual plans')+'</button>';
    if(g.arch==='consumer') extra+='<button class="btn sm ghost" data-act="price-opt" data-o="'+(c.model==='freemium'?'paid':'freemium')+'">'+(c.model==='freemium'?'Free tier on: switch to paywall':'Paywall on: add a free tier')+'</button>';
  }
  return '<div class="sec pricing"><div class="row" style="justify-content:space-between;align-items:flex-end"><div><div class="k">'+(mk?'Your cut':(g.arch==='venue'?'Average tab':'Price'))+'</div><div class="pbig mono">'+now+'</div></div><button class="btn sm ghost" data-act="open-act" data-aid="price">More options</button></div>'+
    '<div class="xs muted">'+esc(hint)+'</div><div class="row" style="gap:5px">'+btns+'</div>'+(extra?'<div class="row" style="gap:5px">'+extra+'</div>':'')+queued+'</div>';
}


/* ------------------------------------------------------------ the building outside (one picture per office tier) */
UI.drawBuilding=function(cv,tier,o){
  o=o||{}; var ctx=cv.getContext('2d'); var dpr=Math.min(2,window.devicePixelRatio||1); var W=cv.clientWidth||240, H=cv.clientHeight||120;
  cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,W,H);
  var spec={garage:{w:4.2,d:3.4,h:2.3},studio:{w:5,d:4,h:3.6},office:{w:5.6,d:4.6,h:6.4},hq:{w:6,d:5,h:12}}[tier]||{w:4,d:3,h:2};
  var sS=Math.min((W-8)/((spec.w+spec.d+4.6)*0.5),(H-8)/(0.25*(spec.w+spec.d+4.6)+0.46*spec.h)); var s=Math.min(sS,60);
  var ox=W/2-(spec.w-spec.d)/4*s, oy=H-4-(spec.w+spec.d+2.2)*s*0.25;
  function P(x,y,z){ return [ox+(x-y)*s*0.5, oy+(x+y)*s*0.25-z*s*0.46]; }
  function poly(pts,fill,stroke){ ctx.beginPath(); pts.forEach(function(p,i){ if(i) ctx.lineTo(p[0],p[1]); else ctx.moveTo(p[0],p[1]); }); ctx.closePath(); if(fill){ ctx.fillStyle=fill; ctx.fill(); } if(stroke){ ctx.strokeStyle=stroke; ctx.lineWidth=1; ctx.stroke(); } }
  function shade(hex,f){ var n=parseInt(hex.slice(1),16), r=(n>>16)&255, g=(n>>8)&255, b=n&255; function c(v){ return Math.max(0,Math.min(255,Math.round(f<0?v*(1+f):v+(255-v)*f))); } return 'rgb('+c(r)+','+c(g)+','+c(b)+')'; }
  function box(x,y,z,w,d,h,col){ poly([P(x,y,z+h),P(x+w,y,z+h),P(x+w,y+d,z+h),P(x,y+d,z+h)],shade(col,0.18),'rgba(0,0,0,.18)'); poly([P(x,y+d,z),P(x+w,y+d,z),P(x+w,y+d,z+h),P(x,y+d,z+h)],shade(col,-0.1),'rgba(0,0,0,.2)'); poly([P(x+w,y,z),P(x+w,y+d,z),P(x+w,y+d,z+h),P(x+w,y,z+h)],shade(col,-0.24),'rgba(0,0,0,.2)'); }
  /* faces: left face is the plane y=d (spans x), right face is the plane x=w (spans y) */
  function fl(u0,u1,z0,z1,fill){ var y=spec.d; poly([P(u0,y,z0),P(u1,y,z0),P(u1,y,z1),P(u0,y,z1)],fill); }
  function fr(u0,u1,z0,z1,fill){ var x=spec.w; poly([P(x,u0,z0),P(x,u1,z0),P(x,u1,z1),P(x,u0,z1)],fill); }
  /* ground */
  poly([P(-1.2,-1.2,0),P(spec.w+1.1,-1.2,0),P(spec.w+1.1,spec.d+1.1,0),P(-1.2,spec.d+1.1,0)],o.night?'#2f4a3a':'#a9d18e','rgba(0,0,0,.12)');
  poly([P(-1.2,spec.d,0),P(spec.w+1.1,spec.d,0),P(spec.w+1.1,spec.d+1.1,0),P(-1.2,spec.d+1.1,0)],'#cfd3da');
  poly([P(spec.w,-1.2,0),P(spec.w+1.1,-1.2,0),P(spec.w+1.1,spec.d+1.1,0),P(spec.w,spec.d+1.1,0)],'#cfd3da');
  var win=o.night?'#ffe08a':'#9fd0f0', brand=o.brand||'#4c6ef5';
  if(tier==='garage'){
    box(0,0,0,spec.w,spec.d,1.6,'#d9c9a8'); /* house */
    poly([P(-0.2,-0.2,1.6),P(spec.w+0.2,-0.2,1.6),P(spec.w+0.2,spec.d/2,2.6),P(-0.2,spec.d/2,2.6)],'#8a5a44'); poly([P(-0.2,spec.d+0.2,1.6),P(spec.w+0.2,spec.d+0.2,1.6),P(spec.w+0.2,spec.d/2,2.6),P(-0.2,spec.d/2,2.6)],'#a0684e','rgba(0,0,0,.2)');
    poly([P(spec.w+0.2,-0.2,1.6),P(spec.w+0.2,spec.d+0.2,1.6),P(spec.w+0.2,spec.d/2,2.6)],'#7b4e3a');
    fl(0.5,2.7,0,1.3,'#c8cdd4'); for(var i=1;i<5;i++) fl(0.5,2.7,i*0.26,i*0.26+0.03,'rgba(60,70,85,.4)'); fl(3.1,3.8,0.2,1.0,win);
    poly([P(-1.2,spec.d,0),P(2.7,spec.d,0),P(2.7,spec.d+1.1,0),P(-1.2,spec.d+1.1,0)],'#b6bcc6');
    box(3.6,spec.d+0.4,0,0.25,0.25,0.5,'#6b4a2f'); box(3.35,spec.d+0.15,0.5,0.75,0.75,0.8,'#4aa56a');
  } else if(tier==='studio'){
    box(0,0,0,spec.w,spec.d,3.2,'#b5654a'); box(-0.1,-0.1,3.2,spec.w+0.2,spec.d+0.2,0.25,'#6b6f7a');
    for(var f=0;f<2;f++) for(var k=0;k<3;k++){ fl(0.4+k*1.5,1.5+k*1.5,0.5+f*1.5,1.5+f*1.5,win); }
    for(var f2=0;f2<2;f2++) for(var k2=0;k2<2;k2++){ fr(0.5+k2*1.8,1.7+k2*1.8,0.5+f2*1.5,1.5+f2*1.5,win); }
    fl(1.9,3.1,0,1.6,'#4a3a2e'); poly([P(1.6,spec.d,1.6),P(3.4,spec.d,1.6),P(3.4,spec.d+0.7,1.35),P(1.6,spec.d+0.7,1.35)],brand); 
    box(0.6,spec.d+0.3,0,0.4,0.4,0.7,'#4aa56a');
    if(o.name){ ctx.save(); ctx.fillStyle='#fff'; ctx.font='bold '+Math.max(8,Math.round(s*0.3))+'px sans-serif'; ctx.textAlign='center'; var a=P(2.5,spec.d,3.0); ctx.fillText(String(o.name).toUpperCase().slice(0,9),a[0],a[1]); ctx.restore(); }
  } else if(tier==='office'){
    box(0,0,0,spec.w,spec.d,6,'#5d7aa3'); box(0.3,0.3,6,spec.w-0.6,spec.d-0.6,0.4,'#4a5568'); box(1.2,1.0,6.4,1.2,1,0.5,'#8a93a3');
    for(var f3=0;f3<5;f3++){ fl(0.2,spec.w-0.2,0.55+f3*1.1,1.25+f3*1.1,o.night?'#ffe9a8':'#bfe3fb'); fr(0.2,spec.d-0.2,0.55+f3*1.1,1.25+f3*1.1,o.night?'#e9c870':'#a6cfe8'); }
    for(var m=1;m<5;m++) fl(0.2+m*(spec.w-0.4)/5,0.24+m*(spec.w-0.4)/5,0.5,6,'rgba(30,50,80,.35)');
    fl(2.0,3.6,0,1.5,'#274a6b'); poly([P(1.7,spec.d,1.6),P(3.9,spec.d,1.6),P(3.9,spec.d+0.8,1.4),P(1.7,spec.d+0.8,1.4)],brand);
    box(0.3,spec.d+0.3,0,0.4,0.4,0.9,'#4aa56a'); box(spec.w-0.7,spec.d+0.3,0,0.4,0.4,0.9,'#4aa56a');
  } else {
    box(0,0,0,spec.w,spec.d,8,'#6a7f98'); box(0.6,0.5,8,spec.w-1.2,spec.d-1,3,'#7b90aa'); box(1.4,1.1,11,spec.w-2.8,spec.d-2.2,0.8,'#8fa2bb');
    for(var f4=0;f4<7;f4++){ fl(0.25,spec.w-0.25,0.5+f4*1.1,1.2+f4*1.1,o.night?'#ffe9a8':'#bfe3fb'); fr(0.25,spec.d-0.25,0.5+f4*1.1,1.2+f4*1.1,o.night?'#e9c870':'#a6cfe8'); }
    for(var m2=1;m2<6;m2++) fl(0.25+m2*(spec.w-0.5)/6,0.3+m2*(spec.w-0.5)/6,0.45,8,'rgba(30,45,70,.35)');
    box(2.0,1.7,11.8,2,1.6,0.1,'#d9dde4'); var hp=P(3.0,2.5,11.95); ctx.fillStyle='#e8590c'; ctx.font='bold '+Math.round(s*0.5)+'px sans-serif'; ctx.textAlign='center'; ctx.fillText('H',hp[0],hp[1]+s*0.12);
    fl(1.8,4.2,0,2.0,'#274a6b'); poly([P(1.5,spec.d,2.1),P(4.5,spec.d,2.1),P(4.5,spec.d+0.9,1.8),P(1.5,spec.d+0.9,1.8)],brand);
    if(o.name){ ctx.save(); ctx.fillStyle='#fff'; ctx.font='bold '+Math.max(8,Math.round(s*0.28))+'px sans-serif'; ctx.textAlign='center'; var a2=P(3,spec.d,7.4); ctx.fillText(String(o.name).toUpperCase().slice(0,10),a2[0]-s*0.1,a2[1]); ctx.restore(); }
    [-0.6,spec.w+0.3].forEach(function(tx){ box(tx,spec.d+0.4,0,0.4,0.4,1.1,'#4aa56a'); });
  }
};
UI.paintBuildings=function(g){
  var night=false; var order=SU.SPACE_ORDER;
  document.querySelectorAll('canvas[data-tier]').forEach(function(cv){ var tier=cv.getAttribute('data-tier'); UI.drawBuilding(cv,tier,{name:g.name,brand:({smb:'#4c6ef5',consumer:'#e8590c',market:'#12b886'})[g.arch],night:night}); });
};

/* ------------------------------------------------------------ BUILD (product) */
var KIND_ORDER={core:0,asked:1,plat:2,unknown:3,nopay:4};
function featureTile(f,g){
  var tag=f.improve?'<span class="tag plat">improve</span>':f.built&&f.key!=='mvp'?'<span class="tag built">'+(f.maxed?'maxed':'built')+'</span>':f.queued?'<span class="tag queued">in the queue</span>':({core:'<span class="tag core">start here</span>',asked:'<span class="tag asked">★ customers asked</span>',nopay:'<span class="tag nopay">decoy</span>',unknown:'<span class="tag unknown">unknown</span>',plat:'<span class="tag plat">upgrade</span>'}[f.kind]||'');
  var dead=(f.built&&f.key!=='mvp'&&!f.improve)||f.queued;
  return '<button class="tile'+(dead?' no':'')+(f.kind==='asked'&&!dead?' star':'')+(f.built?' done':'')+'" data-act="feat" data-key="'+esc(f.key)+'"><span class="tt">'+esc(f.name)+'</span><span class="tf">'+f.scope+' pts</span><span class="tb2">'+esc(f.kind==='plat'||f.improve?f.text:(f.kind==='asked'?'Raises product fit.':f.kind==='core'?'Nothing sells without it.':f.kind==='nopay'?'Only adds clutter.':'Might matter. Might not.'))+'</span>'+tag+'</button>';
}

function techTree(g){
  var fs=CAT.features(g), by={}; fs.forEach(function(f){ by[f.key]=f; });
  var plats=fs.filter(function(f){ return f.kind==='plat'; }), mvp=fs.filter(function(f){ return f.key==='mvp'; })[0];
  var depth=function(f){ if(!f.req||!f.req.length) return 1; var d=1; f.req.forEach(function(r){ if(r==='mvp') return; var pf=by['plat:'+r]; if(pf) d=Math.max(d,1+depth(pf)); }); return d; };
  var tiers={}; plats.forEach(function(f){ var d=depth(f); (tiers[d]=tiers[d]||[]).push(f); });
  var node=function(f){ var st=f.built?'built':f.queued?'queued':f.locked?'locked':'open'; var tag=f.built?'<span class="tag built">built</span>':f.queued?'<span class="tag queued">in the queue</span>':f.locked?'<span class="tag nopay">locked</span>':'<span class="tag core">ready</span>';
    var needs=f.req&&f.req.length?'<span class="tn-need">needs '+f.req.map(function(r){ return r==='mvp'?'first version':(SU.PLAT[r]?SU.PLAT[r].name:r); }).join(', ')+'</span>':'';
    return '<button class="tnode '+st+'" data-act="feat" data-key="'+esc(f.key)+'"'+(f.locked?' title="'+esc(f.lockWhy)+'"':'')+'><span class="tt">'+esc(f.name)+'</span>'+tag+'<span class="tp">'+esc(f.text)+'</span>'+needs+'<span class="tf">'+f.scope+' pts</span></button>'; };
  var h='<div class="sec"><h4>Tech tree <span class="muted xs">build left to right</span></h4><div class="tt-root">'+(mvp?node(mvp).replace('tnode ','tnode root '):'<div class="tnode built root"><span class="tt">First version</span><span class="tag built">shipped</span><span class="tp">Everything grows from this.</span></div>')+'</div>';
  Object.keys(tiers).sort().forEach(function(d){ h+='<div class="tt-tier"><div class="tt-lab">Tier '+d+'</div><div class="tt-row">'+tiers[d].map(node).join('')+'</div></div>'; });
  var asks=fs.filter(function(f){ return f.kind==='asked'||f.kind==='unknown'||f.kind==='nopay'||(f.needId&&(f.built||f.improve)); });
  if(asks.length) h+='<div class="tt-tier"><div class="tt-lab">Customer asks</div><div class="tt-row">'+asks.map(function(f){ return featureTile(f,g); }).join('')+'</div></div>';
  return h+'</div>';
}
function pProduct(g){
  var V=SU.velocity(g), h='<div class="strip">'+stat(SU.T(g,'buildSpeed','Build speed'),V.toFixed(1),SU.T(g,'buildSpeedSub','points a month'))+stat(SU.T(g,'quality','Quality'),Math.round(g.Q),'of 100')+stat(SU.T(g,'debt','Tech debt'),Math.round(g.D),g.D>50?SU.T(g,'debtBad','Dangerous'):g.D>30?SU.T(g,'debtWatch','Watch it'):SU.T(g,'debtOk','Fine'),g.D>50?'bad':'')+'</div>';
  h+=pricingCard(g);
  var st=sub('product',[['features','Features'],['tree','Tech tree'],['roadmap','Roadmap']],'features'); h+=st.html;
  if(st.cur==='tree'){ h+=techTree(g); }
  else if(st.cur==='features'){
    var fs=CAT.features(g).slice().sort(function(a,b){ var da=(a.built&&a.key!=='mvp')?1:0, db=(b.built&&b.key!=='mvp')?1:0; if(da!==db) return da-db; return (KIND_ORDER[a.kind]-KIND_ORDER[b.kind]); });
    h+='<div class="tilegrid">'+fs.map(function(f){ return featureTile(f,g); }).join('')+'</div>';
  } else {
    h+='<div class="sec"><h4>Building now <span class="muted xs">'+g.queue.length+' of 6</span></h4>'+(g.queue.length?'<div class="rmap">'+g.queue.map(function(q){ var pc=q.scope?q.progress/q.scope*100:0; return '<div class="rm-i"><div class="top2"><b>'+esc(q.name)+'</b><span class="mono xs">'+q.progress.toFixed(1)+' / '+q.scope+'</span></div>'+bar(pc,'')+'</div>'; }).join('')+'</div>':empty('Nothing in the queue. Pick a feature.'))+'</div>';
    h+='<div class="sec"><h4>Shipped</h4>'+(g.shipped.length?'<div class="row">'+g.shipped.slice(-12).map(function(s){ return '<span class="chip static '+(s.good!==0||s.plat?'ok':'')+'" title="'+esc(s.name)+'">'+esc(s.name)+'</span>'; }).join('')+'</div>':empty('Nothing shipped yet.'))+'</div>';
    h+=tiles(g.flavor==='ai'?['train','optimize','redteam','refactor','compliance','pivot']:(g.arch==='venue'?['menu','renovate','hours','refactor','pivot']:['launchearly','refactor','compliance','pivot']));
  }
  return h;
}

/* ------------------------------------------------------------ SALES */
function pSales(g){
  var S0=SU.seg(g), c=g.cust, ch=[]; var names={ads:'Search ads',content:'Content and SEO',social:'Creators and social',events:'Events',referral:'Referral rewards',ua:'App install ads'};
  ['ads','content','social','events','referral','ua'].forEach(function(k){ if(g.orders[k]>0) ch.push('<div class="rw"><div class="rm"><b>'+names[k]+'</b></div><span class="mono sm">'+fm(g.orders[k])+'/mo</span><button class="btn sm ghost" data-act="stopch" data-k="'+k+'">Stop</button></div>'); });
  var sdr=SU.count(g,'sdr'); if(sdr) ch.push('<div class="rw"><div class="rm"><b>SDR outreach ('+sdr+')</b></div><span class="mono sm">standing</span></div>');
  var priceTxt=g.arch==='market'?pctS(c.take,0)+' cut':fm(c.price)+'/mo';
  var h='<div class="strip">'+stat(g.arch==='consumer'?'Subscribers':'Customers',SU.fmtNum(SU.custCount(g)),'')+stat('Revenue',fm(g.mrr||0)+'/mo','')+stat('Rivals',String(g.rivals.filter(function(r){ return r.active; }).length),'take '+Math.round((1-SU.compF(g))*100)+'% of demand')+'</div>';
  h+=pricingCard(g);
  (function(){ var act=g.rivals.filter(function(r){ return r.active&&r.presence>0; }).sort(function(a,b){ return b.presence-a.presence; }); var top=act[0]; h+='<div class="sec compcard"><div class="row" style="justify-content:space-between;align-items:center"><div><div class="k">Competition</div><div class="sm">'+(top?'<b>'+esc(top.name)+'</b> is your biggest rival ('+act.length+' in all). They take '+Math.round((1-SU.compF(g))*100)+'% of demand.':'No rivals chasing you right now.')+'</div></div><button class="btn sm" data-act="view" data-id="rivals">See rivals</button></div></div>'; })();
  h+='<div class="sec"><h4>Marketing running now</h4>'+(ch.length?'<div class="rows">'+ch.join('')+'</div>':empty('Nothing. Try outreach, ads, content or a launch.'))+'</div>';
  h+=tiles(g.arch==='venue'?['night','happyhour','market','rival']:['contract','outbound','market','launch','rival']);
  return h;
}

/* ------------------------------------------------------------ TEAM */
function pTeam(g){
  var f=SU.fin(g), sp=SU.Shop.space(g), over=SU.Shop.over(g);
  var h='<div class="strip">'+stat('Seats',SU.headcount(g)+' / '+sp.seats,over?'Cramped. Move up in the Shop':sp.name,over?'bad':'')+stat('Payroll',fm(f.ex.payroll)+'/mo','')+stat('Morale',Math.round(g.morale),over?'-'+SU.Shop.crampedMorale(g).toFixed(0)+' from crowding':'team mood',g.morale<45?'bad':'')+'</div>';
  var pageSize=6, list=[{id:'you',nm:g.founder.name||'You',role:'Founder',col:'#f2b01e',bar:g.founder.sanity,bt:'sanity '+Math.round(g.founder.sanity)}]; if(g.co) list.push({id:'co',nm:g.co.name,role:'Cofounder',col:'#8b5cf6',bar:g.co.bond,bt:'bond '+Math.round(g.co.bond)});
  g.team.forEach(function(e){ list.push({id:e.id,nm:e.name,role:(e.level!=='mid'?SU.cap1(e.level)+' ':'')+SU.ROLES[e.role].name,col:ROLECOL[e.role]||'#5a6b7d',bar:e.loyalty,bt:'loyalty '+Math.round(e.loyalty),e:e}); });
  var pages=Math.max(1,Math.ceil(list.length/pageSize)), pg=Math.min(S.page.team||0,pages-1);
  var cands=(g.cands||[]).map(function(c){ return '<div class="rw click" data-act="cands" data-id="'+c.id+'"><div class="av" style="background:#c9a227">?</div><div class="rm"><b>'+c.list.length+' candidates for '+esc(SU.ROLES[c.role].name.toLowerCase())+'</b><div class="rs">Pick before they take other offers</div></div><button class="btn sm primary">Meet</button></div>'; }).join('');
  var reqs=g.reqs.map(function(r){ return '<div class="rw"><div class="av" style="background:#c9a227">?</div><div class="rm"><b>Hiring: '+esc(SU.ROLES[r.role].name)+'</b><div class="rs">'+fm(r.comp)+'/yr, open '+r.age+' period'+(r.age===1?'':'s')+'</div></div></div>'; }).join('');
  var tm=g.team, avg=function(fn){ return tm.length?tm.reduce(function(a,e){ return a+fn(e); },0)/tm.length:0; };
  h+='<div class="strip">'+stat('Build speed',SU.velocity(g).toFixed(1),'points a month')+stat('Avg skill',Math.round(avg(SU.skillRating)),tm.length?SU.RANKS[Math.round(avg(function(e){ return SU.rankOf(e).i; }))].name+' crew':'just you')+stat('Avg energy',Math.round(avg(SU.energyOf)),avg(SU.energyOf)<45?'Burnout risk':'Rested',avg(SU.energyOf)<45?'bad':'')+'</div>';
  h+='<div class="sec"><h4>Hire in one click <span class="muted xs">candidates appear right away</span></h4>'+hireButtons(g)+'</div>';
  h+='<div class="sec"><h4>People</h4><div class="rows">'+cands+list.slice(pg*pageSize,(pg+1)*pageSize).map(function(p){ return '<div class="rw click" data-act="person" data-id="'+p.id+'">'+avatar(p.nm,p.col)+'<div class="rm"><b>'+esc(p.nm)+'</b><div class="rs">'+esc(p.role)+(p.e?' &middot; '+SU.rankOf(p.e).name+' &middot; skill '+SU.skillRating(p.e)+' &middot; energy '+Math.round(SU.energyOf(p.e)):' &middot; '+p.bt)+'</div></div><div style="width:64px">'+good(p.bar)+'</div></div>'; }).join('')+reqs+'</div>'+(pages>1?'<div class="pager"><button class="btn sm ghost" data-act="page" data-k="team" data-d="-1">Prev</button>'+(pg+1)+' / '+pages+'<button class="btn sm ghost" data-act="page" data-k="team" data-d="1">Next</button></div>':'')+'</div>';
  h+='<div class="tilegrid">'+['hire'].map(tileAction).join('')+'<button class="tile" data-act="view" data-id="roles"><span class="tt">What does each job do?</span><span class="tf">guide</span><span class="tb2">Exactly what every role does for you, and when to hire it.</span></button><button class="tile" data-act="view" data-id="policy"><span class="tt">Work policies</span><span class="tf">free</span><span class="tb2">Remote, four-day week, perks, crunch.</span></button>'+['allhands','offsite','raiseAll','layoff'].map(tileAction).join('')+'</div>';
  return h;
}

/* ------------------------------------------------------------ MONEY */
function offerCard(g){ var o=g.offer; return '<div class="sheet"><h5>'+esc(SU.cap1(o.buyer))+' wants to buy you</h5><div class="sm">'+fm(o.price)+', '+esc(o.struct)+'. Expires in '+o.left+' period'+(o.left===1?'':'s')+'.</div><div class="row" style="margin-top:6px"><button class="btn sm primary" data-act="offer">Review the offer</button></div></div>'; }
function stageIndex(p){ return ({intro:0,meet:1,partner:2,sheet:3})[p.stage]; }
function roundBlock(g){
  var r=g.round, h='<div class="sec"><h4>Your '+esc(M.STAGE_NAME[r.stage])+' <span class="muted xs">asking '+fm(r.ask)+' &middot; '+(r.instrument==='priced'?'priced':r.instrument==='note'?'note':'SAFE')+' &middot; open '+r.age+' mo</span></h4>';
  r.sheets.filter(function(s){ return s.state==='live'; }).forEach(function(s){ var inv=SU.investor(s.inv); h+='<div class="sheet"><h5>Term sheet: '+esc(inv.name)+'</h5><div class="sm">'+fm(s.amount)+' '+(s.instrument==='priced'?'at '+fm(s.pre)+' pre-money':'on a SAFE at a '+fm(s.cap)+' cap')+'. Expires in '+(s.left+1)+'.</div>'+(s.note?'<div class="sm" style="color:var(--bad);font-weight:600">'+esc(s.note)+'</div>':'')+'<div class="row" style="margin-top:6px"><button class="btn sm primary" data-act="sheet" data-id="'+esc(s.id)+'">Review and decide</button></div></div>'; });
  h+=r.pipe.map(function(p){ var inv=SU.investor(p.inv); var idx=stageIndex(p); var out=['pass','dead','lost'].indexOf(p.stage)>=0; var warm=p.interest<35?'cold':p.interest<55?'cool':p.interest<75?'warm':'hot';
    var st={intro:'Waiting for a reply',meet:'First meeting',partner:p.pitchPending?'Partner meeting is waiting for you':'The partners are deciding',sheet:'Term sheet on the table',pass:'Passed',dead:'No reply',lost:'Out of the round',done:'Done'}[p.stage]||p.stage;
    return '<div class="invc"><div class="top2"><b>'+esc(inv.name)+'</b><span class="pill '+(out?'':(warm==='hot'?'good':warm==='warm'?'blue':'warn'))+'">'+(out?'out':warm)+'</span></div><div class="stagebar">'+[0,1,2,3].map(function(i){ return '<i class="'+(out?'pass':(i<=idx?'on':''))+'"></i>'; }).join('')+'</div><div class="row" style="justify-content:space-between"><span class="xs muted">'+esc(st)+'</span>'+(p.pitchPending?'<button class="btn sm primary" data-act="pitch" data-inv="'+esc(p.inv)+'" data-id="">Go to the meeting</button>':'')+'</div></div>'; }).join('');
  return h+'</div>';
}

function cashChart(g){
  var f=SU.fin(g), hist=(g.hist||[]).slice(-18).map(function(h){ return h.cash; }); if(hist.length<2) hist=[g.cash,g.cash];
  var gr=Math.max(0,Math.min(0.15,SU.growthMo(g))), r=g.mrr||0, cash=g.cash, proj=[];
  for(var k=1;k<=12;k++){ r=r*(1+gr*Math.pow(0.97,k)); cash+=r-f.ex.total; proj.push(cash); }
  var all=hist.concat(proj), mx=Math.max.apply(null,all.concat([1])), mn=Math.min.apply(null,all.concat([0])), W=300, H=90, pad=6, n=all.length;
  var X=function(i){ return pad+i*(W-2*pad)/(n-1); }, Y=function(v){ return pad+(1-(v-mn)/Math.max(1,mx-mn))*(H-2*pad); };
  var pts=function(a,off){ return a.map(function(v,i){ return X(i+off).toFixed(1)+','+Y(v).toFixed(1); }).join(' '); };
  var out=proj.findIndex?proj.findIndex(function(v){ return v<0; }):-1;
  var svg='<svg viewBox="0 0 '+W+' '+H+'" class="cashsvg" role="img" aria-label="Cash history and 12 month projection"><line x1="'+pad+'" x2="'+(W-pad)+'" y1="'+Y(0).toFixed(1)+'" y2="'+Y(0).toFixed(1)+'" stroke="#c22a2a" stroke-dasharray="3 3" stroke-width="1"/>'+
    '<polyline points="'+pts(hist,0)+'" fill="none" stroke="#2b3a67" stroke-width="2"/>'+
    '<polyline points="'+X(hist.length-1).toFixed(1)+','+Y(hist[hist.length-1]).toFixed(1)+' '+pts(proj,hist.length)+'" fill="none" stroke="'+(out>=0?'#c22a2a':'#1f9d63')+'" stroke-width="2" stroke-dasharray="5 4"/>'+
    '<line x1="'+X(hist.length-1).toFixed(1)+'" x2="'+X(hist.length-1).toFixed(1)+'" y1="'+pad+'" y2="'+(H-pad)+'" stroke="#9aa6c0" stroke-width="1"/></svg>';
  var msg=f.burn<=0?'You earn more than you spend. The line only goes up.':out>=0?'If nothing changes, cash runs out in about '+(out+1)+' month'+(out?'s':'')+'.':'At this pace you stay above zero for the next year.';
  return '<div class="sec"><div class="row" style="justify-content:space-between"><h4>Cash over time</h4><span class="muted xs">solid: past &middot; dashed: if nothing changes</span></div>'+svg+'<div class="sm '+(out>=0&&f.burn>0?'bad-t':'')+'">'+msg+'</div></div>';
}
function pMoney(g){
  var f=SU.fin(g), E=SU.era(g);
  var h='<div class="strip">'+stat('Cash',fm(g.cash),'',g.cash<0?'bad':'')+stat(f.burn<=0?'Profit / mo':'Burn / mo',fm(Math.abs(f.burn)),f.burn<=0?'you earn more than you spend':'what you lose each month',f.burn>0?'':'good')+stat('Runway',f.burn<=0?'infinite':(f.runway>=99?'99+':f.runway.toFixed(1))+' mo','',f.burn>0&&f.runway<3?'bad':'')+'</div>';
  h+='<div>'+(f.burn<=0?'<span class="pill good">You make more than you spend</span>':f.defaultAlive?'<span class="pill good">Default alive: growth reaches break-even</span>':'<span class="pill bad">Default dead'+(f.daMonth?': cash runs out in about '+f.daMonth+' month'+(f.daMonth===1?'':'s'):'')+'</span>')+' <span class="pill">Money is '+(E.fundAvail>=1.4?'easy':E.fundAvail>=0.9?'normal':'tight')+' now</span></div>';
  h+=moneyMapCard(g);
  h+=cashChart(g);
  if(g.offer) h+=offerCard(g);
  if(g.round) h+=roundBlock(g);
  var ids=g.round?['addInvestor','walkaway']:['raise']; ids=ids.concat(['cutburn']);
  h+='<div class="tilegrid">'+ids.map(tileAction).join('')+
    '<button class="tile" data-act="view" data-id="loans"><span class="tt">Loans and bridges</span><span class="tf">free</span><span class="tb2">Credit card, deferred pay, bridge, venture debt.</span></button>'+
    '<button class="tile" data-act="view" data-id="cap"><span class="tt">Who owns what</span><span class="tf">free</span><span class="tb2">Cap table and what a sale would pay.</span></button>'+
    '<button class="tile" data-act="view" data-id="spend"><span class="tt">Where the money goes</span><span class="tf">free</span><span class="tb2">Every cost, every month.</span></button>'+
    '<button class="tile'+(g.act>=2?'':' no')+'" data-act="view" data-id="exit"><span class="tt">Sell or go public</span><span class="tf">free</span><span class="tb2">'+(g.act>=2?'Bankers, an IPO, going indie, closing up.':'Not yet. Find product fit first.')+'</span></button></div>';
  return h;
}

/* ------------------------------------------------------------ YOU */
function pYou(g){
  var sk=g.founder.skills;
  var h='<div class="strip">'+stat('Sanity',Math.round(g.founder.sanity),'at zero you burn out',g.founder.sanity<35?'bad':'')+stat(g.co?'Cofounder bond':'Cofounder',g.co?Math.round(g.co.bond):'solo',g.co?esc(g.co.name.split(' ')[0]):'')+stat('Focus',Math.round(SU.focusBudget(g).budget),'a month'+(g.focusBonus?' (goals +'+g.focusBonus+')':''))+'</div>';
  h+='<div class="sec"><div class="row" style="justify-content:space-between"><b class="sm">'+esc(g.founder.bg.name)+'</b><span class="xs muted">Product '+sk.p+' &middot; Tech '+sk.t+' &middot; Sales '+sk.s+' &middot; Charm '+sk.c+'</span></div>'+good(g.founder.sanity)+'<div class="xs muted">Perk: '+esc(g.founder.bg.perk)+'. Flaw: '+esc(g.founder.bg.flaw)+'.</div></div>';
  h+=tiles(['self','talkcofounder','investorUpdate','announce','ethics']);
  return h;
}

/* ------------------------------------------------------------ SHOP */
function pShop(g){
  var sp=SU.Shop.space(g), over=SU.Shop.over(g), idx=SU.SPACE_ORDER.indexOf(g.space||'garage');
  var h='<div class="sec"><h4>Your building <span class="muted xs">it grows when you move up</span></h4><canvas class="bldBig" data-tier="'+(g.space||'garage')+'"></canvas><div class="bstrip">'+SU.SPACE_ORDER.map(function(id,i){ var cur=id===(g.space||'garage'), locked=i>idx, c=SU.Shop.canMove(g,id), sp2=SU.SPACES[id]; return '<button class="bcell'+(cur?' cur':'')+(locked?' lock':'')+'" data-act="move" data-id="'+id+'"'+(cur||!c.ok?' disabled':'')+' title="'+esc(cur?'You are here':(c.ok?'Move here':c.why))+'"><canvas data-tier="'+id+'"></canvas><b>'+esc(SU.spaceName(g,id).replace('The ',''))+'</b><span>'+(cur?'here now':sp2.seats+' seats')+'</span></button>'; }).join('')+'</div></div>';
  h+='<div class="sec"><h4>Your space <span class="pill">'+esc(sp.name)+'</span></h4><div class="row" style="justify-content:space-between"><span class="sm">'+SU.headcount(g)+' of '+sp.seats+' seats used</span><span class="xs muted">rent '+fm(sp.rent)+'/mo</span></div>'+bar(SU.headcount(g)/sp.seats*100,over?'bad':(SU.headcount(g)/sp.seats>0.8?'warn':'good'))+(over?'<div class="xs" style="color:var(--bad)">Cramped: morale and speed are dropping.</div>':'')+'<div class="rows">';
  SU.SPACE_ORDER.forEach(function(id,i){ if(id===g.space) return; var s=SU.SPACES[id], c=SU.Shop.canMove(g,id); h+='<div class="rw"><div class="rm"><b>'+esc(SU.spaceName(g,id))+'</b><div class="rs">'+s.seats+' seats &middot; rent '+fm(s.rent)+'/mo'+(i>idx?' &middot; deposit '+fm(s.deposit):'')+'</div></div><button class="btn sm '+(i>idx?'primary':'ghost')+'" data-act="move" data-id="'+id+'"'+(c.ok?'':' disabled title="'+esc(c.why)+'"')+'>'+(i>idx?'Move in':'Move down')+'</button></div>'; });
  h+='</div></div><div class="sec"><h4>Upgrades <span class="muted xs">they show up in the office</span></h4><div class="tilegrid">';
  SU.upgradesFor(g).forEach(function(u){ var owned=SU.Shop.has(g,u.id), c=SU.Shop.canBuy(g,u.id);
    h+='<button class="tile'+(owned?' done':(c.ok?'':' no'))+'" data-act="buy" data-id="'+u.id+'"><span class="tt">'+esc(u.name)+'</span><span class="tf">'+(owned?'owned':fm(u.cost))+'</span>'+(u.needs?'<span class="tag plat" style="position:absolute;right:8px;bottom:6px">Level 2</span>':'')+'<span class="tb2">'+esc(owned?u.text:(c.ok||c.why.indexOf('Need ')!==0&&c.why.indexOf('Needs ')!==0?u.text:c.why))+'</span></button>'; });
  return h+'</div></div>';
}

/* ------------------------------------------------------------ GOALS */
function pGoals(g){
  var L=SU.Goals.list(g), done=L.filter(function(x){ return x.done; }).length, next=L.filter(function(x){ return !x.done; }).slice(0,5);
  var li=SU.Level.info(g);
  var h='<div class="lvlcard"><div class="n">'+li.n+'</div><div><b>'+esc(li.cur.title)+'</b><small>'+(li.next?'Next, level '+li.next.n+': '+esc(li.next.title)+'. '+esc(li.next.hint):'You reached the top.')+'</small><small>Every level adds a trophy to the shelf in your office.</small></div></div>';
  h+='<div class="row" style="justify-content:space-between"><b>Goals</b><span class="pill good">'+done+' of '+L.length+' reached</span></div><div class="sec">';
  next.forEach(function(x){ var pc=x.max?x.cur/x.max*100:0; h+='<div class="rw"><div class="rm"><div class="row" style="justify-content:space-between"><b>'+esc(x.goal.title)+'</b><span class="mono xs">'+(x.money?fm(x.cur)+' / '+fm(x.max):Math.round(x.cur)+' / '+x.max)+'</span></div>'+bar(pc,'')+'<div class="rs">'+esc(x.goal.desc)+' Reward: '+esc(SU.Goals.rewardText(x.goal.reward))+'.</div></div></div>'; });
  if(!next.length) h+=empty('Every goal reached. Go build something huge.');
  h+='</div><div class="sec"><h4>Reached</h4><div class="row">'+(L.filter(function(x){ return x.done; }).map(function(x){ return '<span class="chip static ok" title="'+esc(x.goal.desc)+'">'+esc(x.goal.title)+'</span>'; }).join('')||'<span class="muted xs">None yet.</span>')+'</div></div>';
  h+='<div class="row"><button class="btn sm" data-act="view" data-id="log">Story so far</button><button class="btn sm ghost" data-act="report">Last month</button></div>';
  return h;
}

/* ------------------------------------------------------------ STATS (dashboard, unlocked by the feature) */
function lineChart(series,color,fmt){
  var W=210,H=74,pad=6; if(series.length<2) return '<svg viewBox="0 0 '+W+' '+H+'"><text x="'+(W/2)+'" y="'+(H/2)+'" text-anchor="middle" font-size="11" fill="var(--muted)">not enough months yet</text></svg>';
  var mx=Math.max.apply(null,series), mn=Math.min(0,Math.min.apply(null,series)); if(mx===mn) mx=mn+1;
  var xs=function(i){ return pad+(W-2*pad)*i/(series.length-1); }, ys=function(v){ return H-pad-(H-2*pad-8)*(v-mn)/(mx-mn); };
  var pts=series.map(function(v,i){ return xs(i).toFixed(1)+','+ys(v).toFixed(1); });
  var last=series.length-1;
  return '<svg viewBox="0 0 '+W+' '+H+'"><line x1="'+pad+'" x2="'+(W-pad)+'" y1="'+ys(0).toFixed(1)+'" y2="'+ys(0).toFixed(1)+'" stroke="var(--line)" stroke-width="1"/><polygon points="'+pad+','+ys(0).toFixed(1)+' '+pts.join(' ')+' '+(W-pad)+','+ys(0).toFixed(1)+'" fill="'+color+'" opacity="0.14"/><polyline points="'+pts.join(' ')+'" fill="none" stroke="'+color+'" stroke-width="2" stroke-linejoin="round"/><circle cx="'+xs(last).toFixed(1)+'" cy="'+ys(series[last]).toFixed(1)+'" r="3.5" fill="'+color+'"/><text x="'+pad+'" y="10" font-size="9.5" fill="var(--muted)">'+fmt(mx)+'</text></svg>';
}
function pDash(g){
  var hi=(g.hist||[]).slice(-24); if(hi.length<2) return empty('Give it a couple of months. The charts fill in as you run.');
  var last=hi[hi.length-1], prev=hi[hi.length-2];
  var gm=SU.growthMo(g);
  var h='<div class="strip">'+stat('Growth / mo',(gm>=0?'+':'')+pctS(gm,0),'3-month average',gm<0?'bad':'good')+stat('Net new',(last.nw-last.ch>=0?'+':'')+(last.nw-last.ch),last.nw+' in, '+last.ch+' out')+stat('Burn multiple',(function(){ var nn=Math.max(0,last.mrr-prev.mrr)*12; return nn>0&&last.burn>0?(last.burn*12/nn).toFixed(1)+'x':'n/a'; })(),'lower is better')+'</div>';
  h+='<div class="charts"><div class="chart"><div class="ch-t"><b>Revenue / mo</b><span>'+fm(last.mrr)+'</span></div>'+lineChart(hi.map(function(x){ return x.mrr; }),'#2a58d6',fm)+'</div>'+
    '<div class="chart"><div class="ch-t"><b>Customers</b><span>'+SU.fmtNum(last.cust)+'</span></div>'+lineChart(hi.map(function(x){ return x.cust; }),'#0f7a54',SU.fmtNum)+'</div>'+
    '<div class="chart"><div class="ch-t"><b>Cash</b><span>'+fm(last.cash)+'</span></div>'+lineChart(hi.map(function(x){ return x.cash; }),'#9a6200',fm)+'</div>'+
    '<div class="chart"><div class="ch-t"><b>Product fit</b><span>'+last.pmf+'</span></div>'+lineChart(hi.map(function(x){ return x.pmf; }),'#7048e8',function(v){ return Math.round(v); })+'</div></div>';
  h+='<div class="xs muted">Unlocked because you built the analytics dashboard.</div>';
  return h;
}
var PANELS={inbox:pInbox,customers:pCustomers,product:pProduct,sales:pSales,team:pTeam,money:pMoney,you:pYou,shop:pShop,goals:pGoals,dash:pDash};

/* ------------------------------------------------------------ drawer: one action */
function ctlDef(aid,k){ var a=CAT.actions[aid]; var c=a.ctl(G(),S.cfg[aid]).filter(function(x){ return x.k===k; })[0]; return c; }
function fmtVal(c,v){ return c.fmt==='price'?(v>=100?'$'+Math.round(v):'$'+v.toFixed(2)):c.fmt==='pct'?Math.round(v)+'%':String(v); }
function ctlHtml(aid,c,v){
  var cur=v[c.k], h='<div class="ct"><div class="ct-l">'+esc(c.label||'')+'</div>';
  if(c.kind==='choice'){ h+='<div class="seg wrap">'+c.opts.map(function(o){ return '<button class="sg'+(String(cur)===String(o.v)?' on':'')+'" data-act="ctl" data-aid="'+aid+'" data-k="'+c.k+'" data-v="'+esc(String(o.v))+'">'+esc(o.t)+(o.sub?'<small>'+esc(o.sub)+'</small>':'')+'</button>'; }).join('')+'</div>'; }
  else if(c.kind==='cards'){ h+='<div class="cards">'+c.opts.map(function(o){ return '<button class="cd'+(String(cur)===String(o.v)?' on':'')+'" data-act="ctl" data-aid="'+aid+'" data-k="'+c.k+'" data-v="'+esc(String(o.v))+'"><b>'+esc(o.t)+'</b>'+(o.sub?'<span>'+esc(o.sub)+'</span>':'')+'</button>'; }).join('')+'</div>'; }
  else if(c.kind==='step'){ h+='<div class="stp"><button class="sb" data-act="step" data-aid="'+aid+'" data-k="'+c.k+'" data-dir="-1">−</button><b>'+fmtVal(c,cur)+'</b><button class="sb" data-act="step" data-aid="'+aid+'" data-k="'+c.k+'" data-dir="1">+</button>'+(c.quick?'<div class="qk">'+c.quick.map(function(q){ var lbl=c.quickAbs?(q>0?'+':'')+q+(c.fmt==='pct'?'%':''):(q>0?'+':'')+Math.round(q*100)+'%'; return '<button class="btn sm" data-act="step" data-aid="'+aid+'" data-k="'+c.k+'" data-q="'+q+'">'+lbl+'</button>'; }).join('')+'</div>':'')+'</div>'; }
  else if(c.kind==='toggle'){ return '<button class="tgl'+(cur?' on':'')+'" data-act="tgl" data-aid="'+aid+'" data-k="'+c.k+'"><span class="bx">✓</span>'+esc(c.label)+'</button>'; }
  return h+'</div>';
}
function drawerAct(aid){
  var g=G(), a=CAT.actions[aid], v=cfgFor(aid), ctls=a.ctl?a.ctl(g,v):[], ok=CAT.validate(g,aid,v);
  var title=a.title; if(aid==='build'){ var ft=CAT.featureByKey(g,v.fk); if(ft) title='Build: '+ft.name; }
  var f=focusOf(aid,v), budget=SU.focusBudget(g).budget, used=UI.planFocus(), left=Math.max(0,budget-used);
  var afford=(f<=left+1e-9);
  var pv=a.preview?(a.preview(g,v)||[]):[];
  var h='<div class="dr-h"><button class="btn sm ghost" data-act="back">'+UI.icon('back')+' Back</button><h3>'+esc(title)+'</h3><span class="fc">'+(f?f+' focus':'free')+'</span></div><div class="dr-b"><div class="muted sm">'+esc(a.blurb)+'</div>'+(function(){ var ch=ctls.map(function(c){ return ctlHtml(aid,c,v); }); var pvh=pv.length?'<div class="pv">'+pv.map(function(l){ return '<div class="'+(/^Warning/.test(l)?'wn':'')+'">'+esc(l)+'</div>'; }).join('')+'</div>':''; if(aid==='hire'&&ch.length>1){ ch.splice(1,0,pvh); return ch.join(''); } return ch.join('')+pvh; })()+'</div>';
  var why=!ok.ok?ok.why:(!afford?'You have '+(Math.round(left*2)/2)+' focus left this month.':'');
  h+='<div class="dr-f">'+(why?'<span class="why">'+esc(why)+'</span>':'')+(a.repeat?'<button class="btn" data-act="add-act" data-pin="1"'+((ok.ok&&afford)?'':' disabled')+'>Add and repeat monthly</button>':'')+'<button class="btn primary" data-act="add-act" data-pin="0"'+((ok.ok&&afford)?'':' disabled')+'>Add to plan</button></div>';
  return h;
}
var DEPS={outbound:{ch:['n']},hire:{role:['level']},raise:{stage:['amount','inst','target'],amount:['target']}};
function setCfg(aid,k,val){
  var v=S.cfg[aid]; v[k]=val; var dep=DEPS[aid]&&DEPS[aid][k]; if(dep) dep.forEach(function(d){ delete v[d]; });
  S.cfg[aid]=CAT.defaults(G(),aid,v); renderDrawer();
}

/* ------------------------------------------------------------ drawer: a person */

/* ------------------------------------------------------------ people: stat sheet */
function sbar(label,val,cls,right,tip){ return '<div class="sbar" title="'+esc(tip||'')+'"><span class="sl">'+label+'</span><div class="bar '+(cls||'')+'"><i style="width:'+Math.max(0,Math.min(100,Math.round(val)))+'%"></i></div><span class="sv mono">'+(right==null?Math.round(val):right)+'</span></div>'; }
function cls3(v){ return v<35?'bad':v<60?'warn':'good'; }
function without(g,e){ var g2=SU.clone(g); g2.team=g2.team.filter(function(x){ return x.id!==e.id; }); return SU.velocity(g)-SU.velocity(g2); }
function roleEffect(g,e){
  var r=e.role, f=e.skill||1, ef=SU.energyF(e), rp=SU.rampPct(g,e), idx=g.team.filter(function(x){ return x.role===r; }).indexOf(e), cap={design:3,pm:2,ae:3,mkt:3}[r];
  var counted=cap?idx<cap:true;
  if(r==='eng'){ var vs=(SU.velocity(g),SU._vshare||{}); var tot=0; Object.keys(vs).forEach(function(k){ tot+=vs[k]; }); var share=tot>0?(vs[e.id]||0)/tot:0; return {k:'Build output',v:(SU.velocity(g)*share).toFixed(1)+' pts/mo',s:Math.round(share*100)+'% of your building'}; }
  if(r==='design'||r==='pm'){ var d=without(g,e); return {k:'Speed boost',v:(counted?'+'+d.toFixed(1)+' pts/mo':'none'),s:counted?'added to your engineers':'beyond the first '+cap+' they add nothing'}; }
  if(r==='ae'){ var fit=SU.roleFit(g,'ae'); return {k:'Close rate',v:(counted&&fit.state==='ok')?'+'+Math.round(12*f*rp)+'%':'none',s:fit.state==='ok'?(counted?'on every deal':'beyond the first 3'):'only helps business products'}; }
  if(r==='sdr'){ var f2=SU.roleFit(g,'sdr'); return {k:'Outreach',v:f2.state==='ok'?'1,200/mo':'none',s:f2.state==='ok'?'cold contacts, on autopilot':'does nothing for consumer apps'}; }
  if(r==='cs'){ var capc=300+150*SU.count(g,'cs'); return {k:'Support',v:'+150 customers',s:'team handles '+capc+' of your '+SU.fmtNum(SU.custCount(g))}; }
  if(r==='mkt'){ var fm2=SU.roleFit(g,'mkt'); return {k:'Marketing boost',v:counted?'+'+Math.round(15*f*ef*rp)+'%':'none',s:fm2.state==='ok'?'on all your marketing channels':'needs marketing spend to matter'}; }
  if(r==='mgr'){ var ms=g.team.filter(function(x){ return x.role==='mgr'; }), mi=ms.indexOf(e); return {k:'Delegation',v:mi<2?'+1 focus':'none',s:mi<2?'and runs 2 pinned moves free':'only your first 2 managers count'}; }
  if(r==='cos') return {k:'Extra focus',v:'+2',s:'moves every month'};
  if(r==='vp') return {k:'Team overhead',v:'halved',s:'above 8 people; investors like it'};
  return {k:'Impact',v:'x'+f.toFixed(2),s:''};
}
function personSheet(g,e){
  var rk=SU.rankOf(e), sk=SU.skillRating(e), en=Math.round(SU.energyOf(e)), ramp=Math.round(SU.rampPct(g,e)*100), mk=SU.salaryFor(g,e.role,e.level), pay=Math.round((e.sal/mk-1)*100), risk=Math.round(SU.attrRisk3(g,e)*100), want=SU.wantStatus(g,e), eff=roleEffect(g,e), ten=Math.max(0,Math.round(g.mi-e.joinMi));
  var xpPct=rk.next?(rk.xp-rk.from)/(rk.next.xp-rk.from)*100:100;
  var h='<div class="sec sheetbars">'+sbar('Skill',sk,cls3(sk),sk,'How good they are at the job. It grows with experience.')+sbar('Energy',en,cls3(en),en,'Crunch, crowding and low morale drain it. Perks and rest refill it. Tired people build slower.')+sbar('Loyalty',e.loyalty,cls3(e.loyalty),Math.round(e.loyalty),'Low loyalty means they might leave.')+(ramp<100?sbar('Ramp-up',ramp,'',ramp+'%','New hires take a few months to reach full speed.'):'')+'</div>';
  var gd=SU.ROLE_GUIDE[e.role], fit=SU.roleFit(g,e.role);
  h+='<div class="pv job"><div><b>Their job: '+esc(gd.tag)+'.</b></div>'+gd.does.slice(0,2).map(function(x){ return '<div>'+esc(x)+'</div>'; }).join('')+(fit.state==='no'?'<div class="wn">Right now: '+esc(fit.why)+'</div>':'')+'<div><a href="#" data-act="view" data-id="roles" onclick="return false">See every job</a></div></div>';
  h+='<div class="strip stats4"><div class="st"><div class="l">'+esc(eff.k)+'</div><div class="v">'+esc(eff.v)+'</div><div class="s">'+esc(eff.s)+'</div></div><div class="st"><div class="l">Pay vs market</div><div class="v">'+(pay>=0?'+':'')+pay+'%</div><div class="s">'+fm(e.sal)+' a year</div></div><div class="st'+(risk>=20?' bad':'')+'"><div class="l">Might leave</div><div class="v">'+risk+'%</div><div class="s">in the next 3 months</div></div></div>';
  h+='<div class="sec"><div class="row" style="justify-content:space-between"><b class="sm">Rank: '+rk.name+'</b><span class="mono xs">'+(rk.next?rk.xp+' / '+rk.next.xp+' xp to '+rk.next.name:'top rank')+'</span></div>'+bar(xpPct,'')+'<div class="xs muted">Experience grows every month, faster when you ship. Each rank makes them a little more loyal.</div></div>';
  h+='<div class="pv"><div><b>Wants '+esc(SU.WANT_TEXT[e.want]||e.want)+'.</b> <span class="pill '+(want.ok?'good':'warn')+'">'+(want.ok?'happy':'not yet')+'</span></div><div>'+esc(want.why)+'</div></div>';
  return h;
}

function drawerPerson(id){
  var g=G(), h='', e=g.team.filter(function(x){ return x.id===id; })[0];
  if(id==='you'){
    h='<div class="dr-h"><button class="btn sm ghost" data-act="back">'+UI.icon('back')+' Back</button><h3>'+esc(g.founder.name||'You')+'</h3></div><div class="dr-b"><div class="row">'+avatar(g.founder.name||'Y','#f2b01e')+'<div><b>'+esc(g.founder.bg.name)+'</b><div class="xs muted">Perk: '+esc(g.founder.bg.perk)+'. Flaw: '+esc(g.founder.bg.flaw)+'.</div></div></div><div class="sec"><div class="k">Sanity</div>'+good(g.founder.sanity)+'</div><div class="tilegrid">'+tileAction('self')+tileAction('ethics')+'</div></div>';
  } else if(id==='co'&&g.co){
    h='<div class="dr-h"><button class="btn sm ghost" data-act="back">'+UI.icon('back')+' Back</button><h3>'+esc(g.co.name)+'</h3></div><div class="dr-b"><div class="row">'+avatar(g.co.name,'#8b5cf6')+'<div><b>'+esc(g.co.arch)+'</b><div class="xs muted">'+esc(g.co.trait)+'</div></div></div><div class="sec"><div class="k">Bond</div>'+good(g.co.bond)+'<div class="sm">Wants: '+esc(g.co.wants)+'</div><div class="quote">"'+esc(g.co.voice)+'"</div></div><div class="tilegrid">'+tileAction('talkcofounder')+'</div></div>';
  } else if(e){
    var acts=CAT.personActions(g,e), n5=Math.max(0,Math.min(5,Math.round(SU.skillRating(e)/20))), stars='★'.repeat(n5)+'☆'.repeat(5-n5);
    h='<div class="dr-h"><button class="btn sm ghost" data-act="back">'+UI.icon('back')+' Back</button><h3>'+esc(e.name)+'</h3></div><div class="dr-b"><div class="row">'+avatar(e.name,ROLECOL[e.role]||'#5a6b7d')+'<div><b>'+(e.level!=='mid'?SU.cap1(e.level)+' ':'')+esc(SU.ROLES[e.role].name)+' <span class="pill blue">'+SU.rankOf(e).name+'</span></b><div class="xs muted">'+fm(e.sal)+' a year &middot; joined '+Math.max(0,Math.round(g.mi-e.joinMi))+' months ago</div></div><span class="stars" title="Skill">'+stars+'</span></div>'+
      personSheet(g,e)+(e.trait?'<div class="pv"><div><b>'+esc(SU.TRAITS[e.trait].name)+'.</b> '+esc(SU.TRAITS[e.trait].desc||'')+'</div></div>':'')+'<div class="tilegrid">'+acts.map(function(x,i){ return '<button class="tile'+(x.danger?' danger':'')+'" data-act="pquick" data-id="'+e.id+'" data-i="'+i+'"><span class="tt">'+esc(x.label)+'</span><span class="tf">'+focusSpec(x.spec)+'</span><span class="tb2">'+esc(x.spec.lever==='fire'?'Severance '+fm(e.sal*1.3/26*2)+' once (4 weeks). Their '+fm(e.sal*1.3/12)+' a month stops right away.':x.spec.text)+'</span></button>'; }).join('')+'</div></div>';
  } else h='<div class="dr-h"><button class="btn sm ghost" data-act="back">Back</button><h3>Gone</h3></div><div class="dr-b">That person is no longer here.</div>';
  return h;
}
function focusSpec(sp){ var f=SU.mkClause(G(),sp.lever,sp.params,sp.text).focus; return f?f+' focus':'free'; }

/* ------------------------------------------------------------ drawer: views (policies, loans, exit, cap table, spending, story) */
var EXP_LABEL={payroll:'Payroll',tools:'Tools',infra:'Servers and hosting',marketing:'Marketing and outreach',cogs:'Cost of serving customers',fixed:'Rent, legal, accounting',other:'Perks and care',rbf:'Revenue-based repayment',debt:'Debt interest',owed:'Deferred pay owed',card:'Credit card payments'};

function rolesGuide(g){
  var h='<div class="dr-b"><div class="muted sm">Every job does something specific. Here is exactly what, with your numbers.</div>';
  var order=['eng','design','pm','mgr','sdr','ae','cs','mkt','cos','vp'];
  order.forEach(function(r){
    var gd=SU.ROLE_GUIDE[r], R=SU.ROLES[r], fit=SU.roleFit(g,r), n=SU.count(g,r);
    h+='<div class="rg"><div class="row" style="justify-content:space-between;align-items:baseline"><b>'+esc(R.name)+'</b><span class="pill '+(fit.state==='ok'?'good':fit.state==='no'?'bad':'warn')+'">'+(fit.state==='ok'?'useful now':fit.state==='no'?'no effect now':'not yet')+'</span></div>'+
      '<div class="sm"><b>'+esc(gd.tag)+'.</b></div><ul class="rgl">'+gd.does.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul>'+
      '<div class="xs"><b>Hire when:</b> '+esc(gd.best)+'</div><div class="xs muted"><b>Limits:</b> '+esc(gd.limit)+'</div>'+
      '<div class="xs muted"><b>Your case:</b> '+esc(fit.why)+'</div>'+
      '<div class="xs mono muted">Pay '+fm(SU.salaryFor(g,r,'junior'))+' to '+fm(SU.salaryFor(g,r,'senior'))+' &middot; ramp-up '+R.ramp.mid+' months &middot; you have '+n+'</div></div>';
  });
  return h+'</div>';
}

function healthView(g){
  var list=CAT.health(g);
  var h='<div class="dr-b"><div class="muted sm">Every number in the top bar in plain words, worst first. Tap a fix to add it to your plan.</div>';
  list.forEach(function(x,i){
    h+='<div class="hl '+x.state+'"><div class="row" style="justify-content:space-between;align-items:baseline"><b>'+esc(x.label)+'</b><span class="mono sm">'+esc(x.val)+'</span></div><div class="xs">'+esc(x.meaning)+'</div>'+(x.fix.length?'<div class="row" style="gap:5px;margin-top:3px">'+x.fix.map(function(f,j){ return '<button class="chip idea" data-act="health-fix" data-i="'+i+'" data-j="'+j+'">+ '+esc(f.label)+'</button>'; }).join('')+'</div>':'<div class="xs good-t">Looking fine.</div>')+'</div>';
  });
  return h+'</div>';
}

function rivalCard(g,r){
  var thr=r.presence<0.15?['Low','good']:(r.presence<0.35?['Medium','warn']:['High','bad']);
  var months=r.burn>0?r.cash/r.burn:99; var cmp=function(a,b){ return a>b+4?'better than you':(a<b-4?'behind you':'about even'); };
  var h='<div class="rg"><div class="row" style="justify-content:space-between;align-items:baseline"><b>'+esc(r.name)+'</b><span class="pill '+thr[1]+'">'+thr[0]+' threat</span></div><div class="xs muted">'+esc(r.persona||'')+(r.boss?' &middot; run by '+esc(r.boss):'')+'</div>'+
   '<div class="sbar"><span class="sl">Share</span>'+bar(Math.min(100,r.presence*160),thr[1])+'<span class="sv mono">'+Math.round(r.presence*100)+'%</span></div>'+
   '<div class="sbar"><span class="sl">Product</span>'+bar(r.Q,'')+'<span class="sv mono">'+Math.round(r.Q)+'</span></div><div class="xs muted" style="margin:-2px 0 2px 70px">'+cmp(r.Q,g.Q)+' (yours '+Math.round(g.Q)+')</div>'+
   '<div class="sbar"><span class="sl">Buzz</span>'+bar(r.hype,'')+'<span class="sv mono">'+Math.round(r.hype)+'</span></div><div class="xs muted" style="margin:-2px 0 2px 70px">'+cmp(r.hype,g.hype)+' (yours '+Math.round(g.hype)+')</div>'+
   '<div class="xs"><b>To buy them:</b> '+fm(SU.buyoutPrice(g,r))+(SU.buyoutCheck(g,r).ok?' (you can afford it)':'')+'</div><div class="xs"><b>Price:</b> '+(r.price<0.9?'cheaper than the market':(r.price>1.1?'pricier than the market':'near the market'))+' &middot; <b>Cash:</b> '+fm(r.cash)+(r.burn>0?' ('+(months>=36?'3+ years':months.toFixed(0)+' months')+' left)':'')+'</div>'+
   (r.respect>0||r.grudge>0?'<div class="xs muted">'+(r.grudge>r.respect?'They hold a grudge against you.':'They respect you.')+'</div>':'')+'</div>';
  return h;
}
function rivalsView(g){
  var act=g.rivals.filter(function(r){ return r.active&&r.presence>0; }).sort(function(a,b){ return b.presence-a.presence; });
  var share=Math.round((1-SU.compF(g))*100);
  var h='<div class="dr-b"><div class="muted sm">Rivals take <b>'+share+'%</b> of the demand in your market. Beat them on product, buzz or price, or pick fights carefully.</div>';
  h+=act.length?act.map(function(r){ return rivalCard(g,r); }).join(''):empty('No rivals are chasing you right now. Enjoy it.');
  h+='<div class="tilegrid" style="margin-top:8px">'+tileAction('rival')+'</div></div>';
  return h;
}
function drawerView(id){
  var g=G(), h='', title='';
  if(id==='rivals'){ title='Your rivals'; h=rivalsView(g); }
  else if(id==='health'){ title='Health check'; h=healthView(g); }
  else if(id==='roles'){ title='What each job does'; h=rolesGuide(g); }
  else if(id==='policy'){
    title='Work policies'; h='<div class="dr-b"><div class="muted sm">Policies change how people feel and how fast they build. Each change is one move in your plan.</div><div class="rows">'+CAT.policyList(g).map(function(p){ var on=CAT.policyOn(g,p.id); return '<div class="rw"><div class="rm"><b>'+esc(p.name)+'</b></div><span class="pill '+(on?'good':'')+'">'+(on?'on':'off')+'</span><button class="btn sm" data-act="policy" data-kind="'+p.id+'">'+(on?'Turn off':'Turn on')+'</button></div>'; }).join('')+'</div></div>';
  } else if(id==='loans'){
    title='Loans and bridges'; h='<div class="dr-b"><div class="tilegrid">'+['card','deferStaff','deferFounder','bridge','rbf','debt'].map(tileAction).join('')+'</div></div>';
  } else if(id==='exit'){
    title='Sell or go public'; h='<div class="dr-b"><div class="tilegrid">'+['banker','ipo','indie','shutdown'].map(tileAction).join('')+'</div></div>';
  } else if(id==='spend'){
    title='Where the money goes'; var f=SU.fin(g), ex=f.ex, rows=['payroll','tools','infra','marketing','cogs','fixed','other','rbf','debt','owed','card'].filter(function(k){ return ex[k]>1; });
    h='<div class="dr-b"><div class="row" style="justify-content:space-between"><b>Costs</b><span class="mono">'+fm(ex.total)+'/mo</span></div><table class="t"><tbody>'+rows.map(function(k){ return '<tr><td>'+EXP_LABEL[k]+'</td><td class="n">'+fm(ex[k])+'</td></tr>'; }).join('')+'<tr><td><b>Revenue</b></td><td class="n"><b>'+fm(f.rev)+'</b></td></tr></tbody></table></div>';
  } else if(id==='cap'){
    title='Who owns what'; var t=M.table(g);
    h='<div class="dr-b"><table class="t"><thead><tr><th>Holder</th><th class="n">Share</th></tr></thead><tbody>'+t.rows.map(function(r){ return '<tr><td>'+esc(r.label)+(r.kind==='inv'?' <span class="muted xs">'+fm(r.amount||0)+'</span>':'')+'</td><td class="n">'+SU.pct(r.pct,1)+'</td></tr>'; }).join('')+'</tbody></table><div class="xs muted">Founders together: <b>'+SU.pct(M.founderPct(g),1)+'</b>.'+(g.rounds.length?' Raised so far: '+g.rounds.map(function(r){ return fm(r.amount)+' '+r.stage; }).join(', ')+'.':'')+'</div>'+
      '<div class="sec"><h4>If you sold at...</h4><input type="range" id="wf" min="0" max="100" value="'+wfPos(g)+'" aria-label="Sale price"><div id="wfOut"></div></div></div>';
  } else if(id==='log'){
    title='Story so far'; h='<div class="dr-b">'+(g.journal.slice().reverse().slice(0,16).map(function(e){ return '<div class="ev" style="'+(e.moment?'border-color:#e3b23a;background:#fff9e6':'')+'"><span class="muted xs">'+esc(e.date)+'</span> '+(e.moment?'<b>'+esc(e.text)+'</b>':esc(e.text))+'</div>'; }).join('')||'<div class="empty">Your story starts here.</div>')+'</div>';
  }
  return '<div class="dr-h"><button class="btn sm ghost" data-act="back">'+UI.icon('back')+' Back</button><h3>'+title+'</h3></div>'+h;
}
function wfPos(g){ var v=S.wfX||SU.valuation(g)||5e6; v=Math.max(1e6,Math.min(1e9,v)); return Math.round(100*Math.log(v/1e6)/Math.log(1000)); }
function wfValue(pos){ return Math.round(1e6*Math.pow(1000,pos/100)/1e4)*1e4; }
function wfUpdate(){
  var g=G(), el=$('#wfOut'), sl=$('#wf'); if(!el||!sl) return; var X=wfValue(+sl.value); S.wfX=X;
  var debt=(g.loans.debt?g.loans.debt.bal:0)+(g.loans.rbf?g.loans.rbf.left:0); var w=M.waterfall(g,Math.max(0,X-debt));
  var h='<div class="row" style="justify-content:space-between"><b class="mono" style="font-size:18px">'+fm(X)+'</b><span class="muted xs">sale price'+(debt?', after '+fm(debt)+' of debt':'')+'</span></div><table class="t"><tbody>';
  w.rows.forEach(function(r){ h+='<tr><td>'+esc(r.label)+' <span class="muted xs">'+(r.converted?'converts':'takes its preference')+'</span></td><td class="n">'+fm(r.take)+'</td></tr>'; });
  h+='<tr><td>'+esc(g.founder.name||'You')+'</td><td class="n">'+fm(w.you)+'</td></tr>'+(g.co?'<tr><td>'+esc(g.co.name)+'</td><td class="n">'+fm(w.co)+'</td></tr>':'')+'<tr><td>Employees (options)</td><td class="n">'+fm(w.pool)+'</td></tr></tbody></table>';
  h+='<div class="sm">Founders get <b>'+fm(w.founders)+'</b>. With no preferences: '+fm(w.foundersNoPref)+'.'+(w.founders<w.foundersNoPref*0.97?' Preferences take '+fm(w.foundersNoPref-w.founders)+'.':'')+'</div>';
  el.innerHTML=h;
}

/* ------------------------------------------------------------ actions */
function changed(){ var g=G(); SU.save(g); UI.refreshAll(); Iso.sync(g); }
UI.onInput=function(e){ if(e.target.id==='wf') wfUpdate(); };
UI.onAct=function(a,t,e){
  var g=G();
  switch(a){
    case 'health-fix': { var hl=CAT.health(g)[+t.getAttribute('data-i')], fxs=hl&&hl.fix[+t.getAttribute('data-j')]; if(fxs&&fxs.quick){ UI.openShortlist(fxs.quick.role,fxs.quick.level); } else if(fxs&&UI.addItem({aid:fxs.aid,values:JSON.parse(JSON.stringify(fxs.values))})) UI.toast('Added to your plan.',1400); break; }
    case 'price-quick': { var pv=CAT.defaults(g,'price',{}); if(g.arch==='market'){ var d=+t.getAttribute('data-d'); pv.take=Math.max(3,Math.min(40,Math.round(g.cust.take*100)+d)); } else { var m=+t.getAttribute('data-m'), p0=g.cust.price, st=priceStep(p0), np=Math.max(1,Math.round(p0*(1+m)/st)*st); if(Math.abs(np-p0)<0.005) np=Math.max(1,p0+(m>0?st:-st)); pv.price=np; } var okp=CAT.validate(g,'price',pv); if(!okp.ok){ UI.toast(okp.why); return; } if(UI.addItem({aid:'price',values:pv})){ UI.renderPane(); UI.toast('Price change added to your plan.',1500); } break; }
    case 'price-opt': { var po=CAT.defaults(g,'price',{}), o=t.getAttribute('data-o'); if(o==='annual') po.annual=true; else po.model=o; var oks=CAT.validate(g,'price',po); if(!oks.ok){ UI.toast(oks.why); return; } if(UI.addItem({aid:'price',values:po})){ UI.renderPane(); UI.toast('Added to your plan.',1500); } break; }
    case 'open-act': { var aid=t.getAttribute('data-aid'); var v=CAT.defaults(g,aid,{}); var ok=CAT.validate(g,aid,v); if(!ok.ok){ UI.toast(ok.why); return; } S.cfg[aid]=v; S.drawer={type:'act',aid:aid}; renderDrawer(); break; }
    case 'back': S.drawer=null; renderDrawer(); break;
    case 'ctl': { var aid2=t.getAttribute('data-aid'), k=t.getAttribute('data-k'); var c=ctlDef(aid2,k); var o=c&&c.opts.filter(function(x){ return String(x.v)===t.getAttribute('data-v'); })[0]; if(o) setCfg(aid2,k,o.v); break; }
    case 'step': { var aid3=t.getAttribute('data-aid'), k3=t.getAttribute('data-k'); var c3=ctlDef(aid3,k3), v3=S.cfg[aid3], cur=v3[k3], nv;
      var q=t.getAttribute('data-q'); if(q!==null){ var qv=parseFloat(q); nv=c3.quickAbs?cur+qv:cur*(1+qv); } else nv=cur+(+t.getAttribute('data-dir'))*c3.step;
      nv=Math.max(c3.min,Math.min(c3.max,nv)); if(c3.fmt==='pct') nv=Math.round(nv); else nv=nv<10?Math.round(nv*20)/20:nv<100?Math.round(nv):Math.round(nv/5)*5; nv=Math.max(c3.min,Math.min(c3.max,nv)); setCfg(aid3,k3,nv); break; }
    case 'tgl': { var aid4=t.getAttribute('data-aid'), k4=t.getAttribute('data-k'); setCfg(aid4,k4,!S.cfg[aid4][k4]); break; }
    case 'add-act': { var dr=S.drawer; if(!dr||dr.type!=='act') return; var vv=S.cfg[dr.aid]; var ok2=CAT.validate(g,dr.aid,vv); if(!ok2.ok){ UI.toast(ok2.why); return; } var pin=t.getAttribute('data-pin')==='1'; if(UI.addItem({aid:dr.aid,values:JSON.parse(JSON.stringify(vv)),repeat:pin})){ S.drawer=null; UI.renderPane(); UI.toast(pin?'Added. It repeats every month.':'Added to your plan.',1400); } break; }
    case 'feat': { var key=t.getAttribute('data-key'); var ft=CAT.featureByKey(g,key); if(!ft) return; if(ft.built&&ft.key!=='mvp'&&!ft.improve){ UI.toast('You already built that.'); return; } if(ft.queued){ UI.toast('That is already in the queue.'); return; } S.cfg.build={fk:key,care:1}; S.drawer={type:'act',aid:'build'}; renderDrawer(); break; }
    case 'build-need': { var key2='need:'+t.getAttribute('data-id'); var vb={fk:key2,care:1}; var okb=CAT.validate(g,'build',vb); if(!okb.ok){ UI.toast(okb.why); return; } if(UI.addItem({aid:'build',values:vb})) UI.toast('Added to your plan.',1200); break; }
    case 'sub': S.sub[t.getAttribute('data-tab')]=t.getAttribute('data-v'); UI.renderPane(); break;
    case 'page': { var k5=t.getAttribute('data-k'); S.page[k5]=Math.max(0,(S.page[k5]||0)+(+t.getAttribute('data-d'))); UI.renderPane(); break; }
    case 'more-inbox': S.page.inbox=1; UI.renderPane(); break;
    case 'person': { S.tab='team'; S.drawer={type:'person',id:t.getAttribute('data-id')}; $('#pop').hidden=true; UI.setTab('team'); S.drawer={type:'person',id:t.getAttribute('data-id')}; renderDrawer(); break; }
    case 'pquick': { var e2=g.team.filter(function(x){ return x.id===t.getAttribute('data-id'); })[0]; if(!e2) return; var spec=CAT.personActions(g,e2)[+t.getAttribute('data-i')]; if(spec&&UI.addItem({aid:'quick',spec:spec.spec})){ S.drawer=null; renderDrawer(); UI.toast('Added to your plan.',1200); } break; }
    case 'view': S.drawer={type:'view',id:t.getAttribute('data-id')}; renderDrawer(); if(UI.pocket) UI.setSheet(true); break;
    case 'policy': { var kind=t.getAttribute('data-kind'); if(UI.addItem({aid:'culture',values:{kind:kind,off:CAT.policyOn(g,kind)}})){ S.drawer=null; renderDrawer(); UI.toast('Added to your plan.',1200); } break; }
    case 'stopch': { if(UI.addItem({aid:'marketStop',values:{channel:t.getAttribute('data-k')}})) UI.toast('Added to your plan.',1200); break; }
    case 'chip': UI.addText(t.getAttribute('data-text')); break;
    case 'dismiss': { var id=t.getAttribute('data-id'); g.inbox.forEach(function(i){ if(i.id===id) i.open=false; }); UI.renderTabs(); break; }
    case 'buy': { var r=SU.Shop.buy(g,t.getAttribute('data-id')); if(!r.ok){ UI.toast(r.why); return; } UI.sfx('money'); UI.toast(r.msg,2600); changed(); break; }
    case 'move': { var mv=SU.Shop.move(g,t.getAttribute('data-id')); if(!mv.ok){ UI.toast(mv.why); return; } UI.sfx(mv.up?'goal':'tick'); UI.toast(mv.msg,3000); changed(); break; }
    case 'cands': UI.openCands(t.getAttribute('data-id')); break;
    case 'quick-hire': UI.closeModal(); UI.openShortlist(t.getAttribute('data-role'),t.getAttribute('data-level')||'mid'); break;
    case 'hire-chooser': UI.openHireChooser(); break;
    case 'pick-cand': { var cid=t.getAttribute('data-id'); var emp=SU.pickCandidate(g,cid,+t.getAttribute('data-i')); UI.closeModal(); if(emp){ UI.sfx('hire'); UI.toast(emp.name+' joined as '+SU.ROLES[emp.role].name.toLowerCase()+'.',2600); changed(); } break; }
    case 'drop-cands': { g.cands=g.cands.filter(function(c){ return c.id!==t.getAttribute('data-id'); }); g.inbox.forEach(function(i){ if(i.action&&i.action.type==='cands'&&i.action.id===t.getAttribute('data-id')) i.open=false; }); UI.closeModal(); changed(); break; }
    case 'report': UI.showReport(); break;
    case 'report-full': S.reportFull=!S.reportFull; UI.showReport(); break;
    case 'pitch': UI.openPitch(t.getAttribute('data-inv'),t.getAttribute('data-id')); break;
    case 'pitch-pick': { S.pitch.picks[+t.getAttribute('data-q')]=+t.getAttribute('data-i'); UI.openPitch(S.pitch.inv,S.pitch.item,true); break; }
    case 'pitch-go': pitchGo(); break;
    case 'sheet': UI.openSheet(t.getAttribute('data-id')); break;
    case 'sheet-accept': sheetAccept(t.getAttribute('data-id')); break;
    case 'sheet-pass': sheetPass(t.getAttribute('data-id')); break;
    case 'sheet-counter': sheetCounter(t.getAttribute('data-id'),t.getAttribute('data-term'),parseFloat(t.getAttribute('data-val')||'0')); break;
    case 'offer': UI.openOffer(); break;
    case 'offer-accept': offerAccept(t); break;
    case 'offer-counter': { var rr=SU.Events.counterOffer(g); UI.toast(rr.msg); SU.save(g); if(!g.offer){ UI.closeModal(); changed(); } else UI.openOffer(); break; }
    case 'offer-decline': SU.Events.declineOffer(g); UI.closeModal(); UI.toast('You said no.'); changed(); break;
    case 'new-same': newSame(); break;
    case 'new-fresh': location.reload(); break;
    case 'copy-summary': UI.copyText(UI.summary(),'Summary copied.'); break;
    case 'copy-code': UI.copyText(SU.exportText(g),'Save code copied.'); break;
    case 'story': if(SU.AI) SU.AI.story(); break;
    case 'endtab': S.endTab=t.getAttribute('data-v'); renderEndBody(); break;
  }
};

/* ------------------------------------------------------------ monthly report (one compact popup) */
UI.showReport=function(){
  var rec=S.receipt, g=G(); if(!rec){ UI.toast('Run a month first.'); return; }
  var full=!!S.reportFull;
  var items=rec.items.map(function(it){ var cls=it.status==='dropped'?'dropped':(it.status||'ok'); var lines=(it.lines||[]);
    return '<div class="r-item '+cls+'"><b>'+esc(it.desc)+'</b>'+(it.status==='dropped'?' <span class="pill">dropped</span>':'')+(lines.length?(full?lines.map(function(l){ return '<div class="ln">'+esc(l)+'</div>'; }).join('')+(it.because||[]).map(function(l){ return '<div class="bc">Why: '+esc(l)+'</div>'; }).join(''):'<div class="ln">'+esc(lines[0])+'</div>'):'')+'</div>'; }).join('');
  var notes=[]; if(rec.overload) notes.push(rec.overload); if(rec.sleep) notes.push(rec.sleep); (rec.claimNotes||[]).forEach(function(n){ notes.push(n); }); if(rec.promiseNote) notes.push(rec.promiseNote);
  var left='<div class="k">What you did</div>'+(items||'<div class="muted sm">Nothing in particular. You rested and watched.</div>')+
    (notes.length?notes.map(function(n){ return '<div class="ev">'+esc(n)+'</div>'; }).join(''):'')+
    (rec.events&&rec.events.length?'<div class="k" style="margin-top:6px">What came up</div>'+rec.events.map(function(ev){ return '<div class="ev"><b>'+esc(ev.title)+'</b> <span class="pill '+(ev.outcome==='handled'?'good':ev.outcome==='ignored'?'bad':'warn')+'">'+esc(ev.outcome||'')+'</span><div>'+esc(ev.note||'')+'</div></div>'; }).join(''):'')+
    ((rec.shipped&&rec.shipped.length)?'<div class="k" style="margin-top:6px">Shipped</div><div class="row">'+rec.shipped.map(function(s){ return '<span class="chip ok static" title="'+esc(s.result||'')+'">'+esc(s.name||s)+'</span>'; }).join('')+'</div>':'')+
    ((rec.newGoals&&rec.newGoals.length)?'<div class="k" style="margin-top:6px">Goals reached</div>'+rec.newGoals.map(function(x){ return '<div class="ev"><b>'+esc(x.title)+'</b> '+esc(x.reward)+'</div>'; }).join(''):'');
  var rx=rec.reactions;
  var right='<div class="k">The numbers</div><div class="kpis">'+rec.kpi.map(function(k){ return '<div class="kpi '+(k.bad?'bad':'good')+'"><div class="l">'+esc(k.label)+'</div><div class="v"><span class="a">'+esc(k.from)+'</span> &rarr; <span class="t">'+esc(k.to)+'</span></div>'+(full&&k.drivers&&k.drivers.length?'<div class="dr">'+k.drivers.map(esc).join(' &middot; ')+'</div>':'')+'</div>'; }).join('')+'</div>'+
    (rx?'<div class="news"><div class="hd">'+esc(rx.headline)+'</div>'+rx.chirps.slice(0,full?2:1).map(function(c){ return '<div class="tw"><b>'+esc(c.who)+'</b> '+esc(c.text)+'</div>'; }).join('')+(rx.customer?'<div class="quote">'+esc(rx.customer.who)+': "'+esc(rx.customer.text)+'"</div>':'')+(full&&rx.team?'<div class="quote">'+esc(rx.team.who)+': "'+esc(rx.team.text)+'"</div>':'')+'</div>':'')+
    (rec.newAchv&&rec.newAchv.length?'<div class="row" style="margin-top:6px">'+rec.newAchv.map(function(a){ return '<span class="pill blue">Achievement: '+esc(a)+'</span>'; }).join('')+'</div>':'');
  var m=UI.modal('<h2>What happened: '+esc(rec.date)+'</h2>'+(rec.actBanner?'<div class="pv"><b>'+esc(rec.actBanner.name)+'.</b> '+esc(rec.actBanner.line)+'</div>':'')+'<div class="rep2"><div>'+left+'</div><div>'+right+'</div></div><div class="foot"><button class="btn ghost" data-act="report-full">'+(full?'Show less':'Show details')+'</button><button class="btn primary" data-act="close-modal">Continue</button></div>',{wide:true});
  if(full){ var md=m.querySelector('.modal'); md.style.maxHeight='calc(100dvh - 28px)'; }
};

function candPay(g,e){ try{ if(e.role==='eng'||e.role==='design'||e.role==='pm'){ var g2=SU.clone(g); var e2=SU.clone(e); e2.joinMi=-99; g2.team.push(e2); var dv=SU.velocity(g2)-SU.velocity(g); return '<div class="pv"><div><b>Build speed '+(dv>=0?'+':'')+dv.toFixed(1)+'</b> a month once ramped up</div></div>'; } }catch(x){} return ''; }

/* ------------------------------------------------------------ one-click hiring */
function hireButtons(g){
  return '<div class="rolegrid">'+CAT.hireRoles(g).map(function(r){ var fit=SU.roleFit(g,r), gd=SU.ROLE_GUIDE[r], no=fit.state==='no';
    return '<button class="rolebtn'+(no?' no':'')+'" data-act="quick-hire" data-role="'+r+'" title="'+esc(fit.why)+'"><b>'+esc(SU.ROLES[r].name)+'</b><span>'+esc(gd.tag)+'</span><span class="mono xs">'+fm(SU.salaryFor(g,r,'mid'))+'/yr'+(no?' &middot; no effect for you':'')+'</span></button>'; }).join('')+'</div>';
}
UI.openHireChooser=function(){ var g=G(); UI.modal('<h2>Who do you need?</h2><p class="muted sm">Pick a job and you will see three candidates right away. One more click hires them.</p>'+hireButtons(g)+'<div class="foot"><button class="btn ghost" data-act="close-modal">Not now</button></div>',{wide:true}); };
UI.openShortlist=function(role,level){
  var g=G(); if((g.cands||[]).length>=8){ UI.toast('You have lots of open shortlists. Pick someone first.'); return; }
  var c=SU.shortlist(g,role,level||'mid'); SU.save(g); UI.openCands(c.id);
};

/* ------------------------------------------------------------ candidates */
UI.openCands=function(cid){
  var g=G(), c=(g.cands||[]).filter(function(x){ return x.id===cid; })[0]; if(!c){ UI.toast('Those candidates are gone.'); return; }
  var f0=SU.fin(g), avgSal=c.list.reduce(function(a,x){ return a+x.sal; },0)/c.list.length, addB=avgSal*1.3/12, nb=f0.burn+addB, rw0=f0.burn<=0?999:f0.runway, rw1=nb>0?Math.max(0,g.cash)/nb:999;
  var lv=c.quick?'<div class="row" style="gap:6px"><span class="k">Experience</span>'+['junior','mid','senior'].map(function(l){ return '<button class="btn sm'+(c.level===l?' primary':'')+'" data-act="quick-hire" data-role="'+c.role+'" data-level="'+l+'">'+SU.cap1(l)+'</button>'; }).join('')+'</div>':'';
  var h='<h2>Pick your '+esc(SU.ROLES[c.role].name.toLowerCase())+'</h2><div class="muted sm">'+esc(SU.ROLE_GUIDE[c.role].tag)+'. One click hires them, and they start right away.</div>'+lv+'<div class="pv"><div>Hiring adds about <b>'+fm(addB)+'</b> a month. Runway '+(rw0>99?'long':rw0.toFixed(1)+' mo')+' to '+(rw1>99?'long':rw1.toFixed(1)+' mo')+'.</div>'+(rw1<4?'<div class="wn">Warning: that leaves you under 4 months of cash.</div>':'')+'</div><div class="cands">'+c.list.map(function(e,i){
    var n=Math.max(0,Math.min(5,Math.round((e.skill-0.7)/0.6*5))); var tr=e.trait?SU.TRAITS[e.trait]:null; var fn=e.name.split(' ')[0];
    return '<div class="cand"><div class="row" style="gap:8px">'+avatar(e.name,ROLECOL[e.role]||'#5a6b7d')+'<div><h4>'+esc(e.name)+'</h4><div class="xs muted">'+(e.level!=='mid'?SU.cap1(e.level)+' ':'Mid-level ')+esc(SU.ROLES[e.role].name)+'</div></div></div><div class="stars" title="Skill">'+'★'.repeat(n)+'☆'.repeat(5-n)+' <span class="mono xs">skill '+SU.skillRating(e)+'</span></div>'+candPay(g,e)+'<div class="sm"><b>'+fm(e.sal)+'</b> a year<br><span class="muted">'+fm(e.sal*1.3/12)+'/mo with taxes</span></div>'+(tr?'<div class="pv"><div><b>'+esc(tr.name)+'</b></div><div>'+esc(tr.desc||'')+'</div></div>':'<div class="xs muted">No strong quirks.</div>')+'<div class="xs muted">Wants '+esc(SU.WANT_TEXT[e.want]||e.want)+'.</div><button class="btn primary" data-act="pick-cand" data-id="'+c.id+'" data-i="'+i+'">Hire '+esc(fn)+'</button></div>'; }).join('')+'</div><div class="foot"><button class="btn ghost" data-act="drop-cands" data-id="'+c.id+'">None of them</button><button class="btn" data-act="close-modal">Decide later</button></div>';
  UI.modal(h,{wide:true});
};

/* ------------------------------------------------------------ term sheet, offer, pitch */
UI.openSheet=function(sid,msg){
  var g=G(); var r=g.round; if(!r){ UI.toast('That round is closed.'); return; }
  var s=r.sheets.filter(function(x){ return x.id===sid; })[0]; if(!s||s.state!=='live'){ UI.toast('That offer is gone.'); return; }
  var inv=SU.investor(s.inv), imp=M.sheetImpact(g,s), priced=s.instrument==='priced';
  var h='<h2>Term sheet: '+esc(inv.name)+'</h2><div class="muted sm">'+esc(inv.fund)+'. "'+esc(inv.voice)+'"</div>'+(msg?'<div class="pv"><b>'+esc(msg)+'</b></div>':'')+
   '<div class="sheet"><dl><dt>Amount</dt><dd>'+fm(s.amount)+'</dd><dt>Instrument</dt><dd>'+(priced?'Priced round (preferred stock)':s.instrument==='note'?'Convertible note':'SAFE')+'</dd><dt>'+(priced?'Valuation, pre-money':'Valuation cap, post-money')+'</dt><dd>'+fm(priced?s.pre:s.cap)+'</dd>'+
   (priced?'<dt>Liquidation preference</dt><dd class="'+((s.part||s.pref>1)?'flag':'')+'">'+s.pref+'x '+(s.part?'participating':'non-participating')+'</dd><dt>Anti-dilution</dt><dd class="'+(s.anti==='full'?'flag':'')+'">'+(s.anti==='full'?'Full ratchet':'Broad-based')+'</dd><dt>Board seat</dt><dd>'+(s.board?'Yes, one investor seat':'Observer only')+'</dd><dt>Option pool top-up</dt><dd>to '+SU.pct(s.pool,0)+', from your side</dd><dt>Founder vesting</dt><dd class="'+(s.vestReset?'flag':'')+'">'+(s.vestReset?'Restarts':'Unchanged')+'</dd>':'')+
   '<dt>Expires</dt><dd>'+(s.left+1)+' period'+(s.left?'s':'')+'</dd><dt>Counters left</dt><dd>'+s.counters+'</dd></dl>'+(s.note?'<div class="flag sm">'+esc(s.note)+'</div>':'')+
   '<div class="sm">You and your cofounder own <b>'+SU.pct(imp.founderBefore,1)+'</b> now and would own about <b>'+SU.pct(imp.founderAfter,1)+'</b> after this.</div></div>';
  var cs=[]; if(s.counters>0){ cs.push('<button class="btn sm" data-act="sheet-counter" data-id="'+s.id+'" data-term="valuation" data-val="0.1">Ask for 10% more</button><button class="btn sm" data-act="sheet-counter" data-id="'+s.id+'" data-term="valuation" data-val="0.25">Ask for 25% more (risky)</button>');
    if(s.part||s.pref>1) cs.push('<button class="btn sm" data-act="sheet-counter" data-id="'+s.id+'" data-term="pref">Plain 1x preference</button>'); if(s.board) cs.push('<button class="btn sm" data-act="sheet-counter" data-id="'+s.id+'" data-term="board">Observer, not a seat</button>');
    if(priced&&s.pool>0.07) cs.push('<button class="btn sm" data-act="sheet-counter" data-id="'+s.id+'" data-term="pool">Smaller pool</button>'); if(s.vestReset) cs.push('<button class="btn sm" data-act="sheet-counter" data-id="'+s.id+'" data-term="vest">Keep my vesting</button>'); if(s.anti==='full') cs.push('<button class="btn sm" data-act="sheet-counter" data-id="'+s.id+'" data-term="anti">Broad-based</button>'); }
  h+='<div class="sec"><h4>Negotiate</h4>'+(cs.length?'<div class="row">'+cs.join('')+'</div><div class="xs muted">Every ask risks the investor walking away.</div>':'<div class="muted sm">No counters left. Take it or leave it.</div>')+'</div>';
  h+='<div class="foot"><button class="btn danger" data-act="sheet-pass" data-id="'+s.id+'">Pass</button><button class="btn primary" data-act="sheet-accept" data-id="'+s.id+'">Accept and take the money</button></div>';
  UI.modal(h,{wide:true});
};
function sheetAccept(sid){
  var g=G(); var rec=M.accept(g,sid); UI.closeModal(); if(!rec){ UI.toast('That offer is gone.'); return; }
  UI.sfx('money'); Iso.fx.coins(); Iso.fx.confetti(); Iso.banner('Closed '+fm(rec.amount)+' from '+rec.lead,'#b8860b',4);
  UI.toast('Money in the bank: '+fm(rec.amount)+'. Founders now own '+SU.pct(rec.founderAfter,1)+'.',4200);
  g.inbox.forEach(function(i){ if(i.action&&i.action.type==='sheet') i.open=false; }); changed();
}
function sheetPass(sid){
  var g=G(), r=g.round; if(!r) return; var s=r.sheets.filter(function(x){ return x.id===sid; })[0]; if(s){ s.state='declined'; var p=r.pipe.filter(function(x){ return x.inv===s.inv; })[0]; if(p) p.stage='lost'; SU.journal(g,'Passed on '+SU.investor(s.inv).name+"'s term sheet.",'money'); }
  g.inbox.forEach(function(i){ if(i.action&&i.action.type==='sheet'&&i.action.id===sid) i.open=false; }); UI.closeModal(); UI.toast('You passed on that offer.'); changed();
}
function sheetCounter(sid,term,val){ var g=G(); var res=M.counter(g,sid,term,val); SU.save(g); if(res.walked){ UI.closeModal(); UI.toast(res.msg,4200); changed(); return; } UI.openSheet(sid,res.msg); UI.renderTabs(); }
UI.openOffer=function(){
  var g=G(), o=g.offer; if(!o){ UI.toast('That offer is gone.'); return; }
  var debt=(g.loans.debt?g.loans.debt.bal:0)+(g.loans.rbf?g.loans.rbf.left:0); var w=M.waterfall(g,Math.max(0,o.price-debt));
  var last=g.flags.lastPost||0; var down=o.kind!=='acquihire'&&o.price<last*0.999;
  UI.modal('<h2>'+esc(SU.cap1(o.buyer))+' wants to buy '+esc(g.name)+'</h2><div class="sheet"><dl><dt>Price</dt><dd>'+fm(o.price)+'</dd><dt>Structure</dt><dd>'+esc(o.struct)+'</dd><dt>Type</dt><dd>'+esc(o.kind==='acquihire'?'Acqui-hire (they want the team)':o.kind==='pe'?'Private equity':o.kind==='incumbent'?'Incumbent':'Strategic')+'</dd><dt>Expires</dt><dd>'+o.left+' period'+(o.left===1?'':'s')+'</dd><dt>Counters left</dt><dd>'+o.counters+'</dd></dl>'+
    '<div class="sm">After preferences'+(debt?' and '+fm(debt)+' of debt':'')+', the founders would take home <b>'+fm(w.founders)+'</b>'+(w.foundersNoPref-w.founders>1000?' (preferences take '+fm(w.foundersNoPref-w.founders)+')':'')+'.</div>'+(down?'<div class="flag sm">This is below your last round valuation.</div>':'')+'</div>'+
    '<div class="foot"><button class="btn" data-act="offer-decline">Say no</button>'+(o.counters>0?'<button class="btn" data-act="offer-counter">Push for more</button>':'')+'<button class="btn primary" data-act="offer-accept" data-step="1">Sell the company</button></div>');
};
function offerAccept(t){
  if(t.getAttribute('data-step')==='1'){ t.setAttribute('data-step','2'); t.textContent='Yes, this ends the game. Sell.'; t.className='btn danger'; return; }
  var g=G(); UI.closeModal(); SU.Events.acceptOffer(g); SU.save(g); UI.refreshAll(); UI.showEnd();
}
UI.openPitch=function(invId,itemId,keep){
  var g=G(); var inv=SU.investor(invId);
  if(!keep||!S.pitch||S.pitch.inv!==invId) S.pitch={inv:invId,item:itemId,picks:[]};
  var qs=M.pitchOptions(g,invId), pk=S.pitch.picks;
  var h='<h2>Partner meeting: '+esc(inv.name)+'</h2><div class="muted sm">'+esc(inv.fund)+'. "'+esc(inv.voice)+'"</div><div class="sec">'+qs.map(function(q,qi){ return '<div class="ct"><div class="ct-l">'+esc(q.q)+'</div><div class="cards" style="grid-template-columns:repeat(2,minmax(0,1fr))">'+q.opts.map(function(o,oi){ return '<button class="cd'+(pk[qi]===oi?' on':'')+'" data-act="pitch-pick" data-q="'+qi+'" data-i="'+oi+'"><b>'+esc(o.tag)+'</b><span style="font-size:12px;color:var(--ink)">'+esc(o.t)+'</span></button>'; }).join('')+'</div></div>'; }).join('')+'</div>'+
   '<div class="xs muted">Rounding up helps today and is checked later.</div><div class="foot"><button class="btn ghost" data-act="close-modal">Not now</button><button class="btn primary" data-act="pitch-go"'+(pk.length===3&&pk[0]!==undefined&&pk[1]!==undefined&&pk[2]!==undefined?'':' disabled')+'>Make the pitch</button></div>';
  UI.modal(h,{wide:true,focus:false});
};
function pitchGo(){
  var g=G(), p=S.pitch; if(!p||p.picks.length<3) return;
  var res=M.pitchResolve(g,p.inv,p.picks); M.applyPitch(g,p.inv,res);
  g.inbox.forEach(function(i){ if(i.id===p.item||(i.action&&i.action.type==='pitch'&&i.action.inv===p.inv)) i.open=false; });
  var verdict=res.delta>=5?'That went well.':res.delta>=0?'It was fine. Nobody was blown away.':'That did not land.';
  UI.modal('<h2>'+verdict+'</h2><div class="pv"><div>'+esc(SU.investor(p.inv).name)+"'s interest moved "+(res.delta>=0?'+':'')+Math.round(res.delta)+'.</div>'+(res.notes.length?res.notes.map(function(n){ return '<div class="wn">'+esc(n)+'</div>'; }).join(''):'')+'</div><div class="foot"><button class="btn primary" data-act="close-modal">Back to work</button></div>');
  S.pitch=null; changed();
}
UI.pitchFinish=function(invId,itemId,res){ var g=G(); M.applyPitch(g,invId,res); g.inbox.forEach(function(i){ if(i.id===itemId||(i.action&&i.action.type==='pitch'&&i.action.inv===invId)) i.open=false; }); SU.save(g); UI.refreshAll(); };

/* ------------------------------------------------------------ new run, same idea */
function newSame(){
  var g=G(); var st=S.setup; UI.closeModal();
  var ng=SU.newGame({ideaId:g.ideaId,startKey:g.startKey,cofounder:g.co?g.co.cid:null,bgId:g.founder.bg.id,name:g.founder.name,company:g.name,split:st.split});
  SU.save(ng); UI.begin(ng,true);
}

/* ------------------------------------------------------------ ending (one screen) */
var END_LINE={bell:'You rang the bell.',sale:'You sold the company.',acquihire:'You landed softly.',indie:'You kept it small and profitable.',shutdown:'You wound the company down.',fraud:'The numbers did not hold up.',coup:'The board took over.',burnout:'You ran out of road.',decade:'You made it ten years.',zombie:'The company lives on, barely.'};
UI.showEnd=function(){
  var g=G(); var o=g.over; if(!o) return; S.view='end'; S.auto.on=false; UI.closeModal(); UI.sfx('end'); S.endTab=S.endTab||'why';
  document.body.removeAttribute('data-sheet');
  var rr=UI.recordRun(g); S.endRec=rr;
  var root=$('#app'), raised=o.raised||0;
  var stats=[['Months',Math.round(g.mi)],['Raised',fm(raised)],['Revenue / mo',fm(g.mrr||0)],['Customers',SU.fmtNum(SU.custCount(g))],['Founders own',SU.pct(M.founderPct(g),1)],['Take-home',fm(o.takeHome||0)]];
  root.innerHTML='<div class="endbox"><div class="el"><div class="end-top"><div><div class="k">'+esc(g.name)+' &middot; '+esc(SU.dateStr(g))+'</div><h1>'+esc(o.title)+'</h1><p class="sm" style="margin-top:4px">'+esc(END_LINE[o.type]||'')+(o.takeNote?' Take-home: '+esc(o.takeNote)+'.':'')+'</p></div><div class="score">'+o.score+'<small>score</small></div></div>'+
   '<div class="vis2"><canvas id="endCv"></canvas></div><div class="kpis" style="grid-template-columns:repeat(3,minmax(0,1fr))">'+stats.map(function(s){ return '<div class="kpi"><div class="l">'+s[0]+'</div><div class="v">'+esc(String(s[1]))+'</div></div>'; }).join('')+'</div></div>'+
   '<div class="card side" style="padding:0"><div class="icontabs" style="padding:6px 6px 0">'+[['why','Why'],['press','Press'],['story','Story'],['cast','Cast']].map(function(t){ return '<button class="tb'+(S.endTab===t[0]?' on':'')+'" data-act="endtab" data-v="'+t[0]+'" style="font-size:12.5px;padding:8px 0">'+t[1]+'</button>'; }).join('')+'</div><div class="pn"><div class="pn-in" id="endBody"></div></div><div class="dr-f"><button class="btn ghost sm" data-act="copy-summary">Copy summary</button><button class="btn ghost sm" data-act="copy-code">Save code</button><button class="btn sm" data-act="new-fresh">Different company</button><button class="btn primary" data-act="new-same">Try again</button></div></div></div>';
  renderEndBody();
  Iso.reset(); Iso.attach($('#endCv')); Iso.start(); Iso.sync(g,{initial:true}); setTimeout(function(){ Iso.resize(); Iso.sync(g,{initial:true}); Iso.ending(o.type); },40);
};
function renderEndBody(){
  var g=G(), o=g.over, el=$('#endBody'); if(!el) return; var t=S.endTab, h='';
  $$('[data-act=endtab]').forEach(function(b){ b.classList.toggle('on',b.getAttribute('data-v')===t); });
  if(t==='why'){ var rr=S.endRec||{career:UI.career()}, cr=rr.career, found=Object.keys(cr.endings).length; h='<div class="lvlcard" style="margin-bottom:8px"><div class="n">'+cr.runs+'</div><div><b>Career: run '+cr.runs+(rr.newBest?' \u00b7 NEW BEST SCORE!':'')+'</b><small>Best score '+(cr.best?cr.best.score:0)+(cr.best?' ('+esc(cr.best.name)+')':'')+'. Endings found: '+found+' of 10'+(rr.newEnding?' (a new one!)':'')+'.</small><small>'+Object.keys(UI.ENDINGS).map(function(k){ return cr.endings[k]?'<b>'+esc(UI.ENDINGS[k])+'</b>':'???'; }).join(' &middot; ')+'</small></div></div>'+o.autopsy.map(function(a){ return '<div class="autopsy"><b>'+esc(a.t)+'.</b> '+esc(a.d)+'</div>'; }).join('')+(g.achv.length?'<div class="sec"><h4>Achievements</h4><div class="row">'+g.achv.map(function(id){ var a=SU.ACHIEVEMENTS.filter(function(x){ return x.id===id; })[0]; return '<span class="pill blue">'+esc(a?a.name:id)+'</span>'; }).join('')+'</div></div>':''); }
  else if(t==='press'){ h='<div class="clips">'+o.artifacts.filter(function(a){ return a.kind!=='Where are they now'; }).map(function(a){ return '<div class="clip"><div class="kind">'+esc(a.kind)+'</div><h4>'+esc(a.title)+'</h4>'+(a.text?'<div class="sm">'+esc(a.text)+'</div>':'')+(a.list?'<ul>'+a.list.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul>':'')+'</div>'; }).join('')+'</div>'; }
  else if(t==='story'){ h='<div class="story" id="storyTxt">'+(S.story?esc(S.story):'<span class="muted">'+((S.aiOk&&SU.AI)?'Ask Claude to write the story of your company from what actually happened.':'Connect Claude to have your story written from your game. The press clippings are generated offline.')+'</span>')+'</div>'+((S.aiOk&&SU.AI)?'<div class="row"><button class="btn" data-act="story">Write my story with Claude</button></div>':''); }
  else { var cast=o.artifacts.filter(function(a){ return a.kind==='Where are they now'; })[0]; h=cast?'<div class="clip"><div class="kind">'+esc(cast.kind)+'</div><h4>'+esc(cast.title)+'</h4><ul>'+(cast.list||[]).map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul></div>':'<div class="empty">No cast notes.</div>'; }
  el.innerHTML=h;
}
})();
