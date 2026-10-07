/* RUNWAY - simulation: new game, product, hidden market truth, demand per business model, money, people, rivals, monthly step. */
(function(){
var SU = (window.SU = window.SU || {});
var clamp=SU.clamp, lerp=SU.lerp, rnd=SU.rnd;

SU.START = {'1999':{y:1999,m:1},'2008':{y:2008,m:1},'2021':{y:2021,m:1},'2024':{y:2024,m:1}};
SU.START_INFO = {
  '1999':{name:'Jan 1999',blurb:'Dot-com mania. Money is everywhere. You know what comes next.'},
  '2008':{name:'Jan 2008',blurb:'Fine for eight months, then the crash.'},
  '2021':{name:'Jan 2021',blurb:'Zero-rate boom. Tourists with checkbooks. Enjoy it.'},
  '2024':{name:'Jan 2024',blurb:'The AI boom. Everyone wants a wrapper, and everyone fears one.'}
};
SU.FOCUS_BASE = {1:10,2:10,3:12,4:14,5:14};

/* ------------------------------------------------------------ helpers */
SU.seg = function(G){ return SU.SEG[G.segId]; };
SU.headcount = function(G){ return 1+(G.co?1:0)+G.team.length; };
SU.drv = function(G,metric,delta,cause){ if(!G.drv) G.drv=[]; G.drv.push({m:metric,d:delta,c:cause}); };
SU.journal = function(G,text,kind,moment){ G.journal.push({t:G.t,date:SU.dateStr(G),text:text,kind:kind||'note',moment:!!moment}); if(G.journal.length>400) G.journal.shift(); if(moment) G.moments.push({t:G.t,text:text}); };
SU.inbox = function(G,item){ item.id='i'+(++G.iid); item.t=G.t; item.date=SU.dateStr(G); item.open=true; G.inbox.unshift(item); if(G.inbox.length>40) G.inbox.length=40; return item; };
SU.salaryFor = function(G,role,level){ var E=SU.era(G); return Math.round(SU.ROLES[role].sal[level]*E.salaryIdx/1000)*1000; };
function count(G,role){ var n=0; G.team.forEach(function(e){ if(e.role===role) n++; }); return n; }
SU.count = count;
SU.growthMo = function(G){ var h=G.mrrHist, n=h.length; if(n<4) return 0; var a=h[n-4], b=h[n-1]; if(a<=0) return b>0?0.3:0; return Math.pow(Math.max(b,1)/a,1/3)-1; };
SU.arr = function(G){ return (G.mrr||0)*12; };
SU.custCount = function(G){ var c=G.cust; return G.arch==='smb'?c.n : G.arch==='consumer'?c.payers : Math.round(c.S+c.D); };

/* ------------------------------------------------------------ new game */
function rollNeeds(G){
  var S=SU.SEG[G.segId], list=SU.shuffle(G,S.needs.slice(),'market');
  var nTrue = S.arch==='smb'?SU.int(G,3,4,'market'):3;
  G.needs = list.map(function(n,i){ return {id:n.id,name:n.name,kw:n.kw,real:i<nTrue,w:i<nTrue?SU.int(G,1,3,'market'):0,herring:false,revealed:false,cov:0}; });
  S.herrings.slice(0,2).forEach(function(h){ G.needs.push({id:h.id,name:h.name,kw:h.kw,real:false,w:0,herring:true,revealed:false,cov:0}); });
}
SU.makeEmployee = function(G, role, level, sal, eq, opts){
  opts=opts||{};
  var tr = SU.chance(G,0.55,'people') ? SU.pick(G,SU.TRAIT_IDS,'people') : null;
  if(role==='eng' && tr==='rainmaker') tr='night'; if(role!=='eng' && tr==='night') tr='glue';
  if(role!=='sdr'&&role!=='ae'&&tr==='rainmaker') tr='spreadsheet';
  var a=[SU.rnd(G,'people'),SU.rnd(G,'people'),SU.rnd(G,'people'),SU.rnd(G,'people')], tot=a[0]+a[1]+a[2]+a[3];
  var e={id:'e'+(++G.eid), name:SU.fullName(G,'people'), role:role, level:level, sal:sal, eq:eq, trait:tr, want:SU.pick(G,SU.WANTS,'people'),
    loyalty:70, energy:85, xp:0, joinMi:G.mi, axes:{mission:a[0]/tot,pay:a[1]/tot,autonomy:a[2]/tot,stability:a[3]/tot}, mem:[],
    look:{skin:SU.int(G,0,4,'people'),hair:SU.int(G,0,5,'people'),color:SU.int(G,0,7,'people'),f:SU.chance(G,0.45,'people')}};
  e.skill=Math.round(clamp(1+0.13*SU.randn(G,'people'),0.78,1.28)*100)/100;
  return e;
};
SU.newGame = function(o){
  o=o||{};
  var seed=o.seed||(Math.floor(Math.random()*2147483646)+1);
  var G={v:SU.VERSION,seed:seed,t:0,mi:0,iid:0,fid:0,eid:0,rid:0,act:1,over:null,drv:[],journal:[],inbox:[],feed:[],moments:[],team:[],reqs:[],queue:[],shipped:[],
    pend:{outbound:[],launch:[]},flags:{},stat:{},launches:{},mrrHist:[],claims:[],promises:[],achv:[],ev:{open:[],cool:{},sched:[],hist:[]},rivals:[],round:null,rounds:[],loans:{},lastStand:false,seo:0,incidents:0,bloat:0,whip:0,refactorPts:0,shock:0};
  SU.rngInit(G,seed);
  var idea=SU.IDEAS.filter(function(i){ return i.id===o.ideaId; })[0]||SU.IDEAS[0];
  G.idea=idea; G.ideaId=idea.id; G.arch=idea.arch; G.segId=idea.segId; G.name=o.company||idea.name;
  var sk=SU.START[o.startKey||'2024']||SU.START['2024']; G.startKey=o.startKey||'2024'; G.year=sk.y; G.month=sk.m; G.startYear=sk.y;
  var S=SU.SEG[G.segId], A=SU.ARCH_START[G.arch];
  var bg=SU.BACKGROUNDS.filter(function(b){ return b.id===o.bgId; })[0]||SU.BACKGROUNDS[0];
  G.founder={name:o.name||'You',bg:{id:bg.id,name:bg.name,flags:bg.flags||{},perk:bg.perk,flaw:bg.flaw},skills:{p:bg.skills.p,t:bg.skills.t,s:bg.skills.s,c:bg.skills.c},sanity:bg.sanity,cred:bg.cred,pay:0};
  var cf=SU.COFOUNDERS.filter(function(c){ return c.id===o.cofounder; })[0];
  if(cf){ G.co={id:'co',cid:cf.id,name:cf.name,arch:cf.arch,skills:{p:cf.skills.p,t:cf.skills.t,s:cf.skills.s,c:cf.skills.c},trait:cf.trait,wants:cf.wants,likes:cf.likes,dislikes:cf.dislikes,flags:cf.flags,voice:cf.voice,bond:60+(o.split===0.5?5:o.split>=0.8?-20:o.split>=0.7?-10:0),mem:[],look:{skin:SU.int(G,0,4,'people'),hair:SU.int(G,0,5,'people'),color:8+SU.int(G,0,2,'people'),f:cf.id==='nadia'}}; }
  else G.co=null;
  G.cash=Math.round((A.cash+bg.cash)/2/100)*100; G.cash0=G.cash;
  G.fixed=A.fixed; G.Q=A.Q; G.D=5; G.hype=10; G.morale=75; G.insight=(bg.flags&&bg.flags.insight)||0; G.ethics=0; G.reg=0; G.mrr=0;
  G.trust={cust:50,inv:50+((bg.flags&&bg.flags.warmIntro)?5:0),emp:60,press:50};
  G.orders={ads:0,content:0,social:0,events:0,referral:0,ua:0,culture:{remote:false,hybrid:false,office:false,fourday:false,crunch:0,perks:false,pto:false},therapy:false};
  rollNeeds(G);
  G.wtpMed = S.wtp*clamp(Math.exp(0.25*SU.randn(G,'market')),0.62,1.5);
  G.wtpBand = 0.5; G.pmfOff=(SU.rnd(G,'market')-0.5)*1.2; G.tam=0.35+0.6*SU.rnd(G,'market'); G.viral=clamp(Math.exp(0.5*SU.randn(G,'market')),0.55,2.4);
  if(G.arch==='smb') G.cust={n:0,price:S.defaultPrice,annual:false,freemium:false,free:0,pipe:0,shock:0};
  else if(G.arch==='consumer') G.cust={mau:150,payers:0,price:S.defaultPrice,model:'freemium',annual:false,installsLast:0,rev12:[],shock:0};
  else G.cust={S:6,D:30,take:S.takeDefault,aov:S.aov,orders:0,gmv:0,subD:0,subS:0,shock:0};
  /* rivals */
  var ids=['krellix','mirrormint','slowoak'];
  ids.forEach(function(id){ var r=SU.rivalById(id); G.rivals.push({id:id,name:r.name,boss:r.boss,persona:r.persona,cash:r.cash,burn:r.burn,Q:r.Q,price:r.price,hype:r.hype,ethics:r.ethics,growth:r.growth,presence:id==='krellix'?0.4:id==='mirrormint'?0.0:0.2,active:id!=='mirrormint',respect:0,grudge:0,mem:[],raised:0}); });
  SU.Money.initCap(G, o.split||0.5);
  G.pmf=SU.pmfStar(G);
  G.mrrHist=[0]; G.burnHist=[];
  SU.journal(G,'You started '+G.name+': '+idea.tag+'.','start',true);
  SU.inbox(G,{kind:'info',title:'Day one',body:'You have '+SU.fmtMoney(G.cash)+' and a real problem to solve. Interview customers before you build anything. Pick what you will do this month, then press Run.',chips:[{label:'Talk to 10 customers',text:'interview 10 '+(S.words[0]||'customers')+' and ask what they pay for'},{label:'Build an MVP',text:'build an MVP in 6 weeks'},{label:'Take a breath',text:'take the weekend off'}]});
  if(G.co){ SU.inbox(G,{kind:'person',title:G.co.name+' is on board',body:G.co.name+', '+G.co.arch+'. '+G.co.trait+'. Wants: '+G.co.wants+'.'}); }
  G.space='garage'; G.shop={}; G.goals={}; G.focusBonus=0; G.feat={}; G.cands=[]; G.board=G.board||{};
  G.rec=null;
  return G;
};

/* ------------------------------------------------------------ hidden truth: PMF */
SU.needCov = function(G){ var num=0,den=0; G.needs.forEach(function(n){ if(n.real){ num+=n.w*n.cov; den+=n.w; } }); return den? num/den : 0; };
SU.priceFit = function(G){
  var S=SU.seg(G), c=G.cust;
  if(G.arch==='market'){ var tol=S.takeTol; return clamp(1-Math.max(0,c.take-tol)/tol*1.4 - Math.max(0,(0.06-c.take))*3,0,1); }
  return clamp(1-Math.abs(Math.log(Math.max(0.01,c.price)/G.wtpMed))/1.2,0,1);
};
SU.chanFit = function(G){
  var S=SU.seg(G), o=G.orders, a=[];
  ['ads','content','social','events','referral'].forEach(function(ch){ if(o[ch]>0) a.push(S.aff[ch]*Math.min(1,o[ch]/(ch==='content'?800:ch==='events'?1500:1000))); });
  if(G.stat.sentLast>0) a.push(S.aff.outbound*Math.min(1,G.stat.sentLast/200));
  if(G.stat.launchLast) a.push(S.aff.launch*0.6);
  if(G.orders.ua>0) a.push(S.aff.ads*Math.min(1,G.orders.ua/2000));
  a.sort(function(x,y){ return y-x; });
  return clamp(((a[0]||0)+(a[1]||0))/1.4,0,1);
};
SU.pmfStar = function(G){
  var P = 100*(0.40*SU.needCov(G)+0.20*G.Q/100+0.20*SU.priceFit(G)+0.10*(G.splitSeg?0.5:1)+0.10*SU.chanFit(G)) - Math.min(20,G.bloat) - 5*G.whip;
  return clamp(P,0,100);
};
SU.pmfBand = function(G){
  var half=Math.max(5,30-0.25*G.insight); var c=G.pmf+G.pmfOff*half*0.5;
  return {lo:Math.round(clamp(c-half,0,100)),hi:Math.round(clamp(c+half,0,100)),half:half};
};
var convF=function(G){ return lerp(0.4,1.6,G.pmf/100); };
var featN=function(G,k){ return (G.feat&&G.feat[k])?1:0; };
SU.featN=featN;
var featChurn=function(G){ return (1-0.12*featN(G,'onboarding'))*(1-0.05*featN(G,'mobile')); };
var churnF=function(G){ return lerp(1.8,0.5,G.pmf/100)*featChurn(G); };
SU.featChurn=featChurn;
SU.convF=convF; SU.churnF=churnF;
function priceF(G){
  var S=SU.seg(G), c=G.cust;
  if(G.arch==='market') return clamp(Math.pow(S.takeTol/Math.max(0.03,c.take),0.8),0.3,1.6);
  var elas=0.4+1.4*S.priceSens; return clamp(Math.pow(G.wtpMed/Math.max(0.01,c.price),elas),0.25,2.0);
}
SU.priceF=priceF;
function gateF(G){ var id=G.segId; if(id==='finance' && !G.flags.soc2) return (G.feat&&G.feat.sso)?0.85:0.6; if(id==='practice' && !G.flags.hipaa && G.cust.n>30) return 0.85; return 1; }
function salesSkill(G){ var s=G.founder.skills.s*(G.founder.bg.flags.salesMult||1); if(G.co) s=Math.max(s,G.co.skills.s); return s; }
function mktF(G){ var m=0, n=0; G.team.forEach(function(e){ if(e.role==='mkt' && n<3){ m+=(e.skill||1)*SU.energyF(e)*SU.rampPct(G,e); n++; } }); return 1+0.15*m; }
SU.mktF=mktF;
function closeMult(G){ var ae=0, n=0; G.team.forEach(function(e){ if(e.role==='ae' && n<3){ ae+=(e.skill||1); n++; } }); return (G.co&&G.co.flags.closeMult||1)*(1+0.12*ae)*(1+0.12*featN(G,'integrations')+0.05*featN(G,'sso')); }
SU.compF = function(G){
  var S=SU.seg(G), you=0.5*G.Q+15*Math.log(1/Math.max(0.3,priceRel(G)))+0.2*G.hype+10*(G.splitSeg?0.5:1), tot=0;
  G.rivals.forEach(function(r){ if(!r.active||r.presence<=0) return; var U=0.5*r.Q+15*Math.log(1/Math.max(0.3,r.price))+0.2*r.hype+10; tot+=r.presence*0.5/(1+Math.exp(-(U-you)/10)); });
  return clamp(1-tot,0.35,1);
};
function priceRel(G){ var S=SU.seg(G); if(G.arch==='market') return G.cust.take/S.takeDefault; return G.cust.price/S.defaultPrice; }

/* ------------------------------------------------------------ people */
/* ------------------------------------------------------------ people: stats, energy, experience, rank */
SU.RANKS=[{xp:0,name:'Rookie'},{xp:6,name:'Regular'},{xp:15,name:'Veteran'},{xp:30,name:'Star'},{xp:50,name:'Legend'}];
SU.rankOf=function(e){ var xp=e.xp||0, r=0; SU.RANKS.forEach(function(x,i){ if(xp>=x.xp) r=i; }); return {i:r,name:SU.RANKS[r].name,next:SU.RANKS[r+1]||null,xp:xp,from:SU.RANKS[r].xp}; };
SU.energyOf=function(e){ return e.energy==null?85:e.energy; };
SU.energyF=function(e){ return 0.9+0.15*(SU.energyOf(e)/100); };
SU.skillRating=function(e){ return Math.round(clamp(((e.skill||1)-0.7)/0.75,0,1)*100); };
SU.rampPct=function(G,e){ var r=(SU.ROLES[e.role].ramp[e.level])||3; return clamp((G.mi-e.joinMi)/r,0,1); };
SU.empVel=function(G,e){ var ramp=Math.min(1,(G.mi-e.joinMi)/SU.ROLES.eng.ramp[e.level]); var tv=e.trait&&SU.TRAITS[e.trait].vel||1; var q=(e.trait==='quiet'&&G.mi-e.joinMi>6)?0.6:1; return SU.LEVEL_MULT[e.level]*ramp*tv*q*(e.skill||1)*SU.energyF(e); };
SU.attrRisk3=function(G,e){ var tenure=G.mi-e.joinMi; var tm=e.trait&&SU.TRAITS[e.trait].attr||1; var p=0.018*attritionF(G.morale)*tm*(tenure===12?2:1)*(tenure<3?0.3:1)*(e.loyalty<45?1.5:1)*(SU.energyOf(e)<25?1.5:1); p=clamp(p,0,0.95); return 1-Math.pow(1-p,3); };
/* does this job help in this game right now? used by the hire screen and the roles guide */
SU.roleFit=function(G,role){
  var spend=G.orders.ads+G.orders.content+G.orders.social+G.orders.events+G.orders.ua+G.orders.referral;
  if(role==='design'||role==='pm'){ return count(G,'eng')>0 ? {state:'ok',why:'You have engineers to multiply.'} : {state:'no',why:'You have no engineers yet, so there is nothing to multiply. Hire an engineer first.'}; }
  if(role==='ae') return G.arch==='smb' ? {state:'ok',why:'You sell to businesses, so closers matter.'} : {state:'no',why:'Account execs only close business deals. Your product is not sold that way, so they would do nothing.'};
  if(role==='sdr') return G.arch==='consumer' ? {state:'no',why:'Outreach does not work on consumers. SDRs would do nothing for you.'} : {state:'ok',why:'Outreach works on your customers.'};
  if(role==='mkt') return (spend>0||G.seo>0) ? {state:'ok',why:'You are spending on marketing: they make it work harder.'} : {state:'maybe',why:'You are not spending on any marketing channel yet. A marketer needs spend to multiply.'};
  if(role==='cs'){ var cap=300+150*count(G,'cs'), n=SU.custCount(G); return n>cap*0.7 ? {state:'ok',why:'You have '+SU.fmtNum(n)+' customers against room for '+cap+'. Support is getting stretched.'} : {state:'maybe',why:'You have '+SU.fmtNum(n)+' customers and room for '+cap+'. You do not need more support yet.'}; }
  if(role==='mgr') return SU.headcount(G)>=2||G.t>6 ? {state:'ok',why:'An extra move every month, and your pinned moves run free.'} : {state:'maybe',why:'Works from day one, but pays off most once you repeat the same moves each month.'};
  if(role==='cos') return count(G,'cos')>0 ? {state:'no',why:'You already have a chief of staff. A second adds nothing.'} : {state:'ok',why:'Two more focus every month.'};
  if(role==='vp') return SU.headcount(G)>=10 ? {state:'ok',why:'A big team: a VP cuts the slowdown and impresses investors.'} : {state:'maybe',why:'Your team is small. A VP is expensive and mostly helps past 10 people.'};
  return {state:'ok',why:'Always useful.'};
};
SU.wantStatus=function(G,e){
  var w=e.want, mk=SU.salaryFor(G,e.role,e.level), ok=true, why='';
  if(w==='pay'){ ok=e.sal>=mk*1.03; why=ok?'Paid above market.':'Paid '+Math.round((1-e.sal/mk)*100)+'% under market.'; }
  else if(w==='title'){ ok=(e.level==='senior'||e.level==='staff'); why=ok?'Has a senior title.':'Still waiting on a bigger title.'; }
  else if(w==='mission'){ ok=G.pmf>=50; why=ok?'Believes in where this is going.':'Not sure the product is working yet.'; }
  else if(w==='autonomy'){ var cu=G.orders&&G.orders.culture||{}; ok=!!(cu.remote||cu.fourday||cu.pto)&&!cu.office; why=ok?'Has room to work their way.':'Wants more freedom: try a work policy.'; }
  else if(w==='stability'){ var f=SU.fin(G); ok=f.burn<=0||f.runway>=9; why=ok?'Feels the company is safe.':'Nervous about the cash runway.'; }
  return {ok:ok,why:why};
};
/* monthly: energy moves with crunch, crowding, mood and perks; skill grows with experience; ranks are earned */
SU.staffStep=function(G){
  var mentor=G.team.some(function(e){ return e.trait==='mentor'; }), crunch=G.orders&&G.orders.culture&&G.orders.culture.crunch>0, over=SU.Shop?SU.Shop.over(G):0, perk=SU.Shop?SU.Shop.sanity(G):0, shipped=G.flags&&G.flags.shipMi===G.mi;
  G.rankUps=G.rankUps||[];
  G.team.forEach(function(e){
    var en=SU.energyOf(e), tr=e.trait&&SU.TRAITS[e.trait]||{};
    var d=3+Math.min(2,count(G,'mgr'))+(G.morale-60)/15+perk*1.5-1.5*over-(crunch?9*(tr.crunchOk?0.4:1):0);
    e.energy=clamp(en+d,0,100);
    if(e.energy<20) e.loyalty=clamp(e.loyalty-1.5,0,100);
    var before=SU.rankOf(e).i; e.xp=(e.xp||0)+1+(shipped?2:0);
    if(e.energy>=40) e.skill=Math.min(1.45,Math.round(((e.skill||1)+0.004*(mentor?1.5:1))*1000)/1000);
    var after=SU.rankOf(e); if(after.i>before){ e.loyalty=clamp(e.loyalty+4,0,100); G.rankUps.push({id:e.id,name:e.name,rank:after.name,role:e.role}); SU.journal(G,e.name+' is now a '+after.name+'.','people'); }
  });
};
SU.velocity = function(G){
  var E=0, moraleF=0.55+0.6*G.morale/100, debtF=1-G.D/200, flags=G.founder.bg.flags||{};
  SU._vshare={}; G.team.forEach(function(e){ if(e.role!=='eng') return; var c=SU.empVel(G,e); SU._vshare[e.id]=c; E+=c; });
  var fb=0.35*G.founder.skills.t*(1+(flags.buildBonus||0))*(flags.buildMult||1); E+=fb;
  if(G.co&&G.co.flags.cto) E+=1.5*G.co.skills.t/5*1.4; else if(G.co) E+=0.2*G.co.skills.t;
  var des=Math.min(count(G,'design'),3), pm=Math.min(count(G,'pm'),2); E*=1+0.1*des+0.05*pm;
  var reports=G.team.length; var orgF=1-0.03*Math.max(0,reports-8)*(count(G,'vp')>0?0.5:1);
  var crunch=G.orders.culture.crunch>0?1.25:1; var nightOwl=1; var whip=1-0.06*G.whip;
  var vm=(G.co&&G.co.flags.velMult)||1;
  var shopV=SU.Shop?SU.Shop.vel(G):1, cramp=SU.Shop?SU.Shop.crampedVel(G):1;
  return 2*E*moraleF*debtF*orgF*crunch*whip*vm*shopV*cramp;   /* points per month */
};
function moraleBase(G){
  var E=SU.era(G), payVs=0, n=0;
  G.team.forEach(function(e){ var mk=SU.salaryFor(G,e.role,e.level); payVs+=clamp((e.sal/Math.max(1,mk)-1)*2.5,-1,1); n++; });
  payVs = n? payVs/n : 0;
  var mission=clamp((G.pmf-40)/6,-10,10);
  var da=SU.fin(G).defaultAlive?5:-5;
  var cu=G.orders.culture; var fit=(cu.remote?3:0)+(cu.fourday?5:0)+(cu.perks?3:0)+(cu.pto?2:0)-(cu.office?2:0);
  var glue=0; G.team.forEach(function(e){ if(e.trait==='glue') glue+=4; }); if(G.co&&G.co.flags.moraleTeam) glue+=G.co.flags.moraleTeam;
  var eq=clamp((G.trust.emp-50)/6,-6,6);
  var shopM=SU.Shop?SU.Shop.morale(G):0, cramp=SU.Shop?SU.Shop.crampedMorale(G):0;
  return clamp(60+10*payVs+mission*0.5+da+fit+Math.min(glue,10)+eq+shopM-cramp - (G.ethics>30?3:0),20,95);
}
function attritionF(M){ return M<=20?2.5 : M<=60? 2.5+(1.0-2.5)*(M-20)/40 : M<=90? 1.0+(0.5-1.0)*(M-60)/30 : 0.5; }
var LEVELS=['junior','mid','senior','staff'];
SU.makeCandidates=function(G,r){
  var role=r.role, base=Math.max(1,SU.salaryFor(G,role,r.level)), li=LEVELS.indexOf(r.level), list=[];
  var steps=(role==='vp'||role==='cos')? [0,0,0] : [0,1,-1];
  steps.forEach(function(st,k){
    var idx=li+st; if(idx<0||idx>3) idx=li; var level=LEVELS[idx];
    var e=SU.makeEmployee(G,role,level,0,0);
    var ratio=SU.salaryFor(G,role,level)/base; var skillF=0.92+0.5*(e.skill-0.78)/0.5*0.16;
    e.sal=Math.round(r.comp*ratio*skillF/1000)*1000; e.eq=r.equity*(SU.ROLES[role].eq[level]/Math.max(1e-6,SU.ROLES[role].eq[r.level]));
    list.push(e);
  });
  return list;
};
SU.pickCandidate=function(G,cid,idx){
  var c=(G.cands||[]).filter(function(x){ return x.id===cid; })[0]; if(!c) return null; var e=c.list[idx]; if(!e) return null;
  var mk=SU.salaryFor(G,e.role,e.level); if(e.sal<mk*0.9) e.loyalty-=10; if(e.sal>mk*1.1) e.loyalty+=8; if(G.hype>50) e.loyalty+=5;
  e.joinMi=G.mi; G.team.push(e);
  var grant=Math.round(e.eq*SU.Money.fd(G)); if(grant>0 && G.cap.pool.unissued>=grant){ G.cap.pool.unissued-=grant; G.cap.pool.granted+=grant; e.shares=grant; } else e.shares=0;
  if(c.agency){ var fee=Math.round(c.comp*0.2); G.cash-=fee; SU.drv(G,'cash',-fee,'Recruiter fee'); }
  G.cands=G.cands.filter(function(x){ return x!==c; });
  G.inbox.forEach(function(i){ if(i.action&&i.action.type==='cands'&&i.action.id===cid) i.open=false; });
  SU.inbox(G,{kind:'person',title:e.name+' joined as '+(e.level==='mid'?'':SU.cap1(e.level)+' ')+SU.ROLES[e.role].name,body:(e.trait?SU.TRAITS[e.trait].name+'. ':'')+'Wants: '+e.want+'. Costs '+SU.fmtMoney(e.sal*1.3/12)+'/mo loaded.'});
  if(G.team.length===1) SU.journal(G,'First hire: '+e.name+' ('+SU.ROLES[e.role].name+').','hire',true); else SU.journal(G,e.name+' joined ('+SU.ROLES[e.role].name+').','hire');
  return e;
};
function hireFill(G,E){
  var speed=1; if(G.hype<15) speed*=0.77; else if(G.hype>60) speed*=1.4; if(E.key==='zero') speed*=0.7; if(E.key==='correction'||E.key==='crash'||E.key==='bust') speed*=1.4;
  var filled=[];
  (G.cands||[]).slice().forEach(function(c){ if(G.t>=c.exp){ G.cands=G.cands.filter(function(x){ return x!==c; }); G.inbox.forEach(function(i){ if(i.action&&i.action.type==='cands'&&i.action.id===c.id) i.open=false; }); SU.inbox(G,{kind:'info',title:'The '+SU.ROLES[c.role].name.toLowerCase()+' candidates took other offers',body:'Nobody was picked in time. Post the role again if you still need it.'}); } });
  G.reqs.forEach(function(r){
    r.age++;
    var p=clamp(0.45*speed*(r.agency?2:1),0.12,0.92); if(r.age>=5) p=Math.max(p,0.7);
    if(SU.chance(G,p,'people')){
      r.done=true; var list=SU.makeCandidates(G,r);
      var c={id:'c'+(++G.rid),reqId:r.id,role:r.role,level:r.level,list:list,t:G.t,exp:G.t+3,agency:!!r.agency,comp:r.comp,equity:r.equity};
      G.cands.push(c);
      if(G.flags.autoPick){ var best=0; list.forEach(function(x,i){ if(x.skill>list[best].skill) best=i; }); filled.push(SU.pickCandidate(G,c.id,best)); }
      else SU.inbox(G,{kind:'person',title:list.length+' candidates for '+SU.ROLES[r.role].name.toLowerCase(),body:'Pick who joins. They will take other offers in a few turns.',action:{type:'cands',id:c.id}});
    }
  });
  G.reqs=G.reqs.filter(function(r){ return !r.done; });
  return filled;
}

/* ------------------------------------------------------------ finance */
function expenses(G,E,rev){
  var load=1.3, pay=0;
  G.team.forEach(function(e){ pay+=e.sal*load/12; });
  var foundersPay=(G.founder.pay||0)*(G.co?2:1); pay+=foundersPay;
  var heads=SU.headcount(G); var tools=100*heads;
  var c=G.cust, infra=150;
  if(G.arch==='smb') infra+=2*c.n+0.4*(c.free||0); else if(G.arch==='consumer') infra+=0.03*c.mau; else infra+=0.02*c.gmv;
  var o=G.orders, mk=o.ads+o.content+o.social+o.events+o.referral+o.ua;
  var outCost=(G.pend&&G.pend.outbound||[]).reduce(function(a,x){ return a+0.05*x.n; },0)+count(G,'sdr')*1200*0.05;
  var cogs=0, gm=G.arch==='smb'?0.78:G.arch==='consumer'?0.88:0.97; cogs=rev*(1-gm);
  var fixed=G.fixed*(1+0.25*Math.max(0,G.act-1))+(G.act>=2?60*Math.max(0,heads-3):0)+(SU.Shop?SU.Shop.rent(G):0);
  var other=(o.therapy?400:0)+(o.culture.perks?150*heads:0);
  var rbf=(G.loans.rbf&&G.loans.rbf.left>0)?Math.min(G.loans.rbf.left,0.06*rev):0;
  var debt=(G.loans.debt&&G.loans.debt.bal>0)?G.loans.debt.bal*0.11/12:0;
  var owed=G.owed||0;
  var total=pay+tools+infra+mk+outCost+cogs+fixed+other+rbf+debt+owed;
  return {payroll:pay,tools:tools,infra:infra,marketing:mk+outCost,cogs:cogs,fixed:fixed,other:other,rbf:rbf,debt:debt,owed:owed,total:total};
}
SU.expenses=expenses;
SU.fin = function(G){
  var E=SU.era(G), rev=G.mrr||0, ex=expenses(G,E,rev), burn=ex.total-rev;
  var hist=G.burnHist||[]; var avg=hist.length? hist.slice(-2).reduce(function(a,b){ return a+b; },0)/Math.min(2,hist.length) : burn;
  var useBurn=hist.length? (burn>avg? burn : 0.5*(burn+avg)) : burn;
  var runway = useBurn>0? Math.max(0,G.cash)/useBurn : 999;
  /* default alive: hold expenses, grow revenue at trailing growth (capped, decaying) */
  var g=clamp(SU.growthMo(G),0,0.15), cash=G.cash, alive=true, endM=null, r=rev;
  for(var k=1;k<=36;k++){ r=r*(1+g*Math.pow(0.97,k)); cash+=r-ex.total; if(cash<0){ if(r<ex.total){ alive=false; endM=k; break; } } if(r>=ex.total){ break; } }
  if(rev===0 && burn>0 && G.cash/burn<36) { alive = false; endM = Math.floor(G.cash/Math.max(1,burn)); }
  return {ex:ex,rev:rev,burn:burn,runway:runway,defaultAlive:alive,daMonth:endM};
};

/* ------------------------------------------------------------ demand (business models) */
function outboundFunnel(G,n,segId,spec,E,spam){
  var S=SU.SEG[segId]||SU.seg(G); if(!S) return {replies:0,meetings:0,closes:0};
  var fit=(segId && segId!==G.segId)?0.25:1;
  var replies=n*(S.reply||0.05)*E.replyIdx*(0.55+0.6*spec)*(0.7+0.6*G.pmf/100)*fit*(spam?0.3:1);
  var meetings=replies*0.25;
  var cb=0.28*convF(G)*(G.arch==='smb'?priceF(G):1)*SU.compF(G)*gateF(G)*(0.8+0.1*salesSkill(G))*closeMult(G);
  return {replies:replies,meetings:meetings,closes:meetings*Math.min(0.9,cb),closeRate:Math.min(0.9,cb)};
}
SU.outboundFunnel=outboundFunnel;

function demandSMB(G,E,S){
  var c=G.cust, cf=convF(G), pf=priceF(G), cmp=SU.compF(G), gate=gateF(G);
  var fr=c.freemium, leadMult=fr?2.2:1, convMult=fr?0.28:1;
  var base=0.15*cf*pf*cmp*gate*convMult*(0.8+0.1*salesSkill(G))*closeMult(G);
  var spam=(G.flags.spamUntil||0)>G.mi;
  var newPaid=c.pipe||0; c.pipe=0; var leads=0, sent=0;
  /* outbound this turn: replies and meetings now, closes next month */
  var outs=G.pend.outbound.slice(); G.pend.outbound=[];
  var sdr=count(G,'sdr'); if(sdr) outs.push({n:1200*sdr,seg:G.segId,spec:0.7,standing:true});
  outs.forEach(function(o){
    var f=outboundFunnel(G,o.n,o.seg,o.spec,E,spam);
    var R=SU.poisson(G,f.replies,'market'), M=SU.binom(G,R,0.25,'market'), C=SU.binom(G,M,f.closeRate*leadMult*convMult,'market');
    c.pipe+=C; sent+=o.n; leads+=M; G.stat.repliesLast=(G.stat.repliesLast||0)+R;
  });
  G.stat.sentLast=sent;
  /* ads */
  if(G.orders.ads>0){ var cpc=S.cpc*E.cpcIdx*(1+G.orders.ads/S.adCap); var trials=G.orders.ads/cpc*0.03*leadMult*mktF(G); var cl=SU.binom(G,SU.poisson(G,trials,'market'),Math.min(0.9,0.2*cf*pf*cmp*gate*convMult),'market'); newPaid+=cl; leads+=trials; SU.drv(G,'cust',cl,'Ads'); }
  /* content / SEO */
  if(G.orders.content>0){ if(!G.contentStart) G.contentStart=G.mi; G.seo+=G.orders.content/1500+0.2; }
  if(G.seo>0){ var lc=G.seo*0.5*Math.min(1,(G.mi-(G.contentStart||G.mi))/4)*leadMult*mktF(G); var cl2=SU.binom(G,SU.poisson(G,lc,'market'),Math.min(0.9,0.08*cf*pf*cmp*gate*convMult),'market'); newPaid+=cl2; leads+=lc; if(cl2) SU.drv(G,'cust',cl2,'Content'); }
  /* social / events / referrals */
  if(G.orders.social>0){ var ls=G.orders.social/(S.cpc*E.cpcIdx*1.8)*0.02*leadMult*(S.aff.social*1.6)*mktF(G); newPaid+=SU.binom(G,SU.poisson(G,ls,'market'),Math.min(0.9,0.12*cf*pf*cmp*gate*convMult),'market'); leads+=ls; }
  if(G.orders.events>0){ var le=G.orders.events/900*0.5*S.aff.events*1.4*mktF(G); newPaid+=SU.binom(G,SU.poisson(G,le,'market'),Math.min(0.9,0.22*cf*pf*cmp*gate*convMult),'market'); leads+=le; }
  if(G.orders.referral>0 || c.n>10){ var lr=(c.n*0.03*Math.max(0.2,(G.pmf-30)/70)+G.orders.referral/700)*S.aff.referral*(1+0.4*featN(G,'referrals')); newPaid+=SU.poisson(G,lr*0.5,'market'); }
  /* launches (one-shot) */
  G.pend.launch.splice(0).forEach(function(L){ var cl3=SU.binom(G,Math.round(L.signups),Math.min(0.9,0.10*cf*pf*cmp*gate*convMult),'market'); newPaid+=cl3; if(fr) c.free+=L.signups*0.6; SU.drv(G,'cust',cl3,'Launch'); });
  /* word of mouth */
  var wom=0.07*c.n*Math.max(0,G.pmf-40)/60*(1+0.4*featN(G,'referrals')); newPaid+=SU.poisson(G,wom,'market');
  /* freemium conversion from the free pool */
  if(fr){ c.free+=leads*3; var conv=SU.binom(G,Math.round(c.free),0.025*cf*pf*cmp*gate*0.4,'market'); c.free=Math.max(0,c.free*0.95-conv); newPaid+=conv; }
  /* churn */
  var sup=count(G,'cs'); var load=c.n/(300+150*sup); var supF=load>1?1.2:1;
  var rate=S.churnMo*churnF(G)*(1+0.3*G.incidents)*(c.annual?0.45:1)*supF*lerp(1.2,0.85,G.trust.cust/100)*(G.flags.darkUntil>G.mi?0.7:1)+(c.shock||0);
  rate=clamp(rate,0,0.9); c.shock=0;
  var churned=SU.binom(G,c.n,rate,'market');
  var before=c.n; c.n=Math.max(0,c.n+newPaid-churned);
  if(before===0 && c.n>0){ SU.journal(G,'First paying customer.','milestone',true); SU.inbox(G,{kind:'opp',title:'First paying customer',body:S.quoteName+' signed up. Their words: "'+S.quote+'"'}); }
  if(before<10 && c.n>=10) SU.journal(G,'10 paying customers.','milestone',true);
  var revenue=before*c.price+newPaid*c.price*0.5; if(c.annual) revenue*=1.0;
  G.stat.newLast=newPaid; G.stat.churnLast=churned; G.stat.churnRate=before? churned/before : 0; G.stat.leadsLast=leads;
  return {revenue:revenue};
}
function demandConsumer(G,E,S){
  var c=G.cust, cf=convF(G), pf=priceF(G), cmp=SU.compF(G);
  var shares=G.needs.some(function(n){ return n.real&&n.id==='share'&&n.cov>0.3; });
  var pm=G.pmf/50, K=Math.min(0.9,0.12*pm*pm*(shares?1.8:1)*(G.viral||1)*(1+0.15*featN(G,'referrals')))*(c.model==='paid'?0.5:1);
  var cpi=3.0*E.cpiIdx*(1+G.orders.ua/20000)*(G.flags.rankUntil>G.mi?0.7:1);
  var paid=G.orders.ua>0? G.orders.ua/cpi*mktF(G) : 0;
  var organic=220*(1+G.hype/25)*(1+Math.log10(1+c.installsLast/1000))*(1+0.15*featN(G,'mobile'));
  var social=G.orders.social>0? G.orders.social/(cpi*0.8)*(S.aff.social)*mktF(G) : 0;
  var content=0; if(G.orders.content>0){ if(!G.contentStart) G.contentStart=G.mi; G.seo+=G.orders.content/1500+0.2; } if(G.seo>0) content=G.seo*12*Math.min(1,(G.mi-(G.contentStart||G.mi))/4)*mktF(G);
  var viral=K*c.installsLast;
  var launch=0; G.pend.launch.splice(0).forEach(function(L){ launch+=L.signups*4; });
  var out=0; G.pend.outbound.splice(0).forEach(function(o){ out+=o.n*S.aff.outbound*0.3; G.stat.sentLast=o.n; });
  var installs=SU.poisson(G,(paid+organic+social+content+viral+launch+out),'market');
  var surv=clamp(0.35+0.55*G.pmf/100,0.3,0.92);
  c.mau=c.mau*surv+installs;
  var toPaid=(c.model==='paid'?0.107:0.021)*pf*cf/0.64*cmp*(1+0.10*featN(G,'mobile')+0.04*featN(G,'onboarding'));
  var newPayers=SU.binom(G,installs,clamp(toPaid,0,0.5),'market');
  var churnP=0.12*lerp(1.6,0.6,G.pmf/100)*(c.annual?0.45:1)*(1+0.3*G.incidents)*featChurn(G)+(c.shock||0); c.shock=0;
  var lost=SU.binom(G,c.payers,clamp(churnP,0,0.9),'market');
  var before=c.payers; c.payers=Math.max(0,c.payers+newPayers-lost);
  c.installsLast=installs;
  var t12=c.rev12.reduce(function(a,b){ return a+b; },0); var fee=t12<1e6?0.15:0.30;
  var revenue=(before+c.payers)/2*c.price*(1-fee);
  c.rev12.push(revenue); if(c.rev12.length>12) c.rev12.shift();
  if(before===0 && c.payers>0){ SU.journal(G,'First paying subscriber.','milestone',true); }
  if(c.mau>=500 && !G.flags.mau500){ G.flags.mau500=true; SU.journal(G,'500 monthly active users.','milestone',true); }
  G.stat.newLast=newPayers; G.stat.churnLast=lost; G.stat.churnRate=before?lost/before:0; G.stat.installs=installs;
  return {revenue:revenue};
}
function demandMarket(G,E,S){
  var c=G.cust, cf=convF(G), cmp=SU.compF(G);
  var newD=0, newS=0;
  if(G.orders.ads>0) newD+=G.orders.ads/S.adCpa*0.7*(S.aff.ads*1.3)*mktF(G);
  if(G.orders.social>0) newD+=G.orders.social/(S.adCpa*1.2)*S.aff.social*1.2*mktF(G);
  if(G.orders.content>0){ if(!G.contentStart) G.contentStart=G.mi; G.seo+=G.orders.content/1500+0.2; } if(G.seo>0) newD+=G.seo*5*Math.min(1,(G.mi-(G.contentStart||G.mi))/4)*mktF(G);
  if(G.orders.referral>0) newD+=G.orders.referral/(S.adCpa*0.7)*S.aff.referral;
  if(G.orders.events>0) newS+=G.orders.events/200*S.aff.events;
  G.pend.launch.splice(0).forEach(function(L){ newD+=L.signups*1.2; });
  G.pend.outbound.splice(0).forEach(function(o){ G.stat.sentLast=o.n; var yld=o.n*0.25*cf*(o.seg&&o.seg!==G.segId?0.3:1)*(0.55+0.6*o.spec); if(o.side==='supply') newS+=yld; else newD+=yld*3; });
  var sdr=count(G,'sdr'); if(sdr) newS+=sdr*1200*0.05*cf;
  var matchQ=Math.min(1,0.4+0.6*G.pmf/100+0.03*featN(G,'mobile')+0.02*featN(G,'integrations'));
  var potential=c.D*S.freq*0.6, capacity=c.S*S.capacity;
  var fulfilled=Math.min(potential,capacity)*matchQ;
  var unfilled=potential>0? Math.max(0,1-fulfilled/potential) : 0;
  var util=capacity>0? Math.min(1,fulfilled/capacity) : 0;
  newD+=0.04*c.D*Math.max(0,matchQ-0.35)*(1-unfilled)*(1+0.2*featN(G,'referrals'));       /* word of mouth when it works */
  newS+=0.03*c.S*util*Math.max(0.3,matchQ);
  var demChurn=clamp(0.05+0.25*unfilled+0.08*(1-matchQ),0.02,0.8);
  var supChurn=clamp(0.04+0.20*Math.max(0,c.take-S.takeTol)/S.takeTol+0.12*(1-util),0.02,0.8);
  var Dnew=SU.poisson(G,newD,'market'), Snew=SU.poisson(G,newS,'market');
  c.D=Math.max(0,c.D*(1-demChurn)+Dnew); c.S=Math.max(0,c.S*(1-supChurn)+Snew);
  var potential2=c.D*S.freq*0.6, capacity2=c.S*S.capacity, orders=Math.min(potential2,capacity2)*matchQ;
  var gmv=orders*c.aov; c.orders=orders; c.gmv=gmv;
  var revenue=gmv*c.take*cmp*(0.7+0.3*priceF(G));
  if(c.gmv>=5000 && !G.flags.gmv5k){ G.flags.gmv5k=true; SU.journal(G,'First $5K of monthly GMV.','milestone',true); }
  G.stat.newLast=Dnew+Snew; G.stat.match=matchQ; G.stat.util=util; G.stat.churnRate=demChurn;
  return {revenue:revenue};
}

/* ------------------------------------------------------------ product */
function productStep(G){
  var V=SU.velocity(G), spent=0;
  if(G.refactorPts>0){ var u=Math.min(G.refactorPts,V*0.6); G.D=Math.max(0,G.D-1.5*u*(G.co&&G.co.flags.debtMult?1:1)); G.refactorPts-=u; V-=u; spent+=u; }
  var shipped=[];
  while(V>0.01 && G.queue.length){
    var f=G.queue[0], need=f.scope-f.progress, use=Math.min(V,need); f.progress+=use; V-=use;
    if(f.progress>=f.scope-1e-6){ G.queue.shift(); shipFeature(G,f); shipped.push(f); G.flags.shipMi=G.mi; } else break;
  }
  if(V>0.01 && !G.queue.length){ G.Q+=0.25*V*(1-G.Q/120); G.D+=0.1*V; }
  /* incidents */
  var p=clamp((G.D-35)/150,0,0.4)*(0.5+Math.log10(1+SU.custCount(G))/4)*(SU.Shop?SU.Shop.incident(G):1);
  if(SU.chance(G,p/3,'events')){ G.incidents+=1; G.trust.cust=clamp(G.trust.cust-6,0,100); G.flags.outage=G.mi; SU.journal(G,'Outage. Tech debt is showing.','incident'); SU.inbox(G,{kind:'crisis',title:'Outage',body:'The system went down for hours. Customers noticed.',chips:[{label:'Be honest on the status page',text:'post an honest status page update and refund affected customers'},{label:'Pay down debt',text:'pay down tech debt'}]}); }
  G.incidents=Math.max(0,G.incidents*0.8);
  if(G.D>50 && !G.flags.debtSignal){ G.flags.debtSignal=true; SU.inbox(G,{kind:'signal',title:'Signal: the database is held together with hope',body:'Your engineers warn that tech debt is getting dangerous. An outage is likely if it keeps growing.',chips:[{label:'Pay down tech debt',text:'pay down tech debt this month'}]}); }
  if(G.D<40) G.flags.debtSignal=false;
  return shipped;
}
function shipFeature(G,f){
  var seg=SU.seg(G), fitB=SU.pmfStar(G);
  G.Q+=f.scope*1.2*(1-G.Q/120); G.D+=f.scope*0.5*f.care*((G.co&&G.co.flags.debtMult)||1);
  var good=0, herring=false, tagNames=[];
  (f.tags||[]).forEach(function(id){ var n=G.needs.filter(function(x){ return x.id===id; })[0]; if(!n) return; if(n.real){ n.cov=Math.max(n.cov,clamp(0.4+0.6*G.Q/100,0,1)); if((f.lvl||1)>1) n.cov=clamp(n.cov+0.15,0,1); good++; } else if(n.herring){ herring=true; } tagNames.push(n.name); });
  var core=/\b(mvp|v1|prototype|core|launch)\b/.test(f.name);
  var plat=f.plat&&SU.PLAT&&SU.PLAT[f.plat];
  if(!good && !core && !plat){ G.bloat+=3; }
  if(herring) G.bloat+=1;
  if(plat){ G.feat=G.feat||{}; G.feat[f.plat]=true; if(plat.onShip) plat.onShip(G); }
  G.shipped.push({id:f.id,name:f.name,t:G.t,tags:f.tags,good:good,plat:f.plat||null});
  var fitA=SU.pmfStar(G), dFit=Math.round(fitA-fitB);
  var note=plat? plat.shipped : good? 'It matches a real customer need. Fit potential '+Math.round(fitB)+' to '+Math.round(fitA)+'.' : core? 'A solid base to build on.'+(dFit>0?' Fit potential +'+dFit+'.':'') : (herring?'People asked for it, but it will not move retention. It adds clutter.':'Nobody was waiting for this one. It adds clutter and costs you focus.');
  SU.journal(G,'Shipped: '+f.name+'.','ship',G.shipped.length===1);
  SU.inbox(G,{kind:'opp',title:'Shipped: '+f.name,body:note});
  f.result=note;
  /* copycat reacts to need-matching features */
  if(good){ var mm=G.rivals.filter(function(r){ return r.id==='mirrormint'; })[0]; if(mm && !mm.active){ mm.active=true; mm.presence=0.2; SU.inbox(G,{kind:'rumor',title:'Rumor: a copycat appeared',body:'A suspicious domain looks a lot like your product. MirrorMint ships your features, with a gradient.'}); } }
}

/* ------------------------------------------------------------ rivals */
function rivalStep(G,E){
  G.rivals.forEach(function(r){
    if(!r.active) return;
    r.Q+=r.growth*0.9; r.cash-=r.burn;
    if(r.id==='krellix'){ r.hype=clamp(r.hype+0.2,0,100); if(r.cash<1e6 && SU.chance(G,0.12*E.fundAvail,'rivals')){ r.cash+=r.raised?20e6:12e6; r.raised++; r.burn*=1.6; r.presence=clamp(r.presence+0.1,0,0.8); SU.inbox(G,{kind:'rumor',title:'Rumor: Krellix is raising a mega-round',body:'Thad Brannigan is telling everyone Krellix just closed a big round. Expect a price war.',chips:[{label:'Niche down',text:'talk to 10 customers and double down on our best segment'},{label:'Hold price, add value',text:'build something customers asked for'}]}); } if(r.cash<0){ r.active=false; r.presence=0; G.flags.krellixDead=true; SU.inbox(G,{kind:'opp',title:'Krellix collapsed',body:'Krellix ran out of money. Their customers are up for grabs and their engineers are hiring elsewhere.',chips:[{label:'Buy their customers',text:'buy Krellix customers and hire their engineers'}]}); } }
    if(r.id==='mirrormint'){ r.Q=Math.min(r.Q,70); r.presence=clamp(0.1+0.2*G.shipped.length/6,0,0.4); }
    if(r.id==='slowoak'){ r.presence=clamp(r.presence+0.003,0,0.35); }
    if(r.id==='gargantua' && r.active){ r.presence=clamp(r.presence+0.01,0,0.6); }
  });
}

/* ------------------------------------------------------------ act progress */
SU.updateAct = function(G){
  var arr=SU.arr(G), act=G.act;
  var scale=G.arch==='smb'? G.cust.n>=10 : G.arch==='consumer'? G.cust.mau>=500 : G.cust.gmv>=5000;
  if(act===1 && (scale || G.rounds.length>0 || G.t>=10)) act=2;
  if(act===2 && ((G.pmf>=60 && G.mrr>=40000) || G.rounds.some(function(r){ return r.stage==='A'||r.stage==='B'||r.stage==='C'; }))) act=3;
  if(act===3 && (arr>=15e6 || SU.headcount(G)>=120)) act=4;
  if(act===4 && (arr>=60e6 || (G.ipo&&G.ipo.open))) act=5;
  if(act!==G.act){ G.act=act; G.actNew=true; SU.journal(G,'Act '+act+': '+SU.ACTS[act-1].name+'.','act',true); }
};
SU.ACTS=[
  {name:'Garage',line:'Your enemy is the clock. Find ten customers.',unlocks:'Desk, Customers, Money'},
  {name:'The Hunt',line:'Your new enemy is churn. Find product-market fit.',unlocks:'Metrics, Market, Team, Pitch room'},
  {name:'Blitz',line:'Hire fast, stay coherent. Burn multiple is watching.',unlocks:'Board, org chart'},
  {name:'Crown',line:'Rivals, regulators and the press all want a piece.',unlocks:'M&A desk, IPO prep'},
  {name:'Endgame',line:'Control, exit, legacy.',unlocks:'Roadshow, endings'}
];
SU.turnMonths = function(G){ return G.act>=4?3:1; };

/* ------------------------------------------------------------ monthly step */
SU.step = function(G){
  var E=SU.era(G); SU.pmfRefresh(G);
  G.mi++; G.month++; if(G.month>12){ G.month=1; G.year++; }
  E=SU.era(G); var S=SU.seg(G);
  var shipped=productStep(G);
  /* PMF drifts toward target (takes 2-3 months) */
  var star=SU.pmfStar(G); G.pmf+=0.4*(star-G.pmf); G.pmf=clamp(G.pmf,0,100);
  /* demand */
  var d = G.arch==='smb'? demandSMB(G,E,S) : G.arch==='consumer'? demandConsumer(G,E,S) : demandMarket(G,E,S);
  var rev=d.revenue; G.mrrPrev=G.mrr; G.mrr=rev; G.mrrHist.push(rev); if(G.mrrHist.length>60) G.mrrHist.shift();
  if(rev>0) SU.drv(G,'cash',rev,'Revenue');
  /* rivals */
  rivalStep(G,E);
  /* finance */
  var ex=expenses(G,E,rev);
  if(G.owed){ G.owed=0; }
  G.cash+=rev-ex.total; G.burnHist.push(ex.total-rev); if(G.burnHist.length>12) G.burnHist.shift();
  SU.drv(G,'cash',-ex.payroll,'Payroll'); SU.drv(G,'cash',-(ex.marketing),'Marketing'); SU.drv(G,'cash',-(ex.fixed+ex.tools+ex.infra+ex.cogs+ex.other+ex.rbf+ex.debt),'Infra, tools, office');
  if(G.loans.rbf&&G.loans.rbf.left>0){ G.loans.rbf.left=Math.max(0,G.loans.rbf.left-ex.rbf); }
  /* people */
  var filled=hireFill(G,E);
  var mb=moraleBase(G); G.morale+= (mb-G.morale)*0.1; G.morale=clamp(G.morale,0,100);
  G.team.slice().forEach(function(e){
    var tenure=G.mi-e.joinMi; var tm=e.trait&&SU.TRAITS[e.trait].attr||1;
    var p=0.018*attritionF(G.morale)*tm*(tenure===12?2:1)*(tenure<3?0.3:1)*(e.loyalty<45?1.5:1);
    if(e.trait==='founder' && tenure>=15 && SU.chance(G,0.25,'people')) p=1;
    if(SU.chance(G,p,'people')){ G.team=G.team.filter(function(x){ return x!==e; }); if(e.shares){ G.cap.pool.granted-=e.shares*0.5; G.cap.pool.unissued+=e.shares*0.5; G.cap.pool.granted=Math.max(0,G.cap.pool.granted); }
      SU.journal(G,e.name+' left'+(e.trait==='founder'?' to start something of their own':'')+'.','people'); SU.inbox(G,{kind:'person',title:e.name+' resigned',body:'They are leaving the company. '+(e.trait==='founder'?'A new competitor may appear.':'Morale is the usual culprit.')}); G.stat.leftLast=(G.stat.leftLast||0)+1; if(e.trait==='founder') G.flags.founderLeft=G.mi; }
  });
  G.team.forEach(function(e){ e.loyalty=clamp(e.loyalty+(G.morale>65?0.8:G.morale<40?-1.5:0),0,100); });
  SU.staffStep(G);
  /* culture timers */
  var cu=G.orders.culture; if(cu.crunch>0){ cu.crunch--; G.morale=clamp(G.morale-3,0,100); }
  /* hype/trust */
  var arr=SU.arr(G), Hb=Math.min(50,10+10*Math.log10(1+arr/1e5)); G.hype+=(Hb-G.hype)*0.08; G.hype=clamp(G.hype,0,100);
  if(G.incidents<0.2) G.trust.cust=clamp(G.trust.cust+0.4,0,100);
  G.trust.emp=clamp(G.trust.emp+(G.morale>60?0.4:-0.4),0,100);
  /* sanity */
  var f=SU.fin(G), san=G.founder.sanity;
  if(G.round) san-=2; if(G.orders.therapy) san+=2; if(cu.crunch>0) san-=3;
  if(f.runway<3 && f.burn>0) san-=2; if(f.runway<1 && f.burn>0) san-=4;
  if((G.founder.pay||0)===0 && G.mi>6) san-=1;
  if(san===G.founder.sanity && san<70) san+=1;
  if(SU.Shop) san+=SU.Shop.sanity(G);
  G.founder.sanity=clamp(san,0,100);
  if(SU.Shop){ var hf=SU.Shop.hypeFloor(G); if(hf>0) G.hype=Math.max(G.hype,hf); }
  /* regulatory heat, ethics ledger slow decay */
  G.reg=Math.max(0,G.reg-0.5);
  /* fundraising pipeline */
  SU.Money.step(G,E);
  /* spam flag decays */
  /* history */
  G.stat.arr=arr;
  G.hist=G.hist||[]; G.hist.push({m:G.mi,mrr:Math.round(rev),cust:SU.custCount(G),cash:Math.round(G.cash),burn:Math.round(ex.total-rev),nw:Math.round(G.stat.newLast||0),ch:Math.round(G.stat.churnLast||0),pmf:Math.round(G.pmf)}); if(G.hist.length>160) G.hist.shift();
  return {shipped:shipped,filled:filled};
};
SU.pmfRefresh=function(G){ };
SU.advance = function(G,months){ var out={shipped:[],filled:[]}; for(var i=0;i<months;i++){ var r=SU.step(G); out.shipped=out.shipped.concat(r.shipped); out.filled=out.filled.concat(r.filled); if(G.over) break; } return out; };

/* valuation (paper EV) */
SU.valuation = function(G){
  var E=SU.era(G), arr=SU.arr(G), g=SU.growthMo(G), yoy=Math.pow(1+clamp(g,-0.2,0.5),12)-1;
  var gm=G.arch==='smb'?0.78:G.arch==='consumer'?0.72:0.5, gmAdj=gm>=0.75?1:gm>=0.6?0.75:0.45;
  var nrr=clamp(1-(G.stat.churnRate||0.04)*12*0.5+0.1,0.8,1.3);
  var ev=arr*E.mult*clamp(0.35+0.65*yoy,0.35,2.3)*gmAdj*nrr;
  return Math.max(ev, 0);
};
})();
