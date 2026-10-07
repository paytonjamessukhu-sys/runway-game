/* RUNWAY - UI core: one-screen layout, setup wizard, header, plan, run and auto-run, modals. No typing anywhere: every move is a click. */
(function(){
'use strict';
var SU = window.SU, Iso = SU.Iso, CAT = SU.CAT, fm = SU.fmtMoney;
var UI = (SU.UI = window.UI = {});
var G = null;
var S = UI.S = {sheet:true,view:'setup',tab:'customers',sub:{},drawer:null,receipt:null,setup:null,wiz:0,mute:false,plan:[],cfg:{},uid:0,auto:{on:false,speed:1},busy:false,ticker:[],seenIid:0,mview:'office',aiOk:false,page:{}};
function isPhone(){ return window.innerWidth<=760; }
function setSheet(open){ S.sheet=open; document.body.setAttribute('data-sheet',open?'open':'closed'); }
UI.setSheet=setSheet;
/* the office is centred in the part of the screen the floating panels leave free */
function insets(){
  var st=$('.office .stage'), sd=$('.rcol'); if(!st||!sd||isPhone()) return {l:0,t:0,r:0,b:0};
  var a=st.getBoundingClientRect(), b=sd.getBoundingClientRect();
  var pl=$('#plan'); var pb=pl?Math.max(0,a.bottom-pl.getBoundingClientRect().top):0; return {l:0,t:34,r:Math.max(0,a.right-b.left+6),b:Math.min(pb,170)+4};
}
var root=null, modalEl=null, toastTimer=null;

/* ------------------------------------------------------------ utils */
function $(s,e){ return (e||document).querySelector(s); }
function $$(s,e){ return Array.prototype.slice.call((e||document).querySelectorAll(s)); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function store(k,v){ try{ if(v===undefined){ return localStorage.getItem('su_ui_'+k); } localStorage.setItem('su_ui_'+k,v); }catch(e){ return null; } }
UI.$=$; UI.$$=$$; UI.esc=esc; UI.store=store;
UI.G=function(){ return G; };
UI.setG=function(g){ G=g; };
var ICON={
  inbox:'M3 7h18v11H3z M3 8l9 6 9-6', users:'M4 5h16v11H10l-4 4v-4H4z', cube:'M12 3l8 4.5v9L12 21l-8-4.5v-9z M12 12l8-4.5 M12 12v9 M12 12L4 7.5',
  mega:'M3 10v4h4l8 4V6L7 10z M18 9a4 4 0 010 6', team:'M9 11a3 3 0 100-6 3 3 0 000 6z M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6 M16 10.5a2.5 2.5 0 100-5 M17.5 14c2.2.5 3.5 2.5 3.5 6',
  coin:'M12 3a9 9 0 100 18 9 9 0 000-18z M9.5 14.5c.5 1 1.5 1.5 2.5 1.5 1.4 0 2.5-.8 2.5-2 0-3-5-1.5-5-4.5 0-1.2 1.1-2 2.5-2 1 0 2 .5 2.5 1.5 M12 6v1.5 M12 16.5V18',
  heart:'M12 20s-8-5-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 9c0 6-8 11-8 11z', bag:'M5 8h14l-1 12H6z M9 8V6a3 3 0 016 0v2', flag:'M5 21V4 M5 4h12l-2 4 2 4H5',
  chart:'M4 20V10 M10 20V4 M16 20v-8 M21 20H3', repeat:'M17 2l3 3-3 3 M20 5H9a5 5 0 00-5 5 M7 22l-3-3 3-3 M4 19h11a5 5 0 005-5', x:'M6 6l12 12 M18 6L6 18',
  back:'M15 5l-7 7 7 7', play:'M7 4l13 8-13 8z', plus:'M12 5v14 M5 12h14'
};
UI.icon=function(n,c){ return '<svg class="ico'+(c?' '+c:'')+'" viewBox="0 0 24 24" aria-hidden="true"><path d="'+ICON[n]+'"/></svg>'; };
UI.toast=function(msg,ms){ var t=$('#toast'); if(!t) return; t.textContent=msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(function(){ t.classList.remove('show'); },ms||2600); };
UI.modal=function(html,opts){
  opts=opts||{}; UI.closeModal();
  var b=document.createElement('div'); b.className='mback'; b.innerHTML='<div class="modal'+(opts.wide?' wide':'')+'" role="dialog" aria-modal="true">'+(opts.noClose?'':'<button class="x" data-act="close-modal" aria-label="Close">&times;</button>')+html+'</div>';
  b.addEventListener('mousedown',function(e){ if(e.target===b && !opts.sticky) UI.closeModal(); });
  document.body.appendChild(b); modalEl=b; var f=$('button.primary',b); if(f && opts.focus!==false) try{ f.focus({preventScroll:true}); }catch(e){}
  return b;
};
UI.closeModal=function(){ if(modalEl){ modalEl.remove(); modalEl=null; } };
UI.modalOpen=function(){ return !!modalEl; };
document.addEventListener('keydown',function(e){ if(e.key==='Escape'){ if(modalEl) UI.closeModal(); else if(S.drawer){ S.drawer=null; UI.renderPane(); } } });

/* ------------------------------------------------------------ tiny sound */
var AC=null;
function beep(freq,dur,type,vol,when){ try{ if(S.mute) return; if(!AC){ var C=window.AudioContext||window.webkitAudioContext; if(!C) return; AC=new C(); } var t=AC.currentTime+(when||0); var o=AC.createOscillator(), g=AC.createGain(); o.type=type||'sine'; o.frequency.value=freq; g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol||0.08,t+0.01); g.gain.exponentialRampToValueAtTime(0.0001,t+dur); o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t+dur+0.02); }catch(e){} }
UI.sfx=function(n){
  if(n==='go'){ beep(330,0.09,'triangle',0.07); beep(494,0.12,'triangle',0.07,0.08); }
  else if(n==='ship'){ beep(523,0.1,'square',0.05); beep(784,0.16,'square',0.05,0.1); }
  else if(n==='money'){ beep(988,0.07,'square',0.04); beep(1319,0.2,'square',0.04,0.07); }
  else if(n==='alarm'){ beep(220,0.18,'sawtooth',0.06); beep(220,0.18,'sawtooth',0.06,0.26); }
  else if(n==='hire'){ beep(392,0.1,'sine',0.08); beep(523,0.1,'sine',0.08,0.1); beep(659,0.18,'sine',0.08,0.2); }
  else if(n==='add'){ beep(620,0.05,'triangle',0.05); beep(840,0.07,'triangle',0.05,0.05); }
  else if(n==='tick'){ beep(700,0.03,'square',0.02); }
  else if(n==='goal'){ beep(523,0.1,'triangle',0.07); beep(659,0.1,'triangle',0.07,0.1); beep(784,0.1,'triangle',0.07,0.2); beep(1047,0.22,'triangle',0.07,0.3); }
  else if(n==='end'){ beep(196,0.5,'sine',0.09); beep(147,0.8,'sine',0.09,0.35); }
};

/* ------------------------------------------------------------ copy */
var DIFF={smb:['Steady grind','Real money per customer. Slow to win, hard to kill.'],consumer:['Lottery ticket','Tiny price, huge volume. Needs a viral loop.'],market:['Chicken and egg','Two sides to grow at once. Brutal at first.']};
var GROUPS=[['smb','Sell software to businesses'],['consumer','Consumer apps'],['market','Marketplaces']];
var TABS=[['inbox','Inbox','inbox'],['customers','Clients','users'],['product','Build','cube'],['sales','Sales','mega'],['team','Team','team'],['money','Money','coin'],['you','You','heart'],['shop','Shop','bag'],['goals','Goals','flag'],['dash','Stats','chart']];
UI.TABS=TABS;

/* ------------------------------------------------------------ boot */
UI.boot = function(){
  root = $('#app');
  root.addEventListener('click',onClick);
  document.addEventListener('click',function(e){ if(modalEl && modalEl.contains(e.target)) onClick(e); });
  document.addEventListener('input',onInput);
  document.addEventListener('keydown',onKey);
  var m=store('mute'); S.mute=(m==='1');
  var last=null; try{ last=JSON.parse(store('setup')||'null'); }catch(e){}
  S.setup=Object.assign({idea:'molarity',era:'2024',co:'nadia',bg:'bigco',name:'',company:'',split:0.5,daily:false},last||{});
  if(SU.AI && SU.AI.probe) SU.AI.probe(function(ok){ S.aiOk=ok; });
  renderSetup();
};
function onKey(e){
  if(S.view!=='game'||modalEl) return; var t=e.target; if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT')) return;
  if(e.code==='Space'||e.key==='Enter'){ if(t&&t.tagName==='BUTTON') return; e.preventDefault(); UI.run(); }
  else if(e.key==='p'||e.key==='P'){ UI.toggleAuto(); }
}

/* ------------------------------------------------------------ setup wizard */
var WSTEPS=['Idea','Year','Cofounder','You'];
function saveSetup(){ var s=S.setup; store('setup',JSON.stringify({idea:s.idea,era:s.era,co:s.co,bg:s.bg,name:s.name,company:s.company,split:s.split})); }
function renderSetup(){
  S.view='setup'; document.body.removeAttribute('data-sheet'); Iso.stop(); document.title='Runway'; UI.closeModal();
  var has=SU.hasSave() && SU.load();
  root.innerHTML='<div class="wiz"><div class="wiz-l"><div><div class="brandbig">RUN<span>WAY</span></div><p class="lead">Start a company. Each month you pick your moves with a few clicks and press Run. Keep the cash alive long enough to win.</p></div>'+
    '<div class="vis"><canvas id="heroCv"></canvas></div><div class="sumline" id="sum"></div>'+
    '<div class="row">'+(has?'<button class="btn" data-act="continue">Continue: '+esc(has.name)+', '+esc(SU.dateStr(has))+'</button>':'')+'<button class="btn ghost sm" data-act="help">How it works</button><button class="btn ghost sm" data-act="import">Load a save code</button></div></div>'+
    '<div class="card wiz-r"><div class="stepper" id="stepper"></div><div class="wiz-b" id="wizb"></div><div class="wiz-f" id="wizf"></div></div></div>';
  renderWiz(); heroSync();
}
function ideaCard(i){
  var on=S.setup.idea===i.id;
  return '<button class="opt'+(on?' on':'')+'" data-act="pick-idea" data-id="'+i.id+'"><b>'+esc(i.name)+'</b><span class="tg">'+esc(i.tag)+'</span>'+(i.ai?'<span class="meta"><span class="pill blue">AI idea</span></span>':'')+'</button>';
}
function renderWiz(){
  var st=S.setup, step=S.wiz, idea=SU.IDEAS.filter(function(i){ return i.id===st.idea; })[0]||SU.IDEAS[0];
  $('#stepper').innerHTML=WSTEPS.map(function(n,i){ return '<button class="'+(i===step?'on':(i<step?'done':''))+'" data-act="wiz" data-i="'+i+'"><b>'+(i+1)+'</b>'+n+'</button>'; }).join('');
  var co=SU.COFOUNDERS.filter(function(c){ return c.id===st.co; })[0], bg=SU.BACKGROUNDS.filter(function(b){ return b.id===st.bg; })[0];
  $('#sum').innerHTML='<span class="pill blue">'+esc(idea.name)+'</span><span class="pill">'+esc(SU.START_INFO[st.era].name)+'</span><span class="pill">'+(co?esc(co.name.split(' ')[0]):'Solo')+'</span><span class="pill">'+esc(bg.name)+'</span>';
  var h='';
  if(step===0){
    h+='<h3>Pick an idea</h3><p class="muted sm" style="margin-bottom:6px">Each one plays differently.</p>';
    GROUPS.forEach(function(g){ h+='<div class="sec" style="margin-bottom:8px"><div class="row"><b class="k">'+g[1]+'</b><span class="pill '+(g[0]==='smb'?'good':'warn')+'">'+DIFF[g[0]][0]+'</span></div><div class="ideas">'+SU.IDEAS.filter(function(i){ return i.arch===g[0]; }).map(ideaCard).join('')+'</div></div>'; });
  } else if(step===1){
    h+='<h3>Pick the year</h3><p class="muted sm" style="margin-bottom:8px">The money, the hiring market and the hype change with it.</p><div class="opts">'+['1999','2008','2021','2024'].map(function(k){ var i=SU.START_INFO[k]; return '<button class="opt'+(st.era===k?' on':'')+'" data-act="pick-era" data-id="'+k+'"><b>'+esc(i.name)+'</b><span class="tg">'+esc(i.blurb)+'</span></button>'; }).join('')+'</div>';
  } else if(step===2){
    h+='<h3>Pick a cofounder</h3><p class="muted sm" style="margin-bottom:8px">Or go solo. Solo is harder to fund.</p><div class="opts">'+SU.COFOUNDERS.map(function(c){ return '<button class="opt'+(st.co===c.id?' on':'')+'" data-act="pick-co" data-id="'+c.id+'"><b>'+esc(c.name)+'</b><span class="meta"><span class="pill">'+esc(c.arch)+'</span></span><span class="tg">'+esc(c.trait)+'</span><span class="tg">Wants: '+esc(c.wants)+'</span></button>'; }).join('')+'<button class="opt'+(!st.co?' on':'')+'" data-act="pick-co" data-id=""><b>Solo</b><span class="tg">All the equity, all the work, all the 3am. Investors want a team.</span></button></div>';
  } else {
    h+='<h3>Who are you?</h3><div class="opts" style="margin:6px 0 10px">'+SU.BACKGROUNDS.map(function(b){ return '<button class="opt'+(st.bg===b.id?' on':'')+'" data-act="pick-bg" data-id="'+b.id+'"><b>'+esc(b.name)+'</b><span class="tg">Starts with '+fm(b.cash)+' of savings.</span><span class="meta"><span class="pill good">+ '+esc(b.perk)+'</span><span class="pill bad">- '+esc(b.flaw)+'</span></span></button>'; }).join('')+'</div>'+
      '<div class="opts"><div class="field"><label for="f-name">Your name</label><input id="f-name" type="text" maxlength="24" placeholder="You" value="'+esc(st.name)+'"></div><div class="field"><label for="f-co">Company name</label><input id="f-co" type="text" maxlength="24" placeholder="'+esc(idea.name)+'" value="'+esc(st.company)+'"></div>'+
      (st.co?'<div class="field"><label>Equity split with your cofounder</label><div class="seg wrap">'+[[0.5,'50 / 50'],[0.6,'60 / 40'],[0.7,'70 / 30'],[0.8,'80 / 20']].map(function(o){ return '<button class="sg'+(st.split===o[0]?' on':'')+'" data-act="pick-split" data-v="'+o[0]+'">'+o[1]+'</button>'; }).join('')+'</div></div>':'')+
      '<div class="field"><label>Same market as everyone today?</label><button class="tgl'+(st.daily?' on':'')+'" data-act="daily"><span class="bx">✓</span>Use today\'s shared seed</button></div></div>';
  }
  $('#wizb').innerHTML=h;
  $('#wizf').innerHTML=(step>0?'<button class="btn" data-act="wiz" data-i="'+(step-1)+'">Back</button>':'<span></span>')+(step<3?'<button class="btn primary" data-act="wiz" data-i="'+(step+1)+'">Next</button>':'<button class="btn primary big" data-act="start">Start the company</button>');
}
var heroG=null;
function heroSync(){
  var cvs=$('#heroCv'); if(!cvs) return; Iso.attach(cvs); Iso.start();
  var st=S.setup;
  var g=SU.newGame({ideaId:st.idea,startKey:st.era,cofounder:st.co||null,bgId:st.bg,name:'You',seed:77});
  for(var i=0;i<3;i++){ var roles=['eng','design','cs']; g.team.push(SU.makeEmployee(g,roles[i],'mid',150000,0.001)); }
  g.cust.n=14; g.cust.payers=30; g.mrr=3200; g.mrrHist=[0,300,800,1200,1900,2400,3200]; g.hype=40; g.morale=80; g.insight=50; g.space='studio';
  heroG=g; Iso.reset(); Iso.sync(g,{initial:true}); setTimeout(function(){ Iso.resize(); },30);
}
UI.heroSync=heroSync;

/* ------------------------------------------------------------ start / continue */
function dailySeed(){ var d=new Date(); var k=d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); return Math.abs(SU.hash('daily:'+k))%2147483646+1; }
function startGame(){
  var st=S.setup; saveSetup();
  var idea=SU.IDEAS.filter(function(i){ return i.id===st.idea; })[0]||SU.IDEAS[0];
  var g=SU.newGame({ideaId:st.idea,startKey:st.era,cofounder:st.co||null,bgId:st.bg,name:(st.name||'').trim()||'You',company:(st.company||'').trim()||idea.name,seed:st.daily?dailySeed():undefined,split:st.split});
  SU.save(g); begin(g,true);
}
function begin(g,fresh){
  G=g; S.view='game'; S.receipt=G.last||null; S.plan=[]; S.cfg={}; S.drawer=null; S.auto.on=false; S.busy=false; S.ticker=[]; S.sub={}; S.page={}; S.seenIid=G.iid;
  S.tab=fresh?'customers':(G.inbox.some(function(i){ return i.open&&(i.action||i.kind==='crisis'); })?'inbox':'customers');
  S.sheet=true; buildShell(); Iso.reset(); Iso.setInsetFn(insets); Iso.attach($('#officeCv')); Iso.start(); Iso.sync(G,{initial:true}); Iso.setHandlers({hover:onIsoHover,pick:onIsoPick});
  setTimeout(function(){ Iso.resize(); Iso.sync(G,{initial:true}); },40);
  refreshAll(); document.title=G.name+' | Runway';
  if(G.over){ UI.showEnd(); return; }
  if(fresh && !store('seenhelp2')){ store('seenhelp2','1'); UI.showHelp(true); }
}
UI.begin=begin;

