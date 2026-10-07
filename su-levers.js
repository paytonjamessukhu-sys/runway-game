/* RUNWAY - levers: what each clause does, the focus budget, the receipt, and the turn commit. */
(function(){
var SU = (window.SU = window.SU || {});
var clamp=SU.clamp, M=SU.Money;
var A={}; SU.Apply=A;
SU.sched=function(G,turns,id){ G.ev.sched.push({t:G.t+turns,id:id}); };

function note(r,t){ r.lines.push(t); }
function why(r,t){ r.because.push(t); }
function seg(G){ return SU.seg(G); }
function fm(n){ return SU.fmtMoney(n); }
function findPerson(G,id){ if(id==='co') return G.co; for(var i=0;i<G.team.length;i++) if(G.team[i].id===id) return G.team[i]; return null; }
function spend(G,amount,cause){ G.cash-=amount; SU.drv(G,'cash',-amount,cause); }

/* ------------------------------------------------------------ levers */
A.talk=function(G,cl,ctx,r){
  var p=cl.params, S=seg(G), n=Math.round(p.n*ctx.ff); if(p.pilot) n=Math.max(2,Math.round(n/2)); n=clamp(n,1,40);
  var wrong=p.seg && SU.SEG[p.seg] && p.seg!==G.segId; var eff=ctx.eff*(wrong?0.25:1);
  spend(G,n*20,'Customer interviews');
  var revealed=[];
  if(p.survey){
    if(SU.custCount(G)<20){ note(r,'A survey needs at least 20 customers. You have '+SU.custCount(G)+'.'); r.status='warn'; }
    else { G.survey={t:G.t,pmf:clamp(G.pmf+SU.randn(G,'market')*5,0,100)}; note(r,'Survey result: about '+Math.round(G.survey.pmf)+' out of 100 on product-market fit (give or take 5).'); }
  }
  for(var i=0;i<n;i++){ G.needs.forEach(function(nd){ if(nd.real && !nd.revealed && SU.chance(G,0.12*eff,'market')){ nd.revealed=true; revealed.push(nd); } }); }
  if(SU.chance(G,Math.min(0.9,0.05*n*eff),'market')){ var h=G.needs.filter(function(x){ return x.herring && !x.revealed; })[0]; if(h){ h.revealed=true; note(r,'Several people asked for "'+h.name+'", but they were not willing to pay for it.'); } }
  var gain=(100-G.insight)*(1-Math.pow(1-0.028*eff,n)); G.insight=clamp(G.insight+gain,0,100);
  G.wtpBand=Math.max(0.18,G.wtpBand*Math.pow(0.92,n*(wrong?0.3:1)));
  if(G.arch==='smb' && SU.chance(G,0.03*n*eff,'market')){ G.cust.pipe+=1; note(r,'One of them wants to become a design partner.'); }
  note(r,'Talked to '+n+' '+(wrong?'people (not your target customer)':'people')+'. Insight +'+Math.round(gain)+'.');
  revealed.forEach(function(nd){ note(r,'Learned: "'+nd.name+'" matters here (weight '+nd.w+' of 3).'); SU.journal(G,'Customers revealed a real need: '+nd.name+'.','insight'); });
  if(revealed.length===1 && S.quote) note(r,S.quoteName+': "'+S.quote+'"');
  why(r,'Each interview reveals an unseen need with 12% chance; the wider your insight, the narrower the price and fit ranges.');
  if(wrong){ r.status='warn'; note(r,'Warning: you sell to '+S.who+', not to those people.'); }
  if(!revealed.length && n>=8) note(r,'Nothing new this time. Keep listening to different people.');
};
A.build=function(G,cl,ctx,r){
  var p=cl.params;
  if(G.queue.length>=6){ note(r,'Your build queue is full (6). Ship something first.'); r.status='warn'; return; }
  if(p.plat && G.feat && G.feat[p.plat]){ note(r,'You already shipped that.'); r.status='warn'; return; }
  if(p.plat && G.queue.some(function(q){ return q.plat===p.plat; })){ note(r,'That is already in the queue.'); r.status='warn'; return; }
  var tags=SU.featureTags(G,p.feature);
  var f={id:'f'+(++G.fid),name:p.name||p.feature,scope:p.scope,progress:0,care:p.care,tags:p.plat?[]:tags,born:G.t,plat:p.plat||null,lvl:p.lvl||1};
  G.queue.push(f);
  var V=Math.max(0.1,SU.velocity(G)); var months=(G.queue.reduce(function(a,x){ return a+x.scope-x.progress; },0))/V;
  note(r,'Queued "'+f.name+'" (scope '+p.scope+'). Team speed '+V.toFixed(1)+' points a month, so about '+months.toFixed(1)+' months for the queue.');
  if(p.plat){ var pl=SU.PLAT&&SU.PLAT[p.plat]; if(pl) note(r,'When it ships: '+pl.effect); }
  else {
    var known=tags.map(function(id){ return G.needs.filter(function(n){ return n.id===id; })[0]; }).filter(Boolean);
    var revealedMatch=known.filter(function(n){ return n.real && n.revealed; });
    if(revealedMatch.length) note(r,'It matches what customers told you: '+revealedMatch.map(function(n){ return n.name; }).join(', ')+'.');
    else if(known.some(function(n){ return n.herring; })){ note(r,'Warning: people ask for this, but it will not move retention.'); r.status='warn'; }
    else if(!known.length && !/mvp|v1|prototype|core/.test(p.feature)){ note(r,'This does not match any need you know about yet. Interview customers first.'); r.status='warn'; }
  }
  if(p.care>1) note(r,'Rushing adds tech debt.'); if(p.care<1) note(r,'Careful work adds less tech debt but takes the same time.');
  if(p.deadline!==null && p.deadline!==undefined && p.deadline<months){ note(r,'Your '+p.deadline.toFixed(1)+'-month deadline looks aggressive.'); }
  why(r,'Features ship when progress reaches scope; velocity depends on engineers, morale and tech debt.');
};
A.refactor=function(G,cl,ctx,r){ G.refactorPts+=cl.params.pts*ctx.ff; note(r,'Engineers will spend '+cl.params.pts+' points of capacity paying down tech debt (now '+Math.round(G.D)+').'); why(r,'Refactoring cuts debt 1.5 per point, but takes capacity from features.'); };
A.compliance=function(G,cl,ctx,r){
  var t=cl.params.type; var cost={soc2:30000,hipaa:25000,pentest:15000,gdpr:20000,audit:15000}[t]||20000;
  if(G.flags['c_'+t]){ note(r,'You already started that.'); r.status='warn'; return; }
  spend(G,cost,'Compliance'); G.flags['c_'+t]=G.mi+3; note(r,'Started '+t.toUpperCase()+' for '+fm(cost)+'. It finishes in about 3 months.');
  why(r,'Finance and healthcare buyers want proof. It also lowers breach risk.');
};
A.price=function(G,cl,ctx,r){
  var p=cl.params, c=G.cust, S=seg(G), old=(G.arch==='market')?c.take:c.price; G.flags.priceTried=true;
  if(G.arch==='market'){
    var tk=p.take||(p.pctChange? c.take*(1+p.pctChange) : null) || (p.amount&&p.amount<1? p.amount : null);
    if(!tk){ note(r,'Tell me the take rate you want, for example "take 12%".'); r.status='warn'; return; }
    c.take=clamp(tk,0.03,0.45); note(r,'Take rate set to '+Math.round(c.take*100)+'%.');
    if(c.take>S.takeTol) note(r,'Providers tolerate about '+Math.round(S.takeTol*100)+'%. Above that they leave.');
    why(r,'Supply churn rises sharply once the take rate passes what providers will accept.'); return;
  }
  var np=p.amount||(p.pctChange? old*(1+p.pctChange) : old);
  if(G.arch==='consumer' && !p.amount && !p.pctChange && !p.model && !p.annual){ note(r,'Tell me a price, for example "$6.99/mo", or freemium vs a paywall.'); r.status='warn'; return; }
  np=Math.round(np*100)/100; c.price=np;
  if(p.model==='freemium'){ if(G.arch==='smb') c.freemium=true; else c.model='freemium'; note(r,'Freemium: more signups, but only a small share ever pay.'); }
  if(p.model==='paid'){ if(G.arch==='smb') c.freemium=false; else c.model='paid'; note(r,'Hard paywall: fewer signups, higher conversion, and less sharing.'); }
  if(p.annual){ c.annual=true; note(r,'Annual plans lock customers in: churn drops a lot.'); }
  var rise=old>0? (np-old)/old : 0;
  if(rise>0.02 && (G.arch==='smb'?c.n:c.payers)>0){ var shock=0.5*rise*S.priceSens*(p.grandfather?0.2:1); c.shock=(c.shock||0)+shock; G.trust.cust=clamp(G.trust.cust-4*(p.grandfather?0.3:1),0,100); note(r,'Existing customers feel the increase: churn +'+(shock*100).toFixed(1)+' points this month'+(p.grandfather?' (grandfathered, so far less)':'')+'.'); }
  note(r,'Price is now '+(np<10?'$'+np.toFixed(2):'$'+Math.round(np))+'/mo. Customers would pay about $'+(G.wtpMed*(1-G.wtpBand)).toFixed(0)+' to $'+(G.wtpMed*(1+G.wtpBand)).toFixed(0)+' (you are '+(G.insight<20?'still guessing':'narrowing it down')+').');
  if(np<G.wtpMed*0.25 && S.qualityBar>0.6){ note(r,'Warning: this reads as a toy for '+S.who+'. Trust drops.'); G.trust.cust=clamp(G.trust.cust-3,0,100); r.status='warn'; }
  if(rise<-0.05) note(r,'A price cut changes conversion by about '+Math.round((Math.pow(old/Math.max(0.01,np),0.4+1.4*S.priceSens)-1)*100)+'%, but revenue per customer falls '+Math.round(-rise*100)+'%.');
  var kr=G.rivals.filter(function(x){ return x.id==='krellix'&&x.active; })[0]; if(kr && rise<=-0.2){ G.flags.priceWar=G.mi; note(r,'Krellix noticed your price cut. Expect a price war.'); }
  G.whipPrice=(G.whipPrice||[]); G.whipPrice.push(G.t); G.whipPrice=G.whipPrice.filter(function(t){ return G.t-t<=3; }); if(G.whipPrice.length>=2){ G.whip++; note(r,'Changing price twice in 3 turns adds whiplash.'); }
  why(r,'Conversion follows (willingness to pay / price) raised to a segment-specific elasticity.');
};
A.market=function(G,cl,ctx,r){
  var p=cl.params, key=p.channel, S=seg(G);
  if(p.stop){ G.orders[key]=0; note(r,'Stopped '+key+' spend.'); return; }
  var b=Math.round(p.budget*(p.pilot?0.5:1)); if(b>Math.max(0,G.cash*0.4)){ b=Math.round(Math.max(0,G.cash*0.4)/100)*100; note(r,'Capped at 40% of your cash: '+fm(b)+'.'); }
  G.orders[key]=b; if(key==='content'&&!G.contentStart) G.contentStart=G.mi;
  note(r,'Standing budget: '+fm(b)+' a month on '+key+'. It runs until you change it.');
  var aff=S.aff[key]||0.3; if(aff<0.3){ note(r,'Warning: '+S.who+' rarely discover products through '+key+'.'); r.status='warn'; }
  if(key==='content') note(r,'Content compounds slowly: expect results after about 4 months.');
  var cpc=G.arch==='smb'? S.cpc*SU.era(G).cpcIdx*(1+b/S.adCap) : null;
  if(key==='ads' && cpc) note(r,'Estimated cost per click about $'+cpc.toFixed(2)+', roughly '+Math.round(b/cpc*0.03)+' trials a month.');
  why(r,'Each channel has a different fit with this audience; stacked channels have diminishing returns.');
};
A.outbound=function(G,cl,ctx,r){
  var p=cl.params, n=Math.round(p.n*ctx.ff), S=seg(G), E=SU.era(G);
  if(n<=0){ note(r,'No time left for it.'); return; }
  var spam=n>6000; if(spam){ G.flags.spamUntil=G.mi+6; note(r,'Warning: that volume got your domain flagged. Replies drop by 70% for 6 months.'); r.status='warn'; }
  spend(G,0.05*n,'Outreach tools');
  var segId=p.seg||G.segId; var side=p.side;
  G.pend.outbound.push({n:n,seg:segId,spec:cl.spec,side:side,ch:p.channel});
  var f=SU.outboundFunnel(G,n,segId,cl.spec,E,spam||(G.flags.spamUntil||0)>G.mi);
  if(G.arch==='smb'||G.arch==='market') note(r,'Funnel (expected): '+n+' contacts -> about '+f.replies.toFixed(1)+' replies -> '+f.meetings.toFixed(1)+' meetings -> '+f.closes.toFixed(1)+' customers'+(G.arch==='smb'?' (lands next month)':'')+'.');
  else note(r,'Outbound does not suit a consumer audience; expect almost nothing.');
  if(segId!==G.segId){ note(r,'Warning: you contacted '+SU.SEG[segId].who+' but you sell to '+S.who+'.'); r.status='warn'; }
  if(n<=200) note(r,'Lesson: '+n+' emails is a test, not a channel.');
  why(r,'Reply rate x era x specificity x product-market fit, then meetings (25%) and close rate (price, rivals, your sales skill).');
};
A.launch=function(G,cl,ctx,r){
  var v=cl.params.venue, E=SU.era(G);
  G.launches[v]=(G.launches[v]||0)+1; var rep=G.launches[v]-1;
  var novelty=clamp(G.Q/80,0.2,1), visits=3000*(0.5+novelty)*(1+G.hype/50)*Math.pow(0.4,rep)*({lab:1,forum:0.8,press:0.7,store:0.9,social:0.8}[v]||1);
  var signups=visits*0.04; G.pend.launch.push({venue:v,signups:signups}); G.stat.launchLast=G.mi;
  var up=(8+12*novelty)*Math.pow(0.5,rep); G.hype=clamp(G.hype+up,0,100);
  note(r,'Launched on '+({lab:'Product Lab',forum:'Hacker Forum',press:'the press',store:'the app store',social:'social media'}[v])+': about '+Math.round(visits)+' visits, '+Math.round(signups)+' signups, hype +'+Math.round(up)+'.');
  if(rep>0){ note(r,'Repeat launches work less each time ('+Math.round(Math.pow(0.4,rep)*100)+'%).'); r.status='warn'; }
  if(G.Q<25){ G.hype=clamp(G.hype-5,0,100); G.trust.press=clamp(G.trust.press-6,0,100); note(r,'The product is thin (quality '+Math.round(G.Q)+'). The comments are brutal.'); r.status='warn'; }
  why(r,'Launch traffic scales with quality, novelty and hype, and shrinks 60% each time you repeat a venue.');
};
A.hire=function(G,cl,ctx,r){
  var p=cl.params; var roles=(p.roles&&p.roles.length)?p.roles:[];
  if(!roles.length){ note(r,'Hire whom? Name a role: engineer, designer, SDR, account exec, customer success, marketer, product manager.'); r.status='warn'; return; }
  var add=0;
  roles.forEach(function(ro){
    for(var i=0;i<ro.n;i++){
      if(G.reqs.length>=8){ note(r,'You already have 8 open requisitions.'); r.status='warn'; return; }
      var mk=SU.salaryFor(G,ro.role,ro.level), comp=p.comp||mk, eq=p.equity||SU.ROLES[ro.role].eq[ro.level];
      G.reqs.push({id:'q'+(++G.rid),role:ro.role,level:ro.level,comp:comp,equity:eq,age:0,agency:p.agency});
      add+=comp*1.3/12;
    }
    note(r,'Posted '+ro.n+' '+(ro.level!=='mid'?ro.level+' ':'')+SU.ROLES[ro.role].name.toLowerCase()+(ro.n>1?'s':'')+' at '+fm(p.comp||SU.salaryFor(G,ro.role,ro.level))+' base. Expected fill: 2 to 4 months (hype '+Math.round(G.hype)+').');
  });
  var f=SU.fin(G), newBurn=f.burn+add; var rw=newBurn>0? Math.max(0,G.cash)/newBurn : 999;
  note(r,'Once filled: burn +'+fm(add)+'/mo. Runway '+(f.runway>99?'long':f.runway.toFixed(1)+' mo')+' -> '+(rw>99?'long':rw.toFixed(1)+' mo')+'.');
  if(rw<4){ note(r,'Warning: this puts you under 4 months of runway.'); r.status='warn'; }
  if(G.pmf<35 && SU.headcount(G)>=10){ note(r,'Warning: scaling the team before product-market fit is how startups die.'); r.status='warn'; }
  if(p.agency) note(r,'Recruiter fee: 20% of first-year salary, charged when filled.');
  why(r,'Salary x 1.3 loading, adjusted by era. Hype and hiring climate set how fast roles fill.');
};
A.fire=function(G,cl,ctx,r){
  var p=cl.params, targets=[];
  if(p.who&&p.who.length){ p.who.forEach(function(id){ if(id==='co'){ note(r,'You cannot lay off a cofounder this way. Talk to them.'); r.status='warn'; } else { var e=findPerson(G,id); if(e) targets.push(e); } }); }
  else if(p.pct){ var k=Math.max(1,Math.round(G.team.length*p.pct)); targets=SU.shuffle(G,G.team,'people').slice(0,k); }
  else if(p.role){ targets=G.team.filter(function(e){ return e.role===p.role; }); }
  else if(p.n){ targets=SU.shuffle(G,G.team,'people').slice(0,Math.min(p.n,G.team.length)); }
  if(!targets.length){ note(r,'Nobody to let go.'); r.status='warn'; return; }
  var sev=0; targets.forEach(function(e){ sev+=e.sal*1.3/26*(p.severance>=1?4:2)/1; G.team=G.team.filter(function(x){ return x!==e; }); });
  spend(G,sev,'Severance'); var saved=targets.reduce(function(a,e){ return a+e.sal*1.3/12; },0);
  var hit=targets.length>=3||targets.length>=G.team.length*0.2? 15 : 6; G.morale=clamp(G.morale-hit,0,100); G.founder.sanity=clamp(G.founder.sanity-5,0,100); G.trust.emp=clamp(G.trust.emp-10,0,100);
  G.team.forEach(function(e){ e.loyalty=clamp(e.loyalty-8,0,100); });
  if(G.co&&G.co.dislikes.indexOf('fire')>=0){ G.co.bond=clamp(G.co.bond-10,0,100); note(r,G.co.name+' hates this.'); }
  if(!G.flags.firstLayoff){ G.flags.firstLayoff=true; SU.journal(G,'First layoff.','people',true); } else SU.journal(G,'Laid off '+targets.length+'.','people');
  G.flags.layoffT=G.t;
  note(r,'Let go of '+targets.map(function(e){ return e.name; }).join(', ')+'. Severance '+fm(sev)+'. Burn drops '+fm(saved)+'/mo from next month. Morale -'+hit+'.');
  why(r,'Survivors lose morale and trust, and some of them start looking.');
};
A.comp=function(G,cl,ctx,r){
  var p=cl.params, targets=[];
  if(p.who&&p.who.length) p.who.forEach(function(id){ var e=findPerson(G,id); if(e) targets.push(e); }); else if(p.all) targets=G.team.slice();
  if(!targets.length){ note(r,'Whose pay? Name the person (or "everyone").'); r.status='warn'; return; }
  targets.forEach(function(e){
    if(e.id==='co'||!e.sal){ if(G.co&&e===G.co){ G.co.bond=clamp(G.co.bond+6,0,100); note(r,G.co.name+' appreciates it.'); } return; }
    if(p.promo){ var order=['junior','mid','senior','staff']; var i=order.indexOf(e.level); if(i<order.length-1){ e.level=order[i+1]; e.sal=Math.round(e.sal*1.2/1000)*1000; e.loyalty=clamp(e.loyalty+20,0,100); } }
    if(p.pct>0){ e.sal=Math.round(e.sal*(1+p.pct)/1000)*1000; e.loyalty=clamp(e.loyalty+Math.min(25,p.pct*100),0,100); }
    if(p.equity){ var g=Math.round(p.equity*M.fd(G)); if(G.cap.pool.unissued>=g){ G.cap.pool.unissued-=g; G.cap.pool.granted+=g; e.shares=(e.shares||0)+g; e.loyalty=clamp(e.loyalty+15,0,100); } else note(r,'The option pool is nearly empty.'); }
    e.mem.push({t:G.t,tag:'raise'});
  });
  G.morale=clamp(G.morale+(p.all?5:1.5),0,100);
  var cost=targets.reduce(function(a,e){ return a+(e.sal||0)*(p.pct||0)*1.3/12; },0);
  note(r,'Updated pay for '+targets.map(function(e){ return e.name; }).join(', ')+(p.promo?' (promoted)':'')+(p.equity?' (equity grant)':'')+(cost>0?'. Burn +'+fm(cost)+'/mo.':'.'));
  why(r,'Retention beats replacement. Raises cost cash; equity costs ownership.');
};
A.culture=function(G,cl,ctx,r){
  var k=cl.params.kind, off=cl.params.off, cu=G.orders.culture;
  if(k==='remote'){ cu.remote=!off; cu.office=false; cu.hybrid=false; note(r,off?'Back to an office.':'Fully remote: autonomy up, hiring pool wider.'); G.morale=clamp(G.morale+(off?-4:3),0,100); }
  else if(k==='hybrid'){ cu.hybrid=!off; note(r,'Hybrid policy set.'); }
  else if(k==='office'){ cu.office=true; cu.remote=false; G.morale=clamp(G.morale-8,0,100); G.team.forEach(function(e){ e.loyalty=clamp(e.loyalty-6,0,100); }); note(r,'Return-to-office mandate. Some people will not forgive it.'); r.status='warn'; }
  else if(k==='fourday'){ cu.fourday=!off; note(r,off?'Five-day week again.':'Four-day week: morale and retention up, velocity down about 10%.'); }
  else if(k==='crunch'){ if(off){ cu.crunch=0; note(r,'Crunch is over.'); } else { cu.crunch=3; note(r,'Crunch for 3 months: velocity +25%, morale -3 and sanity -3 each month.'); r.status='warn'; if(G.co&&G.co.dislikes.indexOf('culture:crunch')>=0){ G.co.bond=clamp(G.co.bond-8,0,100); note(r,G.co.name+' is not happy about crunch.'); } } }
  else if(k==='offsite'){ var cost=400*SU.headcount(G); spend(G,cost,'Offsite'); G.morale=clamp(G.morale+4,0,100); note(r,'Team offsite for '+fm(cost)+'. Morale +4.'); }
  else if(k==='perks'){ cu.perks=!off; note(r,off?'Perks cut. Expect grumbling.':'Perks and free lunch: about $150 per person per month, morale up a little.'); }
  else if(k==='pto'){ cu.pto=!off; note(r,'Time-off policy updated.'); }
  why(r,'Culture policies move the morale baseline that sets attrition and velocity.');
};
A.fundraise=function(G,cl,ctx,r){
  var p=cl.params;
  if(p.act){
    var rd=G.round; if(!rd){ note(r,'There is no open round.'); r.status='warn'; return; }
    var live=rd.sheets.filter(function(s){ return s.state==='live'; });
    if(!live.length){ note(r,'No live term sheets right now.'); r.status='warn'; return; }
    if(p.act==='accept'){ var best=live.slice().sort(function(a,b){ return (b.pre||b.cap)-(a.pre||a.cap); })[0]; var rec=M.accept(G,best.id); note(r,'Accepted '+SU.investor(best.inv).name+"'s offer: "+fm(best.amount)+'. Money arrives now.'); SU.fx&&SU.fx.confetti&&SU.fx.confetti(G); }
    else if(p.act==='decline'){ M.declineAll(G); note(r,'You walked away from the table.'); }
    else note(r,'Use the term sheet panel (Money tab) to counter specific terms.');
    return;
  }
  if(p.bridge){ var br=M.insiderBridge(G); note(r,br.msg); if(!br.ok) r.status='warn'; return; }
  var E=SU.era(G);
  if(G.round){
    if(p.target){ var inv=SU.investor(p.target); if(inv && !G.round.pipe.some(function(x){ return x.inv===inv.id; })){ if(inv.stages.indexOf(G.round.stage)>=0 && G.round.ask>=inv.check[0]*0.4){ G.round.pipe.push({inv:inv.id,stage:'intro',interest:M.interest(G,inv,G.round,null),turns:0,warm:false,bonus:3,pitched:false}); note(r,'Added '+inv.name+' to the round.'); } else { note(r,inv.name+' does not write checks like this ('+inv.fund+').'); r.status='warn'; } } else note(r,'Already in the round.'); }
    else { note(r,'A round is already open. Take the partner meetings in your inbox and look at the term sheets in Money.'); }
    return;
  }
  var stage=p.stage||(p.amount?M.stageFromAmount(p.amount):'seed');
  if((stage==='A'||stage==='B'||stage==='C') && !G.rounds.length){ note(r,'You have not raised before. Investors will want to see a seed first.'); r.status='warn'; }
  var targets=p.target?[p.target]:[]; var inst=p.instrument||null;
  var rd2=M.openRound(G,{stage:stage,amount:p.amount,instrument:inst,cap:p.cap,targets:targets,spray:p.spray,accel:p.accel,bridge:false,pool:p.pool},ctx.eff);
  var names=rd2.pipe.map(function(x){ return SU.investor(x.inv).name; });
  note(r,'Opened a '+M.STAGE_NAME[rd2.stage]+' round: asking '+fm(rd2.ask)+' on a '+(rd2.instrument==='priced'?'priced round':rd2.instrument==='note'?'convertible note':'SAFE')+(rd2.askVal?' at a '+fm(rd2.askVal)+' cap':'')+'.');
  note(r,'Pipeline: '+names.join(', ')+'.');
  note(r,'A live round costs about 4 focus points a month and 2 sanity.');
  why(r,'Interest depends on team, market, product, traction and efficiency, weighted by stage and by each investor.');
};
A.finance=function(G,cl,ctx,r){
  var k=cl.params.kind;
  if(k==='card'){ if(G.flags.cardUsed){ note(r,'You already maxed the card.'); r.status='warn'; return; } G.flags.cardUsed=true; G.cash+=25000; G.founder.sanity=clamp(G.founder.sanity-15,0,100); G.loans.card=25000; SU.drv(G,'cash',25000,'Founder credit card'); note(r,'$25K on the founder credit card. Sanity -15.'); }
  else if(k==='deferFounder'){ G.founder.pay=0; note(r,'Founders defer their salaries.'); }
  else if(k==='deferStaff'){ var pay=SU.fin(G).ex.payroll; var save=Math.round(pay*0.3); G.cash+=save; G.owed=(G.owed||0)+save; G.morale=clamp(G.morale-10,0,100); G.team.forEach(function(e){ e.loyalty=clamp(e.loyalty-12,0,100); }); SU.drv(G,'cash',save,'Deferred payroll'); note(r,'Staff defer 30% of pay this month ('+fm(save)+'). You owe it next month. Morale -10.'); r.status='warn'; }
  else if(k==='bridge'){ var b=M.insiderBridge(G); note(r,b.msg); if(!b.ok) r.status='warn'; }
  else if(k==='rbf'){ var x=M.rbf(G); note(r,x.msg); if(!x.ok) r.status='warn'; }
  else if(k==='debt'){ var d=M.ventureDebt(G); note(r,d.msg); if(!d.ok) r.status='warn'; }
  else { var pct=cl.params.pct; ['ads','content','social','events','referral','ua'].forEach(function(c){ G.orders[c]=Math.round(G.orders[c]*(1-pct)); }); G.orders.culture.perks=false; var cut=0; G.queue.forEach(function(){}); note(r,'Cut discretionary spend by '+Math.round(pct*100)+'% (ads, content, perks).'); G.morale=clamp(G.morale-2,0,100); }
  why(r,'Non-dilutive money has covenants and costs; cutting spend slows growth.');
};
A.pivot=function(G,cl,ctx,r){
  var p=cl.params, S=seg(G);
  var cands=Object.keys(SU.SEG).filter(function(id){ return SU.SEG[id].arch===G.arch && id!==G.segId; });
  var to=p.seg && SU.SEG[p.seg] && SU.SEG[p.seg].arch===G.arch ? p.seg : null;
  if(!to){ note(r,'Pivot to what? Options for your model: '+cands.map(function(id){ return SU.SEG[id].name; }).join(', ')+'.'); r.status='warn'; return; }
  if(to===G.segId){ note(r,'You already sell to them.'); r.status='warn'; return; }
  var old=G.segId; G.segId=to; var S2=SU.SEG[to];
  G.splitSeg=false; G.whip++; G.pmf=Math.max(0,G.pmf*0.5); G.insight=Math.max(0,G.insight-15);
  var c=G.cust; if(G.arch==='smb'){ var lost=Math.round(c.n*0.5); c.n-=lost; c.price=S2.defaultPrice; } else if(G.arch==='consumer'){ c.payers=Math.round(c.payers*0.5); c.mau=Math.round(c.mau*0.5); c.price=S2.defaultPrice; } else { c.S=Math.round(c.S*0.4); c.D=Math.round(c.D*0.4); c.take=S2.takeDefault; c.aov=S2.aov; }
  var keep=G.needs.filter(function(n){ return n.cov>0; });
  G.wtpMed=S2.wtp*clamp(Math.exp(0.25*SU.randn(G,'market')),0.62,1.5); G.wtpBand=0.5; G.pmfOff=(SU.rnd(G,'market')-0.5)*1.2;
  var oldNeeds=G.needs; (function(){ var list=SU.shuffle(G,S2.needs.slice(),'market'); var nT=3; G.needs=list.map(function(n,i){ return {id:n.id,name:n.name,kw:n.kw,real:i<nT,w:i<nT?SU.int(G,1,3,'market'):0,herring:false,revealed:false,cov:0}; }); S2.herrings.slice(0,2).forEach(function(h){ G.needs.push({id:h.id,name:h.name,kw:h.kw,real:false,w:0,herring:true,revealed:false,cov:0}); }); })();
  G.shipped.forEach(function(s){ s.good=0; }); G.bloat=Math.max(0,G.bloat-3);
  G.flags.pivots=(G.flags.pivots||0)+1; SU.journal(G,'Pivoted from '+SU.SEG[old].name+' to '+S2.name+'.','pivot',true);
  if(G.co&&G.co.dislikes.indexOf('pivot')>=0){ G.co.bond=clamp(G.co.bond-15,0,100); note(r,G.co.name+' is deeply unhappy about the pivot.'); }
  note(r,'Pivoted to '+S2.name+'. Half your existing base leaves, product-market fit resets to about '+Math.round(G.pmf)+', and what you learned about needs is partly lost. Whiplash +1.');
  why(r,'Pivots are expensive on purpose: they should follow evidence, not mood.');
};
A.ethics=function(G,cl,ctx,r){
  var k=cl.params.kind, c=G.cust;
  if(G.co && G.co.flags.vetoEthics && (k==='dark'||k==='reviews'||k==='data')){ G.co.bond=clamp(G.co.bond-25,0,100); note(r,G.co.name+' refuses to be part of this. Bond -25.'); }
  if(k==='dark'){ G.flags.darkUntil=G.mi+8; G.ethics+=15; SU.sched(G,5,'ev_dark'); note(r,'Retention improves: churn -30% for 8 months. Trust time bomb: complaints and a regulator will notice.'); }
  else if(k==='reviews'){ G.hype=clamp(G.hype+6,0,100); G.ethics+=12; SU.sched(G,4,'ev_reviews'); note(r,'Five-star reviews appear overnight. Hype +6. The store may purge them later.'); }
  else if(k==='data'){ var cash=Math.round(Math.max(10000,(G.mrr||0)*3)/1000)*1000; G.cash+=cash; SU.drv(G,'cash',cash,'Data sale'); G.ethics+=20; SU.sched(G,6,'ev_data'); note(r,'Sold anonymized data for '+fm(cash)+'. Cash now, trust later.'); }
  else if(k==='inflate'){ G.flags.inflate=G.mi+6; G.ethics+=20; note(r,'You will count free users as customers in your next pitch. Investors will like it. Diligence will not.'); }
  else if(k==='spam'){ G.flags.spamUntil=G.mi+4; G.ethics+=8; note(r,'More volume, lower trust. Your domain gets flagged.'); }
  G.reg+=8; r.status='warn';
  note(r,'Claims ledger: '+Math.round(G.ethics)+'. Every shortcut is a visible gamble.');
  why(r,'Cheap now, expensive later. The ledger feeds diligence, press investigations and regulators.');
};
A.self=function(G,cl,ctx,r){
  var k=cl.params.kind, s=G.founder.sanity;
  if(k==='vacation'){ G.founder.sanity=clamp(s+25,0,100); note(r,'A week away. Sanity +25.'); if(G.co&&G.co.dislikes.indexOf('self')>=0) G.co.bond=clamp(G.co.bond-3,0,100); }
  else if(k==='therapy'){ G.orders.therapy=true; spend(G,400,'Coach'); note(r,'A coach, $400 a month. Sanity +2 a month.'); }
  else if(k==='weekend'){ G.founder.sanity=clamp(s+6,0,100); note(r,'You took the weekend off. Sanity +6.'); }
  else { G.founder.sanity=clamp(s+6,0,100); note(r,'You rested. Sanity +6.'); }
  G.flags.rested=G.t;
};
A.talkto=function(G,cl,ctx,r){
  var p=cl.params;
  if(p.who&&p.who.length){ p.who.forEach(function(id){ var e=findPerson(G,id); if(!e) return; if(id==='co'){ var want=G.co.wants; G.co.bond=clamp(G.co.bond+7+(p.apologize?3:0),0,100); G.flags.coSplit=false; note(r,'You sat down with '+G.co.name+'. Bond +'+(7+(p.apologize?3:0))+'. They want: '+want+'.'); } else { e.loyalty=clamp(e.loyalty+9,0,100); e.mem.push({t:G.t,tag:'11'}); note(r,'1:1 with '+e.name+'. Loyalty +9. Their want: '+e.want+'.'); G.flags.talked=(G.flags.talked||{}); G.flags.talked[e.id]=G.t; } }); }
  else if(p.aud==='team'){ G.morale=clamp(G.morale+(p.apologize?5:3),0,100); G.trust.emp=clamp(G.trust.emp+4,0,100); note(r,'All-hands. Morale +'+(p.apologize?5:3)+'.'); G.flags.allHands=G.t; }
  else if(p.aud==='investors'){ G.trust.inv=clamp(G.trust.inv+(p.truth?7:4),0,100); G.board.mood=clamp(G.board.mood+(p.truth?5:2),0,100); note(r,'Investor update sent. '+(p.truth?'Honesty builds trust.':'Steady communication helps.')); G.flags.invUpdate=G.t; }
  else if(p.aud==='customers'){ G.trust.cust=clamp(G.trust.cust+4,0,100); note(r,'Customer note sent. Trust +4.'); }
  else { G.morale=clamp(G.morale+2,0,100); note(r,'Conversation held.'); }
};
A.rival=function(G,cl,ctx,r){
  var p=cl.params; var rv=G.rivals.filter(function(x){ return x.id===p.rival; })[0] || G.rivals.filter(function(x){ return x.active; })[0];
  if(!rv){ note(r,'No rival to deal with.'); r.status='warn'; return; }
  if(p.act==='coffee'){ rv.respect=clamp(rv.respect+10,-100,100); note(r,'Coffee with '+rv.boss+'. '+(rv.id==='slowoak'?'They respect honesty. Respect +10.':'Mutual wariness, but you learned a little.')); if(rv.id==='krellix') note(r,'Intel: Krellix has about '+fm(rv.cash)+' left.'); }
  else if(p.act==='sue'){ spend(G,40000,'Legal'); var win=SU.chance(G,0.3,'rivals'); if(win && rv.id==='mirrormint'){ rv.presence=Math.max(0,rv.presence-0.1); note(r,'You won. MirrorMint backed off.'); } else note(r,'The lawsuit drags on and costs '+fm(40000)+'. Nothing changed.'); rv.grudge=clamp(rv.grudge+10,-100,100); }
  else if(p.act==='poach'){ var comp=SU.salaryFor(G,'ae','senior')*1.2; G.reqs.push({id:'q'+(++G.rid),role:'ae',level:'senior',comp:comp,equity:0.003,age:2,agency:false}); rv.grudge=clamp(rv.grudge+15,-100,100); note(r,'Recruiting a senior account exec from '+rv.name+'. They will remember.'); }
  else if(p.act==='undercut'){ G.flags.priceWar=G.mi; rv.grudge=clamp(rv.grudge+10,-100,100); note(r,'You started a price war with '+rv.name+'. Margins suffer for both of you.'); r.status='warn'; }
  else { note(r,'Merger talks need a respectful relationship. Try coffee first.'); }
};
A.exit=function(G,cl,ctx,r){
  var a=cl.params.act;
  if(a==='banker'){ if(G.banker){ note(r,'You already have a banker.'); return; } G.banker=3; spend(G,15000,'Banker retainer'); note(r,'Hired a banker. In about 3 turns you will see offers, and word may leak (25%).'); SU.sched(G,2,'ev_offer'); }
  else if(a==='accept'){ if(!G.offer){ note(r,'There is no offer on the table.'); r.status='warn'; return; } G.pendingEnd={type:'sale'}; note(r,'You accepted the offer from '+G.offer.buyer+' at '+fm(G.offer.price)+'.'); }
  else if(a==='ipo'){ var g=M.ipoGates(G); if(!g.ok){ note(r,'You are not ready for an IPO:'); g.gates.forEach(function(x){ note(r,(x.ok?'  ok: ':'  missing: ')+x.label); }); r.status='warn'; return; } G.ipo={open:true,stage:1,tier:cl.params.tier}; G.flags.ipoPrep=G.t; note(r,'IPO prep started. Roadshow next turn.'); }
  else if(a==='indie'){ var f=SU.fin(G); if(f.burn>0 || (G.mrr||0)<2000){ note(r,'You are not profitable yet. Ramen royalty needs positive cash flow.'); r.status='warn'; return; } G.pendingEnd={type:'indie'}; note(r,'You choose to stop chasing growth.'); }
  else if(a==='shutdown'){ G.pendingEnd={type:'shutdown'}; note(r,'You decide to wind the company down.'); }
};

/* ------------------------------------------------------------ focus */
SU.focusBudget=function(G){
  var b=(SU.FOCUS_BASE[G.act]||10)+(G.focusBonus||0), mods=[]; if(G.focusBonus) mods.push('goals +'+G.focusBonus);
  var s=G.founder.sanity; if(s<20){ b-=4; mods.push('fried -4'); } else if(s<40){ b-=2; mods.push('frayed -2'); }
  if(G.co&&G.co.cid==='ivy'){ b+=2; mods.push('operator +2'); }
  if(SU.count(G,'cos')>0){ b+=2; mods.push('chief of staff +2'); }
  if(G.round){ b-=4; mods.push('open round -4'); }
  if(G.lastStand){ b+=3; mods.push('last stand +3'); }
  if(G.orders.culture.crunch>0){ b+=3; mods.push('crunch +3'); }
  return {budget:Math.max(3,b),mods:mods};
};

/* ------------------------------------------------------------ commit */
SU.draftClauses=function(G,text){ return SU.parse(G,text); };
SU.snapshot=function(G){ var f=SU.fin(G), b=SU.pmfBand(G); return {cash:G.cash,runway:f.runway,mrr:G.mrr||0,cust:SU.custCount(G),pmfLo:b.lo,pmfHi:b.hi,hype:G.hype,morale:G.morale,sanity:G.founder.sanity,heads:SU.headcount(G),burn:f.burn,bond:G.co?G.co.bond:0}; };

SU.commit=function(G,text,announce,opts){
  opts=opts||{};
  if(G.over) return null;
  G.drv=[]; var before=SU.snapshot(G); var dt=SU.turnMonths(G);
  var parsed=opts.clauses? {clauses:opts.clauses,unmatched:[]} : SU.parse(G,text||'');
  var fb=SU.focusBudget(G); var used=0, overflow=0, over=fb.budget*0.5;
  var rec={t:G.t,date:SU.dateStr(G),act:G.act,input:text||'',announce:announce||'',items:[],unmatched:parsed.unmatched,focus:{budget:fb.budget,mods:fb.mods,used:0,left:0},kpi:[],reactions:null,events:[],dt:dt,questions:[]};
  var ctxList=[];
  parsed.clauses.forEach(function(cl,i){
    var cost=cl.focus, ff=1, status='ok';
    if(cost>0){
      if(used+cost<=fb.budget){ used+=cost; }
      else if(used<fb.budget){ ff=(fb.budget-used)/cost; used=fb.budget; status='partial'; }
      else if(overflow+cost<=over){ overflow+=cost; ff=0.4; status='half'; G.founder.sanity=clamp(G.founder.sanity-2*cost,0,100); }
      else { ff=0; status='dropped'; }
    }
    var eff=clamp((0.55+0.6*cl.spec),0.55,1.15)*(status==='half'?0.4:ff);
    var item={n:i+1,lever:cl.lever,desc:SU.describe(cl),focus:cost,status:status,ff:ff,spec:cl.spec,lines:[],because:[],clause:cl};
    if(cl.spec<0.5 && cl.missing && cl.missing.length){ item.lines.push('Vague: missing '+cl.missing.join(', ')+'. Effect scaled to '+Math.round(eff*100)+'%.'); }
    if(cl.hype) item.lines.push('Hype words without numbers cost credibility.');
    rec.items.push(item);
    if(status==='dropped'){ item.lines.push('No time left for this one. You tried '+parsed.clauses.length+' things; focus is limited.'); return; }
    if(status==='partial'||status==='half') item.lines.push(status==='half'?'Half-attention: 40% efficacy and extra sanity cost.':'Only part of your time reached this ('+Math.round(ff*100)+'%).');
    try{ A[cl.lever](G,cl,{eff:eff,ff:Math.max(0.05,ff)},item); }catch(e){ item.lines.push('(That action failed: '+e.message+')'); item.status='warn'; }
    if(item.status==='ok' && status!=='ok') item.status=status;
    ctxList.push(item);
  });
  rec.focus.used=Math.min(used+overflow,fb.budget*1.5); rec.focus.left=Math.max(0,fb.budget-used);
  var unspent=Math.max(0,fb.budget-used); G.founder.sanity=clamp(G.founder.sanity+Math.min(4,unspent*0.5),0,100);
  if(unspent>=4) rec.sleep='Unspent focus: you slept. Sanity +'+Math.min(4,Math.round(unspent*0.5))+'.';
  if(parsed.clauses.length>fb.budget && used>=fb.budget) rec.overload='You tried '+parsed.clauses.length+' things. About '+rec.items.filter(function(x){ return x.status==='ok'; }).length+' got real attention.';
  /* whiplash from reversals */
  if(parsed.clauses.some(function(c){ return c.lever==='pivot'; })) {}
  /* announcements: claims and promises */
  if(announce||opts.claims||opts.promises){ var an=(opts.claims||opts.promises)? {claims:opts.claims||[],promises:opts.promises||[]} : SU.parseAnnounce(G,announce); var cr=M.applyClaims(G,an.claims,false); rec.claimNotes=cr.notes; an.promises.forEach(function(pr){ pr.due=(pr.dueIn!==undefined)? G.t+pr.dueIn : G.t+Math.max(2,/q[1-4]|june|july|august|sept|oct|nov|dec/.test(pr.by)?4:3); pr.state='open'; G.promises.push(pr); }); if(an.promises.length) rec.promiseNote='Promise recorded: "'+an.promises[0].what+'"'+(an.promises[0].by?' by '+an.promises[0].by:'')+'.'; }
  /* events resolve against what you did */
  SU.Events.resolve(G,parsed.clauses,rec);
  /* time passes */
  var adv=SU.advance(G,dt);
  rec.shipped=adv.shipped; rec.hired=adv.filled;
  G.t++; G.actNew=false; SU.updateAct(G);
  G.pendingEnd && SU.Events.endNow(G,G.pendingEnd);
  SU.Events.after(G,rec);
  var after=SU.snapshot(G); rec.before=before; rec.after=after; rec.kpi=SU.kpiLines(G,before,after);
  rec.reactions=SU.Events.media(G,rec);
  G.rec=rec; G.last=rec;
  if(G.cash<-1e9) G.cash=-1e9;
  SU.save(G);
  return rec;
};

/* KPI deltas with the drivers behind them */
SU.kpiLines=function(G,b,a){
  var out=[]; var drv={}; (G.drv||[]).forEach(function(d){ var k=d.m+'|'+d.c; drv[k]=(drv[k]||0)+d.d; });
  function top(m){ var arr=[]; for(var k in drv){ if(k.split('|')[0]===m) arr.push([k.split('|')[1],drv[k]]); } arr.sort(function(x,y){ return Math.abs(y[1])-Math.abs(x[1]); }); return arr.slice(0,4).map(function(x){ return x[0]+' '+(x[1]>=0?'+':'')+fm(x[1]); }); }
  out.push({k:'cash',label:'Cash',from:fm(b.cash),to:fm(a.cash),bad:a.cash<b.cash,drivers:top('cash')});
  out.push({k:'mrr',label:'Monthly revenue',from:fm(b.mrr),to:fm(a.mrr),bad:a.mrr<b.mrr,drivers:[]});
  out.push({k:'cust',label:G.arch==='market'?'Providers + buyers':G.arch==='consumer'?'Paying subscribers':'Customers',from:String(b.cust),to:String(a.cust),bad:a.cust<b.cust,drivers:G.stat.newLast!==undefined?['+'+Math.round(G.stat.newLast)+' new, -'+Math.round(G.stat.churnLast||0)+' churned']:[]});
  out.push({k:'pmf',label:'Product-market fit',from:b.pmfLo+'-'+b.pmfHi,to:a.pmfLo+'-'+a.pmfHi,bad:(a.pmfLo+a.pmfHi)<(b.pmfLo+b.pmfHi),drivers:[]});
  out.push({k:'sanity',label:'Your sanity',from:String(Math.round(b.sanity)),to:String(Math.round(a.sanity)),bad:a.sanity<b.sanity,drivers:[]});
  out.push({k:'morale',label:'Team morale',from:String(Math.round(b.morale)),to:String(Math.round(a.morale)),bad:a.morale<b.morale,drivers:[]});
  return out;
};
})();
