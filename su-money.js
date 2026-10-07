/* RUNWAY - money: cap table, SAFEs and priced rounds, investor pipeline, pitch meetings, term sheets, waterfall, loans, exits. */
(function(){
var SU = (window.SU = window.SU || {});
var clamp=SU.clamp;
var M = (SU.Money = {});

M.STAGE_NAME={preseed:'Pre-seed',seed:'Seed',A:'Series A',B:'Series B',C:'Series C'};
M.STAGE_WEIGHTS={preseed:[.45,.25,.20,.05,.00],seed:[.35,.25,.20,.15,.05],A:[.25,.20,.15,.30,.10],B:[.15,.15,.10,.35,.25],C:[.15,.15,.10,.35,.25]};
M.BARS={preseed:500,seed:10000,A:125000,B:667000,C:2000000};   /* MRR bars (ARR 1.5M for A etc.) */
M.POOL_TARGET={preseed:0.10,seed:0.10,A:0.12,B:0.12,C:0.12};
M.stageFromAmount=function(amt){ return amt<1.5e6?'preseed': amt<6e6?'seed': amt<25e6?'A': amt<80e6?'B':'C'; };

/* ------------------------------------------------------------ cap table */
M.initCap=function(G,split){
  var total=10e6, founders=9e6, you=G.co? Math.round(founders*split) : founders, co=G.co? founders-you : 0;
  G.cap={common:{you:you,co:co},pool:{granted:0,unissued:1e6},safes:[],classes:[],cid:0};
  G.board={mood:60,seats:{founders:G.co?2:1,investors:0,independent:0},ally:false};
};
M.existing=function(G){ var c=G.cap; var s=c.common.you+c.common.co+c.pool.granted+c.pool.unissued; c.classes.forEach(function(k){ s+=k.sh; }); return s; };
M.fd=function(G){ var c=G.cap; return c.common.you+c.common.co+c.pool.granted+c.pool.unissued+c.classes.reduce(function(a,k){ return a+k.sh; },0); };
/* shares that outstanding SAFEs would convert into at their caps (preview) */
M.safeShares=function(G){
  var c=G.cap; if(!c.safes.length) return [];
  var F=0; c.safes.forEach(function(s){ F+=s.inv/s.cap; }); F=Math.min(F,0.9);
  var ex=M.existing(G), tot=ex*F/(1-F);
  return c.safes.map(function(s){ return {safe:s, sh:tot*((s.inv/s.cap)/F)}; });
};
M.table=function(G){
  var c=G.cap, rows=[]; var sp=M.safeShares(G);
  var total=M.existing(G)+sp.reduce(function(a,x){ return a+x.sh; },0);
  rows.push({id:'you',label:G.founder.name||'You',sh:c.common.you,kind:'founder'});
  if(G.co) rows.push({id:'co',label:G.co.name,sh:c.common.co,kind:'founder'});
  rows.push({id:'pool',label:'Option pool',sh:c.pool.granted+c.pool.unissued,kind:'pool'});
  c.classes.forEach(function(k){ rows.push({id:k.id,label:k.name,sh:k.sh,kind:'inv',amount:k.amount}); });
  sp.forEach(function(x){ rows.push({id:x.safe.id,label:'SAFE ('+SU.fmtMoney(x.safe.inv)+', '+SU.fmtMoney(x.safe.cap)+' cap)',sh:x.sh,kind:'safe',amount:x.safe.inv}); });
  rows.forEach(function(r){ r.pct=total? r.sh/total : 0; });
  return {rows:rows,total:total};
};
M.founderPct=function(G){ var t=M.table(G); var p=0; t.rows.forEach(function(r){ if(r.kind==='founder') p+=r.pct; }); return p; };

/* priced round: convert SAFEs, top up the pool from the pre-money, issue new preferred */
M.priced=function(G,stage,amount,pre,opts){
  opts=opts||{}; var c=G.cap, target=opts.pool||M.POOL_TARGET[stage]||0.10;
  var common=c.common.you+c.common.co, classSh=c.classes.reduce(function(a,k){ return a+k.sh; },0);
  var existing=common+c.pool.granted+c.pool.unissued+classSh;
  /* SAFEs convert at cap unless the round price is lower */
  var safes=c.safes.slice(), conv=safes.map(function(s){ return {s:s,atCap:true,sh:0}; });
  var price=pre/existing, X=0, N=0, safeSh=0;
  for(var pass=0;pass<30;pass++){
    var F=0; conv.forEach(function(k){ if(k.atCap) F+=k.s.inv/k.s.cap; }); F=Math.min(F,0.9);
    var baseSh=existing; safeSh=0;
    conv.forEach(function(k){ if(k.atCap){ k.sh=baseSh*F/(1-F)*((k.s.inv/k.s.cap)/(F||1)); } });
    var capSum=conv.reduce(function(a,k){ return a+(k.atCap?k.sh:0); },0);
    conv.forEach(function(k){ if(!k.atCap){ k.sh=k.s.inv/Math.max(1e-9,price); } });
    safeSh=conv.reduce(function(a,k){ return a+k.sh; },0);
    price=pre/(existing+safeSh+X);
    N=amount/price;
    var post=existing+safeSh+X+N;
    var needX=Math.max(0,target*post-c.pool.unissued);
    var capPrice=(capSum>0)? null : null;
    var changed=false;
    conv.forEach(function(k){ var cp=k.s.cap/(existing+capSum); if(k.atCap && price<cp*0.999){ k.atCap=false; changed=true; } });
    if(Math.abs(needX-X)<1 && !changed) break;
    X=needX;
  }
  /* anti-dilution on earlier preferred if this is a down round */
  var down=false;
  c.classes.forEach(function(k){
    if(k.kind==='safe') return;
    if(price<k.price*0.999){ down=true; if(k.anti==='full') { var r=k.price/price; k.sh*=r; k.price=price; } else if(k.anti==='broad'){ var A=existing+safeSh, B=k.amount/k.price, Cn=N; var ncp=k.price*(A+B)/(A+Cn); k.sh*=k.price/ncp; k.price=ncp; } }
  });
  /* issue */
  conv.forEach(function(k){ c.classes.push({id:'k'+(++c.cid),name:'SAFE '+(M.STAGE_NAME[k.s.stage]||''),sh:k.sh,price:k.s.inv/k.sh,amount:k.s.inv,pref:1,part:false,anti:'none',kind:'safe',investors:[k.s.investor]}); });
  c.safes=[]; c.pool.unissued+=X;
  var cls={id:'k'+(++c.cid),name:M.STAGE_NAME[stage],sh:N,price:price,amount:amount,pref:opts.pref||1,part:!!opts.part,anti:opts.anti||'broad',kind:'priced',investors:opts.investors||[],stage:stage};
  c.classes.push(cls);
  return {price:price,newShares:N,poolAdded:X,safeShares:safeSh,down:down,post:pre+amount,cls:cls};
};
M.addSafe=function(G,inv,cap,investor,stage){ G.cap.safes.push({id:'s'+(++G.cap.cid),inv:inv,cap:cap,investor:investor,stage:stage,t:G.t}); };

/* waterfall: net proceeds to equity */
M.waterfall=function(G,X,opts){
  opts=opts||{}; var c=G.cap, sp=M.safeShares(G);
  var classes=c.classes.map(function(k){ return {id:k.id,name:k.name,sh:k.sh,pref:k.amount*(k.pref||1),part:k.part,kind:'pref'}; });
  sp.forEach(function(x){ classes.push({id:x.safe.id,name:'SAFE',sh:x.sh,pref:x.safe.inv,part:false,kind:'pref'}); });
  var commonSh=c.common.you+c.common.co+c.pool.granted;
  var conv=classes.map(function(){ return false; }), per=0, outp=null;
  for(var it=0;it<8;it++){
    var prefs=0; classes.forEach(function(k,i){ if(!conv[i]) prefs+=k.pref; });
    var scale=1, remaining=X-prefs; if(remaining<0){ scale=Math.max(0,X/prefs); remaining=0; }
    var shares=commonSh; classes.forEach(function(k,i){ if(conv[i]||k.part) shares+=k.sh; });
    per=shares? remaining/shares : 0;
    var changed=false;
    classes.forEach(function(k,i){ var asConv=per*k.sh; var should=!k.part && asConv>k.pref; if(should!==conv[i]){ conv[i]=should; changed=true; } });
    outp={scale:scale,remaining:remaining};
    if(!changed) break;
  }
  var res={per:per,rows:[],overhang:0};
  var prefTaken=0;
  classes.forEach(function(k,i){ var take=conv[i]? per*k.sh : (k.pref*outp.scale + (k.part? per*k.sh:0)); prefTaken+=conv[i]?0:k.pref*outp.scale; res.rows.push({id:k.id,label:k.name,take:take,converted:conv[i]}); });
  res.you=per*c.common.you; res.co=per*c.common.co; res.pool=per*c.pool.granted;
  /* "without preferences" comparison: straight ownership */
  var total=M.table(G).total; var tbl=M.table(G);
  res.youNoPref=X*(c.common.you/total); res.coNoPref=X*(c.common.co/total);
  res.overhang=classes.reduce(function(a,k){ return a+k.pref; },0);
  res.founders=res.you+res.co; res.foundersNoPref=res.youNoPref+res.coNoPref;
  return res;
};

/* ------------------------------------------------------------ interest model */
M.components=function(G,inv,stage){
  var E=SU.era(G), f=G.founder.skills, avg=(f.p+f.t+f.s+f.c)/4;
  var keyHire=Math.min(1,(SU.count(G,'eng')>0?0.5:0)+(SU.count(G,'ae')+SU.count(G,'vp')>0?0.3:0)+(SU.count(G,'design')>0?0.2:0));
  var team=0.5*avg/5+0.15*(G.co?1:0)+0.2*keyHire+0.15*G.founder.cred/100;
  var tamScore=clamp(G.tam*(E.hot?1.5:1)*(1+(G.insight/100)*0.1),0,1);
  var market=clamp(0.25+0.7*tamScore,0,1);
  var product=0.6*G.Q/100+0.4*G.insight/100;
  var bar=M.BARS[stage]||10000, mrr=M.tractionMrr(G);
  var traction=1/(1+Math.exp(-(mrr-bar)/bar*2.2));
  var g=SU.growthMo(G); if(stage==='seed'||stage==='preseed'){ traction=Math.max(traction, clamp(g/0.2,0,1)*(mrr>2000?1:0.3)); }
  var fin=SU.fin(G); var nn=0; var h=G.mrrHist; if(h.length>=4) nn=(h[h.length-1]-h[h.length-4])*12; var bm=nn>0? Math.max(0,fin.burn)*3/nn : (fin.burn>0?4:1);
  var effic=1-0.7*clamp((bm-1)/3,0,1); if(G.arch==='market') effic=Math.min(effic,0.8);
  if(stage==='preseed') effic=0.8;
  return [team,market,product,traction,effic];
};
M.tractionMrr=function(G){ return (G.mrr||0)+(G.arch==='consumer'?0.5*(G.cust.mau||0):0); };
SU.tractionMrr=M.tractionMrr;
M.COMP_NAMES=['team','market','product','traction','efficiency'];
M.interest=function(G,inv,r,p){
  var stage=r.stage, E=SU.era(G), w=M.STAGE_WEIGHTS[stage].slice(), ax=inv.ax;
  var comp=M.components(G,inv,stage);
  w[3]*=0.7+0.6*ax.G; w[4]*=0.5+ax.E; w[1]*=0.7+0.6*ax.M; w[0]*=0.7+0.6*ax.F;
  var sw=w.reduce(function(a,b){ return a+b; },0)||1; var base=0;
  comp.forEach(function(v,i){ base+=(w[i]/sw)*v; });
  var thesis=1; if(inv.tags.indexOf('smb')>=0) thesis=G.arch==='smb'?1.2:0.6; if(inv.tags.indexOf('consumer')>=0) thesis=G.arch==='consumer'?1.2:0.8; if(inv.tags.indexOf('ai')>=0) thesis=G.idea.ai?1.25:0.6; if(inv.tags.indexOf('big')>=0) thesis=G.tam>0.6?1.1:0.7;
  var interest=100*base*thesis*Math.sqrt(E.fundAvail);
  interest+=0.2*G.hype*ax.H*3;
  if(p){ interest+=(p.warm?8:0)+8*liveSheets(r)+(p.bonus||0)-4*(r.passes||0)*0.5; if(ax.C>0.5) interest+=15*ax.C*(r.passes||0)/Math.max(1,r.pipe.length); }
  interest-=(G.ethics>40?12:0)+3*G.whip+(G.flags.coSplit?15:0);
  if(G.founder.bg.flags.kilnBonus && inv.kiln) interest+=G.founder.bg.flags.kilnBonus;
  if(inv.kiln) interest+=15;
  if(inv.tourist) interest+=10;
  return clamp(interest,0,100);
};
function liveSheets(r){ return r.pipe.filter(function(p){ return p.stage==='sheet'; }).length; }
M.weakest=function(G,stage){
  var comp=M.components(G,null,stage), w=M.STAGE_WEIGHTS[stage], worst=0, wv=1e9;
  comp.forEach(function(v,i){ var s=w[i]*(1-v); if(w[i]>0.04 && s>0 && (wv===1e9 || -s<wv)) { if(-s<wv){ wv=-s; worst=i; } } });
  return M.COMP_NAMES[worst];
};
M.passLine=function(G,inv,stage){
  var wk=M.weakest(G,stage), f=SU.fin(G), ch=G.stat.churnRate||0;
  var team=(G.co?'We like you, ':'Solo founders are a tough sell for us. ');
  switch(wk){
    case 'traction': return 'We love the idea, but we need to see more traction. '+SU.fmtMoney(G.mrr||0)+' of monthly revenue is below our bar for '+M.STAGE_NAME[stage]+'.';
    case 'efficiency': return 'The team is strong, but the burn multiple is too high. We need to see more growth per dollar.';
    case 'market': return 'It is a good business, but the market looks too small for a fund like ours.';
    case 'product': return 'We are not convinced the product is there yet. '+(ch>0.05?'Churn of '+(ch*100).toFixed(1)+'% is the issue.':'Talk to more customers and show us it is working.');
    default: return team+'But we want to see a stronger team around you: a cofounder or key hires.';
  }
};

/* ------------------------------------------------------------ rounds */
M.eligible=function(G,stage,ask,opts){
  opts=opts||{}; var t=G.year+(G.month-1)/12;
  return SU.INVESTORS.filter(function(i){
    if(i.stages.indexOf(stage)<0) return false; if(t<i.from||t>i.to) return false;
    if(G.arch==='venue'){ if(!i.venue) return false; } else if(i.venue==='only') return false;
    if(i.id==='kiln' && stage!=='preseed') return false;
    if(ask<i.check[0]*0.4||ask>i.check[1]*2.5) return false;
    if(opts.bridge && !(G.rounds.some(function(r){ return r.leads && r.leads.indexOf(i.id)>=0; }))) return false;
    return true;
  });
};
M.openRound=function(G,p,eff){
  var E=SU.era(G); var stage=p.stage||(p.amount?M.stageFromAmount(p.amount):'seed');
  var inst=p.instrument||((stage==='preseed'||(stage==='seed'&&E.key!=='crash'&&E.key!=='bust'&&E.key!=='mania'&&G.year>=2013))?'safe':(stage==='seed'?'note':'priced'));
  if(stage==='A'||stage==='B'||stage==='C') inst='priced';
  var base=E.base[stage]; var ask=p.amount||clamp(base*0.22,50e3,1e9);
  if(stage==='preseed') ask=p.amount||Math.min(500e3,base*0.08);
  var r={id:'r'+(++G.rid),stage:stage,ask:ask,instrument:inst,askVal:p.cap||null,opened:G.t,age:0,spray:!!p.spray,accel:!!p.accel,bridge:!!p.bridge,passes:0,pipe:[],sheets:[],pool:p.pool||null};
  var list=M.eligible(G,stage,ask,{bridge:p.bridge});
  var warm={}; G.rounds.forEach(function(rr){ (rr.leads||[]).forEach(function(l){ warm[l]=true; }); });
  var picks=[]; if(p.targets&&p.targets.length){ p.targets.forEach(function(id){ var inv=SU.investor(id); if(inv && list.indexOf(inv)>=0) picks.push(inv); }); }
  var rest=SU.shuffle(G,list.filter(function(i){ return picks.indexOf(i)<0; }),'pitch').slice(0,(p.spray?10:7)-picks.length);
  picks=picks.concat(rest);
  if(p.accel){ var k=SU.investor('kiln'); if(k && G.year>=2006 && picks.indexOf(k)<0) picks.unshift(k); }
  picks.forEach(function(inv){ r.pipe.push({inv:inv.id,stage:'intro',interest:0,turns:0,warm:!!warm[inv.id]||(G.founder.bg.flags.warmIntro&&SU.chance(G,0.4,'pitch')),bonus:0,pitchPending:false,pitched:false}); });
  r.pipe.forEach(function(p2){ p2.interest=M.interest(G,SU.investor(p2.inv),r,p2); });
  G.round=r; G.flags.roundOpenedT=G.t;
  return r;
};
M.closeRoundFail=function(G,why){
  var r=G.round; if(!r) return; G.round=null; G.hype=clamp(G.hype-10,0,100); G.founder.sanity=clamp(G.founder.sanity-10,0,100);
  SU.journal(G,'The '+M.STAGE_NAME[r.stage]+' round fell apart. '+(why||''),'money',true);
  SU.inbox(G,{kind:'crisis',title:'The round failed',body:(why||'Nobody committed.')+' You can bridge from insiders, cut burn, or try again later.',chips:[{label:'Bridge from insiders',text:'raise a bridge from insiders'},{label:'Cut burn 30%',text:'cut burn 30%'}]});
  G.trust.inv=clamp(G.trust.inv-6,0,100);
};
M.step=function(G,E){
  var r=G.round; if(!r) return;
  r.age++;
  var eraSpeed=clamp(3/((E.close[0]+E.close[1])/2),0.4,1.6);
  var stale=r.age>((E.close[0]+E.close[1])/2)*1.5+2;
  r.pipe.forEach(function(p){
    if(['pass','dead','sheet','lost','done'].indexOf(p.stage)>=0){ if(p.stage==='sheet'){ p.sheetLeft=(p.sheetLeft===undefined?2:p.sheetLeft-1); } return; }
    var inv=SU.investor(p.inv); p.interest=M.interest(G,inv,r,p); if(stale) p.interest-=10*(r.age-Math.round(((E.close[0]+E.close[1])/2)*1.5));
    p.turns++;
    var adv=clamp((p.interest-30)/40,0.1,0.95)*inv.speed*eraSpeed*(r.spray?1.1:1);
    if(p.stage==='intro'){
      if(SU.chance(G,adv,'pitch')){ var thr=p.warm?35:45; if(p.interest>=thr){ p.stage='meet'; p.turns=0; } else { p.stage='dead'; r.passes++; note(G,inv,'did not reply to your intro'); } }
    } else if(p.stage==='meet'){
      if(SU.chance(G,adv,'pitch')){ if(p.interest>=50){ p.stage='partner'; p.turns=0; p.pitchPending=true; SU.inbox(G,{kind:'opp',title:inv.name+' wants you at a partner meeting',body:inv.fund+' is interested ('+inv.voice+') Prepare to pitch.',action:{type:'pitch',inv:inv.id}}); } else { passUp(G,inv,p,r); } }
    } else if(p.stage==='partner'){
      if(p.pitchPending && p.turns>=2){ p.pitchPending=false; p.pitched=true; p.turns=0; }
      if(!p.pitchPending && SU.chance(G,adv*1.1,'pitch')){ if(p.interest>=65) { var sh=M.makeSheet(G,r,inv,p); if(sh){ p.stage='sheet'; p.sheetLeft=2; } } else passUp(G,inv,p,r); }
    }
  });
  /* exploding sheets expire */
  r.sheets.forEach(function(s){ if(s.state==='live'){ s.left--; if(s.left<0){ s.state='expired'; var pp=r.pipe.filter(function(x){ return x.inv===s.inv; })[0]; if(pp) pp.stage='lost'; SU.inbox(G,{kind:'crisis',title:'A term sheet expired',body:SU.investor(s.inv).name+'\'s offer exploded while you were deciding.'}); } } });
  var live=r.sheets.filter(function(s){ return s.state==='live'; });
  var active=r.pipe.some(function(p){ return ['intro','meet','partner'].indexOf(p.stage)>=0; });
  if(!live.length && !active) M.closeRoundFail(G,'Every investor passed or went quiet.');
  else if(!live.length && stale && r.age>12) M.closeRoundFail(G,'The round went stale.');
};
function note(G,inv,text){ SU.inbox(G,{kind:'info',title:inv.name+' '+text,body:''}); }
function passUp(G,inv,p,r){
  p.stage='pass'; r.passes++;
  var line=M.passLine(G,inv,r.stage);
  G.invMem=G.invMem||{}; (G.invMem[inv.id]=G.invMem[inv.id]||[]).push({tag:'passed',stage:r.stage,t:G.t});
  SU.inbox(G,{kind:'info',title:inv.name+' passed',body:'"'+line+'"'});
  SU.journal(G,inv.name+' passed on the '+M.STAGE_NAME[r.stage]+'.','money');
}
/* the deal on the table */
M.makeSheet=function(G,r,inv,p){
  var E=SU.era(G), stage=r.stage, base=E.base[stage]; var bar=M.BARS[stage]||10000;
  var tm=clamp(0.6+0.9*((G.mrr||0)/bar),0.5,3);
  var pre=base*tm*Math.pow(Math.max(40,p.interest)/70,1.2)*inv.vd; pre=clamp(pre,0.35*base,4*base);
  var amt=r.ask; var lo=inv.check[0], hi=inv.check[1];
  if(amt<lo) amt=lo; if(amt>hi) amt=hi; if(stage!=='preseed' && amt>pre*0.35) amt=Math.round(pre*0.3/1000)*1000;
  if(inv.kiln){ if(G.year>=2014){ amt=500e3; pre=7.14e6; } else { amt=20e3; pre=0.33e6; } }
  amt=Math.round(amt/1000)*1000; pre=Math.round(pre/1e4)*1e4;
  var inst=r.instrument; if(stage==='A'||stage==='B'||stage==='C') inst='priced';
  var s={id:'ts'+(++G.rid),inv:inv.id,stage:stage,instrument:inst,amount:amt,pre:pre,cap:inst==='priced'?null:(inv.kiln?pre:pre+amt),
    pref:1,part:false,anti:'broad',board:(stage!=='preseed'&&stage!=='seed'&&amt>=3e6),proRata:true,pool:M.POOL_TARGET[stage],vestReset:false,left:2,counters:2,state:'live',note:'',revenge:false};
  var pred=(E.key==='crash'||E.key==='bust')&&SU.chance(G,0.25,'pitch'); if(pred&&inst==='priced'){ s.pref=2; s.part=true; s.note='Predatory: 2x participating preference.'; }
  if(E.key==='bust' && SU.chance(G,0.15,'pitch') && inst==='priced'){ s.anti='full'; s.note=(s.note?s.note+' ':'')+'Full-ratchet anti-dilution.'; }
  if((stage==='A') && G.mi<30 && !G.flags.vested && SU.chance(G,0.3,'pitch')){ s.vestReset=true; s.note=(s.note?s.note+' ':'')+'Founder vesting restarts.'; }
  var mem=(G.invMem&&G.invMem[inv.id])||[]; if(mem.some(function(m){ return m.tag==='passed'&&m.stage!==stage; })){ s.revenge=true; s.note=(s.note?s.note+' ':'')+inv.name+' is back after passing earlier.'; }
  if(inv.tourist){ s.pre*=1.5; s.left=1; s.note=(s.note?s.note+' ':'')+'Pre-empt: exploding in 1 turn, no follow-on.'; }
  r.sheets.push(s);
  SU.inbox(G,{kind:'opp',title:'TERM SHEET: '+inv.name,body:SU.fmtMoney(s.amount)+' '+(inst==='priced'?'at '+SU.fmtMoney(s.pre)+' pre-money':'on a SAFE at a '+SU.fmtMoney(s.cap)+' post-money cap')+'. '+(s.note||''),action:{type:'sheet',id:s.id}});
  SU.journal(G,'Term sheet from '+inv.name+'.','money',true);
  return s;
};
M.sheetImpact=function(G,s){
  var c=G.cap, fdNow=M.fd(G)+M.safeShares(G).reduce(function(a,x){ return a+x.sh; },0);
  var sh; if(s.instrument==='priced'){ var post=s.pre+s.amount; sh=s.amount/post; } else sh=s.amount/s.cap;
  var before=M.founderPct(G);
  return {newPct:sh, founderBefore:before, founderAfter:before*(1-sh)*(s.instrument==='priced'?(1-Math.max(0,s.pool-(c.pool.unissued/ (M.existing(G)||1)))*0.8):1)};
};
M.counter=function(G,sid,term,val){
  var r=G.round; if(!r) return {ok:false,msg:'No open round.'}; var s=r.sheets.filter(function(x){ return x.id===sid; })[0]; if(!s||s.state!=='live') return {ok:false,msg:'That offer is gone.'};
  if(s.counters<=0) return {ok:false,msg:'No counters left. Take it or leave it.'};
  s.counters--; var inv=SU.investor(s.inv);
  var maxReasonable=1.25, ask=1;
  if(term==='valuation') ask=1+val; else if(term==='pref') ask=1.15; else if(term==='board') ask=1.1; else if(term==='pool') ask=1.1; else ask=1.1;
  var others=r.sheets.filter(function(x){ return x.state==='live'&&x!==s; }).length;
  var pw=0.08+0.5*(ask/maxReasonable)*(ask>1.15?1.4:0.6)-0.15*others-0.10*(SU.fin(G).runway>=12?1:0)+0.10*(inv.vd-0.8);
  pw=clamp(pw,0.02,0.9);
  if(SU.chance(G,pw,'pitch')){ s.state='withdrawn'; var pp=r.pipe.filter(function(x){ return x.inv===s.inv; })[0]; if(pp) pp.stage='lost'; return {ok:true,walked:true,msg:inv.name+' walked: "That is not the deal we discussed."'}; }
  var give=0.3+0.7*SU.rnd(G,'pitch'); var msg='';
  if(term==='valuation'){ var inc=Math.max(0,val)*give; if(s.pre) s.pre=Math.round(s.pre*(1+inc)/1e4)*1e4; if(s.cap && s.instrument!=='priced') s.cap=Math.round(s.cap*(1+inc)/1e4)*1e4; msg=inv.name+' came up to '+SU.fmtMoney(s.pre||s.cap)+'.'; }
  else if(term==='pref'){ if(s.part||s.pref>1){ s.pref=1; s.part=false; msg=inv.name+' agreed to a plain 1x non-participating preference.'; } else msg='Already standard.'; }
  else if(term==='board'){ s.board=false; msg=inv.name+' dropped the board seat (observer only).'; }
  else if(term==='pool'){ s.pool=Math.max(0.06,s.pool-0.03); msg=inv.name+' trimmed the pool top-up.'; }
  else if(term==='vest'){ s.vestReset=false; msg=inv.name+' dropped the vesting reset.'; }
  else if(term==='anti'){ s.anti='broad'; msg=inv.name+' agreed to broad-based anti-dilution.'; }
  s.note=''; return {ok:true,msg:msg};
};
M.accept=function(G,sid){
  var r=G.round; if(!r) return null; var s=r.sheets.filter(function(x){ return x.id===sid; })[0]; if(!s||s.state!=='live') return null;
  var inv=SU.investor(s.inv); s.state='accepted';
  var before=M.founderPct(G), res=null;
  if(s.instrument==='priced'){ res=M.priced(G,r.stage,s.amount,s.pre,{pool:s.pool,pref:s.pref,part:s.part,anti:s.anti,investors:[s.inv]}); }
  else { M.addSafe(G,s.amount,s.cap,s.inv,r.stage); }
  G.cash+=s.amount; SU.drv(G,'cash',s.amount,'Round closed');
  var after=M.founderPct(G);
  var rec={id:r.id,stage:r.stage,amount:s.amount,pre:s.pre||null,cap:s.cap||null,instrument:s.instrument,lead:inv.name,leads:[s.inv],t:G.t,date:SU.dateStr(G),down:res&&res.down,founderBefore:before,founderAfter:after};
  G.rounds.push(rec);
  /* board */
  if(s.board){ G.board.seats.investors++; if(G.rounds.length>=2 && !G.board.seats.independent && (r.stage==='B'||r.stage==='C')) G.board.seats.independent=1; }
  if(s.vestReset){ G.flags.vested=true; G.morale=clamp(G.morale-3,0,100); }
  if(s.part) G.flags.predatory=true;
  r.pipe.forEach(function(p){ if(p.stage==='sheet'&&p.inv!==s.inv) p.stage='lost'; if(['intro','meet','partner'].indexOf(p.stage)>=0) p.stage='lost'; });
  G.round=null;
  var down=!!(res&&res.down); G.hype=clamp(G.hype+(down?-8:8),0,100); G.morale=clamp(G.morale+(down?-12:6),0,100); G.founder.sanity=clamp(G.founder.sanity+(down?-4:10),0,100);
  G.trust.inv=clamp(G.trust.inv+(down?-4:6),0,100);
  if(s.amount>=500e3 && !G.founder.pay){ G.founder.pay=5000; SU.inbox(G,{kind:'info',title:'You can pay yourselves now',body:'With funding in the bank, founders draw $5K a month each. Sanity thanks you.'}); }
  SU.journal(G,'Closed '+SU.fmtMoney(s.amount)+' '+M.STAGE_NAME[r.stage]+' from '+inv.name+'. Founders now own '+SU.pct(after,1)+'.','money',true);
  if(inv.id==='lena'){ G.flags.gargRofr=true; }
  if(inv.id==='bridgewell'){ }
  G.flags.lastRoundStage=r.stage; G.flags.lastPost=(s.pre||s.cap||0)+(s.instrument==='priced'?s.amount:0);
  return rec;
};
M.declineAll=function(G){ var r=G.round; if(!r) return; r.sheets.forEach(function(s){ if(s.state==='live') s.state='declined'; }); G.round=null; SU.journal(G,'You walked away from the round.','money'); };

/* ------------------------------------------------------------ pitch meeting (offline) */
var CONCERN_KW={traction:['mrr','revenue','customers','growth','pipeline','retention','paying','signed'],efficiency:['burn','runway','efficien','margin','cac','payback','profit'],market:['market','tam','billion','segment','expand','category','industry'],product:['product','roadmap','retention','nps','feature','moat','differentiat','built'],team:['hire','cofounder','team','experience','advisor','background','recruit']};
M.pitchQuestions=function(G,invId){
  var inv=SU.investor(invId), stage=G.round?G.round.stage:'seed', wk=M.weakest(G,stage);
  var qWeak={traction:'Your traction is early. Walk me through your numbers and what you do with this round.',efficiency:'What does your path to profitability look like, and how efficient is your growth?',market:'How big can this get? Convince me it is more than a niche.',product:'Why does your product win? What do customers say, and what stops a rival copying it?',team:'Why is this the right team, and who else do you need to hire?'}[wk];
  var qPersona={priya:'What is the first thing you would fix about your onboarding?',benny:'What are you shipping this week?',kiln:'What have you learned from customers that surprised you?',margaret:'How is this a billion-dollar company?',felix:'Walk me through your best customer, step by step.',grant:'What is your net revenue retention and burn multiple?',lena:'Who are you most afraid of among the big incumbents?',bryce:'Why should we pay a premium to be in this round?',eleanor:'What happens to this business if you never raise again?',odile:'Why will the people who passed on you be wrong?',hana:'Is the model the moat or the workflow?',rusty:'How many eyeballs will you have by Christmas?'}[invId]||'What is your biggest risk?';
  return [{q:qWeak,concern:wk},{q:qPersona,concern:'persona',inv:invId},{q:'Quick one: what is your monthly recurring revenue and how many customers do you have?',concern:'claim'}];
};
M.pitchScore=function(G,invId,answers){
  var inv=SU.investor(invId), qs=M.pitchQuestions(G,invId), total=0, notes=[];
  answers.forEach(function(a,i){
    var t=SU.norm(a||''), q=qs[i], words=t.split(' ').filter(Boolean).length, pts=0, minW=(q.concern==='claim'?4:8);
    var kws=CONCERN_KW[q.concern]||[]; var hit=0; kws.forEach(function(k){ if(t.indexOf(k)>=0) hit++; }); pts+=Math.min(3,hit)*2;
    if(/\d/.test(t)) pts+=1; if(words<minW) pts-=2;
    if(q.concern==='persona'){ var pk=(inv.voice||'').toLowerCase().split(/\W+/).filter(function(w){ return w.length>5; }); var ph=0; pk.forEach(function(k){ if(t.indexOf(k)>=0) ph++; }); pts+=Math.min(2,ph); if(words>=15) pts+=1; }
    total+=pts;
    if(words<minW) notes.push('Answer '+(i+1)+' was too vague.'); else if(pts>=4) notes.push('Answer '+(i+1)+' landed.');
  });
  var ann=SU.parseAnnounce(G,answers.join(' '));
  var cr=M.applyClaims(G,ann.claims,true);
  var delta=clamp(total*0.9-3+cr.bonus,-10,10);
  return {delta:delta,notes:notes.concat(cr.notes)};
};
/* click-based pitch: three questions, four honest-to-spin answers each */
M.pitchOptions=function(G,invId){
  var inv=SU.investor(invId), stage=G.round?G.round.stage:'seed', tr=M.truth(G), comp=M.components(G,inv,stage), cn=M.COMP_NAMES, S0=SU.seg(G);
  var wk=M.weakest(G,stage), wi=Math.max(0,cn.indexOf(wk)), strength=clamp(comp[wi],0,1), fm=SU.fmtMoney;
  function pc(x){ return Math.round(x*100)+'%'; }
  var honest, polished, vision, claimsH=null, claimsP=null;
  var real=G.needs.filter(function(n){ return n.real&&n.revealed; }).map(function(n){ return n.name; }).slice(0,2).join(' and ');
  if(wk==='traction'){ honest='We have '+tr.customers+' customers and '+fm(tr.mrr)+' a month'+(tr.growth>0.005?', growing '+pc(tr.growth)+' a month':'')+'.'; polished='We are at about '+fm(tr.mrr*1.15)+' a month and accelerating.'; vision='Traction is early on purpose. Look at how big this gets.'; claimsH=[{metric:'mrr',val:tr.mrr},{metric:'customers',val:tr.customers}]; claimsP=[{metric:'mrr',val:Math.round(tr.mrr*1.15)},{metric:'customers',val:Math.round(tr.customers*1.15)}]; }
  else if(wk==='efficiency'){ honest='We burn '+fm(tr.burn)+' a month with '+(tr.runway>=99?'plenty of':tr.runway.toFixed(0)+' months of')+' runway, and here is the path to break-even.'; polished='We are extremely capital efficient and getting better.'; vision='Efficiency follows scale. We are buying growth on purpose.'; }
  else if(wk==='market'){ honest='Our wedge is '+S0.who+'. They are a niche, but they pay real money, and the next segment doubles it.'; polished='This is a billion-dollar category and we are early.'; vision='Every business like this will need what we are building.'; }
  else if(wk==='product'){ honest=(real?'Customers told us they need '+real+', and we built it. ':'We keep building what customers ask for. ')+'Quality is '+Math.round(G.Q)+' out of 100.'; polished='Customers love it. Retention is excellent.'; vision='The product is the start. The platform is the point.'; }
  else { honest='We are '+SU.headcount(G)+' people'+(G.co?', with '+G.co.name+' as cofounder':', and I am solo for now')+', and we know exactly who to hire next.'; polished='A world-class team that has done this before.'; vision='We are the right people because we cannot stop thinking about this.'; }
  var q1={concern:wk,q:M.pitchQuestions(G,invId)[0].q,opts:[
    {t:honest,delta:Math.round(-2+8*strength),claims:claimsH,tag:'Honest'},
    {t:polished,delta:Math.round(8*Math.min(1,strength*1.2)),claims:claimsP,tag:'Polished'},
    {t:vision,delta:Math.round(4*inv.ax.M+(wk==='market'?2:-1)),tag:'Big picture'},
    {t:'We would rather not get into that yet.',delta:-4,tag:'Dodge'}]};
  var ax=inv.ax;
  var q2={concern:'persona',q:M.pitchQuestions(G,invId)[1].q,opts:[
    {t:'Walk them through the growth curve, month by month.',delta:Math.round((ax.G-0.4)*12),tag:'Growth'},
    {t:'Show the unit economics: what a customer costs and what they pay.',delta:Math.round((ax.E-0.4)*12),tag:'Efficiency'},
    {t:'Paint the size of the market and where it goes.',delta:Math.round((ax.M-0.4)*12),tag:'Market'},
    {t:'Tell the founder story: why you cannot not do this.',delta:Math.round((ax.F-0.4)*12),tag:'Founder'}]};
  var q3={concern:'claim',q:'Quick one: what is your monthly revenue and how many customers do you have?',opts:[
    {t:'Exactly: '+fm(tr.mrr)+' a month and '+tr.customers+' customers.',delta:1,claims:[{metric:'mrr',val:tr.mrr},{metric:'customers',val:tr.customers}],tag:'Exact'},
    {t:'About '+fm(Math.round(tr.mrr*1.15))+' and '+Math.round(tr.customers*1.15)+' customers.',delta:0,claims:[{metric:'mrr',val:Math.round(tr.mrr*1.15)},{metric:'customers',val:Math.round(tr.customers*1.15)}],tag:'Rounded up'},
    {t:'Around '+fm(Math.round(tr.mrr*1.4))+' and '+Math.round(tr.customers*1.4)+' customers.',delta:0,claims:[{metric:'mrr',val:Math.round(tr.mrr*1.4)},{metric:'customers',val:Math.round(tr.customers*1.4)}],tag:'Inflated'},
    {t:'I will send the numbers after.',delta:-3,tag:'Dodge'}]};
  return [q1,q2,q3];
};
M.pitchResolve=function(G,invId,picks){
  var qs=M.pitchOptions(G,invId), total=0, claims=[], notes=[];
  picks.forEach(function(p,i){ var o=qs[i].opts[p]; if(!o) return; total+=o.delta; if(o.claims) claims=claims.concat(o.claims); });
  var cr=M.applyClaims(G,claims,true); total+=cr.bonus; notes=notes.concat(cr.notes);
  var d=clamp(total*0.9,-10,10);
  return {delta:d,notes:notes};
};
M.applyPitch=function(G,invId,res){
  var r=G.round; if(!r) return; var p=r.pipe.filter(function(x){ return x.inv===invId; })[0]; if(!p) return;
  p.bonus=(p.bonus||0)+res.delta; p.pitchPending=false; p.pitched=true; p.turns=1;
  SU.journal(G,'Pitched '+SU.investor(invId).name+' ('+(res.delta>=0?'+':'')+Math.round(res.delta)+' interest).','money');
};

/* claims: numbers you state vs the truth */
M.truth=function(G){ var f=SU.fin(G); return {mrr:G.mrr||0,arr:(G.mrr||0)*12,customers:SU.custCount(G),growth:SU.growthMo(G),burn:Math.max(0,f.burn),runway:Math.min(f.runway,99)}; };
M.applyClaims=function(G,claims,forInvestors){
  var tr=M.truth(G), bonus=0, notes=[];
  claims.forEach(function(c){
    var truth=tr[c.metric]; if(truth===undefined) return; var said=c.val; if(c.metric==='growth'&&said>1) said=said/100;
    var gap=truth>0? (said-truth)/truth : (said>0?1:0); var label, led=0;
    if(gap<=0.10){ label='honest'; G.founder.cred=clamp(G.founder.cred+1,0,100); }
    else if(gap<=0.30){ label='rounding up'; bonus+=3; led=5; }
    else { label='embellished'; bonus+=6; led=20; }
    if(led){ G.ethics+=led; G.claimsLedger=(G.claimsLedger||[]); G.claimsLedger.push({t:G.t,metric:c.metric,said:said,truth:truth,label:label}); notes.push('You said '+c.metric+' '+fmtClaim(c.metric,said)+'; the truth is '+fmtClaim(c.metric,truth)+' ('+label+').'); }
  });
  return {bonus:forInvestors?bonus:0,notes:notes};
};
function fmtClaim(m,v){ return (m==='mrr'||m==='arr'||m==='burn')?SU.fmtMoney(v):(m==='growth'?SU.pct(v,0)+'/mo':Math.round(v)); }

/* ------------------------------------------------------------ non-dilutive money */
M.rbf=function(G){
  if((G.mrr||0)<20000) return {ok:false,msg:'Revenue-based financing needs at least $20K MRR.'};
  if(G.loans.rbf&&G.loans.rbf.left>0) return {ok:false,msg:'You already have an open advance.'};
  var adv=4*G.mrr; G.cash+=adv; G.loans.rbf={left:adv*1.4,adv:adv}; SU.drv(G,'cash',adv,'Revenue-based financing');
  return {ok:true,msg:'Clearbar advanced '+SU.fmtMoney(adv)+'. 6% of revenue repays it, up to 1.4x.'};
};
M.ventureDebt=function(G){
  var last=G.rounds[G.rounds.length-1]; if(!last||['A','B','C'].indexOf(last.stage)<0) return {ok:false,msg:'Venture debt is for post-Series A companies.'};
  if(G.loans.debt&&G.loans.debt.bal>0) return {ok:false,msg:'You already have venture debt.'};
  var amt=Math.round(last.amount*0.25/1000)*1000; G.cash+=amt; G.loans.debt={bal:amt,cov:3}; SU.drv(G,'cash',amt,'Venture debt');
  return {ok:true,msg:'Bridgewell lent '+SU.fmtMoney(amt)+' at 11%. Covenant: keep cash above 3 months of burn.'};
};
M.insiderBridge=function(G){
  if(!G.rounds.length) return {ok:false,msg:'You have no insiders yet. Try angels in a normal round.'};
  var p=clamp(0.8*(G.board.mood/100)+0.1,0.1,0.9), amt=Math.round((G.rounds[G.rounds.length-1].amount*0.2)/1000)*1000;
  if(SU.chance(G,p,'pitch')){ G.cash+=amt; M.addSafe(G,amt,(G.flags.lastPost||10e6)*0.8,'insiders','seed'); SU.drv(G,'cash',amt,'Insider bridge'); G.trust.inv=clamp(G.trust.inv-3,0,100); return {ok:true,msg:'Insiders wired '+SU.fmtMoney(amt)+' on a SAFE at a discount to the last round.'}; }
  return {ok:false,msg:'Insiders declined to bridge you.'};
};

/* ------------------------------------------------------------ exits */
M.ipoGates=function(G){
  var E=SU.era(G), arr=SU.arr(G), g=SU.growthMo(G); var yoy=Math.pow(1+clamp(g,-0.2,0.5),12)-1;
  var barMult=E.key==='mania'?0.1:E.key==='zero'?0.8:E.key==='ai'?1.2:1; var bar=80e6*barMult;
  var gates=[
    {ok:E.ipoWindow>=0.3,label:'IPO window open ('+Math.round(E.ipoWindow*100)+'%)'},
    {ok:arr>=bar,label:'ARR at least '+SU.fmtMoney(bar)+' ('+SU.fmtMoney(arr)+')'},
    {ok:yoy>=0.25,label:'Growth at least 25% a year'},
    {ok:G.arch!=='smb'||true,label:'Gross margin at least 55%'},
    {ok:G.board.seats.independent>0,label:'An independent director on the board'},
    {ok:!!G.flags.soc2,label:'SOC 2 report'},
    {ok:G.ethics<10,label:'Clean claims ledger'}
  ];
  return {gates:gates,ok:gates.every(function(x){ return x.ok; })};
};
M.makeOffer=function(G){
  var E=SU.era(G), ev=SU.valuation(G), arr=SU.arr(G), heads=SU.headcount(G);
  var threat=0; G.rivals.forEach(function(r){ if(r.id==='gargantua'&&r.active) threat=1; });
  var types=[];
  if(arr>1e6 || G.rounds.length) types.push({buyer:'a strategic acquirer',mult:SU.lerp(1.1,1.3,SU.rnd(G,'events')),kind:'strategic'});
  if(threat) types.push({buyer:'Gargantua Systems',mult:SU.lerp(1.3,1.6,SU.rnd(G,'events')),kind:'incumbent'});
  if(G.mrr>0 && SU.fin(G).burn<0) types.push({buyer:'a private equity firm',mult:SU.lerp(0.8,1.0,SU.rnd(G,'events')),kind:'pe'});
  var eng=SU.count(G,'eng')+1; var acq={buyer:'a big company that likes your team',mult:0,kind:'acquihire',price:Math.round(eng*SU.lerp(1e6,2e6,SU.rnd(G,'events'))/1e4)*1e4};
  if(G.arch==='venue'){ acq={buyer:'a local restaurant group that wants your room',mult:0,kind:'strategic',price:Math.round(Math.max(120e3,(G.mrr||0)*SU.lerp(5,8,SU.rnd(G,'events')))/1e4)*1e4}; types=types.filter(function(x){ return x.kind!=='incumbent'; }); }
  types.push(acq);
  var t=SU.pick(G,types,'events'); var price=t.price||Math.round(ev*t.mult/1e5)*1e5;
  if(!t.price && price<5e5) { t=acq; price=acq.price; }
  return {id:'of'+(++G.rid),buyer:t.buyer,kind:t.kind,price:price,left:3,counters:1,t:G.t,struct:t.kind==='acquihire'?'cash, with 2-year retention packages':(SU.chance(G,0.5,'events')?'cash':'half cash, half stock')};
};
})();