/* ------------------------------------------------------------ shell */
function buildShell(){
  document.body.setAttribute('data-sheet',S.sheet?'open':'closed');
  root.innerHTML=
  '<header class="top" id="hdr"></header>'+
  '<main class="game">'+
    '<section class="office"><div class="stage"><canvas id="officeCv"></canvas>'+
      '<div class="hud"><div class="hud-top"><b id="hudDate"></b><div class="hud-bar"><i id="hudBar"></i></div><span class="lvl" id="hudLvl" data-act="golvl" role="button"></span><button class="btn sm" data-act="report">Last month</button></div><div class="hud-cap"><span id="capR"></span><span id="capL"></span></div><div class="ticker" id="ticker"></div></div>'+
      '<div class="tip" id="tip" hidden></div><div class="pop" id="pop" hidden></div></div></section>'+
    '<section class="card plan" id="plan"></section>'+
    '<div class="rcol"><aside class="card side"><div class="icontabs" id="tabs" role="tablist"></div><div class="pn" id="pn"><div class="pn-in" id="pnIn"></div><div id="drawer"></div></div></aside></div>'+
  '</main>';
}
function refreshAll(){ renderHeader(); renderCaption(); renderHud(); renderPlan(); UI.renderTabs(); if(S.lvlPop){ S.lvlPop=false; var lb=$('#hudLvl'); if(lb){ lb.classList.remove('pop'); void lb.offsetWidth; lb.classList.add('pop'); } } }
UI.refreshAll=refreshAll;

