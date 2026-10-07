/* RUNWAY - free-text parser: sentence -> priced lever clauses (with quantities). Offline, deterministic. */
(function(){
var SU = (window.SU = window.SU || {});
var clamp = SU.clamp;

var W1 = {two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
var D1 = {one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9};

SU.norm = function(t){
  t = String(t||'').toLowerCase().replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/\s+/g,' ').trim();
  t = t.replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[ -](one|two|three|four|five|six|seven|eight|nine)\b/g,function(m,a,b){ return String(W1[a]+D1[b]); });
  t = t.replace(/\b(a couple of|a couple|couple of)\b/g,'2').replace(/\b(a few|a handful of|a handful|several)\b/g,'3').replace(/\b(a dozen|dozen)\b/g,'12').replace(/\b(a|one) hundred\b/g,'100');
  t = t.replace(/\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b/g,function(m){ return String(W1[m]); });
  t = t.replace(/(\d+) hundred\b/g,function(m,a){ return String(+a*100); });
  return t;
};

/* numbers with unit hints */
SU.nums = function(t){
  var re = /(\$)?\s?(\d[\d,]*(?:\.\d+)?)\s?(k|mm|m|bn|b|thousand|million|billion|grand|bucks|dollars|usd|%|percent)?(?![a-z0-9])(\s?(?:\/|per|a|each)\s?(mo|month|yr|year|seat|user|week|wk|order|day|hour|hr))?/g;
  var out=[], m;
  while((m=re.exec(t))){
    if(m[2]===undefined) continue;
    var v=parseFloat(m[2].replace(/,/g,'')); if(isNaN(v)) continue;
    var suf=m[3]||'', mult=1, money=!!m[1], pct=false;
    if(/^(k|thousand|grand)$/.test(suf)) mult=1e3; else if(/^(m|mm|million)$/.test(suf)) mult=1e6; else if(/^(b|bn|billion)$/.test(suf)) mult=1e9;
    else if(/^(%|percent)$/.test(suf)) pct=true; else if(/^(bucks|dollars|usd)$/.test(suf)) money=true;
    var after=t.slice(re.lastIndex).match(/^\s*([a-z][a-z-]*)/);
    out.push({v:v*mult, raw:m[0], money:money, pct:pct, big:mult>1, rate:m[5]||'', idx:m.index, end:re.lastIndex, next:after?after[1]:'', suffix:suf});
  }
  return out;
};

function has(re,t){ return re.test(t); }

/* ------------------------------------------------------------ lever table */
var INVESTOR_RE = /\b(priya|benny|scrappy|kiln|margaret|larkspur|felix|vertical thesis|grant|apex|lena|gargantua ventures|bryce|moonshot|eleanor|odile|contrarian|hana|rusty|portal money|clearbar|bridgewell)\b/;
var CUES = {
  talk:[[/\b(interview|interviews|interviewing)\b/,3],[/\b(customer discovery|user research|customer research|user interviews?|customer interviews?|customer calls?)\b/,3],[/\btalk(?:ing)? (?:to|with) (?:\d+|some|our|the|every|each|more|real)\b/,2.5],[/\b(shadow|ride along|sit in on|sit with)\b/,2],[/\bsurvey\b/,3],[/\b(call|calls|calling) (?:\d+ )?(?:customers?|users?)\b/,2]],
  build:[[/\b(build|builds|building|ship|shipping|implement|develop|developing|code|prototype)\b/,3],[/\b(add|create|make|design)\b/,1.2],[/\b(fix|improve|polish|redesign|streamline|simplify)\b/,2],[/\b(mvp|v1|v2|feature|integration|integrate|sso|api|mobile app|reminders?|booking|module|dashboard|onboarding|workflow)\b/,1],[/\blaunch the (?:mvp|product|feature)\b/,3]],
  refactor:[[/\b(refactor|tech(?:nical)? debt|rewrite|clean ?up (?:the )?code|pay down|stabili[sz]e|harden|rebuild the (?:core|backend))\b/,4]],
  compliance:[[/\b(soc ?2|hipaa|gdpr|pen ?test|penetration test|security audit|compliance|iso 27001|pci)\b/,4]],
  price:[[/(\$\s?\d[\d,.]*\s?(?:k)?\s?(?:\/|per|a)\s?(?:mo|month|yr|year|seat|user)|\b\d+\s?(?:dollars|bucks)\s?(?:\/|per|a)\s?(?:mo|month))/,4],[/\b(pric(?:e|es|ing|ed)|freemium|free tier|paywall|subscription|annual plans?|monthly plans?|discounts?|grandfather\w*|take rate|commission|per seat|tiers?)\b/,3],[/\b(charge|charging)\b/,2]],
  market:[[/\b(ads?|advertis\w*|adwords|google ads|facebook ads|instagram|tiktok|youtube|ppc|sem|seo|blog|blogs|content|newsletter|podcast|sponsor\w*|conference|conferences|trade ?show|booth|billboards?|influencers?|creators?|referral program|referrals?|affiliate|marketing)\b/,3],[/\b(spend|budget|invest)\b[^.]*\b(ads?|marketing|google|facebook|content|seo)\b/,2]],
  outbound:[[/\b(cold[- ]?(?:email|emails|emailing|call|calls|calling|outreach|dm|dms)|outreach|outbound|door[- ]to[- ]door|walk(?:ing)? into|knock(?:ing)? on doors?)\b/,4],[/\b(?:email|dm|call|text|message|contact|reach out to|recruit)\s+\d+\b/,3.5],[/\b\d+\s+(?:cold\s+)?(?:emails?|dms?|calls?|messages?|texts?)\b/,3.5]],
  launch:[[/\b(launch(?:ing)? (?:on|at|to)|product ?hunt|product lab|hacker (?:forum|news)|show hn|press release|go live|public launch|publicly launch|app store launch|post(?:ing)? (?:it )?on)\b/,4]],
  hire:[[/\b(hire|hiring|hires|recruit(?:ing)?|bring on|onboard|use a recruiter|headhunter)\b/,3],[/\b(get|find|add) (?:\d+|a|an) [a-z ]*(?:engineer|developer|designer|marketer|sales|support|pm|rep|sdr|ae)s?\b/,2.5],[/\bneed (?:\d+|a|an) [a-z ]*(?:engineer|developer|designer|marketer|sales|support|pm|rep|sdr|ae)s?\b/,2]],
  fire:[[/\b(fire|firing|let (?:\w+ )?go|lay ?off|laying off|layoffs?|terminate|cut (?:\d+%? of )?(?:the )?(?:staff|team|headcount|engineers|sales)|reduce headcount|downsize)\b/,4]],
  comp:[[/\b(give [a-z ]*a? ?raise|raise (?:salar\w+|pay)|pay (?:more|bump)|bonus|equity refresh|promote|promotion|retention (?:grant|bonus)|match (?:the|their|his|her) offer|more equity|(?:give|grant) [a-z ]* equity)\b/,4]],
  culture:[[/\b(remote|work from home|hybrid|return to office|rto|in[- ]office|4[- ]day|four[- ]day|crunch|all[- ]nighters?|100[- ]hour|offsite|retreat|perks|unlimited pto|work[- ]life|team dinner|ping pong|free lunch)\b/,3]],
  fundraise:[[/\b(seed|pre[- ]?seed|series [a-d]|safe|convertible note|term sheet|bridge(?: round| loan| note)?|fundrais\w*|venture capital|vcs?|angels?|accelerator|apply to (?:kiln|an accelerator|yc)|pitch(?:ing)?|investors?)\b/,2.5],[/\braise (?:a |an |some )?(?:\$?\d[\d.,]*\s?(?:k|m|million|thousand)?|seed|series|round|money|capital|funding|cash)/,3.5],[/\b(valuation|pre-money|post-money|valuation cap|cap table)\b/,2],[/\b(accept|decline|reject|counter|sign)\b[^.]*\b(offer|term sheet|sheet|safe|round)\b/,3]],
  finance:[[/\b(venture debt|revenue[- ]based financing|rbf|credit card|defer(?:red)?(?: salaries| pay| payroll)?|cut burn|slash (?:costs|spending|burn)|reduce (?:costs|spending|burn|expenses)|cut costs|tighten (?:the )?belt|extend (?:the )?runway|insider bridge|loan|line of credit|spread (?:our )?cash)\b/,4]],
  pivot:[[/\b(pivot|switch to|go upmarket|move upmarket|go downmarket|change (?:our )?target|refocus on|new market)\b/,4]],
  ethics:[[/\b(dark pattern|hard[- ]to[- ]cancel|buy (?:reviews|followers|fake)|fake (?:reviews|accounts|testimonials)|sell (?:(?:anonymized|user|customer|our|their) )*data|inflate|count (?:the )?free users|scrape|spam|lie to|exaggerate|bait and switch|misleading|auto[- ]renew)\b/,5]],
  self:[[/\b(weekend off|take (?:the )?weekend|vacation|holiday|take (?:a )?(?:day|break|week) off|rest|sleep|therapy|therapist|exec(?:utive)? coach|coach|meditat\w*|gym|exercise|burnout|recharge|self[- ]care)\b/,4]],
  talkto:[[/\b(1:1|one[- ]on[- ]one|1-1|apologi[sz]e|all[- ]hands|town hall|team meeting|tell (?:the )?(?:team|investors|board|everyone|customers|staff)|update (?:the )?(?:board|investors)|investor update|check in with|sit down with)\b/,4]],
  rival:[[/\b(sue|lawsuit|coffee with|poach|merger|merge with|acquire (?:krellix|mirrormint|slow oak|a competitor)|price war|undercut)\b/,4]],
  exit:[[/\b(acquisition|acquire us|accept (?:the|their|gargantua'?s|an|that) offer|sell (?:the|our) company|sell out|ipo|go public|roadshow|banker|we(?:'| a)re done growing|stop growing|shut ?down|wind down|close (?:the )?(?:company|doors)|pull the plug|ramen)\b/,4]]
};
SU.LEVERS = {
  talk:{name:'Customer talks'}, build:{name:'Build'}, refactor:{name:'Refactor'}, compliance:{name:'Compliance'}, price:{name:'Pricing'}, market:{name:'Marketing'},
  outbound:{name:'Outbound'}, launch:{name:'Launch'}, hire:{name:'Hire'}, fire:{name:'Layoff'}, comp:{name:'Compensation'}, culture:{name:'Culture'},
  fundraise:{name:'Fundraise'}, finance:{name:'Finance'}, pivot:{name:'Pivot'}, ethics:{name:'Shortcut'}, self:{name:'Founder care'}, talkto:{name:'Talk to people'},
  rival:{name:'Rivals'}, exit:{name:'Exit'}, train:{name:'Train a model'}, optimize:{name:'Optimize serving'}, redteam:{name:'Red team'}
};
var PRIORITY = ['ethics','fire','comp','exit','finance','hire','fundraise','price','outbound','launch','market','talk','compliance','refactor','pivot','build','culture','talkto','rival','self'];

/* the verbs that start a new clause (used to split on "and") */
var VERB_START = /\b(hire|build|ship|launch|raise|cut|fire|spend|run|email|cold|call|talk|interview|price|charge|pivot|pitch|apply|take|give|stop|start|set|add|buy|sell|refactor|promote|let|go|move|pay|survey|sue|accept|decline|counter|hold|get|find|recruit|sponsor|offer|ask|tell|apologi[sz]e|rewrite|fix|open|close|negotiate|send|post|write|do|use|make|bring|drop|lower|increase|double|rest|sleep|vacation)\b/;

SU.splitClauses = function(t){
  var parts = t.split(/[.;\n]+/).map(function(s){ return s.trim(); }).filter(Boolean);
  var out=[];
  parts.forEach(function(p){
    var seg = p.split(/,\s*(?:and\s+|then\s+|also\s+|plus\s+)?|\s+(?:and then|then|also|plus|and|but)\s+/);
    seg.forEach(function(s){
      s=s.trim(); if(!s) return;
      var anyCue=false; for(var k in CUES){ if(CUES[k].some(function(c){ return c[0].test(s); })){ anyCue=true; break; } }
      if(!anyCue && out.length && !VERB_START.test(s)) out[out.length-1]+=', '+s;   /* modifier continues previous clause */
      else out.push(s);
    });
  });
  return out;
};

/* ------------------------------------------------------------ entity helpers */
function castNames(G){
  var l=[];
  if(G.co) l.push({kind:'co', id:'co', first:G.co.name.split(' ')[0].toLowerCase(), full:G.co.name});
  (G.team||[]).forEach(function(e){ l.push({kind:'emp', id:e.id, first:e.name.split(' ')[0].toLowerCase(), full:e.name}); });
  return l;
}
function findCast(G,t){ var c=castNames(G), found=[]; c.forEach(function(x){ if(new RegExp('\\b'+x.first+'\\b').test(t)) found.push(x); }); return found; }
function findRoleIn(t){ for(var i=0;i<SU.ROLE_RE.length;i++){ if(SU.ROLE_RE[i][1].test(t)) return SU.ROLE_RE[i][0]; } return null; }
function findLevel(t){ for(var i=0;i<SU.LEVEL_RE.length;i++){ if(SU.LEVEL_RE[i][1].test(t)) return SU.LEVEL_RE[i][0]; } return null; }
var CHANNELS = [['ads',/\b(ads?|advertis\w*|adwords|google|facebook|instagram ads?|ppc|sem|paid|billboards?)\b/],['content',/\b(blog|blogs|content|seo|newsletter|podcast|articles?)\b/],['social',/\b(tiktok|youtube|influencers?|creators?|social|instagram|reels?)\b/],['events',/\b(conference|conferences|trade ?show|booth|sponsor\w*|event|events)\b/],['referral',/\b(referral|referrals|invite|affiliate)\b/]];
function findChannel(t){ for(var i=0;i<CHANNELS.length;i++) if(CHANNELS[i][1].test(t)) return CHANNELS[i][0]; return null; }
var HYPE_RE = /\b(viral|10x|crush it|synergy|disrupt\w*|hockey stick|growth hack\w*|move fast|go big|blitz|dominate|unicorn|world[- ]class|revolutioni[sz]e|game[- ]chang\w*)\b/;

/* ------------------------------------------------------------ per-lever param extraction */
var EX = {};
EX.talk = function(c,G,ns){
  var n=null; ns.forEach(function(x){ if(n===null && !x.money && !x.pct && x.v>=1 && x.v<=100) n=x.v; });
  var p={n:n||5, survey:/\bsurvey\b/.test(c)}; var seg=SU.segFromText(c); if(seg) p.seg=seg;
  if(/\b(pilot|few|test)\b/.test(c)) p.pilot=true;
  return {p:p, expect:['n'], have:n?['n']:[]};
};
EX.build = function(c,G,ns){
  var feat=c.replace(/^(?:we |i |let's |lets )?(?:will |should |need to |want to |going to )?(?:build|ship|implement|develop|code|prototype|add|create|make|design|launch)\s+(?:the |a |an |our |some |new |out |up )?/,'').replace(/\b(in|within|by|over|before|for)\s+\d+\s*(weeks?|wks?|months?|days?|sprints?).*$/,'').replace(/\b(properly|carefully|quickly|fast|rush(?:ed)?|well-tested|tested)\b/g,'').trim();
  var scope = /\b(mvp|v1|prototype)\b/.test(c)?8 : /\b(integration|integrate|platform|marketplace|sso|mobile app|rewrite|rebuild|api|analytics|reporting|enterprise|ai |machine learning)\b/.test(c)?20 : /\b(tweak|button|fix|small|minor|quick)\b/.test(c)?4 : 10;
  var care = /\b(rush|rushed|quick|quickly|fast|hack|asap|yolo|duct tape)\b/.test(c)?1.8 : /\b(properly|carefully|well-tested|tested|solid|robust)\b/.test(c)?0.7 : 1.0;
  var dl=null; var m=c.match(/\b(?:in|within|by|over)\s+(\d+)\s*(weeks?|wks?|months?|days?|sprints?)/); if(m){ dl=+m[1]*(/month/.test(m[2])?1:/day/.test(m[2])?1/30:/sprint/.test(m[2])?0.5:0.25); }
  var have=[]; if(feat && feat.split(' ').length>=1 && feat.length>=3) have.push('feature'); if(dl!==null) have.push('deadline');
  return {p:{feature:feat||'a feature',scope:scope,care:care,deadline:dl}, expect:['feature','deadline'], have:have};
};
EX.refactor = function(c){ var pts=/\b(rewrite|rebuild)\b/.test(c)?10: /\b(big|major|everything|all)\b/.test(c)?8 : 4; return {p:{pts:pts}, expect:[], have:[]}; };
EX.compliance = function(c){ var t=/soc ?2/.test(c)?'soc2' : /hipaa/.test(c)?'hipaa' : /pen ?test|penetration/.test(c)?'pentest' : /gdpr/.test(c)?'gdpr':'audit'; return {p:{type:t}, expect:[], have:[]}; };
EX.price = function(c,G,ns){
  var p={}, have=[];
  var moneyN=null; ns.forEach(function(x){ if(moneyN===null && !x.pct && (x.money || x.rate || /\$/.test(x.raw))) moneyN=x; });
  var pctN=null; ns.forEach(function(x){ if(pctN===null && x.pct) pctN=x; });
  if(moneyN){ p.amount=moneyN.v; have.push('amount'); }
  if(/\bfreemium|free tier\b/.test(c)) { p.model='freemium'; have.push('model'); }
  if(/\bpaywall|hard paywall|no free\b/.test(c)) { p.model='paid'; have.push('model'); }
  if(/\bannual\b/.test(c)) { p.annual=true; have.push('model'); }
  if(/\bgrandfather/.test(c)) p.grandfather=true;
  if(/\b(take rate|commission)\b/.test(c) && pctN){ p.take=pctN.v/100; have.push('take'); }
  else if(pctN && !moneyN){ var dir=/\b(raise|increase|up|higher|hike)\b/.test(c)?1 : /\b(cut|lower|drop|reduce|decrease|discount|down)\b/.test(c)?-1 : (/\bdiscount\b/.test(c)?-1:1); p.pctChange=dir*pctN.v/100; have.push('amount'); }
  if(/\b(double)\b/.test(c) && /pric/.test(c)){ p.pctChange=1; have.push('amount'); }
  if(/\b(halve|half)\b/.test(c) && /pric/.test(c)){ p.pctChange=-0.5; have.push('amount'); }
  if(!have.length && /\b(raise|increase)\b/.test(c)) { p.pctChange=0.1; }
  if(!have.length && /\b(lower|cut|drop|reduce)\b/.test(c)) { p.pctChange=-0.1; }
  return {p:p, expect:['amount'], have:have.length?['amount']:[]};
};
EX.market = function(c,G,ns){
  var ch=findChannel(c); var p={channel:ch||'ads'}, have=[]; if(ch) have.push('channel');
  var m=null; ns.forEach(function(x){ if(m===null && !x.pct && (x.money || x.big || /\$/.test(x.raw) || /\b(spend|budget|on)\b/.test(c)) && x.v>=50) m=x; });
  if(m){ p.budget=m.v; have.push('budget'); }
  else if(/\b(small|pilot|test|bit)\b/.test(c)) p.budget=500;
  else if(/\b(big|aggressive|heavy|lot|serious)\b/.test(c)) p.budget=8000;
  else p.budget=1500;
  var seg=SU.segFromText(c); if(seg) p.seg=seg;
  p.stop = /\b(stop|cancel|pause|kill|end|turn off|shut off|no more)\b/.test(c);
  var dm=c.match(/\bfor\s+(\d+)\s*(months?|weeks?)/); if(dm) p.months=+dm[1]*(/week/.test(dm[2])?0.25:1);
  return {p:p, expect:['channel','budget'], have:have};
};
EX.outbound = function(c,G,ns){
  var n=null; ns.forEach(function(x){ if(n===null && !x.money && !x.pct && x.v>=5 && x.v<=200000) n=x.v; });
  var seg=SU.segFromText(c);
  var ch = /\b(call|calls|calling|phone)\b/.test(c)?'phone' : /\b(door|walk|knock|visit|in person)\b/.test(c)?'walk' : /\b(dm|dms|linkedin|text|texts)\b/.test(c)?'dm':'email';
  var side = null; var s=SU.SEG[G.segId]; if(s && s.arch==='market'){ side = (s.supplyWords||[]).some(function(w){ return new RegExp('\\b'+w+'\\b').test(c); })?'supply' : 'demand'; }
  var have=[]; if(n) have.push('n'); if(seg) have.push('segment');
  return {p:{n:n||100, channel:ch, seg:seg, side:side}, expect:['n','segment'], have:have};
};
EX.launch = function(c){
  var v = /product ?hunt|product lab/.test(c)?'lab' : /hacker (forum|news)|show hn/.test(c)?'forum' : /press|journalist|techpulse/.test(c)?'press' : /app store/.test(c)?'store' : /tiktok|social|twitter|chirp/.test(c)?'social':'lab';
  var explicit=/product ?hunt|product lab|hacker|show hn|press|app store|tiktok|social|chirp/.test(c);
  return {p:{venue:v}, expect:['venue'], have:explicit?['venue']:[]};
};
EX.hire = function(c,G,ns){
  var roles=[], used=[];
  SU.ROLE_RE.forEach(function(rr){
    var re=new RegExp(rr[1].source,'g'), m;
    while((m=re.exec(c))){
      var st=m.index, en=m.index+m[0].length;
      if(used.some(function(u){ return st<u[1] && en>u[0]; })) continue;
      used.push([st,en]);
      var pre=c.slice(Math.max(0,st-30),st);
      var cm=pre.match(/(\d+)\s+(?:[a-z-]+\s+){0,2}$/); var n=cm? +cm[1] : (/\b(an|a|one)\s+(?:[a-z-]+\s+){0,2}$/.test(pre)?1:null);
      var level=null; SU.LEVEL_RE.forEach(function(lr){ if(!level && lr[1].test(pre+' '+m[0])) level=lr[0]; });
      roles.push({role:rr[0], n:n||1, level:level, nx:n!==null, idx:st});
    }
  });
  roles.sort(function(a,b){ return a.idx-b.idx; });
  var comp=null; ns.forEach(function(x){ if(comp===null && (x.money||x.big) && x.v>=20000) comp=x.v; });
  var eq=null; ns.forEach(function(x){ if(eq===null && x.pct && /equity|stock|options|shares/.test(c)) eq=x.v/100; });
  var agency=/\b(recruiter|headhunter|agency)\b/.test(c);
  roles.forEach(function(r){ if(!r.level) r.level=(r.role==='vp'||r.role==='cos')?'senior':'mid'; });
  var have=[]; if(roles.length) have.push('role'); if(roles.some(function(r){ return r.nx; })) have.push('n'); if(roles.some(function(r){ return SU.LEVEL_RE.some(function(lr){ return lr[1].test(c); }); })) have.push('level');
  var first=roles[0]||{};
  return {p:{roles:roles, role:first.role||null, n:SU.sum(roles,function(r){ return r.n; })||1, level:first.level||'mid', comp:comp, equity:eq, agency:agency}, expect:['role','n','level'], have:have};
};
EX.fire = function(c,G,ns){
  var who=findCast(G,c).map(function(x){ return x.id; });
  var pctN=null; ns.forEach(function(x){ if(pctN===null && x.pct) pctN=x; });
  var n=null; ns.forEach(function(x){ if(n===null && !x.pct && !x.money && x.v>=1 && x.v<=100) n=x.v; });
  var role=findRoleIn(c);
  return {p:{who:who, pct:pctN?pctN.v/100:null, n:(!pctN&&n)?n:null, role:role, severance:/\b(generous|extra|severance)\b/.test(c)?1.0:0.5}, expect:['who'], have:(who.length||pctN||n||role)?['who']:[]};
};
EX.comp = function(c,G,ns){
  var who=findCast(G,c).map(function(x){ return x.id; });
  var pctN=null; ns.forEach(function(x){ if(pctN===null && x.pct && !/equity|stock|options/.test(c.slice(x.end,x.end+14))) pctN=x; });
  var eq=null; ns.forEach(function(x){ if(eq===null && x.pct && /equity|stock|options|shares/.test(c)) eq=x.v/100; });
  var all=/\b(everyone|all|team|staff|engineering|sales|company)\b/.test(c) && !who.length;
  var promo=/\bpromot/.test(c);
  return {p:{who:who, all:all, pct:pctN&&!eq?pctN.v/100:(eq?0:0.1), equity:eq, promo:promo}, expect:['who'], have:(who.length||all)?['who']:[]};
};
EX.culture = function(c){
  var k = /\b(remote|work from home|wfh)\b/.test(c)?'remote' : /\bhybrid\b/.test(c)?'hybrid' : /\b(return to office|rto|in[- ]office)\b/.test(c)?'office' : /\b(4|four)[- ]day\b/.test(c)?'fourday' : /\b(crunch|all[- ]nighters?|100[- ]hour)\b/.test(c)?'crunch' : /\b(offsite|retreat|team dinner)\b/.test(c)?'offsite' : /\b(perks|ping pong|free lunch)\b/.test(c)?'perks' : /\bpto\b/.test(c)?'pto':'remote';
  var off=/\b(end|stop|no more|cancel|lift|drop)\b/.test(c);
  return {p:{kind:k, off:off}, expect:[], have:[]};
};
EX.fundraise = function(c,G,ns){
  var p={}, have=[];
  var amt=null; ns.forEach(function(x){ if(amt===null && !x.pct && (x.money||x.big) && x.v>=10000 && !/\b(cap|valuation|post|pre)\b/.test(c.slice(Math.max(0,x.idx-14),x.idx)) ) amt=x; });
  var cap=null; var cm=c.match(/\$?\s?(\d[\d,.]*)\s?(k|m|million|b)?\s*(?:cap|post|valuation|pre[- ]?money|post[- ]?money)/); if(cm){ var cv=parseFloat(cm[1].replace(/,/g,'')); var cmul=/^(m|million)$/.test(cm[2]||'')?1e6:/^k$/.test(cm[2]||'')?1e3:/^b$/.test(cm[2]||'')?1e9:1; cap=cv*cmul; }
  var cm2=c.match(/\b(?:at|on|with)\s+(?:a\s+)?\$?\s?(\d[\d,.]*)\s?(k|m|million|b)?\s*(?:cap|post|valuation|pre)/); if(cm2){ var v2=parseFloat(cm2[1].replace(/,/g,'')); cap=v2*(/^(m|million)$/.test(cm2[2]||'')?1e6:/^k$/.test(cm2[2]||'')?1e3:/^b$/.test(cm2[2]||'')?1e9:1); }
  if(!cap){ ns.forEach(function(x){ if(!cap && x!==amt && x.big && x.v>=1e6 && x.v>(amt?amt.v:0)*1.5) cap=x.v; }); }
  if(amt){ p.amount=amt.v; have.push('amount'); }
  if(cap){ p.cap=cap; have.push('terms'); }
  var inst = /\bsafe\b/.test(c)?'safe' : /\bnote\b/.test(c)?'note' : /\b(priced|equity round|series)\b/.test(c)?'priced' : /\b(venture debt)\b/.test(c)?'debt':null;
  if(inst){ p.instrument=inst; have.push('instrument'); }
  var stage = /\bpre[- ]?seed\b/.test(c)?'preseed' : /\bseed\b/.test(c)?'seed' : /series a\b/.test(c)?'A' : /series b\b/.test(c)?'B' : /series c\b/.test(c)?'C' : null;
  if(stage) p.stage=stage;
  var im=c.match(INVESTOR_RE); if(im){ p.target=im[1]; have.push('target'); }
  if(/\b(accelerator|kiln|yc)\b/.test(c)) p.accel=true;
  if(/\bbridge\b/.test(c)) p.bridge=true;
  if(/\bspray\b/.test(c)) p.spray=true;
  if(/\b(accept|sign|take)\b[^.]*\b(offer|term sheet|sheet|safe|round|deal)\b/.test(c)) p.act='accept';
  else if(/\b(decline|reject|pass on|walk away)\b/.test(c)) p.act='decline';
  else if(/\bcounter\b/.test(c)) p.act='counter';
  var pm=c.match(/(\d+(?:\.\d+)?)\s?%\s*(?:option )?pool/); if(pm) p.pool=+pm[1]/100;
  return {p:p, expect:['amount','terms'], have:have};
};
EX.finance = function(c,G,ns){
  var k = /venture debt/.test(c)?'debt' : /revenue[- ]based|rbf/.test(c)?'rbf' : /credit card/.test(c)?'card' : /defer/.test(c)?(/staff|team|employee|everyone/.test(c)?'deferStaff':'deferFounder') : /insider|bridge/.test(c)?'bridge' : /(cut|slash|reduce|tighten|extend)/.test(c)?'cutburn' : 'cutburn';
  var pct=null; ns.forEach(function(x){ if(pct===null && x.pct) pct=x.v/100; });
  return {p:{kind:k, pct:pct||0.25}, expect:[], have:[]};
};
EX.pivot = function(c,G,ns){
  var seg=SU.segFromText(c); var up=/upmarket|enterprise|bigger/.test(c); var down=/downmarket|smaller/.test(c);
  return {p:{seg:seg, up:up, down:down}, expect:['seg'], have:seg?['seg']:[]};
};
EX.ethics = function(c){
  var k = /dark pattern|hard[- ]to[- ]cancel|auto[- ]renew|bait/.test(c)?'dark' : /buy (reviews|followers|fake)|fake (reviews|accounts|testimonials)/.test(c)?'reviews' : /sell [a-z ]*data/.test(c)?'data' : /inflate|count (the )?free users|exaggerate|misleading|lie to/.test(c)?'inflate' : /scrape|spam/.test(c)?'spam':'dark';
  return {p:{kind:k}, expect:[], have:[]};
};
EX.self = function(c){
  var k=/\bvacation|holiday|week off\b/.test(c)?'vacation' : /\b(therapy|therapist|coach|meditat\w*)\b/.test(c)?'therapy' : /\bweekend\b/.test(c)?'weekend' : 'rest';
  return {p:{kind:k}, expect:[], have:[]};
};
EX.talkto = function(c,G){
  var who=findCast(G,c).map(function(x){ return x.id; });
  var aud = /\binvestors?|board\b/.test(c)?'investors' : /\bcustomers?\b/.test(c)?'customers' : /\b(team|staff|everyone|all[- ]hands|town hall)\b/.test(c)?'team' : (who.length?'person':'team');
  return {p:{who:who, aud:aud, apologize:/apologi[sz]e|sorry/.test(c), truth:/\b(truth|honest|transparen|come clean|straight)\b/.test(c), update:/\b(update)\b/.test(c)}, expect:[], have:[]};
};
EX.rival = function(c,G){
  var r=null; SU.RIVALS.forEach(function(x){ if(new RegExp('\\b'+x.name.split(' ')[0].toLowerCase()+'\\b').test(c)||new RegExp('\\b'+x.boss.split(' ')[0].toLowerCase()+'\\b').test(c)) r=x.id; });
  var act = /\bsue|lawsuit\b/.test(c)?'sue' : /\bcoffee\b/.test(c)?'coffee' : /\bpoach\b/.test(c)?'poach' : /\bmerg/.test(c)?'merge' : /\bacquire\b/.test(c)?'acquire' : /\bundercut|price war\b/.test(c)?'undercut':'coffee';
  return {p:{rival:r, act:act}, expect:['rival'], have:r?['rival']:[]};
};
EX.exit = function(c){
  var a = /\b(accept)\b/.test(c)?'accept' : /\b(ipo|go public|roadshow)\b/.test(c)?'ipo' : /\b(banker|investment banker)\b/.test(c)?'banker' : /\b(done growing|stop growing|ramen|bootstrap)\b/.test(c)?'indie' : /\b(shut ?down|wind down|close (?:the )?(?:company|doors)|pull the plug)\b/.test(c)?'shutdown':'banker';
  var tier = /\blow\b/.test(c)?'low' : /\bhigh\b/.test(c)?'high' : 'mid';
  return {p:{act:a, tier:tier}, expect:[], have:[]};
};

/* ------------------------------------------------------------ detection */
SU.detect = function(c,G){
  var scores={};
  for(var k in CUES){ var s=0; CUES[k].forEach(function(cu){ if(cu[0].test(c)) s+=cu[1]; }); if(s>0) scores[k]=s; }
  /* contextual adjustments */
  var role=findRoleIn(c), cast=findCast(G,c), inv=INVESTOR_RE.test(c);
  if(role && scores.hire) scores.hire+=2;
  if(role && !scores.hire && /\b(need|get|find|add|bring)\b/.test(c)) scores.hire=(scores.hire||0)+2.5;
  if(role && scores.build && !/\b(build|ship|implement|develop)\b/.test(c)) scores.build=Math.max(0,scores.build-2);
  if(cast.length){ if(/\b(talk|meet|chat|1:1|apologi[sz]e|sit|check in|coffee|speak)\b/.test(c)) scores.talkto=(scores.talkto||0)+4; if(scores.talk) scores.talk=Math.max(0,scores.talk-2.5); if(/\b(raise|bonus|promot|equity)\b/.test(c)) scores.comp=(scores.comp||0)+2; if(/\b(fire|let go|lay off)\b/.test(c)) scores.fire=(scores.fire||0)+2; }
  if(inv){ scores.fundraise=(scores.fundraise||0)+2.5; if(scores.talkto) scores.talkto=Math.max(0,scores.talkto-2); }
  if(/\bprice|pricing|prices\b/.test(c) && /\b(raise|increase|lower|cut|drop|double|halve)\b/.test(c)){ scores.price=(scores.price||0)+2; if(scores.fundraise) scores.fundraise=Math.max(0,scores.fundraise-3.5); }
  if(/\b(raise|increase) (?:salar|pay)|a raise\b/.test(c)){ scores.comp=(scores.comp||0)+3; if(scores.fundraise) scores.fundraise=Math.max(0,scores.fundraise-3.5); }
  if(/\b(accept|decline|counter)\b/.test(c) && /\b(offer|term sheet|sheet)\b/.test(c)){ scores.fundraise=(scores.fundraise||0)+1.5; if(/\b(acquisition|buyout|acquire|buy us)\b/.test(c)) scores.exit=(scores.exit||0)+2; }
  if(/\bsoc ?2\b/.test(c) && scores.build) scores.build=Math.max(0,scores.build-3);
  if(scores.outbound && scores.market && /\b(cold|email|dm|call)/.test(c)) scores.market=Math.max(0,scores.market-2);
  if(scores.launch && scores.market) scores.market=Math.max(0,scores.market-1);
  if(scores.finance && scores.fundraise && /\b(bridge|venture debt|rbf|revenue[- ]based)\b/.test(c)) scores.fundraise=Math.max(0,scores.fundraise-2);
  var arr=Object.keys(scores).filter(function(k){ return scores[k]>0; }).map(function(k){ return {lever:k, score:scores[k]}; });
  arr.sort(function(a,b){ if(Math.abs(b.score-a.score)>0.4) return b.score-a.score; return PRIORITY.indexOf(a.lever)-PRIORITY.indexOf(b.lever); });
  return arr;
};

/* ------------------------------------------------------------ focus cost */
SU.focusCost = function(G, cl){
  var p=cl.params, n, f=1;
  var has=function(role){ return (G.team||[]).some(function(e){ return e.role===role; }); };
  switch(cl.lever){
    case 'talk': f=1+Math.min(3,Math.ceil((p.n||5)/8))-1; f=Math.max(1,f); break;
    case 'build': f=(G.co&&G.co.flags&&G.co.flags.cto)||(G.team||[]).some(function(e){ return e.role==='eng'&&(e.level==='senior'||e.level==='staff'); })?1:2; break;
    case 'refactor': f=1; break;
    case 'compliance': f=2; break;
    case 'price': f=1; break;
    case 'market': f=(has('mkt')?0.5:1); break;
    case 'outbound': { var sdr=(G.team||[]).filter(function(e){ return e.role==='sdr'||e.role==='ae'; }).length; var cap=sdr*1500; f=(p.n||100)<=cap?0.5:Math.max(0.5,Math.ceil(((p.n||100)-cap)/200)); if(p.channel==='phone') f=Math.max(0.5,Math.ceil((p.n||100)/50)); if(p.channel==='walk') f=Math.max(1,Math.ceil((p.n||100)/15)); break; }
    case 'launch': f=3; break;
    case 'hire': f=0; (p.roles&&p.roles.length?p.roles:[{role:p.role,n:p.n}]).forEach(function(r){ f+=((r.role==='vp'||r.role==='cos')?2:1)+Math.max(0,(r.n||1)-1)*0.5; }); if(has('cos')||has('vp')) f=Math.max(0.5,f*0.6); break;
    case 'fire': f=2; break;
    case 'comp': f=1; break;
    case 'culture': f=(p.kind==='offsite'?2:1); break;
    case 'fundraise': f=G.round?1:2; if(p.act) f=1; break;
    case 'finance': f=1; break;
    case 'pivot': f=5; break;
    case 'ethics': f=0; break;
    case 'self': f=(p.kind==='vacation'?3:0); break;
    case 'talkto': f=1; break;
    case 'rival': f=2; break;
    case 'train': f=(p.size==='small'?1:2); break;
    case 'optimize': f=1; break;
    case 'redteam': f=1; break;
    case 'exit': f=(p.act==='shutdown'||p.act==='indie'||p.act==='accept')?0:3; break;
    default: f=1;
  }
  return Math.round(f*2)/2;
};

/* ------------------------------------------------------------ main parse */
SU.parse = function(G, text){
  var t=SU.norm(text); var out={clauses:[], unmatched:[]}; if(!t) return out;
  var learned=SU.learned();
  SU.splitClauses(t).forEach(function(c,i){
    var l=learned[c];
    var det=SU.detect(c,G);
    var top=det[0];
    var lever = l? l.lever : (top && top.score>=2 ? top.lever : null);
    if(!lever){ var gs=det.slice(0,3).map(function(d){ return d.lever; }); ['market','outbound','build'].forEach(function(g){ if(gs.length<3 && gs.indexOf(g)<0) gs.push(g); }); out.unmatched.push({text:c, guesses:gs}); return; }
    var ns=SU.nums(c); var ex=EX[lever](c,G,ns);
    var params = ex.p; if(l && l.params){ for(var k in l.params) if(params[k]===undefined||params[k]===null) params[k]=l.params[k]; }
    var spec = ex.expect.length? ex.have.length/ex.expect.length : 1;
    if(['self','culture','exit','refactor','compliance','ethics','finance','fire','comp','talkto','rival','pivot'].indexOf(lever)>=0) spec = Math.max(spec, 0.85);
    if(lever==='fundraise' && params.act) spec=1;
    var hype=HYPE_RE.test(c) && !ns.length; if(hype) spec=Math.max(0,spec-0.25);
    if(lever==='build' && ex.have.indexOf('feature')>=0 && spec<0.5) spec=0.5;
    spec=clamp(spec,0,1);
    var cl={id:i, lever:lever, params:params, text:c, spec:spec, hype:hype, conf:top?top.score:3, learned:!!l, missing:ex.expect.filter(function(e){ return ex.have.indexOf(e)<0; })};
    cl.focus=SU.focusCost(G,cl);
    var prev=out.clauses[out.clauses.length-1];
    if(prev && prev.lever==='price' && cl.lever==='price' && Object.keys(cl.params).length===1 && cl.params.grandfather){ prev.params.grandfather=true; return; }
    out.clauses.push(cl);
  });
  return out;
};

SU.isQuestion = function(text){ var t=String(text||'').trim().toLowerCase(); return /\?\s*$/.test(t) || /^(should we|what if|how much|how many|can we afford|do we|are we|is it|what happens)\b/.test(t); };

/* describe a clause for chips ("I understood: ...") */
SU.describe = function(cl){
  var p=cl.params, L=SU.LEVERS[cl.lever].name;
  switch(cl.lever){
    case 'talk': return 'Talk to '+p.n+' customers';
    case 'build': var bf=p.name||p.feature; return 'Build: '+(bf.length>34?bf.slice(0,32)+'..':bf)+(p.care>1?' (rushed)':p.care<1?' (careful)':'');
    case 'refactor': return 'Pay down tech debt';
    case 'compliance': return 'Get '+p.type.toUpperCase();
    case 'price': return p.amount? 'Price $'+p.amount : (p.model==='freemium'?'Go freemium': p.pctChange? ('Price '+(p.pctChange>0?'+':'')+Math.round(p.pctChange*100)+'%') : (p.take? 'Take rate '+Math.round(p.take*100)+'%' : 'Change pricing'));
    case 'market': return p.stop? 'Stop '+p.channel+' spend' : 'Spend $'+p.budget+'/mo on '+p.channel;
    case 'outbound': return 'Outreach: '+p.n+' '+(p.channel==='email'?'emails':p.channel==='phone'?'calls':p.channel==='walk'?'visits':'DMs');
    case 'launch': return 'Launch: '+p.venue;
    case 'hire': return p.roles&&p.roles.length? 'Hire '+p.roles.map(function(r){ return r.n+' '+(r.level&&r.level!=='mid'?r.level+' ':'')+SU.ROLES[r.role].name.toLowerCase()+(r.n>1?'s':''); }).join(' + ') : 'Hire (which role?)';
    case 'fire': return 'Layoff'+(p.pct?' '+Math.round(p.pct*100)+'%':p.n?' '+p.n:'');
    case 'comp': return p.promo?'Promote':('Raise comp'+(p.equity?' (equity)':''));
    case 'culture': return (p.off?'End ':'')+'Policy: '+p.kind;
    case 'fundraise': return p.act? SU.cap1(p.act)+' offer' : 'Raise'+(p.amount?' '+SU.fmtMoney(p.amount):'')+(p.instrument?' ('+p.instrument+')':'')+(p.target?' from '+p.target:'');
    case 'finance': return 'Finance: '+p.kind;
    case 'pivot': return 'Pivot'+(p.seg?' to '+SU.SEG[p.seg].name:'');
    case 'ethics': return 'Shortcut: '+p.kind;
    case 'self': return 'Founder care: '+p.kind;
    case 'talkto': return 'Talk to '+p.aud;
    case 'rival': return 'Rival: '+p.act;
    case 'train': return 'Train a '+({small:'small',medium:'medium',large:'large'}[p.size]||'new')+' model';
    case 'optimize': return 'Optimize serving costs';
    case 'redteam': return 'Red-team the model';
    case 'exit': return 'Exit: '+p.act;
  }
  return L;
};

/* announcements: claims + promises */
SU.parseAnnounce = function(G, text){
  var t=SU.norm(text); var out={claims:[], promises:[]}; if(!t) return out;
  var ns=SU.nums(t);
  /* claims: numbers attached to metrics */
  var metricRe=[['mrr',/\b(mrr|monthly recurring|recurring revenue)\b/],['arr',/\b(arr|annual recurring|annualized)\b/],['customers',/\b(customers?|clients?|paying|users?|practices|restaurants)\b/],['growth',/\b(growth|growing|month over month|mom|yoy)\b/],['burn',/\b(burn)\b/],['runway',/\brunway\b/]];
  ns.forEach(function(x){
    var win=t.slice(Math.max(0,x.idx-26), Math.min(t.length,x.end+26));
    for(var i=0;i<metricRe.length;i++){ if(metricRe[i][1].test(win)){ out.claims.push({metric:metricRe[i][0], val:x.pct?x.v/100:x.v, pct:x.pct}); break; } }
  });
  var pm=t.match(/\b(?:we will|we'll|i will|promise|guarantee|commit to|going to)\b[^.]*?(?:ship|launch|deliver|release|build|have|hit|reach)\s+([^.,;]*?)(?:\s+by\s+([a-z0-9 ]+))?(?:[.,;]|$)/);
  if(pm){ out.promises.push({what:pm[1].trim().slice(0,60), by:(pm[2]||'').trim(), tags:SU.featureTags(G,pm[1]||'')}); }
  return out;
};
SU.featureTags = function(G,text){
  var seg=SU.SEG[G.segId]; if(!seg) return []; var t=String(text).toLowerCase(), tags=[];
  seg.needs.concat(seg.herrings).forEach(function(n){ if(n.kw.some(function(k){ return t.indexOf(k)>=0; })) tags.push(n.id); });
  return tags;
};
})();
