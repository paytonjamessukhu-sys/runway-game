/* RUNWAY - shop: office space, upgrades, platform features, goals. Everything here is bought or earned with clicks. */
(function(){
var SU = (window.SU = window.SU || {});
var clamp=SU.clamp, fm=SU.fmtMoney;

/* ------------------------------------------------------------ office space */
SU.SPACES = {
  garage:{id:'garage',name:'The Garage',seats:4,rent:0,deposit:0,blurb:'Free, cold, and full of boxes. Four desks.'},
  studio:{id:'studio',name:'The Studio',seats:7,rent:2500,deposit:5000,blurb:'A bright loft with real desks and a window. Seven seats.'},
  office:{id:'office',name:'The Office',seats:12,rent:8000,deposit:25000,blurb:'A meeting room, a server closet and a kitchen. Twelve seats and room to grow.'},
  hq:{id:'hq',name:'Headquarters',seats:40,rent:25000,deposit:120000,blurb:'Your name on the building. Room for everyone.'}
};
SU.SPACE_ORDER=['garage','studio','office','hq'];
SU.SPACE_NAMES={ai:{garage:'The Garage (one GPU)',studio:'The Lab Loft',office:'The Research Floor',hq:'The AI Campus'}};
SU.spaceName=function(G,id){ var a=SU.SPACE_NAMES[G&&G.biz]; return (a&&a[id])||SU.SPACES[id].name; };

/* ------------------------------------------------------------ upgrades (visible in the office) */
SU.UPGRADES = [
  {id:'espresso',name:'Espresso machine',cost:1200,min:'garage',fx:{morale:2,sanity:0.5},text:'Morale +2 and a little sanity back every month.',blurb:'Real coffee. The team notices.'},
  {id:'plants',name:'Plants everywhere',cost:250,min:'garage',fx:{morale:1},text:'Morale +1.',blurb:'Cheap, green, and somehow it helps.'},
  {id:'dog',name:'Office dog',cost:300,min:'garage',fx:{morale:3,sanity:0.5},text:'Morale +3 and a little sanity back every month.',blurb:'Biscuit starts Monday. He does no work and everyone loves him.'},
  {id:'chairs',name:'Good chairs',cost:3000,min:'garage',fx:{morale:2,vel:0.02},text:'Morale +2 and building 2% faster.',blurb:'Backs thank you.'},
  {id:'standing',name:'Standing desks',cost:2500,min:'garage',fx:{morale:2,vel:0.02},text:'Morale +2 and building 2% faster. Everyone stands.',blurb:'Your team will stand while they work.'},
  {id:'monitors',name:'Big monitors',cost:4000,min:'garage',fx:{vel:0.04},text:'Building 4% faster.',blurb:'More pixels, fewer tabs.'},
  {id:'sign',name:'Neon sign',cost:1500,min:'studio',fx:{hypeFloor:8},text:'Buzz never falls below 8, and it goes up a bit now.',blurb:'Your name, glowing. Visitors take photos.'},
  {id:'lounge',name:'Lounge and beanbags',cost:3500,min:'studio',fx:{morale:3,sanity:0.5},text:'Morale +3 and a little sanity back every month.',blurb:'Somewhere to think that is not a desk.'},
  {id:'nap',name:'Nap pod',cost:4500,min:'studio',fx:{sanity:2},text:'You recover 2 sanity every month.',blurb:'Twenty minutes. Reset.'},
  {id:'servers',name:'Server upgrade',cost:6000,min:'studio',fx:{incident:0.7,vel:0.02},text:'30% fewer outages and building 2% faster.',blurb:'Blinking lights, fewer 3am pages.'},
  {id:'mural',name:'Brand mural',cost:2000,min:'studio',fx:{morale:1,hypeFloor:5},text:'Morale +1 and buzz never falls below 5.',blurb:'A local artist paints your logo ten feet tall.'},
  {id:'monitors2',name:'Video wall',cost:9000,min:'office',needs:'monitors',fx:{vel:0.04},text:'Building 4% faster. A whole wall of screens.',blurb:'Level 2 of Big monitors.'},
  {id:'execdesks',name:'Executive desks',cost:7000,min:'office',needs:'standing',fx:{morale:2,vel:0.02},text:'Morale +2 and building 2% faster. Dark wood, green lamps.',blurb:'Level 2 of Standing desks.'},
  {id:'barista',name:'Barista bar',cost:5000,min:'office',needs:'espresso',fx:{morale:3,sanity:0.5},text:'Morale +3 and a little sanity back every month.',blurb:'Level 2 of the Espresso machine. Somebody learns latte art.'},
  {id:'gameroom',name:'Game room',cost:8000,min:'office',needs:'lounge',fx:{morale:4},text:'Morale +4. Ping pong is now a meeting.',blurb:'Level 2 of the Lounge.'},
  {id:'rooftop',name:'Rooftop terrace',cost:30000,min:'hq',needs:'lounge',fx:{morale:5,sanity:1},text:'Morale +5 and sanity +1 every month.',blurb:'Sunset standups.'}
];
SU.upgrade=function(id){ return SU.UPGRADES.filter(function(u){ return u.id===id; })[0]; };

SU.Shop = {
  has:function(G,id){ return !!(G.shop && G.shop[id]); },
  owned:function(G){ return SU.UPGRADES.filter(function(u){ return G.shop && G.shop[u.id]; }); },
  morale:function(G){ var s=0; SU.Shop.owned(G).forEach(function(u){ s+=u.fx.morale||0; }); return s; },
  vel:function(G){ var s=0; SU.Shop.owned(G).forEach(function(u){ s+=u.fx.vel||0; }); return 1+s; },
  sanity:function(G){ var s=0; SU.Shop.owned(G).forEach(function(u){ s+=u.fx.sanity||0; }); return s; },
  hypeFloor:function(G){ var s=0; SU.Shop.owned(G).forEach(function(u){ s=Math.max(s,u.fx.hypeFloor||0); }); return s; },
  incident:function(G){ var s=1; SU.Shop.owned(G).forEach(function(u){ if(u.fx.incident) s*=u.fx.incident; }); return s; },
  space:function(G){ var sp=SU.SPACES[G.space||'garage']; var o={}; for(var k in sp) o[k]=sp[k]; o.name=SU.spaceName(G,sp.id); return o; },
  rent:function(G){ return SU.Shop.space(G).rent; },
  seats:function(G){ return SU.Shop.space(G).seats; },
  over:function(G){ return Math.max(0,SU.headcount(G)-SU.Shop.seats(G)); },
  crampedMorale:function(G){ return Math.min(12,1.5*SU.Shop.over(G)); },
  crampedVel:function(G){ return clamp(1-0.04*SU.Shop.over(G),0.6,1); },
  canBuy:function(G,id){
    var u=SU.UPGRADES.filter(function(x){ return x.id===id; })[0]; if(!u) return {ok:false,why:'Unknown item.'};
    if(G.shop&&G.shop[id]) return {ok:false,why:'You already have it.'};
    if(u.needs && !(G.shop&&G.shop[u.needs])) return {ok:false,why:'Needs '+SU.upgrade(u.needs).name+' first.'};
    if(SU.SPACE_ORDER.indexOf(G.space||'garage')<SU.SPACE_ORDER.indexOf(u.min)) return {ok:false,why:'Needs '+SU.SPACES[u.min].name+' or bigger.'};
    if(G.cash<u.cost) return {ok:false,why:'Need '+fm(u.cost-G.cash)+' more.'};
    return {ok:true};
  },
  buy:function(G,id){
    var c=SU.Shop.canBuy(G,id); if(!c.ok) return c; var u=SU.UPGRADES.filter(function(x){ return x.id===id; })[0];
    G.cash-=u.cost; G.shop=G.shop||{}; G.shop[id]=G.t+1; SU.drv(G,'cash',-u.cost,u.name);
    if(u.fx.morale) G.morale=clamp(G.morale+u.fx.morale,0,100); if(id==='sign') G.hype=clamp(G.hype+3,0,100); if(id==='dog') G.morale=clamp(G.morale+2,0,100);
    SU.journal(G,'Bought: '+u.name+' ('+fm(u.cost)+').','shop',false);
    return {ok:true,msg:u.name+' is in. '+u.text};
  },
  canMove:function(G,to){
    var sp=SU.SPACES[to]; if(!sp||to===G.space) return {ok:false,why:'You are already here.'};
    var up=SU.SPACE_ORDER.indexOf(to)>SU.SPACE_ORDER.indexOf(G.space||'garage');
    if(up && G.cash<sp.deposit) return {ok:false,why:'Need '+fm(sp.deposit-G.cash)+' more for the deposit.',up:up};
    if(!up && SU.headcount(G)>sp.seats) return {ok:false,why:'Too many people for '+sp.seats+' seats.',up:up};
    return {ok:true,up:up};
  },
  move:function(G,to){
    var c=SU.Shop.canMove(G,to); if(!c.ok) return c; var sp=SU.SPACES[to];
    if(c.up){ G.cash-=sp.deposit; SU.drv(G,'cash',-sp.deposit,'Office deposit'); G.morale=clamp(G.morale+6,0,100); G.hype=clamp(G.hype+4,0,100); }
    else { G.morale=clamp(G.morale-5,0,100); G.hype=clamp(G.hype-3,0,100); }
    G.space=to; SU.journal(G,(c.up?'Moved into ':'Moved down to ')+sp.name+'.','shop',c.up);
    return {ok:true,msg:(c.up?'Moved into ':'Moved down to ')+sp.name+'. Rent is now '+fm(sp.rent)+' a month.',up:c.up};
  }
};

/* ------------------------------------------------------------ company level: a title that grows as the company does (shows in the HUD, trophies appear in the office) */
SU.LEVELS = [
  {n:1,title:'Napkin sketch',hint:'Just an idea.',test:function(G){ return true; }},
  {n:2,title:'Prototype',hint:'Ship your first product.',test:function(G){ return G.shipped.length>=1; }},
  {n:3,title:'First dollars',hint:'Land your first paying customer.',test:function(G){ return SU.custCount(G)>=1 && (G.mrr||0)>0; }},
  {n:4,title:'Real team',hint:'Grow to 3 people.',test:function(G){ return SU.headcount(G)>=3; }},
  {n:5,title:'Funded',hint:'Raise your first round.',test:function(G){ return G.rounds.length>=1; }},
  {n:6,title:'Gaining ground',hint:'Reach $25K a month.',test:function(G){ return (G.mrr||0)>=25000; }},
  {n:7,title:'Scale-up',hint:'12 people and $100K a month.',test:function(G){ return SU.headcount(G)>=12 && (G.mrr||0)>=100000; }},
  {n:8,title:'Big leagues',hint:'Two rounds raised and $500K a month.',test:function(G){ return G.rounds.length>=2 && (G.mrr||0)>=500000; }},
  {n:9,title:'Market leader',hint:'Reach $2M a month.',test:function(G){ return (G.mrr||0)>=2e6; }},
  {n:10,title:'Unicorn',hint:'Reach $8M a month.',test:function(G){ return (G.mrr||0)>=8e6; }}
];
SU.Level = {
  calc:function(G){ var n=1; SU.LEVELS.forEach(function(l){ if(l.test(G)) n=Math.max(n,l.n); }); n=Math.max(n,G.lvl||1); return n; },
  info:function(G){ var n=SU.Level.calc(G); return {n:n,cur:SU.LEVELS[n-1],next:SU.LEVELS[n]||null}; },
  /* returns the new level when it just went up, else 0 */
  check:function(G){ var n=SU.Level.calc(G), was=G.lvl||1; G.lvl=n; return n>was?n:0; }
};

/* ------------------------------------------------------------ platform features (each one does something you can see) */
SU.PLAT = {
  dashboard:{name:'Analytics dashboard',scope:10,minAct:1,effect:'Unlocks the Dashboard tab with revenue, signups and churn by month. You also learn a little about your customers.',shipped:'The Dashboard tab is unlocked. You can finally see revenue, signups and churn month by month.',onShip:function(G){ G.insight=clamp(G.insight+5,0,100); }},
  onboarding:{name:'Guided onboarding',scope:8,minAct:1,effect:'New customers stick around: churn down about 12%.',shipped:'Fewer people drop off in the first week. Churn is down about 12%.'},
  referrals:{name:'Referral program',scope:10,minAct:2,effect:'Happy customers bring friends: referrals up about 40%.',shipped:'Customers now invite their friends. Referrals are up about 40%.'},
  integrations:{name:'Integrations',scope:20,minAct:2,effect:'Deals close easier: close rate up about 12%.',shipped:'Your product plugs into the tools people already use. Close rate is up about 12%.'},
  mobile:{name:'Mobile app',scope:20,minAct:1,effect:'More signups and a little less churn.',shipped:'The mobile app is out. More signups, a little less churn.'},
  evals:{biz:'ai',name:'Eval suite',scope:10,minAct:1,effect:'Catches regressions before customers do: churn down about 12%.',shipped:'Every release is tested against hundreds of cases. Churn is down about 12%.'},
  rag:{biz:'ai',name:'Retrieval over customer data',scope:14,minAct:1,effect:'The model uses the customer\u2019s own documents: model quality +8 and it decays more slowly.',shipped:'The model now answers from the customer\u2019s own data. Quality +8.',onShip:function(G){ G.Q=Math.min(100,G.Q+8); }},
  finetune:{biz:'ai',name:'Customer fine-tuning',scope:20,minAct:2,effect:'Deals close easier: close rate up about 15%.',shipped:'Customers can tune the model to their own work. Close rate is up about 15%.'},
  guardrails:{biz:'ai',name:'Safety guardrails',scope:16,minAct:2,effect:'Fewer incidents and bigger customers say yes.',shipped:'Guardrails catch the worst answers. Incidents are rarer and cautious buyers relax.'},
  sso:{name:'Security: SSO and audit logs',scope:20,minAct:2,effect:'Bigger customers say yes. Finance buyers stop hesitating.',shipped:'Security reviews stop being a blocker. Bigger customers are saying yes.'}
};
SU.PLAT_ORDER=['dashboard','onboarding','mobile','referrals','integrations','sso','evals','rag','finetune','guardrails'];

/* ------------------------------------------------------------ goals */
function lvl(cur,max,money){ return {cur:Math.min(cur,max),max:max,money:!!money}; }
SU.GOALS = [
  {id:'g_talk',title:'Learn what customers pay for',desc:'Find your first real need.',prog:function(G){ return lvl(G.needs.filter(function(n){ return n.real&&n.revealed; }).length,1); },reward:{sanity:5}},
  {id:'g_mvp',title:'Ship your first product',desc:'Build something real.',prog:function(G){ return lvl(G.shipped.length,1); },reward:{hype:5}},
  {id:'g_cust1',title:'Land your first customer',desc:'Somebody pays you.',prog:function(G){ return lvl(SU.custCount(G),1); },reward:{hype:5}},
  {id:'g_hire1',title:'Hire your first person',desc:'You are not alone anymore.',prog:function(G){ return lvl(G.team.length,1); },reward:{morale:5}},
  {id:'g_cust10',title:'Reach 10 customers',desc:'It is not a fluke.',prog:function(G){ return lvl(SU.custCount(G),10); },reward:{focus:1}},
  {id:'g_mrr1k',title:'Make $1K a month',desc:'Revenue is real.',prog:function(G){ return lvl(G.mrr||0,1000,true); },reward:{morale:5}},
  {id:'g_move',title:'Move out of the garage',desc:'Buy a bigger space in the Shop.',prog:function(G){ return lvl(G.space!=='garage'?1:0,1); },reward:{morale:5}},
  {id:'g_fit',title:'Reach product fit of 60',desc:'Customers pull the product out of your hands.',prog:function(G){ return lvl(Math.round(G.pmf),60); },reward:{focus:1}},
  {id:'g_year',title:'Survive a year',desc:'Most startups do not.',prog:function(G){ return lvl(G.mi,12); },reward:{sanity:5}},
  {id:'g_raise',title:'Raise your first round',desc:'Someone bets on you.',prog:function(G){ return lvl(G.rounds.length,1); },reward:{sanity:8}},
  {id:'g_team5',title:'Grow to 5 people',desc:'A real team.',prog:function(G){ return lvl(SU.headcount(G),5); },reward:{focus:1}},
  {id:'g_mrr10k',title:'Make $10K a month',desc:'Default alive is in sight.',prog:function(G){ return lvl(G.mrr||0,10000,true); },reward:{hype:6}},
  {id:'g_profit',title:'Turn a profit',desc:'Spend less than you earn.',prog:function(G){ return lvl((G.mi>3&&SU.fin(G).burn<0)?1:0,1); },reward:{focus:1}},
  {id:'g_dash',title:'Build a dashboard that works',desc:'Unlock the Dashboard tab in the Product screen.',prog:function(G){ return lvl(G.feat&&G.feat.dashboard?1:0,1); },reward:{sanity:4}},
  {id:'g_team15',title:'Grow to 15 people',desc:'You need a bigger office.',prog:function(G){ return lvl(SU.headcount(G),15); },reward:{morale:5}},
  {id:'g_mrr100k',title:'Make $100K a month',desc:'A real business.',prog:function(G){ return lvl(G.mrr||0,100000,true); },reward:{focus:1}},
  {id:'g_seriesA',title:'Raise a Series A',desc:'Serious money, serious expectations.',prog:function(G){ return lvl(G.rounds.some(function(r){ return r.stage==='A'||r.stage==='B'||r.stage==='C'; })?1:0,1); },reward:{hype:8}},
  {id:'g_mrr1m',title:'Make $1M a month',desc:'Now it is a company.',prog:function(G){ return lvl(G.mrr||0,1e6,true); },reward:{hype:10}}
];
SU.Goals = {
  list:function(G){ return SU.GOALS.map(function(g){ var p=g.prog(G); var done=!!(G.goals&&G.goals[g.id]); return {goal:g,cur:p.cur,max:p.max,money:p.money,done:done}; }); },
  next:function(G,n){ return SU.Goals.list(G).filter(function(x){ return !x.done; }).slice(0,n||3); },
  rewardText:function(r){ var a=[]; if(r.focus) a.push('+'+r.focus+' focus every month, for good'); if(r.sanity) a.push('Sanity +'+r.sanity); if(r.morale) a.push('Morale +'+r.morale); if(r.hype) a.push('Buzz +'+r.hype); return a.join(', '); },
  check:function(G,rec){
    G.goals=G.goals||{}; var out=[];
    SU.GOALS.forEach(function(g){
      if(G.goals[g.id]) return; var p=g.prog(G); if(p.cur<p.max) return;
      G.goals[g.id]=G.t; var r=g.reward||{};
      if(r.focus && (G.focusBonus||0)<5) G.focusBonus=(G.focusBonus||0)+r.focus;
      if(r.sanity) G.founder.sanity=clamp(G.founder.sanity+r.sanity,0,100); if(r.morale) G.morale=clamp(G.morale+r.morale,0,100); if(r.hype) G.hype=clamp(G.hype+r.hype,0,100);
      SU.journal(G,'Goal reached: '+g.title+'.','goal',true); out.push(g);
    });
    if(rec && out.length){ rec.newGoals=(rec.newGoals||[]).concat(out.map(function(g){ return {id:g.id,title:g.title,reward:SU.Goals.rewardText(g.reward||{})}; })); }
    return out;
  }
};
})();