/* ------------------------------------------------------------ header */
function runwayInfo(){ var f=SU.fin(G); var inf=f.burn<=0; var mo=inf?24:Math.min(24,f.runway); return {f:f,inf:inf,mo:mo,cls:inf?'ok':(f.runway<3?'low':(f.runway<6?'mid':''))}; }
function delta(a,b,money){ var d=a-b; if(Math.abs(d)<0.5) return ''; return (d>0?'+':'-')+(money?fm(Math.abs(d)):Math.round(Math.abs(d))); }
function renderHeader(over){
  var rw=runwayInfo(), f=rw.f, rec=G.last, b=rec&&rec.before;
  var cash=over?over.cash:G.cash, mrr=over?over.mrr:(G.mrr||0), cust=over?over.cust:SU.custCount(G);
  var arch=G.arch, custLabel=arch==='consumer'?'Subscribers':(arch==='market'?'Both sides':'Customers');
  var band=SU.pmfBand(G);
  var dashes=''; for(var i=0;i<24;i++) dashes+='<span class="dash'+(i<Math.round(rw.mo)?' on':'')+'"></span>';
  var act=SU.ACTS[G.act-1];
  $('#hdr').innerHTML='<div class="brand">RUNWAY</div><div class="who"><b>'+esc(G.name)+'</b><span>Act '+G.act+': '+esc(act.name)+'</span></div>'+
   '<div class="meters">'+
   '<div class="m'+(cash<0?' neg':'')+'"><span class="l">Cash</span><span class="v" id="mCash">'+fm(cash)+'</span><span class="d '+(b&&G.cash>=b.cash?'up':'dn')+'">'+(b&&!over?delta(G.cash,b.cash,true):'&nbsp;')+'</span></div>'+
   '<div class="runway '+rw.cls+'" title="Months of cash left at the current burn"><div class="dashes">'+dashes+'</div><div class="rt"><span>Runway</span><b>'+(rw.inf?'profitable':(f.runway>=99?'99+ mo':f.runway.toFixed(1)+' mo'))+'</b></div></div>'+
   '<div class="m"><span class="l">Revenue / mo</span><span class="v" id="mMrr">'+fm(mrr)+'</span><span class="d '+(b&&(G.mrr||0)>=b.mrr?'up':'dn')+'">'+(b&&!over?delta(G.mrr||0,b.mrr,true):'&nbsp;')+'</span></div>'+
   '<div class="m"><span class="l">'+custLabel+'</span><span class="v" id="mCust">'+SU.fmtNum(cust)+'</span><span class="d '+(b&&SU.custCount(G)>=b.cust?'up':'dn')+'">'+(b&&!over?delta(SU.custCount(G),b.cust,false):'&nbsp;')+'</span></div>'+
   '<div class="m" title="Product-market fit. A range, because you cannot see it exactly. Talking to customers narrows it."><span class="l">Product fit</span><span class="v">'+band.lo+'-'+band.hi+'</span><span class="d">of 100</span></div>'+
   '<div class="m" title="Your energy. At zero you burn out."><span class="l">Sanity</span><span class="v">'+Math.round(G.founder.sanity)+'</span><span class="d">team '+Math.round(G.morale)+'</span></div>'+
   '</div><div class="hb"><button class="hbtn" data-act="help">?</button><button class="hbtn" data-act="menu">Menu</button></div>';
}
function tweenHeader(b,a,dur){
  var ec=$('#mCash'), em=$('#mMrr'), eu=$('#mCust'); if(!ec) return; var t0=performance.now();
  function frame(now){ var k=Math.min(1,(now-t0)/dur); k=1-Math.pow(1-k,3); if(ec) ec.textContent=fm(b.cash+(a.cash-b.cash)*k); if(em) em.textContent=fm(b.mrr+(a.mrr-b.mrr)*k); if(eu) eu.textContent=SU.fmtNum(b.cust+(a.cust-b.cust)*k); if(k<1) S.tw=requestAnimationFrame(frame); }
  cancelAnimationFrame(S.tw); S.tw=requestAnimationFrame(frame);
}
function renderCaption(){
  var f=SU.fin(G), E=SU.era(G), da=f.defaultAlive;
  var sp=SU.Shop.space(G), over=SU.Shop.over(G);
  $('#capL').innerHTML=esc(E.name)+' &middot; money is '+(E.fundAvail>=1.4?'easy':E.fundAvail>=0.9?'normal':'tight')+' &middot; '+esc(sp.name)+' ('+SU.headcount(G)+'/'+sp.seats+' seats'+(over?', cramped':'')+')';
  $('#capR').innerHTML=(f.burn<=0?'<span class="pill good">Profitable</span>':(G.mrr<=0&&G.t<=6)?'<span class="pill">Pre-revenue: '+(f.runway>=99?'99+':f.runway.toFixed(0))+' month'+(Math.round(f.runway)===1?'':'s')+' of cash</span>':da?'<span class="pill good">Default alive</span>':'<span class="pill bad">Default dead'+(f.daMonth?': cash out in ~'+f.daMonth+' mo':'')+'</span>');
}
function renderHud(){
  var li=SU.Level.info(G), lb=$('#hudLvl'); if(lb){ lb.textContent='Lv '+li.n+' \u00b7 '+li.cur.title; lb.title=li.next?'Next: '+li.next.title+'. '+li.next.hint:'Top level. You built a unicorn.'; }
  $('#hudDate').textContent=SU.dateStr(G)+(SU.turnMonths(G)===3?' (a quarter per turn)':'');
  renderTicker();
}
function pushTicker(text,kind){ S.ticker=S.ticker.filter(function(x){ return x.text!==text; }); S.ticker.push({text:text,kind:kind||'',t:Date.now()}); if(S.ticker.length>3) S.ticker.shift(); renderTicker(); }
function renderTicker(){ var el=$('#ticker'); if(!el) return; var now=Date.now(); S.ticker=S.ticker.filter(function(x){ return now-x.t<11000; }); el.innerHTML=S.ticker.map(function(x){ return '<div class="tk '+esc(x.kind)+'">'+esc(x.text)+'</div>'; }).join(''); }
UI.pushTicker=pushTicker;

