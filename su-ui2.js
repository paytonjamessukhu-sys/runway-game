/* RUNWAY - UI panels (one screen, tiles and drawers), the monthly report, deal modals and the ending. */
(function(){
'use strict';
var SU = window.SU, UI = window.UI, Iso = SU.Iso, CAT = SU.CAT, M = SU.Money, fm = SU.fmtMoney, esc = UI.esc, $ = UI.$, $$ = UI.$$, S = UI.S;
function G(){ return UI.G(); }
var ROLECOL={eng:'#4c78c9',design:'#e0597a',pm:'#7b5fc4',sdr:'#3aa38b',ae:'#2e9bb5',cs:'#e0922d',mkt:'#c4553a',cos:'#5a6b7d',vp:'#2b2f3a'};
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
  var fn=PANELS[S.tab]||PANELS.customers; pn.innerHTML=fn(g); pn.scrollTop=keep; S.lastTab=S.tab; renderDrawer();
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
function pCustomers(g){
  var S0=SU.seg(g), band=SU.pmfBand(g), churn=g.stat.churnRate||0;
  var label=g.arch==='consumer'?'Subscribers':(g.arch==='market'?'Both sides':'Customers');
  var h='<div class="strip">'+stat(label,SU.fmtNum(SU.custCount(g)),'+'+Math.round(g.stat.newLast||0)+' / -'+Math.round(g.stat.churnLast||0)+' last month')+stat('Churn / month',pctS(churn,1),churn>0.08?'Too high':churn>0.04?'Watch it':'Healthy',churn>0.08?'bad':'')+stat('Product fit',band.lo+'-'+band.hi,'of 100')+'</div>';
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
  var now=mk?Math.round(c.take*100)+'% cut':fm(c.price)+' / mo';
  var queued=q?'<div class="pq">Queued: '+esc(mk?q.values.take+'% cut':fm(q.values.price)+' / mo')+' <button class="pb" data-act="unplan" data-uid="'+q.uid+'" title="Remove">'+UI.icon('x')+'</button></div>':'';
  var btns;
  if(mk) btns=[-2,-1,1,2].map(function(d){ return '<button class="btn sm" data-act="price-quick" data-d="'+d+'">'+(d>0?'+':'')+d+' pts</button>'; }).join('');
  else btns=[-0.2,-0.1,0.1,0.2].map(function(m){ return '<button class="btn sm" data-act="price-quick" data-m="'+m+'">'+(m>0?'+':'')+Math.round(m*100)+'%</button>'; }).join('');
  var extra='';
  if(!mk){
    extra+='<button class="btn sm'+(c.annual?' ghost':'')+'" data-act="price-opt" data-o="annual"'+(c.annual?' disabled':'')+'>'+(c.annual?'Annual plans: on':'Offer annual plans')+'</button>';
    if(g.arch==='consumer') extra+='<button class="btn sm ghost" data-act="price-opt" data-o="'+(c.model==='freemium'?'paid':'freemium')+'">'+(c.model==='freemium'?'Free tier on: switch to paywall':'Paywall on: add a free tier')+'</button>';
  }
  return '<div class="sec pricing"><div class="row" style="justify-content:space-between;align-items:flex-end"><div><div class="k">'+(mk?'Your cut':'Price')+'</div><div class="pbig mono">'+now+'</div></div><button class="btn sm ghost" data-act="open-act" data-aid="price">More options</button></div>'+
    '<div class="xs muted">'+esc(hint)+'</div><div class="row" style="gap:5px">'+btns+'</div>'+(extra?'<div class="row" style="gap:5px">'+extra+'</div>':'')+queued+'</div>';
}

/* ------------------------------------------------------------ BUILD (product) */
var KIND_ORDER={core:0,asked:1,plat:2,unknown:3,nopay:4};
function featureTile(f,g){
  var tag=f.improve?'<span class="tag plat">improve</span>':f.built&&f.key!=='mvp'?'<span class="tag built">'+(f.maxed?'maxed':'built')+'</span>':f.queued?'<span class="tag queued">in the queue</span>':({core:'<span class="tag core">start here</span>',asked:'<span class="tag asked">★ customers asked</span>',nopay:'<span class="tag nopay">decoy</span>',unknown:'<span class="tag unknown">unknown</span>',plat:'<span class="tag plat">upgrade</span>'}[f.kind]||'');
  var dead=(f.built&&f.key!=='mvp'&&!f.improve)||f.queued;
  return '<button class="tile'+(dead?' no':'')+(f.kind==='asked'&&!dead?' star':'')+(f.built?' done':'')+'" data-act="feat" data-key="'+esc(f.key)+'"><span class="tt">'+esc(f.name)+'</span><span class="tf">'+f.scope+' pts</span><span class="tb2">'+esc(f.kind==='plat'||f.improve?f.text:(f.kind==='asked'?'Raises product fit.':f.kind==='core'?'Nothing sells without it.':f.kind==='nopay'?'Only adds clutter.':'Might matter. Might not.'))+'</span>'+tag+'</button>';
}
function pProduct(g){
  var V=SU.velocity(g), h='<div class="strip">'+stat('Build speed',V.toFixed(1),'points a month')+stat('Quality',Math.round(g.Q),'of 100')+stat('Tech debt',Math.round(g.D),g.D>50?'Dangerous':g.D>30?'Watch it':'Fine',g.D>50?'bad':'')+'</div>';
  h+=pricingCard(g);
  var st=sub('product',[['features','Features'],['roadmap','Roadmap']],'features'); h+=st.html;
  if(st.cur==='features'){
    var fs=CAT.features(g).slice().sort(function(a,b){ var da=(a.built&&a.key!=='mvp')?1:0, db=(b.built&&b.key!=='mvp')?1:0; if(da!==db) return da-db; return (KIND_ORDER[a.kind]-KIND_ORDER[b.kind]); });
    h+='<div class="tilegrid">'+fs.map(function(f){ return featureTile(f,g); }).join('')+'</div>';
  } else {
    h+='<div class="sec"><h4>Building now <span class="muted xs">'+g.queue.length+' of 6</span></h4>'+(g.queue.length?'<div class="rmap">'+g.queue.map(function(q){ var pc=q.scope?q.progress/q.scope*100:0; return '<div class="rm-i"><div class="top2"><b>'+esc(q.name)+'</b><span class="mono xs">'+q.progress.toFixed(1)+' / '+q.scope+'</span></div>'+bar(pc,'')+'</div>'; }).join('')+'</div>':empty('Nothing in the queue. Pick a feature.'))+'</div>';
    h+='<div class="sec"><h4>Shipped</h4>'+(g.shipped.length?'<div class="row">'+g.shipped.slice(-12).map(function(s){ return '<span class="chip static '+(s.good!==0||s.plat?'ok':'')+'" title="'+esc(s.name)+'">'+esc(s.name)+'</span>'; }).join('')+'</div>':empty('Nothing shipped yet.'))+'</div>';
    h+=tiles(['refactor','compliance','pivot']);
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
  h+='<div class="sec"><h4>Marketing running now</h4>'+(ch.length?'<div class="rows">'+ch.join('')+'</div>':empty('Nothing. Try outreach, ads, content or a launch.'))+'</div>';
  h+=tiles(['outbound','market','launch','rival']);
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
  h+='<div class="sec"><h4>People</h4><div class="rows">'+cands+list.slice(pg*pageSize,(pg+1)*pageSize).map(function(p){ return '<div class="rw click" data-act="person" data-id="'+p.id+'">'+avatar(p.nm,p.col)+'<div class="rm"><b>'+esc(p.nm)+'</b><div class="rs">'+esc(p.role)+' &middot; '+p.bt+'</div></div><div style="width:64px">'+good(p.bar)+'</div></div>'; }).join('')+reqs+'</div>'+(pages>1?'<div class="pager"><button class="btn sm ghost" data-act="page" data-k="team" data-d="-1">Prev</button>'+(pg+1)+' / '+pages+'<button class="btn sm ghost" data-act="page" data-k="team" data-d="1">Next</button></div>':'')+'</div>';
  h+='<div class="tilegrid">'+['hire'].map(tileAction).join('')+'<button class="tile" data-act="view" data-id="policy"><span class="tt">Work policies</span><span class="tf">free</span><span class="tb2">Remote, four-day week, perks, crunch.</span></button>'+['allhands','offsite','raiseAll','layoff'].map(tileAction).join('')+'</div>';
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
function pMoney(g){
  var f=SU.fin(g), E=SU.era(g);
  var h='<div class="strip">'+stat('Cash',fm(g.cash),'',g.cash<0?'bad':'')+stat(f.burn<=0?'Profit / mo':'Burn / mo',fm(Math.abs(f.burn)),f.burn<=0?'you earn more than you spend':'what you lose each month',f.burn>0?'':'good')+stat('Runway',f.burn<=0?'infinite':(f.runway>=99?'99+':f.runway.toFixed(1))+' mo','',f.burn>0&&f.runway<3?'bad':'')+'</div>';
  h+='<div>'+(f.burn<=0?'<span class="pill good">You make more than you spend</span>':f.defaultAlive?'<span class="pill good">Default alive: growth reaches break-even</span>':'<span class="pill bad">Default dead'+(f.daMonth?': cash runs out in about '+f.daMonth+' month'+(f.daMonth===1?'':'s'):'')+'</span>')+' <span class="pill">Money is '+(E.fundAvail>=1.4?'easy':E.fundAvail>=0.9?'normal':'tight')+' now</span></div>';
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
  var h='<div class="sec"><h4>Your space <span class="pill">'+esc(sp.name)+'</span></h4><div class="row" style="justify-content:space-between"><span class="sm">'+SU.headcount(g)+' of '+sp.seats+' seats used</span><span class="xs muted">rent '+fm(sp.rent)+'/mo</span></div>'+bar(SU.headcount(g)/sp.seats*100,over?'bad':(SU.headcount(g)/sp.seats>0.8?'warn':'good'))+(over?'<div class="xs" style="color:var(--bad)">Cramped: morale and speed are dropping.</div>':'')+'<div class="rows">';
  SU.SPACE_ORDER.forEach(function(id,i){ if(id===g.space) return; var s=SU.SPACES[id], c=SU.Shop.canMove(g,id); h+='<div class="rw"><div class="rm"><b>'+esc(s.name)+'</b><div class="rs">'+s.seats+' seats &middot; rent '+fm(s.rent)+'/mo'+(i>idx?' &middot; deposit '+fm(s.deposit):'')+'</div></div><button class="btn sm '+(i>idx?'primary':'ghost')+'" data-act="move" data-id="'+id+'"'+(c.ok?'':' disabled title="'+esc(c.why)+'"')+'>'+(i>idx?'Move in':'Move down')+'</button></div>'; });
  h+='</div></div><div class="sec"><h4>Upgrades <span class="muted xs">they show up in the office</span></h4><div class="tilegrid">';
  SU.UPGRADES.forEach(function(u){ var owned=SU.Shop.has(g,u.id), c=SU.Shop.canBuy(g,u.id);
    h+='<button class="tile'+(owned?' done':(c.ok?'':' no'))+'" data-act="buy" data-id="'+u.id+'"><span class="tt">'+esc(u.name)+'</span><span class="tf">'+(owned?'owned':fm(u.cost))+'</span><span class="tb2">'+esc(owned?u.text:(c.ok||c.why.indexOf('Need ')!==0&&c.why.indexOf('Needs ')!==0?u.text:c.why))+'</span></button>'; });
  return h+'</div></div>';
}

/* ------------------------------------------------------------ GOALS */
function pGoals(g){
  var L=SU.Goals.list(g), done=L.filter(function(x){ return x.done; }).length, next=L.filter(function(x){ return !x.done; }).slice(0,5);
  var h='<div class="row" style="justify-content:space-between"><b>Goals</b><span class="pill good">'+done+' of '+L.length+' reached</span></div><div class="sec">';
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
  var h='<div class="dr-h"><button class="btn sm ghost" data-act="back">'+UI.icon('back')+' Back</button><h3>'+esc(title)+'</h3><span class="fc">'+(f?f+' focus':'free')+'</span></div><div class="dr-b"><div class="muted sm">'+esc(a.blurb)+'</div>'+ctls.map(function(c){ return ctlHtml(aid,c,v); }).join('')+(pv.length?'<div class="pv">'+pv.map(function(l){ return '<div class="'+(/^Warning/.test(l)?'wn':'')+'">'+esc(l)+'</div>'; }).join('')+'</div>':'')+'</div>';
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
function drawerPerson(id){
  var g=G(), h='', e=g.team.filter(function(x){ return x.id===id; })[0];
  if(id==='you'){
    h='<div class="dr-h"><button class="btn sm ghost" data-act="back">'+UI.icon('back')+' Back</button><h3>'+esc(g.founder.name||'You')+'</h3></div><div class="dr-b"><div class="row">'+avatar(g.founder.name||'Y','#f2b01e')+'<div><b>'+esc(g.founder.bg.name)+'</b><div class="xs muted">Perk: '+esc(g.founder.bg.perk)+'. Flaw: '+esc(g.founder.bg.flaw)+'.</div></div></div><div class="sec"><div class="k">Sanity</div>'+good(g.founder.sanity)+'</div><div class="tilegrid">'+tileAction('self')+tileAction('ethics')+'</div></div>';
  } else if(id==='co'&&g.co){
    h='<div class="dr-h"><button class="btn sm ghost" data-act="back">'+UI.icon('back')+' Back</button><h3>'+esc(g.co.name)+'</h3></div><div class="dr-b"><div class="row">'+avatar(g.co.name,'#8b5cf6')+'<div><b>'+esc(g.co.arch)+'</b><div class="xs muted">'+esc(g.co.trait)+'</div></div></div><div class="sec"><div class="k">Bond</div>'+good(g.co.bond)+'<div class="sm">Wants: '+esc(g.co.wants)+'</div><div class="quote">"'+esc(g.co.voice)+'"</div></div><div class="tilegrid">'+tileAction('talkcofounder')+'</div></div>';
  } else if(e){
    var acts=CAT.personActions(g,e), stars='★'.repeat(Math.round((e.skill-0.7)/0.6*5))+'☆'.repeat(5-Math.round((e.skill-0.7)/0.6*5));
    h='<div class="dr-h"><button class="btn sm ghost" data-act="back">'+UI.icon('back')+' Back</button><h3>'+esc(e.name)+'</h3></div><div class="dr-b"><div class="row">'+avatar(e.name,ROLECOL[e.role]||'#5a6b7d')+'<div><b>'+(e.level!=='mid'?SU.cap1(e.level)+' ':'')+esc(SU.ROLES[e.role].name)+'</b><div class="xs muted">'+fm(e.sal)+' a year &middot; joined '+Math.max(0,Math.round(g.mi-e.joinMi))+' months ago</div></div><span class="stars" title="Skill">'+stars+'</span></div>'+
      '<div class="sec"><div class="k">Loyalty</div>'+good(e.loyalty)+'</div>'+(e.trait?'<div class="pv"><div><b>'+esc(SU.TRAITS[e.trait].name)+'.</b> '+esc(SU.TRAITS[e.trait].desc||'')+'</div></div>':'')+'<div class="sm muted">Wants '+esc(SU.WANT_TEXT[e.want]||e.want)+'.</div>'+
      '<div class="tilegrid">'+acts.map(function(x,i){ return '<button class="tile'+(x.danger?' danger':'')+'" data-act="pquick" data-id="'+e.id+'" data-i="'+i+'"><span class="tt">'+esc(x.label)+'</span><span class="tf">'+focusSpec(x.spec)+'</span><span class="tb2">'+esc(x.spec.text)+'</span></button>'; }).join('')+'</div></div>';
  } else h='<div class="dr-h"><button class="btn sm ghost" data-act="back">Back</button><h3>Gone</h3></div><div class="dr-b">That person is no longer here.</div>';
  return h;
}
function focusSpec(sp){ var f=SU.mkClause(G(),sp.lever,sp.params,sp.text).focus; return f?f+' focus':'free'; }

/* ------------------------------------------------------------ drawer: views (policies, loans, exit, cap table, spending, story) */
var EXP_LABEL={payroll:'Payroll',tools:'Tools',infra:'Servers and hosting',marketing:'Marketing and outreach',cogs:'Cost of serving customers',fixed:'Rent, legal, accounting',other:'Perks and care',rbf:'Revenue-based repayment',debt:'Debt interest',owed:'Deferred pay owed'};
function drawerView(id){
  var g=G(), h='', title='';
  if(id==='policy'){
    title='Work policies'; h='<div class="dr-b"><div class="muted sm">Policies change how people feel and how fast they build. Each change is one move in your plan.</div><div class="rows">'+CAT.policyList(g).map(function(p){ var on=CAT.policyOn(g,p.id); return '<div class="rw"><div class="rm"><b>'+esc(p.name)+'</b></div><span class="pill '+(on?'good':'')+'">'+(on?'on':'off')+'</span><button class="btn sm" data-act="policy" data-kind="'+p.id+'">'+(on?'Turn off':'Turn on')+'</button></div>'; }).join('')+'</div></div>';
  } else if(id==='loans'){
    title='Loans and bridges'; h='<div class="dr-b"><div class="tilegrid">'+['card','deferStaff','deferFounder','bridge','rbf','debt'].map(tileAction).join('')+'</div></div>';
  } else if(id==='exit'){
    title='Sell or go public'; h='<div class="dr-b"><div class="tilegrid">'+['banker','ipo','indie','shutdown'].map(tileAction).join('')+'</div></div>';
  } else if(id==='spend'){
    title='Where the money goes'; var f=SU.fin(g), ex=f.ex, rows=['payroll','tools','infra','marketing','cogs','fixed','other','rbf','debt','owed'].filter(function(k){ return ex[k]>1; });
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
    case 'view': S.drawer={type:'view',id:t.getAttribute('data-id')}; renderDrawer(); break;
    case 'policy': { var kind=t.getAttribute('data-kind'); if(UI.addItem({aid:'culture',values:{kind:kind,off:CAT.policyOn(g,kind)}})){ S.drawer=null; renderDrawer(); UI.toast('Added to your plan.',1200); } break; }
    case 'stopch': { if(UI.addItem({aid:'marketStop',values:{channel:t.getAttribute('data-k')}})) UI.toast('Added to your plan.',1200); break; }
    case 'chip': UI.addText(t.getAttribute('data-text')); break;
    case 'dismiss': { var id=t.getAttribute('data-id'); g.inbox.forEach(function(i){ if(i.id===id) i.open=false; }); UI.renderTabs(); break; }
    case 'buy': { var r=SU.Shop.buy(g,t.getAttribute('data-id')); if(!r.ok){ UI.toast(r.why); return; } UI.sfx('money'); UI.toast(r.msg,2600); changed(); break; }
    case 'move': { var mv=SU.Shop.move(g,t.getAttribute('data-id')); if(!mv.ok){ UI.toast(mv.why); return; } UI.sfx(mv.up?'goal':'tick'); UI.toast(mv.msg,3000); changed(); break; }
    case 'cands': UI.openCands(t.getAttribute('data-id')); break;
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

/* ------------------------------------------------------------ candidates */
UI.openCands=function(cid){
  var g=G(), c=(g.cands||[]).filter(function(x){ return x.id===cid; })[0]; if(!c){ UI.toast('Those candidates are gone.'); return; }
  var h='<h2>Pick your '+esc(SU.ROLES[c.role].name.toLowerCase())+'</h2><div class="muted sm">Three people applied. Pick one. The others take other offers.</div><div class="cands">'+c.list.map(function(e,i){
    var n=Math.max(0,Math.min(5,Math.round((e.skill-0.7)/0.6*5))); var tr=e.trait?SU.TRAITS[e.trait]:null; var fn=e.name.split(' ')[0];
    return '<div class="cand"><div class="row" style="gap:8px">'+avatar(e.name,ROLECOL[e.role]||'#5a6b7d')+'<div><h4>'+esc(e.name)+'</h4><div class="xs muted">'+(e.level!=='mid'?SU.cap1(e.level)+' ':'Mid-level ')+esc(SU.ROLES[e.role].name)+'</div></div></div><div class="stars" title="Skill">'+'★'.repeat(n)+'☆'.repeat(5-n)+'</div><div class="sm"><b>'+fm(e.sal)+'</b> a year<br><span class="muted">'+fm(e.sal*1.3/12)+'/mo with taxes</span></div>'+(tr?'<div class="pv"><div><b>'+esc(tr.name)+'</b></div><div>'+esc(tr.desc||'')+'</div></div>':'<div class="xs muted">No strong quirks.</div>')+'<div class="xs muted">Wants '+esc(SU.WANT_TEXT[e.want]||e.want)+'.</div><button class="btn primary" data-act="pick-cand" data-id="'+c.id+'" data-i="'+i+'">Hire '+esc(fn)+'</button></div>'; }).join('')+'</div><div class="foot"><button class="btn ghost" data-act="drop-cands" data-id="'+c.id+'">None of them</button><button class="btn" data-act="close-modal">Decide later</button></div>';
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
  if(t==='why'){ h=o.autopsy.map(function(a){ return '<div class="autopsy"><b>'+esc(a.t)+'.</b> '+esc(a.d)+'</div>'; }).join('')+(g.achv.length?'<div class="sec"><h4>Achievements</h4><div class="row">'+g.achv.map(function(id){ var a=SU.ACHIEVEMENTS.filter(function(x){ return x.id===id; })[0]; return '<span class="pill blue">'+esc(a?a.name:id)+'</span>'; }).join('')+'</div></div>':''); }
  else if(t==='press'){ h='<div class="clips">'+o.artifacts.filter(function(a){ return a.kind!=='Where are they now'; }).map(function(a){ return '<div class="clip"><div class="kind">'+esc(a.kind)+'</div><h4>'+esc(a.title)+'</h4>'+(a.text?'<div class="sm">'+esc(a.text)+'</div>':'')+(a.list?'<ul>'+a.list.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul>':'')+'</div>'; }).join('')+'</div>'; }
  else if(t==='story'){ h='<div class="story" id="storyTxt">'+(S.story?esc(S.story):'<span class="muted">'+((S.aiOk&&SU.AI)?'Ask Claude to write the story of your company from what actually happened.':'Connect Claude to have your story written from your game. The press clippings are generated offline.')+'</span>')+'</div>'+((S.aiOk&&SU.AI)?'<div class="row"><button class="btn" data-act="story">Write my story with Claude</button></div>':''); }
  else { var cast=o.artifacts.filter(function(a){ return a.kind==='Where are they now'; })[0]; h=cast?'<div class="clip"><div class="kind">'+esc(cast.kind)+'</div><h4>'+esc(cast.title)+'</h4><ul>'+(cast.list||[]).map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul></div>':'<div class="empty">No cast notes.</div>'; }
  el.innerHTML=h;
}
})();
