/* RUNWAY - events: crises and opportunities with signals, the showrunner, resolution against what you typed, and endings. */
(function(){
var SU = (window.SU = window.SU || {});
var clamp=SU.clamp, M=SU.Money;
var Ev = (SU.Events = {});
var DEFS = SU.EV = {};
var LIST = SU.EVLIST = [];

var VENUE_NO={scalingWall:1,priceWar:1,copycat:1,gargantua:1,rugpull:1,whale:1,viral:1,featureStorm:1,forumFront:1,techpulse:1,chirp3am:1,ev_dark:1,ev_data:1,tourist:1,covenant:1,ledger:1,aihalluc:1,tokencut:1};
function def(o){ if(VENUE_NO[o.id]){ var c0=o.cond; o.cond=function(G){ if(G.arch==='venue') return false; return c0.apply(this,arguments); }; } DEFS[o.id]=o; LIST.push(o); }
function P(G,id){ if(id==='co') return G.co; for(var i=0;i<G.team.length;i++) if(G.team[i].id===id) return G.team[i]; return null; }
function first(n){ return n? n.split(' ')[0] : 'them'; }
function didMap(cl){ var m={}; cl.forEach(function(c){ (m[c.lever]=m[c.lever]||[]).push(c); }); return m; }
function aimed(c,pid){ return c.params && c.params.who && c.params.who.indexOf(pid)>=0; }
function fm(n){ return SU.fmtMoney(n); }
function fx(G,o){ if(o.morale) G.morale=clamp(G.morale+o.morale,0,100); if(o.hype) G.hype=clamp(G.hype+o.hype,0,100); if(o.sanity) G.founder.sanity=clamp(G.founder.sanity+o.sanity,0,100); if(o.cash){ G.cash+=o.cash; SU.drv(G,'cash',o.cash,o.why||'Event'); } if(o.trust){ for(var k in o.trust) G.trust[k]=clamp(G.trust[k]+o.trust[k],0,100); } if(o.reg) G.reg=Math.max(0,G.reg+o.reg); if(o.ethics) G.ethics=Math.max(0,G.ethics+o.ethics); if(o.board) G.board.mood=clamp(G.board.mood+o.board,0,100); if(o.shock) G.cust.shock=(G.cust.shock||0)+o.shock; }
function personLeaves(G,e,why){ G.team=G.team.filter(function(x){ return x!==e; }); SU.journal(G,e.name+' left'+(why?' ('+why+')':'')+'.','people'); }
function segWho(G){ return SU.seg(G).who; }

/* ------------------------------------------------------------ people */
def({id:'poach',cat:'people',sev:2,minAct:1,w:1.2,cd:6,tension:15,
  cond:function(G){ return G.team.some(function(e){ return e.loyalty<60 && (e.level==='senior'||e.level==='staff'||e.loyalty<45); }); },
  bind:function(G){ var l=G.team.filter(function(e){ return e.loyalty<60; }).sort(function(a,b){ return a.loyalty-b.loyalty; }); return {pid:l[0].id}; },
  signal:{ahead:1,text:function(G,c){ var p=P(G,c.pid); return 'A Gargantua recruiter viewed '+(p?p.name:'someone')+'\'s profile four times.'; },mitigate:['comp','talkto']},
  title:function(G,c){ var p=P(G,c.pid); return (p?p.name:'Someone')+' has an offer'; },
  body:function(G,c){ var p=P(G,c.pid); return 'Gargantua offered '+(p?p.name:'them')+' 1.6x cash. '+(p?first(p.name):'They')+' wants to talk tonight.'; },
  chips:function(G,c){ var p=P(G,c.pid), f=p?first(p.name):'them'; return [{label:'Match it',text:'give '+f+' a 40% raise'},{label:'Offer equity',text:'give '+f+' 0.5% equity'},{label:'Talk it through',text:'1:1 with '+f}]; },
  levers:['comp','talkto'],
  resolve:function(G,c,did){ var p=P(G,c.pid); if(!p) return {note:'They were already gone.'};
    var cmp=(did.comp||[]).filter(function(x){ return aimed(x,c.pid)&&(x.params.pct>=0.3||x.params.equity||x.params.promo); })[0];
    if(cmp){ p.loyalty=clamp(p.loyalty+25,0,100); return {good:true,note:p.name+' stays. The offer got matched.'}; }
    var tk=(did.talkto||[]).filter(function(x){ return aimed(x,c.pid); })[0];
    if(tk){ if(SU.chance(G,0.55,'events')){ p.loyalty=clamp(p.loyalty+15,0,100); return {good:true,note:p.name+' decided to stay after you talked.'}; } personLeaves(G,p,'took the offer'); return {note:'You talked, but '+p.name+' took the offer anyway.'}; }
    personLeaves(G,p,'took the offer'); return {note:p.name+' took the offer.'}; },
  ignore:function(G,c){ var p=P(G,c.pid); if(p){ personLeaves(G,p,'took the offer'); fx(G,{morale:-3}); return {note:p.name+' left for Gargantua.'}; } return {note:''}; }});

def({id:'coTalk',cat:'people',sev:2,minAct:1,w:2,cd:12,tension:15,
  cond:function(G){ return !!G.co && (G.flags.coLowTurns||0)>=2; },
  bind:function(G){ return {}; },
  signal:{ahead:1,text:function(G){ return G.co.name+' has been quiet in standups.'; },mitigate:['talkto']},
  title:function(G){ return 'We need to talk: '+G.co.name; },
  body:function(G){ return G.co.name+' wants to talk. It is about '+G.co.wants+'. '+G.co.voice; },
  chips:function(G){ return [{label:'Sit down and listen',text:'1:1 with '+first(G.co.name)+' and apologize'}]; },
  levers:['talkto'],
  resolve:function(G,c,did){ var t=(did.talkto||[]).filter(function(x){ return aimed(x,'co'); })[0]; if(t){ G.co.bond=clamp(G.co.bond+18,0,100); G.flags.coLowTurns=0; return {good:true,note:G.co.name+' feels heard. Bond restored.'}; } return Ev.coLeaves(G); },
  ignore:function(G){ return Ev.coLeaves(G); }});
Ev.coLeaves=function(G){
  if(!G.co) return {note:''}; var n=G.co.name; G.cofounderLeft=true; G.co=null; G.morale=clamp(G.morale-8,0,100); G.founder.sanity=clamp(G.founder.sanity-8,0,100);
  var dead=!G.flags.vested; if(dead) G.flags.coSplit=true;
  SU.journal(G,n+' left the company.'+(dead?' Their shares stay with them: dead equity.':''),'people',true);
  return {note:n+' left. '+(dead?'Without vesting they keep everything: investors will notice the dead equity.':'Unvested shares return to the pool.')};
};
def({id:'toxic',cat:'people',sev:2,minAct:2,w:1,cd:10,tension:10,
  cond:function(G){ return G.team.length>=5 && G.team.some(function(e){ return e.trait==='tenx'; }); },
  bind:function(G){ var e=G.team.filter(function(x){ return x.trait==='tenx'; })[0]; return {pid:e.id}; },
  signal:{ahead:1,text:function(G,c){ var p=P(G,c.pid); return 'Two engineers asked to transfer away from '+(p?p.name:'a teammate')+'.'; },mitigate:['talkto','fire']},
  title:function(G,c){ var p=P(G,c.pid); return 'Toxic star: '+(p?p.name:''); },
  body:function(G,c){ var p=P(G,c.pid); return (p?p.name:'Your best engineer')+' ships twice as fast as anyone and is wearing the team down. People are talking.'; },
  chips:function(G,c){ var p=P(G,c.pid), f=p?first(p.name):'them'; return [{label:'Let '+f+' go',text:'let go of '+f},{label:'Coach '+f,text:'1:1 with '+f}]; },
  levers:['fire','talkto'],
  resolve:function(G,c,did){ var p=P(G,c.pid); if(!p) return {note:''}; if((did.fire||[]).some(function(x){ return aimed(x,c.pid); })) return {good:true,note:'You let '+p.name+' go. The team exhaled.'}; if((did.talkto||[]).some(function(x){ return aimed(x,c.pid); })){ if(SU.chance(G,0.5,'events')){ p.trait='night'; return {good:true,note:p.name+' took the feedback seriously.'}; } fx(G,{morale:-3}); return {note:p.name+' nodded and changed nothing.'}; } return Ev.toxicBad(G,p); },
  ignore:function(G,c){ var p=P(G,c.pid); return p? Ev.toxicBad(G,p) : {note:''}; }});
Ev.toxicBad=function(G,p){ fx(G,{morale:-8}); var o=SU.pick(G,G.team.filter(function(x){ return x!==p; }),'people'); if(o) personLeaves(G,o,'burned out by the toxic star'); return {note:'Morale cratered'+(o?' and '+o.name+' quit':'')+'.'}; };
def({id:'leak',cat:'people',sev:2,minAct:2,w:1,cd:10,tension:10,
  cond:function(G){ return G.morale<45 && (G.t-(G.flags.layoffT||-99)<=3 || G.ethics>25); },
  bind:function(G){ return {}; },
  title:function(){ return 'Someone screenshotted the all-hands'; },
  body:function(){ return 'Internal messages are circulating on social media. A reporter is asking for comment.'; },
  chips:function(){ return [{label:'Own it',text:'all-hands: tell the team the truth and apologize'}]; },
  levers:['talkto'],
  resolve:function(G,c,did){ if((did.talkto||[]).some(function(x){ return x.params.aud==='team'||x.params.aud==='investors'; })){ fx(G,{trust:{press:-2}}); return {good:true,note:'You owned it publicly. The story fizzled.'}; } fx(G,{trust:{press:-6}}); return {note:'You said little. The story ran with a mild sting.'}; },
  ignore:function(G){ fx(G,{trust:{press:-10},hype:-5}); return {note:'The story ran. Reporters ignored your silence.'}; }});
def({id:'founderWaiting',cat:'people',sev:2,minAct:2,w:1,cd:20,tension:10,
  cond:function(G){ return G.team.some(function(e){ return e.trait==='founder' && G.mi-e.joinMi>=12; }); },
  bind:function(G){ var e=G.team.filter(function(x){ return x.trait==='founder'; })[0]; return {pid:e.id}; },
  signal:{ahead:1,text:function(G,c){ var p=P(G,c.pid); return (p?p.name:'Someone')+' registered a domain name.'; },mitigate:['comp','talkto']},
  title:function(G,c){ var p=P(G,c.pid); return (p?p.name:'An employee')+' is thinking of starting a company'; },
  body:function(G,c){ var p=P(G,c.pid); return (p?p.name:'They')+' has been restless. Another startup in your space would not be good news.'; },
  chips:function(G,c){ var p=P(G,c.pid), f=p?first(p.name):'them'; return [{label:'Promote '+f,text:'promote '+f+' and give '+f+' 0.5% equity'},{label:'Talk',text:'1:1 with '+f}]; },
  levers:['comp','talkto'],
  resolve:function(G,c,did){ var p=P(G,c.pid); if(!p) return {note:''}; if((did.comp||[]).some(function(x){ return aimed(x,c.pid)&&(x.params.promo||x.params.equity); })){ p.trait=null; p.loyalty=95; return {good:true,note:p.name+' accepted a bigger role and stays.'}; } return Ev.spinout(G,p); },
  ignore:function(G,c){ var p=P(G,c.pid); return p? Ev.spinout(G,p) : {note:''}; }});
Ev.spinout=function(G,p){ personLeaves(G,p,'to start a competitor'); G.rivals.push({id:'spin'+(++G.rid),name:first(p.name)+'\'s startup',boss:p.name,persona:'Spinout',cash:1.5e6,burn:70e3,Q:22,price:0.85,hype:25,ethics:0.6,growth:1.0,presence:0.12,active:true,respect:0,grudge:0,mem:[],raised:0}); return {note:p.name+' left and started a competitor. They know your roadmap.'}; };

/* ------------------------------------------------------------ product and customers */
def({id:'scalingWall',cat:'product',sev:2,minAct:2,w:1,cd:12,tension:10,
  cond:function(G){ return SU.growthMo(G)>0.25 && G.D>40; },bind:function(){ return {}; },
  signal:{ahead:1,text:function(){ return 'Latency doubled this week.'; },mitigate:['refactor','hire']},
  title:function(){ return 'The scaling wall'; },body:function(){ return 'Growth is outrunning the infrastructure. Pages time out at peak hours.'; },
  chips:function(){ return [{label:'Freeze and refactor',text:'pay down tech debt this month'},{label:'Hire an engineer',text:'hire a senior engineer'}]; },
  levers:['refactor','hire'],
  resolve:function(G,c,did){ if(did.refactor){ G.D=Math.max(0,G.D-8); return {good:true,note:'You froze features and stabilised the system.'}; } if(did.hire){ return {good:true,note:'A senior engineer is on the way. You limped through.'}; } return {}; },
  ignore:function(G){ G.incidents+=2; fx(G,{trust:{cust:-8},shock:0.03}); return {note:'The site fell over at peak. Customers noticed.'}; }});
def({id:'whale',cat:'market',sev:1,minAct:2,w:1.2,cd:99,tension:-10,
  cond:function(G){ return G.arch==='smb' && G.cust.n>=15 && !G.flags.whaleDone; },bind:function(){ return {}; },
  title:function(){ return 'A 40-location chain wants a call'; },
  body:function(G){ return 'They would pay about '+fm(250000)+' a year, but they want five custom features first. Contracts like this can eat a small team alive.'; },
  chips:function(){ return [{label:'Take it',text:'build custom reporting, SSO and multi-location support for the chain'},{label:'Counter at double',text:'price the enterprise plan at double and build only SSO'},{label:'Decline',text:'talk to 10 customers and stay focused on our core'}]; },
  levers:['build','price','talk'],
  resolve:function(G,c,did){ G.flags.whaleDone=true; if(did.build){ G.cust.n+=12; G.queue.push({id:'f'+(++G.fid),name:'custom chain features',scope:20,progress:0,care:1,tags:[],born:G.t}); fx(G,{morale:-2}); SU.journal(G,'Signed a 40-location chain.','milestone',true); return {good:true,note:'They signed (+12 locations). Five custom features are now promised, and they will cost you a quarter.'}; } if(did.price){ if(SU.chance(G,0.5,'events')){ G.cust.n+=12; return {good:true,note:'They accepted the higher price. +12 locations.'}; } return {note:'They balked at double and walked.'}; } return {note:'You stayed focused. No regrets, probably.'}; },
  ignore:function(G){ G.flags.whaleDone=true; return {note:'They went with someone else.'}; }});
def({id:'featureStorm',cat:'product',sev:1,minAct:2,w:1.2,cd:99,tension:-5,
  cond:function(G){ return SU.custCount(G)>=12 && !G.flags.stormDone && G.needs.some(function(n){ return n.herring; }); },
  bind:function(G){ var h=G.needs.filter(function(n){ return n.herring; })[0]; return {nid:h.id}; },
  title:function(G,c){ var n=G.needs.filter(function(x){ return x.id===c.nid; })[0]; return 'Everyone is asking for '+(n?n.name:'a feature'); },
  body:function(G,c){ var n=G.needs.filter(function(x){ return x.id===c.nid; })[0]; return 'Support tickets about "'+(n?n.name:'it')+'" tripled. Loud users are not always paying users.'; },
  chips:function(G,c){ var n=G.needs.filter(function(x){ return x.id===c.nid; })[0]; return [{label:'Interview them',text:'interview 8 customers about what they actually pay for'},{label:'Build it',text:'build '+(n?n.name:'it')}]; },
  levers:['talk','build'],
  resolve:function(G,c,did){ G.flags.stormDone=true; var n=G.needs.filter(function(x){ return x.id===c.nid; })[0]; if(did.talk){ if(n) n.revealed=true; G.insight=clamp(G.insight+8,0,100); return {good:true,note:'Interviews showed they ask for it but do not pay for it. A teaching moment.'}; } if(did.build){ G.bloat+=3; return {note:'You built what loud users asked for. It did not move retention.'}; } return {}; },
  ignore:function(G){ G.flags.stormDone=true; fx(G,{morale:-1}); return {note:'The tickets piled up. Support is grumpy.'}; }});
def({id:'inspection',cat:'product',sev:1,minAct:1,w:1.0,cd:10,tension:6,
  cond:function(G){ return G.arch==='venue' && G.shipped.length>0 && G.mi>=4 && G.D>=15; },bind:function(){ return {}; },
  title:function(){ return 'The health inspector is at the door'; },
  body:function(G){ return 'A clipboard, a thermometer and a long look at the back of house. Wear and grime is '+Math.round(G.D)+' right now.'; },
  chips:function(){ return [{label:'Scrub like crazy',text:'pay down tech debt'}]; },
  levers:['refactor'],
  resolve:function(G,c,did){ if(did.refactor){ G.D=Math.max(0,G.D-10); fx(G,{trust:{cust:2}}); return {good:true,note:'You scrubbed everything in an hour. They found nothing. Wear down 10.'}; } return {}; },
  ignore:function(G){ if(G.D<30){ return {good:true,note:'They checked everything, nodded and left. Clean enough.'}; } var fine=Math.round(900+G.D*40); G.cash-=fine; SU.drv(G,'cash',-fine,'Health violation'); G.cust.rating=Math.max(1,G.cust.rating-0.25); fx(G,{trust:{cust:-4}}); return {note:'A violation posted on the door and a '+fm(fine)+' fine. The rating dipped.'}; }});
def({id:'goodreview',cat:'market',sev:0,minAct:1,w:0.9,cd:12,tension:-8,
  cond:function(G){ return G.arch==='venue' && G.shipped.length>0 && G.cust.rating>=3.4 && G.mi>=3; },bind:function(){ return {}; },
  title:function(){ return 'A local food blogger raved about you'; },
  body:function(){ return 'Four thousand followers just read that your place is the best kept secret in the neighborhood. The secret is out.'; },
  chips:function(){ return [{label:'Lean into it',text:'spend $1000 on social media this month'}]; },
  levers:['market'],
  resolve:function(G,c,did){ var gain=Math.round(8+G.cust.regulars*0.1); G.cust.regulars+=gain; G.hype=clamp(G.hype+(did.market?12:8),0,100); return {good:true,note:'+'+gain+' regulars and a line out the door on Friday.'+(did.market?' You doubled down on social while it was hot.':'')}; },
  ignore:function(G){ G.hype=clamp(G.hype+6,0,100); G.cust.regulars+=4; return {good:true,note:'A few extra faces, and a little more buzz.'}; }});
def({id:'rentHike',cat:'money',sev:1,minAct:1,w:0.8,cd:99,tension:8,
  cond:function(G){ return G.arch==='venue' && G.mi>=8 && !G.flags.rentHike; },bind:function(){ return {}; },
  title:function(){ return 'The landlord is raising your rent'; },
  body:function(G){ return 'Twelve percent, starting next month. That is about '+fm(Math.round(SU.Shop.rent(G)*0.12))+' a month you did not plan for.'; },
  chips:function(){ return [{label:'Raise prices a little',text:'raise prices 3%'}]; },
  levers:['price'],
  resolve:function(G,c,did){ G.flags.rentHike=true; G.rentMult=1.12; if(did.price) return {good:true,note:'You passed some of it on. Regulars grumbled, and then paid.'}; return {note:'Rent is up 12% for good. Your margin took the hit.'}; },
  ignore:function(G){ G.flags.rentHike=true; G.rentMult=1.12; return {note:'Rent is up 12% for good. Your margin took the hit.'}; }});
def({id:'supplier',cat:'money',sev:1,minAct:1,w:0.8,cd:99,tension:4,
  cond:function(G){ return G.arch==='venue' && G.mi>=6 && !G.flags.supplierUp; },bind:function(){ return {}; },
  title:function(){ return 'Your supplier raised prices'; },
  body:function(){ return 'Liquor, produce and glassware all cost more. Your pour cost just went up about 2 points for half a year.'; },
  chips:function(){ return [{label:'Raise prices 4%',text:'raise prices 4%'}]; },
  levers:['price'],
  resolve:function(G,c,did){ G.flags.supplierUp=G.mi+6; if(did.price) return {good:true,note:'You raised prices 4% and mostly kept your margin.'}; return {note:'Pour cost is up about 2 points for six months.'}; },
  ignore:function(G){ G.flags.supplierUp=G.mi+6; return {note:'Pour cost is up about 2 points for six months.'}; }});
def({id:'aihalluc',cat:'product',sev:2,minAct:1,w:1.1,cd:7,tension:10,
  cond:function(G){ return G.flavor==='ai' && G.mi>=5 && SU.custCount(G)>=3 && !(G.flags.redteamUntil>G.mi) && !(G.feat&&G.feat.guardrails&&SU.chance(G,0.6,'events')); },bind:function(){ return {}; },
  title:function(){ return 'Your model told a customer something false'; },
  body:function(G){ return 'A screenshot is going around: the model confidently invented an answer, and the customer acted on it. '+(G.segId==='lawfirm'?'In a law firm, that is the worst kind of mistake.':'Customers are asking what you are going to do.'); },
  chips:function(){ return [{label:'Fix the failure mode',text:'pay down tech debt'},{label:'Talk to the customer',text:'interview 8 customers about what went wrong'}]; },
  levers:['refactor','talk'],
  resolve:function(G,c,did){ if(did.refactor){ G.Q=Math.min(100,G.Q+3); G.trust.cust=clamp(G.trust.cust-2,0,100); return {good:true,note:'You traced it, patched it and published the fix. Quality +3. Trust took a small hit.'}; } if(did.talk){ G.insight=clamp(G.insight+6,0,100); G.trust.cust=clamp(G.trust.cust-3,0,100); return {good:true,note:'You called them yourself. They stayed, and you learned how they actually use it.'}; } return {}; },
  ignore:function(G){ G.incidents+=2; fx(G,{trust:{cust:-10},shock:0.03,hype:-4}); return {note:'You said nothing. The screenshot kept spreading and customers noticed the silence.'}; }});
def({id:'tokencut',cat:'market',sev:0,minAct:1,w:0.7,cd:99,tension:-6,
  cond:function(G){ return G.flavor==='ai' && G.mi>=8 && !G.flags.tokenCut; },bind:function(){ return {}; },
  title:function(){ return 'A model provider cut its prices by 60%'; },
  body:function(){ return 'Serving the same answers just got a lot cheaper for everyone. Margins improve, and so do your competitors.'; },
  chips:function(){ return []; }, levers:[],
  resolve:function(G){ G.flags.tokenCut=true; G.ai.eff=Math.min(0.35,(G.ai.eff||0)+0.08); return {good:true,note:'Your gross margin rises about 2 points for good.'}; },
  ignore:function(G){ G.flags.tokenCut=true; G.ai.eff=Math.min(0.35,(G.ai.eff||0)+0.08); return {good:true,note:'Your gross margin rises about 2 points for good.'}; }});
def({id:'rugpull',cat:'market',sev:2,minAct:2,w:1,cd:99,tension:15,
  cond:function(G){ return (G.idea.ai||G.arch==='smb') && G.mi>10 && !G.flags.rugpull; },bind:function(){ return {}; },
  signal:{ahead:2,text:function(){ return 'Rumor: a platform you rely on is changing its terms.'; },mitigate:['build','pivot','price']},
  title:function(){ return 'Platform rug-pull'; },
  body:function(){ return 'A platform you depend on raised prices 4x and is shipping something that overlaps your product.'; },
  chips:function(){ return [{label:'Move up the workflow',text:'build a deeper workflow integration the platform cannot copy'},{label:'Raise price',text:'raise prices 15%'}]; },
  levers:['build','pivot','price'],
  resolve:function(G,c,did){ G.flags.rugpull=true; if(did.build||did.pivot){ G.fixed+=1000; return {good:true,note:'You moved up the stack. The change still costs you, but less.'}; } if(did.price){ G.fixed+=2000; return {note:'You raised prices to absorb it. Customers grumbled.'}; } G.fixed+=3000; fx(G,{shock:0.02}); return {note:'The change hit hard.'}; },
  ignore:function(G){ G.flags.rugpull=true; G.fixed+=3000; fx(G,{shock:0.03}); return {note:'The terms changed and you had no plan. Costs up, customers shaken.'}; }});
def({id:'viral',cat:'market',sev:1,minAct:2,w:0.8,cd:99,tension:5,
  cond:function(G){ return G.pmf>=55 && G.hype>25 && !G.flags.viral; },bind:function(){ return {}; },
  title:function(G){ return G.name+' is going viral'; },body:function(){ return 'A post took off. Traffic is spiking, and so are the server bills.'; },
  chips:function(){ return [{label:'Ride it',text:'pay down tech debt and hire a senior engineer'},{label:'Push marketing',text:'spend $5K on ads this month'}]; },
  levers:['refactor','hire','market','build'],
  resolve:function(G,c,did){ G.flags.viral=true; var gain=Math.round(8+SU.custCount(G)*0.2); if(G.arch==='smb') G.cust.n+=gain; else if(G.arch==='consumer'){ G.cust.mau+=gain*80; G.cust.payers+=Math.round(gain*0.3); } else { G.cust.D+=gain*4; G.cust.S+=gain; } G.hype=clamp(G.hype+10,0,100); if(did.refactor||did.hire) return {good:true,note:'You were ready. +'+gain+' signups held.'}; return {good:true,note:'+'+gain+' signups rolled in, and the site wobbled.'}; },
  ignore:function(G){ G.flags.viral=true; G.incidents+=1; return {note:'The wave passed while the site was down. A missed moment.'}; }});
def({id:'partner',cat:'market',sev:1,minAct:1,w:0.9,cd:14,tension:-8,
  cond:function(G){ return G.mi>=3 && SU.custCount(G)>=3; },bind:function(){ return {}; },
  title:function(){ return 'An inbound partnership'; },body:function(G){ return 'A company that sells to '+segWho(G)+' wants to integrate and co-market.'; },
  chips:function(){ return [{label:'Say yes',text:'build the integration and email 50 of their customers'},{label:'Take a call',text:'talk to 5 customers about the integration'}]; },
  levers:['build','outbound','talk','market'],
  resolve:function(G,c,did){ var gain=2+Math.round(SU.custCount(G)*0.05); if(G.arch==='smb') G.cust.pipe+=gain*(did.build?2:1); else if(G.arch==='consumer') G.cust.mau+=gain*60; else G.cust.D+=gain*8; G.hype=clamp(G.hype+3,0,100); return {good:true,note:'The partnership brings about '+gain*(did.build?2:1)+' new customers.'}; },
  ignore:function(){ return {note:'The offer lapsed.'}; }});
def({id:'coIdea',cat:'people',sev:1,minAct:2,w:0.7,cd:99,tension:-5,
  cond:function(G){ return !!G.co && G.co.bond>70 && !G.flags.coIdea; },bind:function(){ return {}; },
  title:function(G){ return G.co.name+'\'s big idea'; },body:function(G){ return 'Over dinner, '+first(G.co.name)+' pitches a new product line. It would take a quarter to build and might distract the whole team.'; },
  chips:function(G){ return [{label:'Build it',text:'build the new product line properly'},{label:'Park it kindly',text:'1:1 with '+first(G.co.name)+' about the new idea'}]; },
  levers:['build','talkto'],
  resolve:function(G,c,did){ G.flags.coIdea=true; if(did.build){ G.co.bond=clamp(G.co.bond+5,0,100); G.queue.push({id:'f'+(++G.fid),name:'the big idea',scope:20,progress:0,care:1,tags:[],born:G.t}); return {good:true,note:'Bond +5. It is on the roadmap, and it will take capacity.'}; } if(did.talkto){ G.co.bond=clamp(G.co.bond+3,0,100); return {good:true,note:'You parked it kindly. No hurt feelings.'}; } return {}; },
  ignore:function(G){ G.flags.coIdea=true; G.co.bond=clamp(G.co.bond-4,0,100); return {note:first(G.co.name)+' felt brushed off.'}; }});

/* ------------------------------------------------------------ rivals */
def({id:'priceWar',cat:'rivals',sev:2,minAct:1,w:3,cd:8,tension:15,
  cond:function(G){ return !!G.flags.priceWar && G.mi-G.flags.priceWar<=2 && G.rivals.some(function(r){ return r.id==='krellix'&&r.active; }); },bind:function(){ return {}; },
  title:function(){ return 'Krellix starts a price war'; },body:function(){ return 'They cut prices 30% and are telling customers you are overpriced.'; },
  chips:function(){ return [{label:'Hold and add value',text:'build something customers asked for and talk to 8 customers'},{label:'Match price',text:'lower prices 20%'}]; },
  levers:['price','build','talk','market'],
  resolve:function(G,c,did){ G.flags.priceWar=0; if(did.price){ G.hype=clamp(G.hype-2,0,100); return {note:'You matched. Margins are thin for both of you.'}; } if(did.build||did.talk){ G.insight=clamp(G.insight+3,0,100); return {good:true,note:'You held the line and added value. The best customers stayed.'}; } return {}; },
  ignore:function(G){ G.flags.priceWar=0; var k=G.rivals.filter(function(r){ return r.id==='krellix'; })[0]; if(k){ k.presence=clamp(k.presence+0.12,0,0.8); } fx(G,{shock:0.015}); return {note:'You did nothing. Krellix took share.'}; }});
def({id:'copycat',cat:'rivals',sev:2,minAct:2,w:1.2,cd:99,tension:10,
  cond:function(G){ var mm=G.rivals.filter(function(r){ return r.id==='mirrormint'&&r.active; })[0]; return !!mm && G.shipped.length>=2 && !G.flags.copycat; },bind:function(){ return {}; },
  signal:{ahead:1,text:function(){ return 'A suspicious domain looks a lot like your pricing page.'; },mitigate:['build','rival']},
  title:function(){ return 'MirrorMint copied your launch'; },body:function(){ return 'Dex Faraday shipped your feature with a gradient and a lower price.'; },
  chips:function(){ return [{label:'Out-ship them',text:'build the next feature properly'},{label:'Sue',text:'sue MirrorMint'}]; },
  levers:['build','rival','market'],
  resolve:function(G,c,did){ G.flags.copycat=true; if(did.rival){ if(SU.chance(G,0.3,'events')){ var mm=G.rivals.filter(function(r){ return r.id==='mirrormint'; })[0]; if(mm) mm.presence=Math.max(0,mm.presence-0.1); return {good:true,note:'You won in court.'}; } return {note:'The lawsuit cost you and changed nothing.'}; } if(did.build){ G.Q+=2; return {good:true,note:'You out-shipped them. Quality is your moat.'}; } if(did.market){ G.hype=clamp(G.hype+3,0,100); return {note:'You drowned them out with marketing.'}; } return {}; },
  ignore:function(G){ G.flags.copycat=true; var mm=G.rivals.filter(function(r){ return r.id==='mirrormint'; })[0]; if(mm) mm.presence=clamp(mm.presence+0.1,0,0.5); return {note:'MirrorMint took some of your demand.'}; }});
def({id:'gargantua',cat:'rivals',sev:3,minAct:2,w:1,cd:99,tension:25,
  cond:function(G){ return !G.flags.garg && ((G.act>=3) || (G.idea.ai && G.mi>14) || (SU.arr(G)>3e6)); },bind:function(){ return {}; },
  signal:{ahead:3,text:function(){ return 'Project Pelican: Gargantua is building something in your category.'; },mitigate:['pivot','exit','build','price']},
  title:function(){ return 'Gargantua bundles it for free'; },body:function(){ return 'Gargantua is giving away a bundled version of what you sell. Overlapping customers ask why they should pay.'; },
  chips:function(){ return [{label:'Hire a banker',text:'hire a banker'},{label:'Build what they cannot',text:'build a niche feature big companies skip'}]; },
  levers:['exit','pivot','build','price'],
  resolve:function(G,c,did){ G.flags.garg=true; Ev.activateGarg(G,0.25); if(did.exit) return {good:true,note:'You called a banker. Expect offers soon.'}; if(did.pivot||did.build){ return {good:true,note:'You moved to ground Gargantua is slow to cover. The bundle hurts less.'}; } return {note:'You priced into it. Pain, but not panic.'}; },
  ignore:function(G){ G.flags.garg=true; Ev.activateGarg(G,0.45); fx(G,{shock:0.02}); return {note:'The bundle landed with no answer from you. Churn spiked.'}; }});
Ev.activateGarg=function(G,pres){ var g=G.rivals.filter(function(r){ return r.id==='gargantua'; })[0]; if(!g){ var r=SU.rivalById('gargantua'); g={id:'gargantua',name:r.name,boss:r.boss,persona:r.persona,cash:r.cash,burn:0,Q:r.Q,price:0.35,hype:r.hype,ethics:r.ethics,growth:0.3,presence:pres,active:true,respect:0,grudge:0,mem:[],raised:0}; G.rivals.push(g); } else { g.active=true; g.presence=Math.max(g.presence,pres); } };
def({id:'fireSale',cat:'rivals',sev:1,minAct:1,w:3,cd:99,tension:-10,
  cond:function(G){ return !!G.flags.krellixDead && !G.flags.fireSale; },bind:function(){ return {}; },
  title:function(){ return 'Fire sale: Krellix is gone'; },body:function(){ return 'Their customers and engineers are available at a discount.'; },
  chips:function(){ return [{label:'Buy the customers',text:'buy Krellix customers and hire their engineers'}]; },
  levers:['rival','hire','market','exit'],
  resolve:function(G,c,did){ G.flags.fireSale=true; if(G.cash<60000) return {note:'You could not afford the fire sale.'}; G.cash-=60000; SU.drv(G,'cash',-60000,'Fire sale'); var gain=Math.round(Math.max(5,SU.custCount(G)*0.25)); if(G.arch==='smb') G.cust.n+=gain; else if(G.arch==='consumer'){ G.cust.mau+=gain*60; G.cust.payers+=Math.round(gain*0.4); } else { G.cust.D+=gain*5; G.cust.S+=gain; } G.reqs.push({id:'q'+(++G.rid),role:'eng',level:'senior',comp:SU.salaryFor(G,'eng','senior')*0.9,equity:0.002,age:2,agency:false}); return {good:true,note:'You bought their customers (+'+gain+') for '+fm(60000)+' and are recruiting a Krellix engineer.'}; },
  ignore:function(G){ G.flags.fireSale=true; return {note:'Someone else picked up the pieces.'}; }});

/* ------------------------------------------------------------ money and markets */
def({id:'marketTurn',cat:'money',sev:2,minAct:1,w:0,cd:99,tension:20,auto:true,
  cond:function(G){ return false; },bind:function(){ return {}; },
  title:function(G){ return 'The market turned: '+SU.era(G).name; },body:function(G){ return 'Funding dried up. Investors pull term sheets and hiring freezes spread. Cut burn or raise what you can.'; },
  chips:function(){ return [{label:'Cut burn 30%',text:'cut burn 30%'},{label:'Raise now',text:'raise a bridge from insiders'}]; },
  levers:['finance','fundraise','fire'],
  resolve:function(G){ return {note:'You took it seriously.'}; },ignore:function(G){ return {note:'Cash is now the only thing that matters.'}; }});
def({id:'talentWave',cat:'money',sev:1,minAct:1,w:2,cd:12,tension:-10,
  cond:function(G){ var k=SU.era(G).key; return (k==='correction'||k==='crash'||k==='bust') && G.cash>50000; },bind:function(){ return {}; },
  title:function(){ return 'Big companies are laying people off'; },body:function(){ return 'Great engineers are on the market at a discount. This will not last.'; },
  chips:function(){ return [{label:'Hire two senior engineers',text:'hire two senior engineers'}]; },
  levers:['hire'],
  resolve:function(G,c,did){ var n=0; G.reqs.forEach(function(r){ if(!r.disc){ r.comp=Math.round(r.comp*0.85/1000)*1000; r.disc=true; r.age+=2; n++; } }); return {good:true,note:n?'You moved fast: '+n+' open roles filled at about a 15% discount.':'Nothing to hire for.'}; },
  ignore:function(){ return {note:'The window closed.'}; }});
def({id:'covenant',cat:'money',sev:2,minAct:3,w:3,cd:12,tension:15,
  cond:function(G){ return !!G.loans.debt && G.loans.debt.bal>0 && G.cash<3*Math.max(1,SU.fin(G).burn); },bind:function(){ return {}; },
  signal:{ahead:1,text:function(){ return 'Bridgewell reminded you of the cash covenant.'; },mitigate:['finance','fundraise','fire']},
  title:function(){ return 'Covenant breach'; },body:function(){ return 'Cash fell under three months of burn. The bank can sweep your account.'; },
  chips:function(){ return [{label:'Cut burn',text:'cut burn 25%'},{label:'Raise',text:'raise a bridge'}]; },
  levers:['finance','fundraise','fire'],
  resolve:function(G){ var fee=Math.round(G.loans.debt.bal*0.02); G.cash-=fee; SU.drv(G,'cash',-fee,'Waiver fee'); return {good:true,note:'Bridgewell granted a waiver for a '+fm(fee)+' fee.'}; },
  ignore:function(G){ var s=Math.round(Math.max(0,G.cash)*0.5); G.cash-=s; SU.drv(G,'cash',-s,'Bank sweep'); return {note:'The bank swept '+fm(s)+' from your account.'}; }});
def({id:'tourist',cat:'money',sev:1,minAct:1,w:3,cd:99,tension:-5,auto:true,
  cond:function(G){ return SU.era(G).key==='zero' && !G.round && !G.flags.tourist && G.t>=3; },bind:function(){ return {}; },
  title:function(){ return 'Bryce Calloway wants to pre-empt your round'; },body:function(){ return 'Moonshot Opportunity Fund will wire money in 36 hours at a rich price. No board seat. Also FOMO.'; },
  chips:function(){ return [{label:'Take the offer',text:'accept the term sheet'}]; },
  levers:['fundraise'],
  fire:function(G){ G.flags.tourist=true; var stage=(G.mrr>40000?'A':G.mrr>3000?'seed':'preseed'); var inv=SU.investor('bryce'); var r=M.openRound(G,{stage:stage,targets:['bryce']},1); r.pipe=r.pipe.filter(function(p){ return p.inv==='bryce'; }); if(!r.pipe.length){ r.pipe.push({inv:'bryce',stage:'intro',interest:80,turns:0,warm:true,bonus:20}); } var p=r.pipe[0]; p.interest=Math.max(75,p.interest); p.stage='sheet'; p.sheetLeft=1; M.makeSheet(G,r,inv,p); },
  resolve:function(G){ return {note:'You decided.'}; },ignore:function(G){ return {note:''}; }});
def({id:'offer',cat:'money',sev:1,minAct:1,w:0,cd:99,tension:0,auto:true,
  cond:function(){ return false; },bind:function(){ return {}; },
  title:function(){ return 'An offer to buy the company'; },body:function(){ return ''; },chips:function(){ return []; },levers:[],
  fire:function(G){ if(G.offer) return; G.offer=M.makeOffer(G); SU.inbox(G,{kind:'opp',title:'OFFER: '+G.offer.buyer+' wants to buy you',body:fm(G.offer.price)+', '+G.offer.struct+'. Expires in '+G.offer.left+' turns.',action:{type:'offer'}}); SU.journal(G,'Acquisition offer from '+G.offer.buyer+'.','money',true); },
  resolve:function(G){ return {note:''}; },ignore:function(G){ return {note:''}; }});

/* ------------------------------------------------------------ press, ethics, founder */
def({id:'forumFront',cat:'press',sev:1,minAct:1,w:0,cd:99,tension:0,auto:true,cond:function(G){ return false; },bind:function(){ return {}; },
  title:function(){ return 'Hacker Forum front page'; },body:function(){ return ''; },chips:function(){ return []; },levers:[],
  fire:function(G){ var good=G.Q>=40&&G.trust.cust>=45; var cm=SU.pick(G,good?['"This is exactly what I needed, and the founders are in the thread."','"Tried it for ten minutes. The onboarding is actually good."']:['"This is just a cron job."','"Cool landing page. Where is the product?"','"Why would anyone pay for this?"'],'media'); G.hype=clamp(G.hype+(good?8:-4),0,100); G.trust.press=clamp(G.trust.press+(good?5:-4),0,100); SU.inbox(G,{kind:good?'opp':'info',title:'Hacker Forum front page',body:(good?'You hit the front page. ':'You hit the front page for the wrong reasons. ')+'Top comment: '+cm}); },
  resolve:function(){ return {note:''}; },ignore:function(){ return {note:''}; }});
def({id:'techpulse',cat:'press',sev:1,minAct:2,w:0,cd:99,tension:0,auto:true,cond:function(G){ return false; },bind:function(){ return {}; },
  title:function(){ return 'TechPulse Rising 30'; },body:function(){ return ''; },chips:function(){ return []; },levers:[],
  fire:function(G){ G.flags.tpRising=true; G.hype=clamp(G.hype+10,0,100); SU.inbox(G,{kind:'opp',title:'TechPulse "Rising 30" list',body:G.name+' made the list. Hype +10. Founders who believe the list stop listening to customers.'}); SU.journal(G,'Named to TechPulse Rising 30.','press',true); },
  resolve:function(){ return {note:''}; },ignore:function(){ return {note:''}; }});
def({id:'ledger',cat:'press',sev:3,minAct:1,w:3,cd:99,tension:25,
  cond:function(G){ return G.ethics>=40 && !G.flags.ledger; },bind:function(){ return {}; },
  signal:{ahead:2,text:function(){ return 'A reporter contacted a former employee.'; },mitigate:['talkto']},
  title:function(){ return 'The Ledger investigation'; },body:function(){ return 'Corinne Vale is publishing a story about your practices on Friday. She asked for comment.'; },
  chips:function(){ return [{label:'Come clean',text:'tell the team, investors and customers the truth and apologize'}]; },
  levers:['talkto'],
  resolve:function(G,c,did){ G.flags.ledger=true; if((did.talkto||[]).some(function(x){ return x.params.truth||x.params.apologize; })){ fx(G,{trust:{cust:-8,press:-6},hype:-6,ethics:-15,board:-4}); return {good:true,note:'You self-disclosed. The story hurt, but it could have been far worse.'}; } fx(G,{trust:{cust:-14,press:-12},hype:-12,board:-10,reg:10}); return {note:'You said something vague. The story ran in full.'}; },
  ignore:function(G){ G.flags.ledger=true; fx(G,{trust:{cust:-20,press:-18,inv:-12},hype:-18,board:-15,reg:15}); if(G.ethics>=70){ G.pendingEnd={type:'fraud'}; } return {note:'The exposé ran. Customers, staff and investors all read it.'}; }});
def({id:'chirp3am',cat:'press',sev:1,minAct:1,w:3,cd:6,tension:5,
  cond:function(G){ return G.founder.sanity<20; },bind:function(){ return {}; },
  title:function(){ return 'You posted at 3am'; },body:function(){ return 'Sleep deprivation made a bad idea feel brilliant. It is already getting screenshots.'; },
  chips:function(){ return [{label:'Delete and apologize',text:'apologize to the team and take a week off'}]; },
  levers:['self','talkto'],
  resolve:function(G){ fx(G,{trust:{press:-3}}); return {good:true,note:'You deleted it and apologised. Mostly forgotten.'}; },
  ignore:function(G){ if(SU.chance(G,0.25,'events')){ fx(G,{hype:-8,trust:{press:-10,inv:-5}}); return {note:'The post went viral for the wrong reasons.'}; } return {note:'Nobody noticed. Lucky.'}; }});
def({id:'ev_dark',cat:'ethics',sev:2,minAct:1,w:0,cd:99,tension:15,
  cond:function(){ return false; },bind:function(){ return {}; },
  title:function(){ return 'Dark pattern fallout'; },body:function(){ return 'Complaints about hard-to-cancel subscriptions are piling up, and a regulator sent a letter.'; },
  chips:function(){ return [{label:'Refund and remove it',text:'tell customers the truth, refund affected users and build a clear cancel flow'}]; },
  levers:['talkto','build','price'],
  resolve:function(G,c,did){ G.flags.darkUntil=0; if(did.talkto||did.build){ fx(G,{trust:{cust:-5},reg:2,ethics:-8}); return {good:true,note:'You refunded and removed it. A warning, not a fine.'}; } fx(G,{trust:{cust:-10}}); return {note:'You made a token change. Trust slipped.'}; },
  ignore:function(G){ var fine=Math.min(2e6,50000+(G.mrr||0)*3); G.cash-=fine; SU.drv(G,'cash',-fine,'Regulatory fine'); fx(G,{trust:{cust:-15},reg:10}); return {note:'A regulator fined you '+fm(fine)+'.'}; }});
def({id:'ev_reviews',cat:'ethics',sev:1,minAct:1,w:0,cd:99,tension:0,auto:true,cond:function(){ return false; },bind:function(){ return {}; },
  title:function(){ return 'Review purge'; },body:function(){ return ''; },chips:function(){ return []; },levers:[],
  fire:function(G){ G.hype=clamp(G.hype-10,0,100); G.trust.press=clamp(G.trust.press-8,0,100); G.flags.rankUntil=0; SU.inbox(G,{kind:'crisis',title:'Fake reviews purged',body:'The store removed hundreds of reviews and your ranking dropped. Hype -10.'}); },
  resolve:function(){ return {note:''}; },ignore:function(){ return {note:''}; }});
def({id:'ev_data',cat:'ethics',sev:2,minAct:1,w:0,cd:99,tension:15,
  cond:function(){ return false; },bind:function(){ return {}; },
  title:function(){ return 'Data sale exposed'; },body:function(){ return 'A researcher traced a dataset back to you. Customers are asking what you sold.'; },
  chips:function(){ return [{label:'Disclose and apologize',text:'tell customers the truth and apologize'}]; },
  levers:['talkto'],
  resolve:function(G,c,did){ if(did.talkto){ fx(G,{trust:{cust:-12,press:-6},reg:8,ethics:-8}); return {good:true,note:'You disclosed quickly. The damage was half of what it could have been.'}; } fx(G,{trust:{cust:-20,press:-10},reg:12}); return {note:'Your reply was thin.'}; },
  ignore:function(G){ fx(G,{trust:{cust:-25,press:-10},reg:15}); return {note:'Trust fell off a cliff.'}; }});

/* ------------------------------------------------------------ showrunner */
function tension(G){
  var f=SU.fin(G); var T=60*Math.max(0,1-Math.min(f.runway,24)/12)+15*G.ev.open.filter(function(e){ return e.sev>=2; }).length+10*(G.rivals.some(function(r){ return r.active&&r.presence>0.35; })?1:0)+10*(G.board.mood<40?1:0)+10*(G.founder.sanity<40?1:0);
  return clamp(T,0,100);
}
var TARGET=[30,40,50,60,70,85,50,35];
function openEvent(G,def,ctx){
  var e={uid:'u'+(++G.eid),id:def.id,ctx:ctx||{},sev:def.sev,t0:G.t,dueT:G.t+(def.deadline||1),title:def.title(G,ctx||{}),body:def.body(G,ctx||{}),chips:def.chips(G,ctx||{})};
  G.ev.open.push(e); G.ev.cool[def.id]=G.t;
  var kind=def.sev>=2?'crisis':(def.cat==='market'||def.cat==='money'?'opp':'info');
  SU.inbox(G,{kind:kind,title:e.title,body:e.body,chips:e.chips,evUid:e.uid,sev:def.sev});
  if(def.sev>=3) G.ev.lastSev3=G.t;
  return e;
}
function fireNow(G,def,ctx,rec,viaSched){
  if(def.auto){ if(def.fire) def.fire(G,ctx); return; }
  openEvent(G,def,ctx);
}
function scheduled(G,rec){
  var due=G.ev.sched.filter(function(s){ return s.t<=G.t; }); G.ev.sched=G.ev.sched.filter(function(s){ return s.t>G.t; });
  due.forEach(function(s){
    var d=DEFS[s.id]; if(!d) return;
    if(s.mit){ SU.inbox(G,{kind:'opp',title:'Averted: '+d.title(G,s.ctx||{}),body:'Your earlier move headed it off.'}); return; }
    if(d.cond && !d.auto && s.fromSignal===undefined){ }
    fireNow(G,d,s.ctx||d.bind(G)||{},rec,true);
  });
}
function showrunner(G,rec){
  var open=G.ev.open.filter(function(e){ return e.sev>=2; }).length;
  if(open>=1) return;
  if(G.t-(G.ev.lastSev3===undefined?-99:G.ev.lastSev3)<=2 && G.ev.lastSev3!==undefined) { /* quiet after a major crisis */ }
  var T=tension(G), target=TARGET[G.t%8];
  var p=0.5+(T<target-15?0.15:0)-(T>target+15?0.2:0)+(G.act>=2?0.05:0);
  if(!SU.chance(G,p,'events')) return;
  var pool=LIST.filter(function(d){
    if(d.w<=0) return false; if(G.act<d.minAct) return false; if(d.maxAct && G.act>d.maxAct) return false;
    var last=G.ev.cool[d.id]; if(last!==undefined && G.t-last<(d.cd||6)) return false;
    if(G.ev.open.some(function(e){ return e.id===d.id; })) return false; if(G.ev.sched.some(function(s){ return s.id===d.id; })) return false;
    if(G.ev.lastSev3!==undefined && G.t-G.ev.lastSev3<=3 && d.sev>=2) return false;
    if(G.ev.lastSev3!==undefined && G.t-G.ev.lastSev3<=2 && d.cat!=='market' && d.sev>=2) return false;
    try{ return d.cond(G); }catch(e){ return false; }
  });
  if(!pool.length) return;
  var d=SU.wpick(G,pool,function(x){ return x.w*(1+0.03*(target-T)*x.tension/10); },'events');
  var ctx=d.bind(G)||{};
  if(d.signal && d.sev>=2){
    var text=typeof d.signal.text==='function'? d.signal.text(G,ctx) : d.signal.text;
    SU.inbox(G,{kind:'signal',title:'Signal: '+text,body:'Something may be coming. A move in the next turn can head it off.',sev:d.sev});
    G.ev.sched.push({t:G.t+d.signal.ahead,id:d.id,ctx:ctx,mitigate:d.signal.mitigate});
    G.ev.cool[d.id]=G.t;
  } else fireNow(G,d,ctx,rec);
}
/* resolve open events against the clauses you just typed */
Ev.resolve=function(G,clauses,rec){
  var did=didMap(clauses);
  /* mitigation of scheduled crises */
  G.ev.sched.forEach(function(s){ if(s.mitigate && s.mitigate.some(function(l){ return did[l]; }) && !s.mit && s.t>G.t){ s.mit=true; } if(s.mitigate && s.mitigate.some(function(l){ return did[l]; }) && s.t===G.t+0 && !s.mit){ s.mit=true; } });
  var keep=[];
  G.ev.open.forEach(function(e){
    var d=DEFS[e.id]; if(!d){ return; }
    var responded=(d.levers||[]).some(function(l){ return did[l]; });
    var item={title:e.title,id:e.id};
    if(responded){ var res=d.resolve(G,e.ctx,did)||{}; if(res.note){ item.note=res.note; item.outcome=res.good?'handled':'mixed'; rec.events.push(item); SU.journal(G,e.title+': '+res.note,'event',false); } }
    else if(G.t>=e.dueT){ var ig=d.ignore(G,e.ctx)||{}; if(ig.note){ item.note=ig.note; item.outcome='ignored'; rec.events.push(item); SU.journal(G,e.title+' (no response): '+ig.note,'event'); } }
    else keep.push(e);
    SU.inboxClose(G,e.uid);
  });
  G.ev.open=keep.filter(function(e){ return true; });
  /* items that were kept stay in the inbox */
  keep.forEach(function(e){ SU.inboxOpen(G,e.uid); });
};
SU.inboxClose=function(G,uid){ G.inbox.forEach(function(i){ if(i.evUid===uid) i.open=false; }); };
SU.inboxOpen=function(G,uid){ G.inbox.forEach(function(i){ if(i.evUid===uid) i.open=true; }); };

/* ------------------------------------------------------------ after a turn */
function stats(G){
  if(G.co){ G.flags.coLowTurns = G.co.bond<35 ? (G.flags.coLowTurns||0)+1 : 0; G.co.bond=clamp(G.co.bond+(G.co.bond>60?-0.3:0.1),0,100); /* bond drifts toward comfort */ }
  var g=SU.growthMo(G); G.flags.slowTurns=(g<0.02 && SU.fin(G).defaultAlive)? (G.flags.slowTurns||0)+1 : 0;
  var k=SU.phaseKey(G.year,G.month); if(G.flags.lastPhase && G.flags.lastPhase!==k && ['crash','bust','correction'].indexOf(k)>=0){ Ev.marketTurn(G); } G.flags.lastPhase=k;
  /* certifications finishing */
  ['soc2','hipaa'].forEach(function(c){ if(G.flags['c_'+c] && G.flags['c_'+c]<=G.mi && !G.flags[c]){ G.flags[c]=true; SU.journal(G,c.toUpperCase()+' certification complete.','milestone',true); SU.inbox(G,{kind:'opp',title:c.toUpperCase()+' complete',body:'Buyers that care about it will now take your calls.'}); } });
  /* board mood */
  var f=SU.fin(G); var base=50+(g>0.08?15:g<0?-15:0)+(f.defaultAlive?10:-20)+(G.trust.inv-50)/4-(G.ethics>40?10:0); G.board.mood=clamp(G.board.mood+(base-G.board.mood)*0.12,0,100);
}
Ev.marketTurn=function(G){ var k=SU.era(G); G.hype=clamp(G.hype-10,0,100); var n=0; if(G.round){ G.round.sheets.forEach(function(s){ if(s.state==='live'){ if(s.pre) s.pre=Math.round(s.pre*0.7/1e4)*1e4; if(s.cap) s.cap=Math.round(s.cap*0.7/1e4)*1e4; n++; } }); } var d=DEFS.marketTurn; openEvent(G,d,{}); SU.journal(G,'The market turned: '+k.name+'.','era',true); if(n) SU.inbox(G,{kind:'crisis',title:'Term sheets repriced',body:n+' live offer(s) were cut 30% as the market turned.'}); };
function promises(G,rec){
  G.promises.forEach(function(p){ if(p.state!=='open'||G.t<p.due) return; var kept=p.tags&&p.tags.length? G.shipped.some(function(s){ return s.tags&&p.tags.some(function(t){ return s.tags.indexOf(t)>=0; }) && s.t>=G.t-8; }) : G.shipped.length>0&&G.shipped[G.shipped.length-1].t>=G.t-4;
    p.state=kept?'kept':'broken';
    if(kept){ G.trust.cust=clamp(G.trust.cust+5,0,100); G.trust.inv=clamp(G.trust.inv+3,0,100); SU.inbox(G,{kind:'opp',title:'Promise kept',body:'You delivered "'+p.what+'".'}); SU.journal(G,'Kept a promise: '+p.what+'.','promise'); }
    else { G.trust.cust=clamp(G.trust.cust-15,0,100); G.trust.inv=clamp(G.trust.inv-8,0,100); G.founder.cred=clamp(G.founder.cred-5,0,100); SU.inbox(G,{kind:'crisis',title:'Promise broken',body:'You did not deliver "'+p.what+'". Customers and investors remember.'}); SU.journal(G,'Broke a promise: '+p.what+'.','promise',true); }
  });
}
function offers(G,rec){
  if(G.offer){ G.offer.left--; if(G.offer.left<0){ SU.inbox(G,{kind:'info',title:'The offer expired',body:G.offer.buyer+' moved on.'}); G.offer=null; } return; }
  if(G.banker){ G.banker--; if(G.banker<=0){ G.banker=0; DEFS.offer.fire(G); return; } }
  if(G.act>=3 && SU.chance(G,SU.turnMonths(G)*(0.1+0.2*G.hype/100+(G.rivals.some(function(r){ return r.id==='gargantua'&&r.active; })?0.3:0))/3,'events')) DEFS.offer.fire(G);
  else if(G.act>=2 && SU.fin(G).runway<4 && SU.fin(G).burn>0 && SU.headcount(G)>=4 && SU.chance(G,0.12,'events')){ var o=M.makeOffer(G); o.kind=(G.arch==='venue'?'strategic':'acquihire'); o.buyer=(G.arch==='venue'?'a local restaurant group that wants your room':'a big company that wants your team'); o.price=Math.round((SU.count(G,'eng')+1)*1.4e6/1e4)*1e4; o.struct='cash, with 2-year retention packages'; G.offer=o; SU.inbox(G,{kind:'opp',title:'ACQUI-HIRE OFFER',body:fm(o.price)+' for the team. It is not a great price, but it is a soft landing.',action:{type:'offer'}}); }
}
function ipoStep(G,rec){
  if(!G.ipo||!G.ipo.open) return;
  if(G.t>G.flags.ipoPrep){
    var E=SU.era(G); var crash=SU.chance(G,(1-E.ipoWindow)*0.3,'events');
    if(crash){ G.ipo=null; SU.inbox(G,{kind:'crisis',title:'IPO postponed',body:'Markets turned during the roadshow. The window closed.'}); fx(G,{hype:-8}); return; }
    var tier=G.ipo.tier||'mid'; var ev=Math.max(SU.valuation(G),SU.arr(G)*E.mult*0.8);
    var pop=tier==='low'?SU.lerp(0.25,0.5,SU.rnd(G,'events')):tier==='high'?SU.lerp(-0.05,0.15,SU.rnd(G,'events')):SU.lerp(0.1,0.3,SU.rnd(G,'events'));
    G.pendingEnd={type:'bell',tier:tier,value:ev*(tier==='low'?0.9:tier==='high'?1.15:1),pop:pop};
    Ev.endNow(G,G.pendingEnd); G.pendingEnd=null;
  }
}
function boardStep(G,rec){
  var inv=G.board.seats.investors+G.board.seats.independent, fnd=G.board.seats.founders-(G.co?0:0);
  if(G.board.mood<30 && inv>=fnd && G.rounds.length && SU.chance(G,(0.15+0.3*(30-G.board.mood)/30)/3*SU.turnMonths(G),'events')){
    if(G.board.ally && SU.chance(G,0.5,'events')){ SU.inbox(G,{kind:'opp',title:'Your ally saved you at the board',body:'The independent director talked the board out of a vote.'}); G.board.mood+=8; return; }
    G.pendingEnd={type:'coup'}; Ev.endNow(G,G.pendingEnd); G.pendingEnd=null;
  } else if(G.board.mood<40 && G.rounds.length && !G.flags.boardWarn){ G.flags.boardWarn=true; SU.inbox(G,{kind:'signal',title:'Signal: your lead investor asked the independent for a 1:1',body:'Board mood is low. Send an honest investor update and fix the numbers.',chips:[{label:'Update the board',text:'update the investors and tell them the truth'}]}); }
  if(G.board.mood>55) G.flags.boardWarn=false;
}
Ev.after=function(G,rec){
  if(G.over) return;
  stats(G); promises(G,rec); scheduled(G,rec);
  if(Ev.checkEnd(G,rec)) return;
  showrunner(G,rec); offers(G,rec); ipoStep(G,rec); boardStep(G,rec);
  if(G.over) return;
  Ev.checkEnd(G,rec);
  if(SU.checkAchv) SU.checkAchv(G,rec);
  if(SU.Goals) SU.Goals.check(G,rec);
  /* act banner */
  if(G.actNew){ rec.actBanner=SU.ACTS[G.act-1]; G.actNew=false; }
};
Ev.checkEnd=function(G,rec){
  if(G.over) return true;
  if(G.founder.sanity<=0){
    if(G.co && G.co.bond>60){ G.founder.sanity=40; G.flags.recovering=3; SU.inbox(G,{kind:'crisis',title:'You collapsed',body:G.co.name+' kept the company running while you recovered for three weeks.'}); SU.journal(G,'Burnout. '+G.co.name+' covered.','people',true); return false; }
    Ev.endNow(G,{type:'burnout'}); return true;
  }
  if(G.mi>=120){ Ev.endNow(G,{type:'decade'}); return true; }
  var f=SU.fin(G);
  if(G.cash<0){
    if(!G.lastStand){ G.lastStand=true; G.lastStandT=G.t; rec.lastStand=true; SU.inbox(G,{kind:'crisis',title:'PAYROLL FRIDAY: '+fm(f.ex.payroll)+' due. '+fm(Math.max(0,G.cash))+' in the bank.',body:'You are out of cash. You have one turn and +3 focus. Options: founder credit card, defer pay, an insider bridge, revenue-based financing, layoffs, an acqui-hire.',chips:[{label:'Founder credit card',text:'put $25K on the founder credit card'},{label:'Defer staff pay',text:'defer 30% of staff pay this month'},{label:'Lay off 25%',text:'let go of 25% of the team'},{label:'Insider bridge',text:'raise an insider bridge'}]}); SU.journal(G,'Payroll Friday.','crisis',true); return false; }
    if(G.t>G.lastStandT){
      if(G.team.length===0 && (G.mrr||0)>=0.8*(f.ex.total-f.ex.payroll-(G.founder.pay||0)*(G.co?2:1))){ G.zombie=true; G.cash=0; G.lastStand=false; SU.journal(G,'You keep the lights on as a two-person zombie.','money',true); SU.inbox(G,{kind:'info',title:'Zombie mode',body:'Only the founders remain and revenue covers the tools. The company survives, but it is not going anywhere.'}); return false; }
      Ev.endNow(G,{type:'shutdown'}); return true;
    }
    return false;
  }
  if(G.lastStand && G.cash>=0){ var proj=G.cash+(-f.burn); if(proj>=0){ G.lastStand=false; SU.journal(G,'Survived Payroll Friday.','crisis',true); SU.inbox(G,{kind:'opp',title:'You survived Payroll Friday',body:'The wire hit in time. Do not make a habit of it.'}); } }
  else if(!G.lastStand && f.burn>0 && (G.cash-f.burn)<0){ G.lastStand=true; G.lastStandT=G.t; rec.lastStand=true; SU.inbox(G,{kind:'crisis',title:'PAYROLL FRIDAY: '+fm(f.ex.payroll)+' due. '+fm(G.cash)+' in the bank.',body:'Next month\'s payroll will bounce unless something changes. You get +3 focus this turn.',chips:[{label:'Founder credit card',text:'put $25K on the founder credit card'},{label:'Cut burn 30%',text:'cut burn 30%'},{label:'Lay off 25%',text:'let go of 25% of the team'},{label:'Raise',text:'raise $500K on a SAFE'}]}); SU.journal(G,'Payroll Friday.','crisis',true); }
  return false;
};
/* the offer on the table */
Ev.acceptOffer=function(G){ if(!G.offer) return; G.pendingEnd={type:'sale',offer:G.offer}; Ev.endNow(G,G.pendingEnd); G.pendingEnd=null; };
Ev.counterOffer=function(G){ if(!G.offer||G.offer.counters<=0) return {ok:false,msg:'No counters left.'}; G.offer.counters--; if(SU.chance(G,0.25+0.2*(G.rivals.some(function(r){ return r.id==='gargantua'; })?1:0),'events')){ G.offer.price=Math.round(G.offer.price*1.2/1e5)*1e5; return {ok:true,msg:'They came up to '+fm(G.offer.price)+'.'}; } if(SU.chance(G,0.15,'events')){ var b=G.offer.buyer; G.offer=null; return {ok:false,msg:b+' walked away.'}; } return {ok:true,msg:'They held firm at '+fm(G.offer.price)+'.'}; };
Ev.declineOffer=function(G){ if(G.offer){ SU.journal(G,'Turned down '+G.offer.buyer+'.','money'); G.offer=null; } };
Ev.endNow=function(G,end){
  if(G.over) return;
  var o=end||{}; o.t=G.t; o.date=SU.dateStr(G); G.over=o; G.pendingEnd=null;
  SU.journal(G,'The end: '+(SU.endTitle?SU.endTitle(o,G):o.type)+'.','end',true);
  if(SU.Story) SU.Story.finalize(G);
};
})();