/* ------------------------------------------------------------ the plan */
UI.planFocus=function(){ var u=0; S.plan.forEach(function(it){ u+=CAT.item(G,it).focus; }); return u; };
UI.addItem=function(it){
  var a=CAT.actions[it.aid]; var item=CAT.item(G,it);
  if(a && a.unique){ var key=a.unique===true?'':String((it.values||{})[a.unique]); S.plan=S.plan.filter(function(x){ if(x.aid!==it.aid) return true; if(a.unique===true) return false; return String((x.values||{})[a.unique])!==key; }); }
  if(it.aid==='quick'){ var spec=it.spec; S.plan=S.plan.filter(function(x){ return !(x.aid==='quick'&&x.spec.text===spec.text); }); }
  var budget=SU.focusBudget(G).budget, used=UI.planFocus();
  if(used+item.focus>budget+1e-9){ UI.toast('Not enough focus left this month. Run the month or remove something.'); return false; }
  it.uid=++S.uid; S.plan.push(it); UI.sfx('add'); renderPlan(); var pl=$('#plan'); if(pl){ pl.classList.remove('flash'); void pl.offsetWidth; pl.classList.add('flash'); }
  return true;
};
UI.addText=function(text){
  var P=SU.parse(G,text); if(!P.clauses.length){ UI.toast('I cannot do that one from here.'); return false; }
  var ok=false; P.clauses.forEach(function(cl){ if(UI.addItem({aid:'text',text:cl.text})) ok=true; }); return ok;
};
function renderPlan(){
  var el=$('#plan'); if(!el||!G) return;
  var budget=SU.focusBudget(G).budget, used=UI.planFocus(), tm=SU.turnMonths(G);
  var dots=''; var total=Math.round(budget); for(var i=0;i<total;i++) dots+='<i class="'+(i<Math.round(used)?'on':'')+'"></i>';
  var items=S.plan.map(function(it,ix){ var r=CAT.item(G,it); var pin=(it.aid==='quick'||it.aid==='text')?false:!!(CAT.actions[it.aid]&&CAT.actions[it.aid].repeat); var a=CAT.actions[it.aid];
    var sub=''; try{ if(a&&a.preview&&it.values){ var pv=a.preview(G,it.values); sub=(pv&&pv[0])||''; } }catch(e){}
    return '<div class="qrow'+(it.repeat?' pinned':'')+'"><span class="qn">'+(ix+1)+'</span><div class="qm"><b title="'+esc(r.label)+'">'+esc(r.label)+'</b>'+(sub?'<span class="qsub">'+esc(sub)+'</span>':'')+'</div>'+(r.focus?'<span class="pf">'+r.focus+' focus</span>':'<span class="pf">free</span>')+(pin?'<button class="pb'+(it.repeat?' on':'')+'" data-act="pin" data-uid="'+it.uid+'" title="Repeat every month">'+UI.icon('repeat')+'</button>':'')+'<button class="pb" data-act="unplan" data-uid="'+it.uid+'" title="Remove">'+UI.icon('x')+'</button></div>'; }).join('');
  var vel=Math.max(0.1,SU.velocity(G)), cum=0;
  var bq=G.queue.map(function(q){ cum+=q.scope-q.progress; var mo=Math.max(1,Math.ceil(cum/vel-1e-6)); var pc=q.scope?Math.round(q.progress/q.scope*100):0;
    return '<div class="bq"><div class="bq-t"><b>'+esc(q.name)+'</b><span class="mono xs">'+pc+'%</span></div><div class="bar"><i style="width:'+pc+'%"></i></div><span class="xs muted">'+(mo===1?'Ships next month':'Ships in about '+mo+' months')+'</span></div>'; }).join('');
  var pend=S.plan.filter(function(it){ return it.aid==='build'&&it.values; }).map(function(it){ var f=CAT.featureByKey(G,it.values.fk); return f?'<div class="bq pend"><div class="bq-t"><b>'+esc(f.name)+'</b><span class="xs muted">when you run</span></div><span class="xs muted">Starts this month. About '+CAT.eta(G,f.scope).toFixed(1)+' months of work.</span></div>':''; }).join('');
  bq=bq+pend;
  var ideas=CAT.coach(G).filter(function(c){ return !S.plan.some(function(it){ return it.aid===c.aid && JSON.stringify(it.values)===JSON.stringify(c.values); }); }).slice(0,3);
  S.ideas=ideas;
  var lbl=tm===3?'Run next quarter':'Run '+SU.MONTHS[G.month-1];
  el.innerHTML='<div class="plan-h"><h2>'+(tm===3?'This quarter':SU.dateStr(G))+'</h2><span class="muted sm">Your plan</span><div class="focus"><span class="k">Focus</span><div class="dots" title="You can only give real attention to so much each period">'+dots+'</div><b>'+Math.round(used*2)/2+'/'+total+'</b></div></div>'+
    '<div class="plan-body"><div class="plan-list">'+(items||'<span class="hint">Nothing planned yet. Pick moves from the menus, or just run the month.</span>')+'</div>'+
    '<div class="bqs"><div class="k">Building'+(G.queue.length?' ('+G.queue.length+')':'')+'</div>'+(bq||'<span class="hint">Nothing in the build queue. Pick a feature on the Build tab.</span>')+'</div></div>'+
    (ideas.length?'<div class="plan-ideas"><span class="k">Try</span>'+ideas.map(function(c,i){ return '<button class="chip idea" data-act="coach-add" data-i="'+i+'" title="'+esc(c.why)+'">+ '+esc(c.label)+'</button>'; }).join('')+'</div>':'')+
    '<div class="plan-run"><button class="btn primary big runfill" id="runBtn" data-act="run"'+(S.busy||G.over?' disabled':'')+'><i id="runFill"></i><span id="runLbl">'+(S.busy?'Running...':lbl+' '+UI.icon('play'))+'</span></button>'+
    '<button class="btn" data-act="auto" id="autoBtn">'+(S.auto.on?'Auto-run: on':'Auto-run')+'</button><span class="seg">'+[1,2,4].map(function(v){ return '<button class="sg'+(S.auto.speed===v?' on':'')+'" data-act="speed" data-v="'+v+'">'+v+'x</button>'; }).join('')+'</span>'+
    (S.plan.length?'<button class="btn ghost sm" data-act="clear-plan">Clear</button>':'')+'</div>';
  var rb=$('#runB2'); if(rb){ rb.textContent=S.busy?'Running...':(tm===3?'Run quarter':'Run '+SU.MONTHS[G.month-1]); rb.disabled=!!(S.busy||G.over); }
}
UI.renderPlan=renderPlan;

