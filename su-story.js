/* RUNWAY - story: press and social reactions, achievements, endings, autopsy, score, generated artifacts. */
(function(){
var SU = (window.SU = window.SU || {});
var clamp=SU.clamp, M=SU.Money;
var Story = (SU.Story = {});
function fm(n){ return SU.fmtMoney(n); }
function fill(t,tok){ return t.replace(/\{(\w+)\}/g,function(m,k){ return tok[k]!==undefined? tok[k] : m; }); }
function pick(G,a){ return SU.pick(G,a,'media'); }

/* ------------------------------------------------------------ reactions */
var HEAD={
  raise:{good:['{co} lands {amt} to take on {seg}','{co} raises {amt}: "we are just getting started"'],bad:['{co} raises {amt} at a price some call generous','Investors circle {co}, but founders keep little']},
  hire:{good:['{co} adds {n} to the team as demand grows','Hiring picks up at {co}'],bad:['{co} grows headcount before proving fit, critics say']},
  fire:{good:['{co} trims staff to extend runway'],bad:['Layoffs at {co}: "this was not an easy decision"','{co} cuts jobs as cash tightens']},
  launch:{good:['{co} makes a splash with its launch','{co} debuts to a warm reception'],bad:['{co} launches. The reviews are not kind','Thin product greets {co} launch crowd']},
  price:{good:['{co} changes pricing, and customers mostly shrug'],bad:['Customers push back on {co} price change','{co} pricing move draws complaints']},
  build:{good:['{co} ships what customers asked for','{co} adds to its product, and users notice'],bad:['{co} busy building, but is it what anyone wants?']},
  market:{good:['{co} ramps up marketing, and the numbers follow'],bad:['{co} spends on marketing; results are unclear']},
  outbound:{good:['Inboxes everywhere: {co} goes door to door in email'],bad:['{co} outreach lands in spam folders']},
  talk:{good:['{co} founder spends the week with customers: "I was wrong about three things"'],bad:['{co} listens, but the answers are mixed']},
  ethics:{good:[],bad:['Questions about {co} practices surface online','Anonymous posts accuse {co} of cutting corners']},
  self:{good:['{co} founder logs off for a few days'],bad:[]},
  culture:{good:['{co} changes how it works, and staff say they like it'],bad:['{co} employees split over new workplace rules']},
  pivot:{good:['{co} pivots to {seg}'],bad:['{co} changes direction, and not everyone follows']},
  exit:{good:['{co} makes its move'],bad:['{co} makes its move']},
  none:{good:['{co} keeps its head down and grows','Quiet month at {co}, which is fine'],bad:['{co} is quiet. Too quiet?','Silence from {co} worries watchers']}
};
var CHIRP={
  good:['just tried {co}. ok this is actually good','{co} fixed the thing I complained about last week','anyone else using {co}? my {seg} friends love it','shoutout to the {co} team for shipping fast','{co} support replied in 4 minutes. what'],
  bad:['{co} is fine but I keep hitting bugs','ok but who is {co} actually for','{co} pricing feels off to me','I wanted to like {co}','{co} founders are everywhere on my timeline and I am not sure why'],
  neutral:['has anyone compared {co} with the big guys?','{co} and Krellix are basically the same product','thinking about {co} for our team, thoughts?']
};
var FORUM={good:['The founders are replying in the thread. Respect.','I use it daily. Not perfect, but it solves a real problem.','Honestly the onboarding is better than most funded companies.'],bad:['This is just a cron job with a login page.','Another startup that discovered "AI" in a press release.','What is the moat? Genuinely asking.','Show me retention, then we will talk.'],neutral:['Interesting, but I would wait for the second version.','What is your pricing relative to the incumbents?']};

Story.media=function(G,rec){
  var tok={co:G.name,seg:SU.seg(G).who,n:'',amt:''};
  var items=rec.items.filter(function(i){ return i.status!=='dropped'; }).sort(function(a,b){ return b.focus-a.focus; });
  var lead=items[0]; var lever=lead? lead.lever : 'none';
  var map={talkto:'talk',comp:'hire',compliance:'build',refactor:'build',finance:'raise',fundraise:'raise',rival:'market'};
  var key=map[lever]||lever; if(!HEAD[key]) key='none';
  var b=rec.before, a=rec.after;
  var score=(a.mrr>b.mrr?1:a.mrr<b.mrr?-1:0)+(a.cust>b.cust?1:a.cust<b.cust?-1:0)+(a.sanity<b.sanity-8?-1:0)+(G.cash<0?-2:0);
  if(key==='ethics'||key==='fire') score=Math.min(score,-1);
  if(key==='raise'&&lead&&lead.clause.params.act==='accept') score=Math.max(score,2);
  var mood=score>0?'good':score<0?'bad':(SU.rnd(G,'media')<0.5?'good':'bad');
  var bank=HEAD[key][mood]; if(!bank||!bank.length) bank=HEAD[key][mood==='good'?'bad':'good']||HEAD.none[mood];
  if(lead && lead.clause){ var p=lead.clause.params; if(key==='hire') tok.n=(p.n||1)+''; if(key==='raise'){ tok.amt=fm(p.amount||G.round&&G.round.ask||0); } }
  var cm=mood==='good'?'good':'bad';
  var out={headline:fill(pick(G,bank)||'{co} in the news',tok),chirps:[],forum:fill(pick(G,FORUM[mood==='good'?'good':(score<0?'bad':'neutral')]),tok),mood:mood};
  var seen={};
  for(var i=0;i<2;i++){ var m2=i===0?cm:(SU.rnd(G,'media')<0.35?'neutral':cm); var t=fill(pick(G,CHIRP[m2]),tok); if(seen[t]) continue; seen[t]=1; out.chirps.push({who:pickHandle(G),text:t}); }
  out.customer=customerQuote(G,mood); out.team=teamQuote(G,mood);
  return out;
};
function pickHandle(G){ var h=['@dentist_dana','@fryer_fred','@cfo_hal','@devops_dev','@mom_of_three','@growth_greg','@vc_vera','@skeptic_sam','@indie_ines','@night_owl']; return pick(G,h); }
function customerQuote(G,mood){ var S=SU.seg(G); var c=SU.custCount(G); if(c<1) return {who:S.quoteName,text:S.skeptic}; return {who:S.quoteName,text:mood==='good'?S.quote.replace(/^If it does not/,'It finally does').replace(/it is one more tab I babysit\./,'and that saves me a tab.'):S.skeptic}; }
function teamQuote(G,mood){
  if(G.co && SU.rnd(G,'media')<0.6){ return {who:G.co.name,text:G.co.voice}; }
  var e=pick(G,G.team); if(e){ return {who:e.name,text:e.loyalty<50?'I am updating my resume, just in case.':e.loyalty>75?'Best team I have worked on.':'We are doing okay. Keep us posted.'}; }
  return {who:G.founder.name||'You',text:'It is just us, and the bank account. Keep going.'};
}
(SU.Events=SU.Events||{}).media=Story.media;

/* ------------------------------------------------------------ achievements */
var ACH=[
  {id:'first_customer',name:'First customer',test:function(G){ return /First paying/.test(G.journal.map(function(j){ return j.text; }).join('|')); }},
  {id:'ten',name:'Ten customers',test:function(G){ return /10 paying|500 monthly|\$5K of monthly GMV/.test(G.journal.map(function(j){ return j.text; }).join('|')); }},
  {id:'first_hire',name:'First hire',test:function(G){ return G.team.length>0 || /First hire/.test(G.journal.map(function(j){ return j.text; }).join('|')); }},
  {id:'raised',name:'Raised money',test:function(G){ return G.rounds.length>=1; }},
  {id:'series_a',name:'Series A',test:function(G){ return G.rounds.some(function(r){ return r.stage==='A'; }); }},
  {id:'mrr10',name:'$10K a month',test:function(G){ return (G.mrr||0)>=10000; }},
  {id:'mrr100',name:'$100K a month',test:function(G){ return (G.mrr||0)>=100000; }},
  {id:'alive',name:'Default alive',test:function(G){ return G.mi>6 && SU.fin(G).defaultAlive && (G.mrr||0)>0; }},
  {id:'friday',name:'Survived Payroll Friday',test:function(G){ return /Survived Payroll/.test(G.journal.map(function(j){ return j.text; }).join('|')); }},
  {id:'honest',name:'Clean hands',test:function(G){ return G.act>=3 && G.ethics<5; }},
  {id:'insight',name:'You know your customer',test:function(G){ return G.insight>=70; }},
  {id:'profit',name:'Profitable',test:function(G){ var f=SU.fin(G); return G.mi>6 && f.burn<0; }}
];
SU.ACHIEVEMENTS=ACH;
SU.checkAchv=function(G,rec){ ACH.forEach(function(a){ if(G.achv.indexOf(a.id)<0){ var ok=false; try{ ok=a.test(G); }catch(e){} if(ok){ G.achv.push(a.id); if(rec){ (rec.newAchv=rec.newAchv||[]).push(a.name); } } } }); };

/* ------------------------------------------------------------ endings */
SU.endTitle=function(o){ return ({bell:'The Bell',sale:'The Exit',acquihire:'Soft Landing',indie:'Ramen Royalty',shutdown:'Our Incredible Journey',fraud:'The Documentary',coup:'The Coup',burnout:'Out of Office',decade:'Decade Review',zombie:'The Walking Dead'})[o.type]||'The End'; };
function mo(n){ n=Math.round(n); return n+' month'+(n===1?'':'s'); }
function art(w){ return /^[aeiou]/i.test(w)?'an ':'a '; }
function totalRaised(G){ return G.rounds.reduce(function(a,r){ return a+r.amount; },0); }
function sinceYears(G){ return Math.max(0.1,G.mi/12); }
Story.autopsy=function(G){
  var r=[];
  if(G.pmf<40) r.push({t:'Never found product-market fit',d:'Fit was about '+Math.round(G.pmf)+' out of 100 and insight '+Math.round(G.insight)+'. Talk to customers before building, and watch what they pay for, not what they ask for.'});
  if(SU.headcount(G)>=12 && G.pmf<50) r.push({t:'Scaled too early',d:'You had '+SU.headcount(G)+' people before the product worked. Premature scaling is the classic killer.'});
  if(G.cash<0||G.over.type==='shutdown') r.push({t:'Ran out of runway',d:'You hit zero. Default-alive math, not hope, should drive burn. Track runway every turn.'});
  if(SU.compF(G)<0.7) r.push({t:'Lost ground to rivals',d:'Competitors took about '+Math.round((1-SU.compF(G))*100)+'% of your demand. Differentiate on a need only you meet.'});
  if(G.ethics>=30) r.push({t:'Shortcuts caught up with you',d:'Your claims ledger reached '+Math.round(G.ethics)+'. Cheap wins became expensive.'});
  if(G.flags.coSplit||(G.flags.coLeft)) r.push({t:'Cofounder trouble',d:'Without vesting or care, a departing cofounder takes shares and momentum with them.'});
  if(G.rounds.length===0 && G.mi>14) r.push({t:'Never raised, never profitable',d:'You were stuck between funding and ramen. Pick a lane early.'});
  if(G.founder.sanity<25) r.push({t:'Burned out',d:'Sanity is a resource. Quiet turns and real rest are cheaper than recovery.'});
  if(!r.length) r.push({t:'It was close',d:'Luck and timing matter. Replay it with a different idea or era.'});
  return r.slice(0,3);
};
Story.takeHome=function(G,o){
  var th=0, note='';
  if(o.type==='sale'&&o.offer){ var debt=(G.loans.debt?G.loans.debt.bal:0)+(G.loans.rbf?G.loans.rbf.left:0); var wf=M.waterfall(G,Math.max(0,o.offer.price-debt)); th=wf.founders; o.wf=wf; note='after preferences'; }
  else if(o.type==='bell'){ var pc=M.founderPct(G); th=pc*o.value; o.founderPct=pc; note='paper value at pricing, before lockup'; }
  else if(o.type==='indie'){ var f=SU.fin(G); th=Math.max(0,-f.burn)*12; note='annual profit you keep'; }
  else if(o.type==='decade'){ th=M.founderPct(G)*SU.valuation(G)*0.5; note='rough paper value'; }
  o.takeHome=th; o.takeNote=note; return th;
};
Story.score=function(G,o){
  var th=o.takeHome||0, s=th>0? 100*Math.log10(1+th/1e5) : 0;
  s+=Math.min(80,G.mi*0.6); s+=Math.min(60,G.moments.length*3); s+=G.achv.length*4; s-=Math.min(60,G.ethics*0.6);
  if(o.type==='sale'||o.type==='bell') s+=40;
  if(o.type==='fraud') s=Math.min(s,20);
  return Math.max(0,Math.round(s));
};
Story.finalize=function(G){
  var o=G.over; if(!o||o.done) return;
  if(o.type==='sale'){ var last=G.flags.lastPost||0; if(o.offer.kind==='acquihire'||o.offer.price<last*0.999) o.type='acquihire'; }
  if(o.type==='sale' || o.type==='acquihire'){ if(o.offer) o.offer=o.offer; }
  Story.takeHome(G,o);
  o.title=SU.endTitle(o); o.score=Story.score(G,o); o.autopsy=Story.autopsy(G); o.raised=totalRaised(G);
  SU.checkAchv(G,null);
  o.artifacts=Story.artifacts(G,o); o.done=true;
};
Story.artifacts=function(G,o){
  var y0=G.startYear, y1=G.year, name=G.name, a=[];
  var tok={co:name,y0:y0,y1:y1};
  var tag=G.idea.tag.toLowerCase();
  var cust=SU.custCount(G);
  if(o.type==='shutdown'){
    a.push({kind:'Startup graveyard',title:name+', '+y0+'-'+y1,text:name+' '+tag+'. It lasted '+mo(G.mi)+', raised '+fm(totalRaised(G))+', and served '+cust+' customers. Briefly.'});
    a.push({kind:'Final post',title:'We are shutting down',text:'After '+mo(G.mi)+' we are winding down '+name+'. Thank you to the '+(G.team.length+1+(G.co?1:0))+' people who built it and the '+cust+' customers who trusted us. We learned more than we can write here.'});
  } else if(o.type==='bell'){
    a.push({kind:'TechPulse',title:name+' rings the bell',text:name+' priced its IPO at a valuation near '+fm(o.value)+' and '+(o.pop>0.2?'popped '+Math.round(o.pop*100)+'% on day one, leaving money on the table.':o.pop>0.05?'rose '+Math.round(o.pop*100)+' percent in its debut.':'barely moved on day one.')});
    var rf=[];
    if(G.flags.firstLayoff) rf.push('We have conducted layoffs and may do so again, which could harm morale and retention.');
    if(G.flags.coSplit||G.cofounderLeft) rf.push('Our cofounder left the company, and we may lose other key personnel.');
    if(G.ethics>0) rf.push('Past practices regarding customer data and retention have drawn scrutiny and could expose us to liability.');
    G.rivals.forEach(function(r){ if(r.active&&r.presence>0.2) rf.push('We compete with '+r.name+', which can '+(r.id==='gargantua'?'bundle similar functionality at no charge.':'undercut our prices or ship similar features.')); });
    if(G.flags.rugpull) rf.push('We depend on third-party platforms that have changed their terms without notice.');
    if(G.flags.predatory) rf.push('Certain preferred stock terms may adversely affect holders of our common stock.');
    rf.push('Our CEO has, on at least one occasion, described a competitor in terms we would not repeat here.');
    a.push({kind:'S-1 risk factors',title:'Risk factors written from your history',list:rf.slice(0,6)});
  } else if(o.type==='sale'||o.type==='acquihire'){
    var wf=o.wf;
    a.push({kind:'TechPulse',title:(o.offer.buyer.charAt(0).toUpperCase()+o.offer.buyer.slice(1))+' acquires '+name+' for '+fm(o.offer.price),text:o.type==='acquihire'?'The deal is mostly about the team. "We are joining Gargantua!" the founders post. Hacker Forum decodes the subtext.':name+' will join its new owner. The founders said they are "excited for the next chapter".'});
    if(wf) a.push({kind:'The waterfall',title:'Who got what',text:'On '+fm(o.offer.price)+', the founders received '+fm(wf.founders)+' versus '+fm(wf.foundersNoPref)+' with no preferences. Preferences took '+fm(Math.max(0,wf.foundersNoPref-wf.founders))+'.'});
  } else if(o.type==='indie'){
    a.push({kind:'Manifesto',title:'Why we are not raising',text:name+' makes '+fm(Math.max(0,-SU.fin(G).burn))+' a month more than it spends. Mara Osei sent a congratulatory note, 4,000 words long.'});
  } else if(o.type==='fraud'){
    a.push({kind:'Streaming',title:'"The Founder Who Counted Free Users"',text:'A three-part documentary on '+name+' premieres next month. Corinne Vale of The Ledger is a producer. Courtroom sketch artists are already booked.'});
  } else if(o.type==='coup'){
    a.push({kind:'Press release',title:name+' announces leadership change',text:'The board has appointed an interim CEO. The founder will "pursue other opportunities". Your final post: "It was a good run."'});
  } else if(o.type==='burnout'){
    a.push({kind:'Note to self',title:'Out of office',text:'You closed the laptop on '+SU.dateStr(G)+'. '+(G.co?G.co.name+' runs the company now.':'The company coasted without you, then slowed.')});
  } else {
    a.push({kind:'Decade review',title:name+' after ten years',text:'You are still here. '+cust+' customers, '+(G.team.length+1)+' people, and '+(G.rounds.length)+' rounds raised.'});
  }
  /* Founder wiki page */
  var isYou=(G.founder.name==='You'); var wiki=[]; wiki.push((isYou?'You are ':G.founder.name+' is ')+art(G.founder.bg.name)+G.founder.bg.name.toLowerCase()+' and the founder of '+name+', '+tag+'.');
  if(G.co) wiki.push((isYou?'You':'They')+' co-founded the company with '+G.co.name+'.'); else if(G.cofounderLeft) wiki.push((isYou?'Your':'Their')+' cofounder left early.');
  wiki.push('Over '+mo(G.mi)+' the company raised '+fm(totalRaised(G))+' across '+G.rounds.length+' round'+(G.rounds.length===1?'':'s')+' and reached '+fm(G.mrr||0)+' of monthly revenue.');
  if(G.achv.length) wiki.push('Notable: '+G.achv.map(function(id){ return ACH.filter(function(x){ return x.id===id; })[0].name; }).join('; ')+'.');
  a.push({kind:'Founder page',title:G.founder.name,text:wiki.join(' ')});
  /* Where are they now */
  var wh=[]; if(G.co) wh.push(G.co.name+': '+(o.type==='burnout'?'runs the company.':'moved on to a new venture.')); G.team.slice(0,3).forEach(function(e){ wh.push(e.name+': '+(e.loyalty>70?'still brags about the team.':'updated the resume.')); });
  G.rivals.slice(0,3).forEach(function(r){ wh.push(r.boss+' ('+r.name+'): '+(r.active?'still going.':'collapsed.')); });
  if(wh.length) a.push({kind:'Where are they now',title:'The cast',list:wh});
  return a;
};
})();