/* ------------------------------------------------------------ run a month */
function planToCommit(){
  var clauses=[], claims=null, promises=[], skipped=0, used=0, budget=SU.focusBudget(G).budget;
  S.plan.forEach(function(it){
    if(it.aid!=='quick'&&it.aid!=='text'){ var ok=CAT.validate(G,it.aid,it.values); if(!ok.ok){ skipped++; UI.pushTicker('Skipped: '+(CAT.actions[it.aid]?CAT.actions[it.aid].title:'a move')+'. '+(ok.why||''),'bad'); return; } }
    var r=CAT.item(G,it); if(used+r.focus>budget+1e-9){ skipped++; return; } used+=r.focus;
    if(r.special==='announce') claims=(claims||[]).concat(r.claims); else if(r.special==='promise') promises.push(r.promise); else r.clauses.forEach(function(c){ clauses.push(c); });
  });
  return {clauses:clauses,claims:claims,promises:promises};
}
UI.run=function(){
  if(S.busy||!G||G.over||S.view!=='game') return;
  var pc=planToCommit(); var backup=SU.clone(G), rec=null; S.seenIid=G.iid;
  try{ rec=SU.commit(G,'',null,{clauses:pc.clauses,claims:pc.claims||undefined,promises:pc.promises.length?pc.promises:undefined}); }
  catch(e){ console.error(e); G=backup; UI.toast('Something went wrong with that month. Nothing happened.'); return; }
  S.receipt=rec; S.plan=S.plan.filter(function(it){ return it.repeat; });
  /* the office reacts while the numbers tick */
  S.busy=true; var dur=Math.round(2600/S.auto.speed); if(isPhone()) setSheet(false);
  renderHeader({cash:rec.before.cash,mrr:rec.before.mrr,cust:rec.before.cust}); tweenHeader(rec.before,rec.after,dur);
  renderPlan(); Iso.sync(G); Iso.afterTurn(G,rec);
  var rl=$('#runFill'); if(rl){ rl.style.transition='width '+dur+'ms linear'; rl.style.width='100%'; } var hb=$('#hudBar'); if(hb){ hb.style.transition='none'; hb.style.width='0'; void hb.offsetWidth; hb.style.transition='width '+dur+'ms linear'; hb.style.width='100%'; }
  var cashUp=rec.after.cash-rec.before.cash;
  UI.sfx(rec.lastStand?'alarm':(rec.shipped&&rec.shipped.length?'ship':(cashUp>40000?'money':'go')));
  setTimeout(function(){ finishRun(rec); },dur);
};
function finishRun(rec){
  S.busy=false; if(isPhone()&&!S.auto.on) setSheet(true); var hb=$('#hudBar'); if(hb){ hb.style.transition='none'; hb.style.width='0'; }
  /* ticker lines */
  if(rec.reactions&&rec.reactions.headline) pushTicker(rec.reactions.headline,'');
  var b=rec.before, a=rec.after; var dm=a.mrr-b.mrr; pushTicker('Revenue '+fm(a.mrr)+' a month ('+(dm>=0?'+':'-')+fm(Math.abs(dm))+')',dm>=0?'money':'bad');
  if(G.stat.newLast||G.stat.churnLast) pushTicker('+'+Math.round(G.stat.newLast||0)+' new, -'+Math.round(G.stat.churnLast||0)+' lost',(G.stat.newLast||0)>=(G.stat.churnLast||0)?'ship':'bad');
  (rec.shipped||[]).forEach(function(s){ pushTicker('Shipped: '+(s.name||s)+(s.result?'. '+s.result:''),'ship'); });
  G.inbox.filter(function(i){ return parseInt(i.id.slice(1),10)>S.seenIid && (i.kind==='person'||i.kind==='crisis'||i.kind==='opp'); }).slice(0,3).forEach(function(i){ pushTicker(i.title,i.kind==='crisis'?'bad':''); });
  (rec.newGoals||[]).forEach(function(g){ pushTicker('Goal reached: '+g.title+'. '+g.reward,'goal'); Iso.banner('Goal reached: '+g.title,'#7048e8',4); UI.sfx('goal'); });
  if(rec.hired&&rec.hired.length) UI.sfx('hire');
  (G.rankUps||[]).forEach(function(r){ pushTicker(r.name+' is now a '+r.rank+'.','goal'); Iso.say&&Iso.say(r.id,r.rank+'!'); }); G.rankUps=[];
  var lvUp=SU.Level.check(G); if(lvUp){ var lv=SU.LEVELS[lvUp-1]; pushTicker('Level '+lvUp+': '+lv.title+'.','goal'); Iso.banner('Level '+lvUp+': '+lv.title,'#f59f00',4.5); UI.sfx('goal'); S.lvlPop=true; }
  refreshAll(); Iso.sync(G);
  if(G.over){ setTimeout(function(){ UI.showEnd(); },700); return; }
  var blk=blockers(rec);
  if(S.auto.on){
    if(blk.length){ S.auto.on=false; renderPlan(); UI.toast('Paused: '+blk[0],4200); S.tab=blk.tab||'inbox'; UI.renderTabs(); }
    else setTimeout(function(){ if(S.auto.on) UI.run(); },Math.round(300/S.auto.speed));
  } else {
    if(blk.length){ S.tab=blk.tab||'inbox'; UI.renderTabs(); }
    UI.showReport();
  }
}
function blockers(rec){
  var out=[]; out.tab='inbox';
  G.inbox.forEach(function(i){ if(!i.open) return; var n=parseInt(i.id.slice(1),10); if(n<=S.seenIid) return; if(i.action){ out.push(i.title); } else if(i.kind==='crisis'||i.kind==='signal'){ out.push(i.title); } });
  if(rec.actBanner){ out.push('A new act begins: '+rec.actBanner.name); }
  if(G.lastStand) out.push('Payroll Friday: you are out of cash');
  var f=SU.fin(G); if(f.burn>0 && f.runway<2.5 && !S.warnedRunway){ S.warnedRunway=true; out.push('Less than 3 months of cash left'); } if(f.runway>=4||f.burn<=0) S.warnedRunway=false;
  return out;
}
UI.toggleAuto=function(){
  if(!G||G.over) return; S.auto.on=!S.auto.on; renderPlan(); if(S.auto.on){ if(!S.busy) UI.run(); UI.toast('Auto-run on. It pauses when something needs you.',2400); } else UI.toast('Auto-run off.',1600);
};

/* ------------------------------------------------------------ tabs (rendering lives in ui2) */
UI.renderTabs=function(){
  if(!G||!$('#tabs')) return;
  var urgent=G.inbox.filter(function(i){ return i.open&&(i.kind==='crisis'||i.kind==='signal'||i.action||(i.kind==='opp'&&i.t>=G.t-1)); }).length;
  var tabs=TABS.filter(function(t){ return t[0]!=='dash'||(G.feat&&G.feat.dashboard); });
  if(!tabs.some(function(t){ return t[0]===S.tab; })) S.tab='customers';
  $('#tabs').innerHTML=tabs.map(function(t){ return '<button class="tb'+(S.tab===t[0]?' on':'')+'" role="tab" aria-selected="'+(S.tab===t[0])+'" data-act="tab" data-tab="'+t[0]+'" title="'+t[1]+'">'+UI.icon(t[2])+'<span>'+t[1]+'</span>'+(t[0]==='inbox'&&urgent?'<span class="badge">'+urgent+'</span>':'')+'</button>'; }).join('');
  UI.renderPane();
};

/* ------------------------------------------------------------ office interaction */
function onIsoHover(info,x,y){
  var tip=$('#tip'); if(!tip) return; if(!info){ tip.hidden=true; return; }
  var t=isoLabel(info); if(!t){ tip.hidden=true; return; }
  tip.innerHTML=t; tip.hidden=false; var st=$('.office .stage'); tip.style.left=Math.max(80,Math.min(st.clientWidth-80,x))+'px'; tip.style.top=y+'px';
}
function isoLabel(info){
  var p=info.person;
  if(info.kind==='you') return '<b>'+esc(G.founder.name||'You')+'</b>You. Sanity '+Math.round(G.founder.sanity)+'.';
  if(info.kind==='co'&&G.co) return '<b>'+esc(G.co.name)+'</b>Cofounder. Bond '+Math.round(G.co.bond)+'.';
  if((info.kind==='emp'||info.kind==='person')&&p){ var e=G.team.filter(function(x){ return x.id===p.id; })[0]; return e? '<b>'+esc(e.name)+'</b>'+esc(SU.ROLES[e.role].name)+', loyalty '+Math.round(e.loyalty) : null; }
  if(info.kind==='customer') return '<b>A customer</b>Dropped by to see how it is going.';
  if(info.kind==='investor') return '<b>An investor</b>Here to see the company.';
  if(info.kind==='board') return '<b>Customer wall</b>'+SU.custCount(G)+' so far. Click for customers.';
  if(info.kind==='roadmap') return '<b>Roadmap</b>What you are building. Click for the product.';
  if(info.kind==='tv') return '<b>Dashboard</b>Runway and revenue. Click for money.';
  if(info.kind==='door') return '<b>Front door</b>Click to open the inbox.';
  if(info.kind==='rack') return '<b>Servers</b>'+(G.incidents?G.incidents+' incident(s) so far.':'Quiet, for now.');
  if(info.kind==='dog') return '<b>Biscuit</b>Office dog. Morale booster.';
  if(info.kind==='coffee') return '<b>Coffee</b>The real runway.';
  if(info.kind==='desk') return info.mine?'<b>Your desk</b>':'<b>A desk</b>';
  return null;
}
function onIsoPick(info,x,y){
  var tip=$('#tip'); if(tip) tip.hidden=true; var k=info.kind;
  if(k==='board'){ UI.setTab('customers'); return; } if(k==='roadmap'){ UI.setTab('product'); return; } if(k==='tv'){ UI.setTab(G.feat&&G.feat.dashboard?'dash':'money'); return; } if(k==='door'){ UI.setTab('inbox'); return; }
  if(k==='dog'){ Iso.fx.hearts(Iso.person('dog')); UI.toast('Biscuit approves.'); return; }
  if(k==='you'||k==='co'||k==='emp'||k==='person'){ showPop(info,x,y); return; }
  if(k==='rack'){ UI.toast('Tech debt '+Math.round(G.D)+'. Product quality '+Math.round(G.Q)+'. '+(G.incidents?G.incidents+' incident(s).':'No incidents.')); return; }
}
function showPop(info,x,y){
  var pop=$('#pop'); var p=info.person; var h='';
  if(info.kind==='you'){ h='<h4>'+esc(G.founder.name||'You')+'</h4><div class="sm muted">'+esc(G.founder.bg.name)+'</div><div class="sec" style="margin-top:6px"><div class="k">Sanity</div><div class="bar '+(G.founder.sanity<35?'bad':G.founder.sanity<60?'warn':'good')+'"><i style="width:'+Math.round(G.founder.sanity)+'%"></i></div><div class="sm">Perk: '+esc(G.founder.bg.perk)+'. Flaw: '+esc(G.founder.bg.flaw)+'.</div></div><div class="row" style="margin-top:7px"><button class="btn sm" data-act="pop-add" data-aid="self" data-k="kind" data-v="weekend">Weekend off</button><button class="btn sm ghost" data-act="close-pop">Close</button></div>'; }
  else if(info.kind==='co'&&G.co){ h='<h4>'+esc(G.co.name)+'</h4><div class="sm muted">Cofounder. '+esc(G.co.arch)+'</div><div class="sec" style="margin-top:6px"><div class="k">Bond</div><div class="bar '+(G.co.bond<40?'bad':G.co.bond<65?'warn':'good')+'"><i style="width:'+Math.round(G.co.bond)+'%"></i></div><div class="sm">'+esc(G.co.trait)+'</div><div class="quote">"'+esc(G.co.voice)+'"</div></div><div class="row" style="margin-top:7px"><button class="btn sm" data-act="pop-add" data-aid="talkcofounder">Talk it out</button><button class="btn sm ghost" data-act="close-pop">Close</button></div>'; }
  else { var e=G.team.filter(function(x){ return p&&x.id===p.id; })[0]; if(!e) return;
    h='<h4>'+esc(e.name)+'</h4><div class="sm muted">'+(e.level!=='mid'?SU.cap1(e.level)+' ':'')+esc(SU.ROLES[e.role].name)+' &middot; '+fm(e.sal)+'/yr</div><div class="sec" style="margin-top:6px;gap:3px"><div class="xs muted">'+SU.rankOf(e).name+' &middot; skill '+SU.skillRating(e)+'</div><div class="k">Energy</div><div class="bar '+(SU.energyOf(e)<35?'bad':SU.energyOf(e)<60?'warn':'good')+'"><i style="width:'+Math.round(SU.energyOf(e))+'%"></i></div><div class="k">Loyalty</div><div class="bar '+(e.loyalty<45?'bad':e.loyalty<65?'warn':'good')+'"><i style="width:'+Math.round(e.loyalty)+'%"></i></div>'+(e.trait?'<div class="sm"><b>'+esc(SU.TRAITS[e.trait].name)+'.</b> '+esc(SU.TRAITS[e.trait].desc||'')+'</div>':'')+'</div><div class="row" style="margin-top:7px"><button class="btn sm" data-act="person" data-id="'+e.id+'">Manage</button><button class="btn sm ghost" data-act="close-pop">Close</button></div>'; }
  pop.innerHTML=h; pop.hidden=false; var st=$('.office .stage'); var w=st.clientWidth; pop.style.left=Math.max(8,Math.min(w-pop.offsetWidth-8,x-pop.offsetWidth/2))+'px'; pop.style.top=Math.max(8,Math.min(st.clientHeight-pop.offsetHeight-8,y+10))+'px';
}
UI.setTab=function(t){ S.tab=t; S.drawer=null; setSheet(true); UI.renderTabs(); };

/* ------------------------------------------------------------ help, menu, import */
UI.showHelp=function(first){
  UI.modal('<h2>How Runway works</h2>'+
  '<p>You run a startup. Each month you pick a few moves from the menus on the right, then press <b>Run</b>. A month goes by, the office reacts, and you see what happened.</p>'+
  '<div class="sec"><h4>The rules that matter</h4>'+
  '<p class="sm"><b>1. Focus is limited.</b> You have about ten focus points a month. Every move costs some. Plan it, then run.</p>'+
  '<p class="sm"><b>2. Talk to customers first.</b> Interviews reveal what people pay for. Then build exactly that. Every feature card tells you what it does.</p>'+
  '<p class="sm"><b>3. Watch the runway.</b> The dashes at the top are months of cash left. When they run out, you run out.</p>'+
  '<p class="sm"><b>4. Pin what works.</b> Hit the repeat icon on a move and it happens every month without using up your clicks. Auto-run plays the months for you and stops when something needs you.</p>'+
  '<p class="sm"><b>5. Spend on the office.</b> The Shop gives you a bigger space and upgrades. You will see every one of them in the office.</p></div>'+
  '<div class="sec"><h4>How it ends</h4><p class="sm">Ring the bell, sell the company, go profitable and free, burn out, or shut down. Most startups die. Yours might not.</p></div>'+
  '<div class="foot"><button class="btn primary" data-act="close-modal">'+(first?'Let me play':'Got it')+'</button></div>');
};
UI.showMenu=function(){
  UI.modal('<h2>Menu</h2><div class="sec" style="gap:7px"><button class="btn" data-act="help">How it works</button><button class="btn" data-act="export">Copy a save code</button><button class="btn" data-act="import">Load a save code</button><button class="btn" data-act="mute">'+(S.mute?'Turn sound on':'Turn sound off')+'</button><button class="btn" data-act="summary">Copy a summary to share</button>'+(S.aiOk&&SU.AI?'<button class="btn" data-act="ai-advice">Ask Claude for advice</button>':'')+'<button class="btn danger" data-act="new">Start a new company</button></div>');
};
UI.showImport=function(){
  UI.modal('<h2>Load a save code</h2><p class="sm muted">Paste a code you copied from the menu. It replaces the game you are in.</p><div class="field"><label for="imp">Save code</label><input id="imp" type="text" placeholder="RUNWAY1:..."></div><div class="foot"><button class="btn ghost" data-act="close-modal">Cancel</button><button class="btn primary" data-act="import-go">Load it</button></div>');
};
function copyText(t,okMsg){
  var done=function(){ UI.toast(okMsg||'Copied.'); };
  try{ navigator.clipboard.writeText(t).then(done,function(){ fallbackCopy(t); }); }catch(e){ fallbackCopy(t); }
}
function fallbackCopy(t){ UI.modal('<h2>Copy this</h2><div class="field"><input id="cp" type="text" readonly value="'+esc(t)+'"></div><div class="foot"><button class="btn primary" data-act="close-modal">Done</button></div>'); var a=$('#cp'); if(a){ a.focus(); a.select(); } }
UI.copyText=copyText;
UI.summary=function(){
  var o=G.over; var l=[]; l.push('RUNWAY: '+G.name+' ('+G.idea.tag+')'); l.push(SU.dateStr(G)+', started '+G.startYear+', '+G.t+' turns');
  l.push('Cash '+fm(G.cash)+', revenue '+fm(G.mrr||0)+'/mo, '+SU.custCount(G)+' customers, raised '+fm(G.rounds.reduce(function(a,r){ return a+r.amount; },0)));
  if(o) l.push('Ending: '+o.title+', score '+o.score); return l.join('\n');
};

/* ------------------------------------------------------------ click router */
function onClick(e){
  var t=e.target.closest('[data-act]'); if(!t) return; var a=t.getAttribute('data-act');
  if(t.tagName==='BUTTON') UI.sfx('tick');
  switch(a){
    case 'start': startGame(); break;
    case 'continue': var g=SU.load(); if(g) begin(g,false); break;
    case 'help': UI.closeModal(); UI.showHelp(false); break;
    case 'close-modal': UI.closeModal(); break;
    case 'close-pop': $('#pop').hidden=true; break;
    case 'wiz': S.wiz=+t.getAttribute('data-i'); renderWiz(); break;
    case 'pick-idea': S.setup.idea=t.getAttribute('data-id'); renderWiz(); heroSync(); break;
    case 'pick-era': S.setup.era=t.getAttribute('data-id'); renderWiz(); heroSync(); break;
    case 'pick-co': S.setup.co=t.getAttribute('data-id')||null; renderWiz(); heroSync(); break;
    case 'pick-bg': S.setup.bg=t.getAttribute('data-id'); renderWiz(); break;
    case 'pick-split': S.setup.split=parseFloat(t.getAttribute('data-v')); renderWiz(); break;
    case 'daily': S.setup.daily=!S.setup.daily; renderWiz(); break;
    case 'import': UI.closeModal(); UI.showImport(); break;
    case 'import-go': try{ var g2=SU.importText($('#imp').value); UI.closeModal(); SU.save(g2); begin(g2,false); UI.toast('Loaded.'); }catch(err){ UI.toast('That code did not work.'); } break;
    case 'menu': UI.showMenu(); break;
    case 'export': UI.closeModal(); copyText(SU.exportText(G),'Save code copied. Keep it somewhere safe.'); break;
    case 'summary': UI.closeModal(); copyText(UI.summary(),'Summary copied.'); break;
    case 'mute': S.mute=!S.mute; store('mute',S.mute?'1':'0'); UI.closeModal(); UI.toast(S.mute?'Sound off.':'Sound on.'); break;
    case 'new': UI.closeModal(); G=null; S.auto.on=false; Iso.reset(); renderSetup(); break;
    case 'run': UI.run(); break;
    case 'auto': UI.toggleAuto(); break;
    case 'speed': S.auto.speed=+t.getAttribute('data-v'); renderPlan(); break;
    case 'clear-plan': S.plan=[]; renderPlan(); break;
    case 'unplan': var u=+t.getAttribute('data-uid'); S.plan=S.plan.filter(function(x){ return x.uid!==u; }); renderPlan(); break;
    case 'pin': var u2=+t.getAttribute('data-uid'); S.plan.forEach(function(x){ if(x.uid===u2) x.repeat=!x.repeat; }); renderPlan(); UI.toast('Repeats every month until you remove it.',1800); break;
    case 'coach-add': var c=S.ideas&&S.ideas[+t.getAttribute('data-i')]; if(c) UI.addItem({aid:c.aid,values:JSON.parse(JSON.stringify(c.values))}); break;
    case 'golvl': UI.setTab('goals'); break;
    case 'tab': { var nt=t.getAttribute('data-tab'); if(isPhone()&&S.sheet&&S.tab===nt&&!S.drawer){ setSheet(false); } else { S.tab=nt; S.drawer=null; setSheet(true); } UI.renderTabs(); break; }
    case 'pop-add': var pa=t.getAttribute('data-aid'); var pv={}; if(t.getAttribute('data-k')) pv[t.getAttribute('data-k')]=t.getAttribute('data-v'); UI.addItem({aid:pa,values:CAT.defaults(G,pa,pv)}); $('#pop').hidden=true; break;
    case 'ai-advice': UI.closeModal(); if(SU.AI) SU.AI.advice(); break;
    default: if(UI.onAct) UI.onAct(a,t,e);
  }
}
function onInput(e){
  var t=e.target;
  if(t.id==='f-name') S.setup.name=t.value; else if(t.id==='f-co') S.setup.company=t.value;
  else if(UI.onInput) UI.onInput(e);
}
window.addEventListener('resize',function(){ if(S.view==='game') setTimeout(function(){ Iso.resize(); },30); });
})();
