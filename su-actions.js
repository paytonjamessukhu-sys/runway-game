/* RUNWAY - action catalog. Every move in the game is a card here: no typing. Each card knows its controls, what it will do (a clause for the engine), and a preview. */
(function(){
var SU = (window.SU = window.SU || {});
var clamp=SU.clamp, fm=SU.fmtMoney, M=function(){ return SU.Money; };
var CAT = (SU.CAT = {groups:[],actions:{},order:[]});
function R(n){ return Math.round(n); }
function cap(s){ return s?s.charAt(0).toUpperCase()+s.slice(1):s; }
function opt(v,t,sub){ return {v:v,t:t,sub:sub}; }
function mk(G,lever,params,text){ return SU.mkClause(G,lever,params,text,0.85); }
function def(a){ CAT.actions[a.id]=a; CAT.order.push(a.id); }
SU.mkClause=function(G,lever,params,text,spec){
  var cl={id:0,lever:lever,params:params,text:text||'',spec:spec===undefined?0.85:spec,hype:false,conf:5,learned:false,missing:[]};
  cl.focus=SU.focusCost(G,cl); return cl;
};
CAT.groups=[
  {id:'customers',name:'Customers',blurb:'Find out what they want and what they will pay.'},
  {id:'product',name:'Product',blurb:'Build what customers asked for. Every feature shows what it does.'},
  {id:'sales',name:'Sales',blurb:'Price it, tell people, and win them.'},
  {id:'team',name:'Team',blurb:'Hire, pay and keep good people.'},
  {id:'money',name:'Money',blurb:'Raise it, borrow it, or sell the company.'},
  {id:'you',name:'You',blurb:'Look after yourself. Decide how honest to be.'}
];
CAT.actionsIn=function(gid){ return CAT.order.filter(function(id){ return CAT.actions[id].group===gid; }); };

/* ------------------------------------------------------------ features (product) */
CAT.features=function(G){
  var list=[];
  var has=function(re){ return G.shipped.some(function(s){ return re.test(s.name); })||G.queue.some(function(q){ return re.test(q.name); }); };
  if(!has(/mvp/i)) list.push({key:'mvp',name:'MVP',scope:8,kind:'core',feat:'mvp',text:'The first version. Nothing else matters until it exists.'});
  G.needs.forEach(function(n){
    var lvl=G.shipped.filter(function(s){ return s.tags&&s.tags.indexOf(n.id)>=0; }).length, built=lvl>0, queued=G.queue.some(function(q){ return q.tags&&q.tags.indexOf(n.id)>=0; });
    var scope=/integration|sso|mobile|api|analytic|report|platform|marketplace/.test(n.name.toLowerCase())?20:10;
    var kind=n.revealed?(n.real?'asked':'nopay'):'unknown';
    list.push({key:'need:'+n.id,name:cap(n.name)+(lvl>0?' v'+(lvl+1):''),baseName:cap(n.name),lvl:lvl,maxed:lvl>=3,scope:scope,kind:kind,feat:n.name+' '+n.kw[0],needId:n.id,built:built,queued:queued,improve:lvl>0&&lvl<3,
      text:lvl>0?'Improve it: customers want it better. More of the need gets covered.':kind==='asked'?'Customers told you they need this. It raises product fit.':kind==='nopay'?'People ask for it, but they will not pay for it. It only adds clutter.':'You have not heard anyone ask for this. It might matter. It might be a decoy.'});
  });
  SU.PLAT_ORDER.forEach(function(id){ var p=SU.PLAT[id]; if(G.act<p.minAct) return; if(id==='mobile' && G.arch==='smb' && G.act<2) return;
    list.push({key:'plat:'+id,name:p.name,scope:p.scope,kind:'plat',plat:id,text:p.effect,feat:p.name,built:!!(G.feat&&G.feat[id]),queued:G.queue.some(function(q){ return q.plat===id; })}); });
  list.forEach(function(f){ if(f.key==='mvp'){ f.built=false; f.queued=false; } });
  return list;
};
CAT.featureByKey=function(G,key){ return CAT.features(G).filter(function(f){ return f.key===key; })[0]; };
CAT.eta=function(G,scope){ var V=Math.max(0.1,SU.velocity(G)); var q=G.queue.reduce(function(a,x){ return a+x.scope-x.progress; },0); return (q+scope)/V; };

/* ------------------------------------------------------------ CUSTOMERS */
def({id:'talk',group:'customers',title:'Interview customers',blurb:'Sit down with the people you want to sell to. Learn what they pay for.',repeat:true,
  ctl:function(G){ return [{k:'n',label:'How many people',kind:'choice',opts:[opt(4,'4'),opt(8,'8'),opt(12,'12'),opt(20,'20')],def:8}]; },
  make:function(G,v){ return mk(G,'talk',{n:v.n,survey:false},'Interview '+v.n+' customers'); },
  preview:function(G,v){ var gain=(100-G.insight)*(1-Math.pow(1-0.028*0.9,v.n)); return ['Costs about '+fm(v.n*20)+'.','Insight +'+R(gain)+' (now '+R(G.insight)+' of 100). Each conversation can reveal a real need.']; }});
def({id:'survey',group:'customers',title:'Run a customer survey',blurb:'Needs 20 customers. Tells you how good your product fit really is.',
  ok:function(G){ return SU.custCount(G)>=20?{ok:true}:{ok:false,why:'You need 20 customers first. You have '+SU.custCount(G)+'.'}; },
  ctl:function(){ return []; }, make:function(G){ return mk(G,'talk',{n:5,survey:true},'Run a survey'); },
  preview:function(){ return ['You get a product fit reading within about 5 points.']; }});
def({id:'townhall',group:'customers',title:'Write to your customers',blurb:'A personal note. Builds trust.',
  ctl:function(){ return []; }, make:function(G){ return mk(G,'talkto',{who:[],aud:'customers',apologize:false,truth:false,update:true},'Write to customers'); },
  preview:function(G){ return ['Customer trust +4 (now '+R(G.trust.cust)+').']; }});
def({id:'promise',group:'customers',title:'Promise customers a feature',blurb:'Promises build trust when kept and cost it when missed.',special:'promise',
  ok:function(G){ return CAT.promiseOptions(G).length?{ok:true}:{ok:false,why:'Queue a feature first.'}; },
  ctl:function(G){ var o=CAT.promiseOptions(G); return [{k:'f',label:'Which feature',kind:'choice',opts:o,def:o[0]&&o[0].v},{k:'due',label:'Deliver within',kind:'choice',opts:[opt(2,'2 months'),opt(4,'4 months'),opt(6,'6 months')],def:4}]; },
  make:function(G,v){ return null; },
  preview:function(G,v){ return ['If you ship it in time, customers trust you more. If not, trust and fit take a hit.']; }});
CAT.promiseOptions=function(G){ return G.queue.map(function(q){ return opt(q.id,q.name,'in the queue'); }); };

/* ------------------------------------------------------------ PRODUCT */
def({id:'build',group:'product',title:'Build a feature',blurb:'Pick from the list below.',hidden:true,
  ctl:function(G,v){ return [{k:'care',label:'How carefully',kind:'choice',opts:[opt(0.7,'Careful','less tech debt'),opt(1,'Normal'),opt(1.8,'Rush','more tech debt')],def:1}]; },
  make:function(G,v){ var f=CAT.featureByKey(G,v.fk); if(!f) return null; return mk(G,'build',{feature:f.feat,name:f.name,scope:f.scope,care:v.care||1,deadline:null,plat:f.plat||null,lvl:(f.lvl||0)+1},'Build '+f.name); },
  ok:function(G,v){ var f=CAT.featureByKey(G,v.fk); if(!f) return {ok:false,why:'That feature is gone.'}; if(f.maxed) return {ok:false,why:'Already as good as it gets.'}; if(f.built&&!f.improve&&f.key!=='mvp') return {ok:false,why:'Already built.'}; if(f.queued) return {ok:false,why:'Already in the queue.'}; if(G.queue.length>=6) return {ok:false,why:'The queue is full.'}; return {ok:true}; },
  preview:function(G,v){ var f=CAT.featureByKey(G,v.fk); if(!f) return []; return [f.text,'About '+CAT.eta(G,f.scope).toFixed(1)+' months at your speed of '+SU.velocity(G).toFixed(1)+' points a month.']; }});
def({id:'refactor',group:'product',title:'Pay down tech debt',blurb:'Slows features now, prevents outages later.',
  ok:function(G){ return G.D>5?{ok:true}:{ok:false,why:'Your debt is already low.'}; },
  ctl:function(){ return [{k:'pts',label:'How much',kind:'choice',opts:[opt(4,'A little'),opt(8,'A lot'),opt(10,'Rewrite the ugly parts')],def:4}]; },
  make:function(G,v){ return mk(G,'refactor',{pts:v.pts},'Pay down tech debt'); },
  preview:function(G,v){ return ['Debt now '+R(G.D)+'. It drops about '+(1.5*v.pts).toFixed(0)+' if engineers have time.','Those points come out of feature work.']; }});
def({id:'compliance',group:'product',title:'Get certified',blurb:'Finance and healthcare buyers want proof. Takes about 3 months.',
  ctl:function(G){ var t=[['soc2','SOC 2',30000],['hipaa','HIPAA',25000],['pentest','Pen test',15000],['gdpr','GDPR',20000]]; return [{k:'type',label:'Which one',kind:'choice',opts:t.map(function(x){ return opt(x[0],x[1],fm(x[2])); }),def:'soc2'}]; },
  ok:function(G,v){ return G.flags['c_'+v.type]?{ok:false,why:'Already started.'}:{ok:true}; },
  make:function(G,v){ return mk(G,'compliance',{type:v.type},'Get '+v.type.toUpperCase()); },
  preview:function(G,v){ return [G.segId==='finance'&&v.type==='soc2'?'Finance buyers hesitate without SOC 2: it lifts your close rate a lot.':'Lowers breach risk and opens bigger customers.']; }});
def({id:'pivot',group:'product',title:'Pivot to a new customer',blurb:'Drastic. Only when the evidence says so.',danger:true,
  ok:function(G){ return G.t>=4?{ok:true}:{ok:false,why:'Give it a few months first.'}; },
  ctl:function(G){ var c=Object.keys(SU.SEG).filter(function(id){ return SU.SEG[id].arch===G.arch&&id!==G.segId; }); return [{k:'seg',label:'Sell to',kind:'cards',opts:c.map(function(id){ return opt(id,SU.SEG[id].who,SU.SEG[id].name); }),def:c[0]}]; },
  make:function(G,v){ return mk(G,'pivot',{seg:v.seg,up:false,down:false},'Pivot'); },
  preview:function(){ return ['Half your customers leave, product fit resets to about half, and part of what you learned is lost.']; }});

/* ------------------------------------------------------------ SALES */
def({id:'price',group:'sales',title:'Set your price',blurb:'Too high and nobody buys. Too low and you look like a toy.',unique:true,
  ctl:function(G,v){
    if(G.arch==='market') return [{k:'take',label:'Your cut of every order',kind:'step',min:3,max:40,step:1,def:Math.round(G.cust.take*100),fmt:'pct',quick:[-3,-1,1,3],quickAbs:true}];
    var p=G.cust.price, st=p<10?0.5:p<30?1:p<100?5:p<500?10:50;
    var c=[{k:'price',label:'Price per month',kind:'step',min:1,max:5000,step:st,def:p,fmt:'price',quick:[-0.2,-0.1,0.1,0.2]},{k:'annual',label:'Offer annual plans (customers stay longer)',kind:'toggle',def:!!G.cust.annual}];
    if(G.arch==='consumer') c.push({k:'model',label:'Free users or paywall',kind:'choice',opts:[opt('keep','Keep as is'),opt('freemium','Free tier'),opt('paid','Paywall')],def:'keep'});
    c.push({k:'grand',label:'Grandfather existing customers',kind:'toggle',def:false});
    return c; },
  ok:function(G,v){ if(G.arch==='market') return Math.abs(v.take/100-G.cust.take)>0.0005?{ok:true}:{ok:false,why:'Pick a different take rate.'}; var same=Math.abs(v.price-G.cust.price)<0.005; if(same && !(v.annual&&!G.cust.annual) && !(v.model&&v.model!=='keep')) return {ok:false,why:'Change the price or a setting.'}; return {ok:true}; },
  make:function(G,v){
    if(G.arch==='market') return mk(G,'price',{take:v.take/100},'Take rate '+v.take+'%');
    var p={}; if(Math.abs(v.price-G.cust.price)>=0.005) p.amount=Math.round(v.price*100)/100; if(v.annual&&!G.cust.annual) p.annual=true; if(v.model&&v.model!=='keep') p.model=v.model; if(v.grand) p.grandfather=true;
    return mk(G,'price',p,'Price $'+v.price); },
  preview:function(G,v){
    var S=SU.seg(G), out=[];
    if(G.arch==='market'){ out.push('Providers tolerate about '+Math.round(S.takeTol*100)+'%. Above that they start to leave.'); return out; }
    var old=G.cust.price, rise=(v.price-old)/Math.max(0.01,old);
    if(G.insight>=15){ var b=G.wtpBand, cc=G.wtpMed*(1+G.pmfOff*b*0.5), lo=cc*(1-b), hi=cc*(1+b); var f=function(x){ return x>=100?'$'+R(x):'$'+x.toFixed(2); }; out.push('Customers hint at about '+f(lo)+' to '+f(hi)+' a month.'); } else out.push('You do not know what they will pay yet. Interview more customers.');
    if(rise>0.02 && (G.arch==='smb'?G.cust.n:G.cust.payers)>0){ var shock=0.5*rise*S.priceSens*(v.grand?0.2:1); out.push('Existing customers react: churn +'+(shock*100).toFixed(1)+' points this month.'); }
    if(rise<-0.05) out.push('A cut brings more signups, but each customer pays '+R(-rise*100)+'% less.');
    return out; }});
def({id:'outbound',group:'sales',title:'Reach out to customers',blurb:'Emails, calls and visits. Cheap, slow, and it works.',repeat:true,
  ok:function(G){ return G.arch==='consumer'?{ok:false,why:'Outreach does not work on consumers. Use creators and ads.'}:{ok:true}; },
  ctl:function(G,v){
    var ch=(v&&v.ch)||'email';
    var vol={email:[100,300,600,1000,2000],phone:[20,50,100],walk:[10,20,40],dm:[50,150,300]}[ch];
    var c=[{k:'ch',label:'How',kind:'choice',opts:[opt('email','Cold email'),opt('phone','Phone calls'),opt('walk','Walk-ins'),opt('dm','Direct messages')],def:'email'},{k:'n',label:'How many',kind:'choice',opts:vol.map(function(n){ return opt(n,String(n)); }),def:vol[Math.min(1,vol.length-1)]}];
    if(G.arch==='market'){ var S=SU.seg(G); c.push({k:'side',label:'Who',kind:'choice',opts:[opt('supply',cap(S.supplyNoun||'sellers')),opt('demand',cap(S.demandNoun||'buyers'))],def:'supply'}); }
    return c; },
  make:function(G,v){ return mk(G,'outbound',{n:v.n,channel:v.ch,seg:null,side:G.arch==='market'?v.side:null},'Reach out to '+v.n); },
  preview:function(G,v){ var f=SU.outboundFunnel(G,v.n,G.segId,0.85,SU.era(G),false); var out=['Costs about '+fm(0.05*v.n)+' in tools.']; if(G.arch==='smb'||G.arch==='market') out.push('Expect about '+f.replies.toFixed(1)+' replies, '+f.meetings.toFixed(1)+' meetings and '+f.closes.toFixed(1)+' customers'+(G.arch==='smb'?' next month':'')+'.'); if(v.n<=200) out.push('This is a test, not a channel.'); return out; }});
function channelsFor(G){
  var S=SU.seg(G), all={ads:'Search ads',content:'Content and SEO',social:'Creators and social',events:'Events and sponsorships',referral:'Referral rewards',ua:'App install ads'};
  var ids=G.arch==='consumer'?['ua','social','content','referral']:['ads','content','social','events','referral'];
  return ids.map(function(id){ var aff=(S.aff[id]!==undefined?S.aff[id]:(id==='ua'?S.aff.ads:0.4)); var stars=Math.max(1,Math.round(aff*5)); return opt(id,all[id],'Fit '+'★'.repeat(stars)+'☆'.repeat(5-stars)); });
}
def({id:'market',group:'sales',title:'Spend on marketing',blurb:'A standing monthly budget per channel. It keeps running until you change it.',repeat:false,unique:'channel',
  ctl:function(G,v){ var ch=channelsFor(G); return [{k:'channel',label:'Where',kind:'choice',opts:ch,def:ch[0].v},{k:'budget',label:'Each month',kind:'choice',opts:[250,500,1000,2000,5000,10000].map(function(b){ return opt(b,fm(b)); }),def:1000}]; },
  ok:function(G,v){ return G.cash>=v.budget*0.5?{ok:true}:{ok:false,why:'You cannot afford that.'}; },
  make:function(G,v){ return mk(G,'market',{channel:v.channel,budget:v.budget,stop:false},'Spend $'+v.budget+' on '+v.channel); },
  preview:function(G,v){ var S=SU.seg(G), out=[]; var aff=S.aff[v.channel===('ua')?'ads':v.channel]; if(aff!==undefined && aff<0.3) out.push('Warning: '+S.who+' rarely find products this way.');
    if(v.channel==='ads' && G.arch==='smb'){ var cpc=S.cpc*SU.era(G).cpcIdx*(1+v.budget/S.adCap); out.push('About $'+cpc.toFixed(2)+' a click and roughly '+R(v.budget/cpc*0.03)+' trials a month.'); }
    if(v.channel==='content') out.push('Content compounds slowly. Expect results after about 4 months.');
    if(v.budget>G.cash*0.4) out.push('Capped at 40% of your cash.');
    out.push('Runs every month until you stop it.'); return out; }});
def({id:'marketStop',group:'sales',title:'Stop a marketing channel',blurb:'Turn off a monthly budget.',
  ok:function(G){ var a=['ads','content','social','events','referral','ua'].some(function(k){ return G.orders[k]>0; }); return a?{ok:true}:{ok:false,why:'Nothing is running.'}; },
  ctl:function(G){ var all={ads:'Search ads',content:'Content and SEO',social:'Creators and social',events:'Events',referral:'Referral rewards',ua:'App install ads'}; var o=['ads','content','social','events','referral','ua'].filter(function(k){ return G.orders[k]>0; }).map(function(k){ return opt(k,all[k],fm(G.orders[k])+'/mo'); }); return [{k:'channel',label:'Which',kind:'choice',opts:o,def:o[0]&&o[0].v}]; },
  make:function(G,v){ return mk(G,'market',{channel:v.channel,budget:0,stop:true},'Stop '+v.channel); },
  preview:function(){ return ['Saves the monthly budget right away.']; }});
def({id:'launch',group:'sales',title:'Launch somewhere public',blurb:'One big spike of visitors. Works less each time you repeat a place.',
  ok:function(G){ return G.shipped.length>0?{ok:true}:{ok:false,why:'Ship something first.'}; },
  ctl:function(G){ var v=[['lab','Product Lab','Everyone in tech'],['forum','Hacker Forum','Sharp, harsh crowd'],['press','The press','Needs polish'],['store','App Store','Consumers'],['social','Social media','Quick and loud']]; return [{k:'venue',label:'Where',kind:'cards',opts:v.map(function(x){ var n=G.launches[x[0]]||0; return opt(x[0],x[1],x[2]+(n?' (launched '+n+'x)':'')); }),def:'lab'}]; },
  make:function(G,v){ return mk(G,'launch',{venue:v.venue},'Launch: '+v.venue); },
  preview:function(G,v){ var rep=(G.launches[v.venue]||0), nov=clamp(G.Q/80,0.2,1), visits=3000*(0.5+nov)*(1+G.hype/50)*Math.pow(0.4,rep)*({lab:1,forum:0.8,press:0.7,store:0.9,social:0.8}[v.venue]||1); var out=['About '+R(visits)+' visitors and '+R(visits*0.04)+' signups.']; if(G.Q<25) out.push('Your product is thin (quality '+R(G.Q)+'). The comments will be brutal.'); if(rep) out.push('You have launched here before: it works '+R(Math.pow(0.4,rep)*100)+'% as well.'); return out; }});
def({id:'rival',group:'sales',title:'Deal with a competitor',blurb:'Coffee, a price war, poaching, or a lawsuit.',
  ok:function(G){ return G.rivals.some(function(r){ return r.active; })?{ok:true}:{ok:false,why:'No active competitors.'}; },
  ctl:function(G){ var rv=G.rivals.filter(function(r){ return r.active; }); return [{k:'rival',label:'Who',kind:'choice',opts:rv.map(function(r){ return opt(r.id,r.name,r.boss); }),def:rv[0]&&rv[0].id},{k:'act',label:'What',kind:'choice',opts:[opt('coffee','Coffee','learn something'),opt('undercut','Price war','margins suffer'),opt('poach','Poach a sales lead'),opt('sue','Sue ($40K)')],def:'coffee'}]; },
  make:function(G,v){ return mk(G,'rival',{rival:v.rival,act:v.act},'Competitor'); },
  preview:function(G,v){ return {coffee:['Respect goes up and you may learn how much cash they have left.'],undercut:['Both of you lose margin. Do this only if you can win.'],poach:['Posts a senior account exec job. They will remember.'],sue:['Costs $40K. Wins about 30% of the time, and only against copycats.']}[v.act]; }});

/* ------------------------------------------------------------ TEAM */
var ROLE_BLURB={eng:'Builds the product faster.',design:'Makes it nicer, helps every engineer.',pm:'Keeps the roadmap sane.',sdr:'Sends outreach all month, every month.',ae:'Closes the deals your outreach finds.',cs:'Keeps customers happy and subscribed.',mkt:'Makes your marketing spend work harder.',cos:'Gives you more focus each month.',vp:'Runs a whole department.'};
def({id:'hire',group:'team',title:'Hire someone',blurb:'You post a job, then pick from three candidates when they apply.',
  ok:function(G){ return G.reqs.length<8?{ok:true}:{ok:false,why:'You already have 8 open roles.'}; },
  ctl:function(G,v){
    var roles=['eng','design','pm','sdr','ae','cs','mkt']; if(G.act>=3) roles.push('cos','vp');
    var role=(v&&v.role)||'eng';
    return [{k:'role',label:'Who do you need',kind:'cards',opts:roles.map(function(r){ return opt(r,SU.ROLES[r].name,ROLE_BLURB[r]); }),def:'eng'},
      {k:'level',label:'Experience',kind:'choice',opts:[opt('junior','Junior'),opt('mid','Mid'),opt('senior','Senior')],def:(role==='vp'||role==='cos')?'senior':'mid'},
      {k:'pay',label:'Pay',kind:'choice',opts:[opt(0.9,'Below market'),opt(1,'Market'),opt(1.15,'Above market'),opt(1.3,'Top of market')],def:1},
      {k:'eq',label:'Equity',kind:'choice',opts:[opt(0.6,'Little'),opt(1,'Standard'),opt(1.8,'Generous')],def:1},
      {k:'agency',label:'Use a recruiter (fills faster, costs 20% of a year of pay)',kind:'toggle',def:false}]; },
  make:function(G,v){ var role=v.role||'eng', lvl=v.level||'mid'; var mkt=SU.salaryFor(G,role,lvl), comp=Math.round(mkt*(v.pay||1)/1000)*1000; var eq=SU.ROLES[role].eq[lvl]*(v.eq||1);
    return mk(G,'hire',{roles:[{role:role,n:1,level:lvl}],role:role,n:1,level:lvl,comp:comp,equity:eq,agency:!!v.agency},'Hire '+SU.ROLES[role].name); },
  preview:function(G,v){ var role=v.role||'eng', lvl=v.level||'mid'; var comp=Math.round(SU.salaryFor(G,role,lvl)*(v.pay||1)/1000)*1000; var add=comp*1.3/12, f=SU.fin(G), nb=f.burn+add, rw=nb>0?Math.max(0,G.cash)/nb:999;
    var out=[fm(comp)+' a year, about '+fm(add)+' a month with taxes and tools.','Runway '+(f.burn<=0||f.runway>99?'long':f.runway.toFixed(1)+' mo')+' to '+(rw>99?'long':rw.toFixed(1)+' mo')+' once they join.']; if(rw<4) out.push('Warning: that leaves you under 4 months of cash.'); if(G.pmf<35&&SU.headcount(G)>=10) out.push('Warning: scaling before product fit kills startups.'); if(v.agency) out.push('Recruiter fee: '+fm(comp*0.2)+' when someone joins.'); var seats=SU.Shop?SU.Shop.seats(G):99; if(SU.headcount(G)+G.reqs.length+1>seats) out.push('You are out of seats. Move to a bigger space in the Shop or people get cramped.'); return out; }});
def({id:'layoff',group:'team',title:'Lay people off',blurb:'Painful. Saves cash. Everyone left will feel it.',danger:true,
  ok:function(G){ return G.team.length?{ok:true}:{ok:false,why:'You have no team to let go.'}; },
  ctl:function(){ return [{k:'pct',label:'How many',kind:'choice',opts:[opt(10,'10%'),opt(20,'20%'),opt(30,'30%'),opt(50,'Half')],def:20},{k:'generous',label:'Generous severance (costs more, softer landing)',kind:'toggle',def:false}]; },
  make:function(G,v){ return mk(G,'fire',{who:[],pct:v.pct/100,n:null,role:null,severance:v.generous?1:0.5},'Layoff'); },
  preview:function(G,v){ var k=Math.max(1,R(G.team.length*v.pct/100)); var avg=G.team.length?G.team.reduce(function(a,e){ return a+e.sal; },0)/G.team.length:0; return ['About '+k+' '+(k===1?'person':'people')+' go. Burn drops about '+fm(k*avg*1.3/12)+' a month.','Morale drops and the rest get nervous.']; }});
def({id:'raiseAll',group:'team',title:'Give everyone a raise',blurb:'Keeps people. Costs cash every month.',
  ok:function(G){ return G.team.length?{ok:true}:{ok:false,why:'You have no team yet.'}; },
  ctl:function(){ return [{k:'pct',label:'How much',kind:'choice',opts:[opt(5,'5%'),opt(10,'10%'),opt(15,'15%')],def:10}]; },
  make:function(G,v){ return mk(G,'comp',{who:[],all:true,pct:v.pct/100,equity:null,promo:false},'Raise for everyone'); },
  preview:function(G,v){ var pay=G.team.reduce(function(a,e){ return a+e.sal*1.3/12; },0); return ['Burn +'+fm(pay*v.pct/100)+' a month. Morale +5.']; }});
def({id:'allhands',group:'team',title:'Hold an all-hands',blurb:'Talk straight to the whole team. Morale up.',
  ctl:function(){ return [{k:'sorry',label:'Own up to a mistake',kind:'toggle',def:false}]; },
  make:function(G,v){ return mk(G,'talkto',{who:[],aud:'team',apologize:!!v.sorry,truth:false,update:false},'All-hands'); },
  preview:function(G,v){ return ['Morale +'+(v.sorry?5:3)+' and trust up a little.']; }});
def({id:'offsite',group:'team',title:'Team offsite',blurb:'A weekend away together.',
  ctl:function(){ return []; }, make:function(G){ return mk(G,'culture',{kind:'offsite',off:false},'Offsite'); },
  preview:function(G){ return ['Costs about '+fm(400*SU.headcount(G))+'. Morale +4.']; }});
def({id:'culture',group:'team',title:'Change a work policy',blurb:'Remote, four-day week, perks and more.',hidden:true,unique:'kind',
  ctl:function(G){ return [{k:'kind',label:'Policy',kind:'choice',opts:CAT.policyList(G).map(function(p){ return opt(p.id,p.name); }),def:'remote'}]; },
  make:function(G,v){ var st=CAT.policyOn(G,v.kind); return mk(G,'culture',{kind:v.kind,off:(v.off!==undefined?v.off:st)},'Policy: '+v.kind); },
  preview:function(G,v){ return {remote:['Autonomy up, a wider hiring pool, morale +3.'],hybrid:['A middle path.'],office:['Return to office: morale -8, and some people will not forgive it.'],fourday:['Morale and retention up, building about 10% slower.'],perks:['About $150 per person a month. Morale up a little.'],pto:['Morale up a little.'],crunch:['Building +25% for 3 months. Morale and your sanity drop each month.']}[v.kind]||[]; }});
CAT.policyList=function(G){ return [{id:'remote',name:'Fully remote'},{id:'hybrid',name:'Hybrid'},{id:'office',name:'Back to the office'},{id:'fourday',name:'Four-day week'},{id:'perks',name:'Free lunch and perks'},{id:'pto',name:'Unlimited time off'},{id:'crunch',name:'Crunch for 3 months'}]; };
CAT.policyOn=function(G,k){ var cu=G.orders.culture; return k==='remote'?!!cu.remote:k==='hybrid'?!!cu.hybrid:k==='office'?!!cu.office:k==='fourday'?!!cu.fourday:k==='perks'?!!cu.perks:k==='pto'?!!cu.pto:k==='crunch'?cu.crunch>0:false; };
/* quick actions on a person */
CAT.personActions=function(G,e){
  var fn=e.id; return [
    {label:'Raise 10%',aid:'quick',spec:{lever:'comp',params:{who:[fn],all:false,pct:0.1,equity:null,promo:false},text:'Raise '+e.name}},
    {label:'Promote',aid:'quick',spec:{lever:'comp',params:{who:[fn],all:false,pct:0,equity:null,promo:true},text:'Promote '+e.name}},
    {label:'Equity',aid:'quick',spec:{lever:'comp',params:{who:[fn],all:false,pct:0,equity:0.005,promo:false},text:'Equity for '+e.name}},
    {label:'Talk 1:1',aid:'quick',spec:{lever:'talkto',params:{who:[fn],aud:'person',apologize:false,truth:false,update:false},text:'Talk to '+e.name}},
    {label:'Let go',danger:true,aid:'quick',spec:{lever:'fire',params:{who:[fn],pct:null,n:null,role:null,severance:0.5},text:'Let go of '+e.name}}
  ];
};

/* ------------------------------------------------------------ MONEY */
var STAGE_ASKS={preseed:[150e3,250e3,500e3],seed:[1e6,2e6,3e6,5e6],A:[8e6,12e6,20e6],B:[25e6,40e6,60e6],C:[80e6,120e6]};
def({id:'raise',group:'money',title:'Raise money',blurb:'Start a round. Investors reply over the next few months.',unique:true,
  ok:function(G){ return G.round?{ok:false,why:'A round is already open.'}:{ok:true}; },
  ctl:function(G,v){
    var st=(v&&v.stage)||(G.rounds.length?(G.mrr>40000?'A':'seed'):'preseed'); var asks=STAGE_ASKS[st];
    var stages=['preseed','seed','A','B'].filter(function(s){ return s==='preseed'||s==='seed'||G.rounds.length>0||G.mrr>20000; });
    var c=[{k:'stage',label:'Round',kind:'choice',opts:stages.map(function(s){ return opt(s,SU.Money.STAGE_NAME[s]); }),def:st},
      {k:'amount',label:'How much',kind:'choice',opts:asks.map(function(a){ return opt(a,fm(a)); }),def:asks[Math.min(1,asks.length-1)]}];
    if(st==='preseed'||st==='seed') c.push({k:'inst',label:'Paper',kind:'choice',opts:[opt('safe','SAFE','simple, converts later'),opt('priced','Priced round','set a valuation now'),opt('note','Convertible note','debt that converts')],def:'safe'});
    var inv=SU.Money.eligible(G,st,(v&&v.amount)||asks[0]); c.push({k:'target',label:'Start with',kind:'choice',opts:[opt('','Anyone','best odds')].concat(inv.slice(0,8).map(function(i){ return opt(i.id,i.name,i.fund); })),def:''});
    if(st==='preseed' && G.year>=2006) c.push({k:'accel',label:'Apply to Kiln (accelerator, small check, big signal)',kind:'toggle',def:false});
    return c; },
  make:function(G,v){ var p={stage:v.stage,amount:v.amount,instrument:(v.inst&&(v.stage==='preseed'||v.stage==='seed'))?v.inst:null,cap:null,target:v.target||undefined,spray:false,accel:!!v.accel}; return mk(G,'fundraise',p,'Raise '+fm(v.amount)); },
  preview:function(G,v){ var E=SU.era(G), out=[]; var el=SU.Money.eligible(G,v.stage,v.amount); out.push(el.length+' investors write checks like this right now.'); out.push('Money is '+(E.fundAvail>=1.4?'easy':E.fundAvail>=0.9?'normal':'tight')+'. A round usually takes '+E.close[0]+' to '+E.close[1]+' months.'); out.push('While it is open you lose about 4 focus a month and 2 sanity.'); if(v.stage!=='preseed'&&v.stage!=='seed'&&!G.rounds.length) out.push('You have not raised before. Investors want a seed first.'); return out; }});
def({id:'addInvestor',group:'money',title:'Add an investor to your round',blurb:'Bring one more name to the table.',
  ok:function(G){ return G.round?{ok:true}:{ok:false,why:'You have no open round.'}; },
  ctl:function(G){ var r=G.round; var inv=r?SU.Money.eligible(G,r.stage,r.ask).filter(function(i){ return !r.pipe.some(function(p){ return p.inv===i.id; }); }):[]; return [{k:'target',label:'Who',kind:'choice',opts:inv.slice(0,8).map(function(i){ return opt(i.id,i.name,i.fund); }),def:inv[0]&&inv[0].id}]; },
  make:function(G,v){ return mk(G,'fundraise',{target:v.target},'Add investor'); },
  preview:function(){ return ['They start at the first meeting, a little warmer than a cold intro.']; }});
def({id:'walkaway',group:'money',title:'Walk away from the round',blurb:'Stop raising and get your focus back.',danger:true,
  ok:function(G){ return G.round?{ok:true}:{ok:false,why:'You have no open round.'}; },
  ctl:function(){ return []; }, make:function(G){ return mk(G,'fundraise',{act:'decline'},'Walk away'); },
  preview:function(){ return ['The round closes. You lose a bit of buzz.']; }});
def({id:'cutburn',group:'money',title:'Cut spending',blurb:'Trim ads, content and perks.',
  ctl:function(){ return [{k:'pct',label:'How much',kind:'choice',opts:[opt(10,'10%'),opt(25,'25%'),opt(40,'40%')],def:25}]; },
  make:function(G,v){ return mk(G,'finance',{kind:'cutburn',pct:v.pct/100},'Cut spending'); },
  preview:function(G){ return ['Cuts marketing budgets and perks. Morale -2.']; }});
def({id:'card',group:'money',title:'Max out the founder credit card',blurb:'$25K right now. Your sanity pays the interest.',danger:true,
  ok:function(G){ return G.flags.cardUsed?{ok:false,why:'Already maxed.'}:{ok:true}; },
  ctl:function(){ return []; }, make:function(G){ return mk(G,'finance',{kind:'card',pct:0.25},'Credit card'); }, preview:function(){ return ['+$25K cash. Sanity -15.']; }});
def({id:'deferStaff',group:'money',title:'Ask staff to defer pay',blurb:'Buy a month. Costs trust.',danger:true,
  ok:function(G){ return G.team.length?{ok:true}:{ok:false,why:'No staff to ask.'}; },
  ctl:function(){ return []; }, make:function(G){ return mk(G,'finance',{kind:'deferStaff',pct:0.25},'Defer staff pay'); }, preview:function(G){ return ['You hold back 30% of payroll this month and owe it next month. Morale -10.']; }});
def({id:'deferFounder',group:'money',title:'Stop paying yourself',blurb:'Founders skip their salaries.',
  ok:function(G){ return (G.founder.pay||0)>0?{ok:true}:{ok:false,why:'You are not paying yourself.'}; },
  ctl:function(){ return []; }, make:function(G){ return mk(G,'finance',{kind:'deferFounder',pct:0.25},'Defer founder pay'); }, preview:function(){ return ['Saves your salaries. Sanity drifts down over time.']; }});
def({id:'bridge',group:'money',title:'Ask insiders for a bridge',blurb:'Your existing investors top you up.',
  ok:function(G){ return G.rounds.length?{ok:true}:{ok:false,why:'You have no investors yet.'}; },
  ctl:function(){ return []; }, make:function(G){ return mk(G,'finance',{kind:'bridge',pct:0.25},'Bridge'); }, preview:function(G){ return ['A small SAFE at a discount. Works about '+R(clamp(0.8*(G.board.mood/100)+0.1,0.1,0.9)*100)+'% of the time.']; }});
def({id:'rbf',group:'money',title:'Take a revenue-based loan',blurb:'Needs $20K a month. Repaid as a share of revenue.',
  ok:function(G){ if((G.mrr||0)<20000) return {ok:false,why:'Needs $20K a month in revenue.'}; if(G.loans.rbf&&G.loans.rbf.left>0) return {ok:false,why:'You already have one.'}; return {ok:true}; },
  ctl:function(){ return []; }, make:function(G){ return mk(G,'finance',{kind:'rbf',pct:0.25},'Revenue loan'); }, preview:function(G){ return ['You get '+fm(4*G.mrr)+' now and repay 1.4x from 6% of revenue.']; }});
def({id:'debt',group:'money',title:'Take venture debt',blurb:'For companies past a Series A.',
  ok:function(G){ var last=G.rounds[G.rounds.length-1]; if(!last||['A','B','C'].indexOf(last.stage)<0) return {ok:false,why:'Only after a Series A or later.'}; if(G.loans.debt&&G.loans.debt.bal>0) return {ok:false,why:'You already have some.'}; return {ok:true}; },
  ctl:function(){ return []; }, make:function(G){ return mk(G,'finance',{kind:'debt',pct:0.25},'Venture debt'); }, preview:function(){ return ['About a quarter of your last round at 11%. Keep 3 months of cash.']; }});
def({id:'banker',group:'money',title:'Hire a banker and explore a sale',blurb:'Costs $15K. Offers show up in a few months.',
  ok:function(G){ return G.banker?{ok:false,why:'You already have a banker.'}:{ok:true}; },
  ctl:function(){ return []; }, make:function(G){ return mk(G,'exit',{act:'banker',tier:'mid'},'Banker'); }, preview:function(){ return ['Word may leak to your team and customers (25%).']; }});
def({id:'ipo',group:'money',title:'Prepare to go public',blurb:'Needs scale, growth, clean books and an open market.',
  ok:function(G){ return G.act>=4?{ok:true}:{ok:false,why:'You are years from this.'}; },
  ctl:function(){ return [{k:'tier',label:'Which bank',kind:'choice',opts:[opt('low','Small bank'),opt('mid','Mid-size'),opt('high','Top-tier')],def:'mid'}]; },
  make:function(G,v){ return mk(G,'exit',{act:'ipo',tier:v.tier},'IPO'); }, preview:function(G){ var g=SU.Money.ipoGates(G); return g.gates.map(function(x){ return (x.ok?'Yes: ':'Not yet: ')+x.label; }); }});
def({id:'indie',group:'money',title:'Stop chasing growth',blurb:'Stay small, stay profitable, stay free.',danger:true,
  ok:function(G){ var f=SU.fin(G); return (f.burn<=0&&(G.mrr||0)>=2000)?{ok:true}:{ok:false,why:'You need to be profitable first.'}; },
  ctl:function(){ return []; }, make:function(G){ return mk(G,'exit',{act:'indie',tier:'mid'},'Go indie'); }, preview:function(){ return ['This ends the game on your terms.']; }});
def({id:'shutdown',group:'money',title:'Shut the company down',blurb:'It is okay to stop.',danger:true,confirm:true,
  ctl:function(){ return []; }, make:function(G){ return mk(G,'exit',{act:'shutdown',tier:'mid'},'Shut down'); }, preview:function(){ return ['This ends the game.']; }});

/* ------------------------------------------------------------ YOU */
def({id:'self',group:'you',title:'Take care of yourself',blurb:'Burnout ends companies.',
  ctl:function(G){ return [{k:'kind',label:'How',kind:'cards',opts:[opt('weekend','Weekend off','sanity +6, free'),opt('vacation','A week away','sanity +25, costs focus'),opt('therapy','Hire a coach','sanity +2 every month, $400/mo'),opt('rest','Just rest','sanity +6')],def:'weekend'}]; },
  ok:function(G,v){ return (v.kind==='therapy'&&G.orders.therapy)?{ok:false,why:'You already have a coach.'}:{ok:true}; },
  make:function(G,v){ return mk(G,'self',{kind:v.kind},'Founder care'); },
  preview:function(G){ return ['Your sanity is '+R(G.founder.sanity)+'. At zero you burn out.']; }});
def({id:'talkcofounder',group:'you',title:'Talk it out with your cofounder',blurb:'A real conversation.',
  ok:function(G){ return G.co?{ok:true}:{ok:false,why:'You are solo.'}; },
  ctl:function(){ return []; }, make:function(G){ return mk(G,'talkto',{who:['co'],aud:'person',apologize:false,truth:false,update:false},'Talk to cofounder'); },
  preview:function(G){ return G.co?['Bond +7 (now '+R(G.co.bond)+'). They want: '+G.co.wants+'.']:[]; }});
def({id:'investorUpdate',group:'you',title:'Send investors an update',blurb:'Keeps your board warm.',
  ok:function(G){ return G.rounds.length?{ok:true}:{ok:false,why:'You have no investors yet.'}; },
  ctl:function(){ return [{k:'truth',label:'Tell them the hard parts too',kind:'toggle',def:true}]; },
  make:function(G,v){ return mk(G,'talkto',{who:[],aud:'investors',apologize:false,truth:!!v.truth,update:true},'Investor update'); },
  preview:function(G,v){ return ['Investor trust +'+(v.truth?7:4)+'.']; }});
def({id:'announce',group:'you',title:'Announce your numbers',blurb:'What you tell investors and customers gets checked later.',special:'announce',
  ctl:function(G){ return [{k:'mode',label:'How do you put it',kind:'choice',opts:[opt('honest','Honest','exact numbers'),opt('round','Round up','a little generous'),opt('spin','Spin it','a lot generous')],def:'honest'}]; },
  make:function(G,v){ return null; },
  preview:function(G,v){ return {honest:['You state your real revenue and customers. Clean books are an asset.'],round:['Rounding up about 12% is common. It is also noticed in diligence.'],spin:['Spinning 40% helps a pitch today and ruins a diligence call tomorrow.']}[v.mode]; }});
CAT.claims=function(G,mode){ var f={honest:1,round:1.12,spin:1.4}[mode]||1; var out=[]; if(G.mrr>0) out.push({metric:'mrr',val:Math.round(G.mrr*f),pct:false}); if(SU.custCount(G)>0) out.push({metric:'customers',val:Math.round(SU.custCount(G)*f),pct:false}); return out; };
def({id:'ethics',group:'you',title:'Cut a corner',blurb:'Quick wins with a delayed bill. Your claims ledger remembers.',danger:true,
  ctl:function(G){ return [{k:'kind',label:'Which shortcut',kind:'cards',opts:[opt('dark','Hard-to-cancel flows','churn -30% now, a complaint wave later'),opt('reviews','Buy five-star reviews','buzz now, purge later'),opt('data','Sell anonymized user data','cash now, trust later'),opt('inflate','Count free users as customers','investors like it, diligence does not'),opt('spam','Blast more outreach','more volume, flagged domain')],def:'dark'}]; },
  make:function(G,v){ return mk(G,'ethics',{kind:v.kind},'Shortcut: '+v.kind); },
  preview:function(G,v){ return ['Claims ledger '+R(G.ethics)+' now. Every shortcut adds to it.','Costs no focus. Costs plenty later.']; }});

/* ------------------------------------------------------------ validation and items */
CAT.defaults=function(G,aid,seed){
  var a=CAT.actions[aid], v=Object.assign({},seed||{}), guard=0, again=true;
  while(again && guard++<4){ again=false; (a.ctl?a.ctl(G,v):[]).forEach(function(c){ if(v[c.k]===undefined && c.def!==undefined){ v[c.k]=c.def; again=true; } }); }
  return v;
};
CAT.validate=function(G,aid,v){ var a=CAT.actions[aid]; if(!a) return {ok:false,why:'Unknown action.'}; var o=a.ok?a.ok(G,v):{ok:true}; return o; };
CAT.item=function(G,it){
  /* it: {aid, values} or {aid:'quick', spec} or {aid:'text', text} */
  if(it.aid==='quick'){ var cl=mk(G,it.spec.lever,JSON.parse(JSON.stringify(it.spec.params)),it.spec.text); return {clauses:[cl],label:it.spec.text,focus:cl.focus}; }
  if(it.aid==='text'){ var P=SU.parse(G,it.text); return {clauses:P.clauses,label:P.clauses.map(function(c){ return SU.describe(c); }).join(', ')||it.text,focus:P.clauses.reduce(function(a,c){ return a+c.focus; },0)}; }
  var a=CAT.actions[it.aid]; if(!a) return {clauses:[],label:'?',focus:0};
  if(a.special==='announce'){ return {clauses:[],special:'announce',label:'Announce numbers: '+({honest:'honest',round:'rounded up',spin:'spun'}[it.values.mode]||''),focus:0,claims:CAT.claims(G,it.values.mode)}; }
  if(a.special==='promise'){ var q=G.queue.filter(function(x){ return x.id===it.values.f; })[0]; if(!q) return {clauses:[],label:'Promise (feature gone)',focus:0}; return {clauses:[],special:'promise',label:'Promise: '+q.name+' in '+it.values.due+' months',focus:0,promise:{what:q.name,by:'',tags:q.tags||[],dueIn:it.values.due}}; }
  var cl2=a.make(G,it.values); if(!cl2) return {clauses:[],label:a.title,focus:0};
  return {clauses:[cl2],label:SU.describe(cl2),focus:cl2.focus};
};

/* ------------------------------------------------------------ coach: what a good player would look at now */
CAT.coach=function(G){
  var out=[], f=SU.fin(G), seg=SU.seg(G), w=seg.words[0], runway=f.runway, mrr=G.mrr||0;
  function add(aid,values,label,why){ out.push({aid:aid,values:CAT.defaults(G,aid,values),label:label,why:why}); }
  var inPlan=function(aid){ return false; };
  if(G.t===0){ add('talk',{n:8},'Interview 8 customers','Learn what they pay for before you spend months building.'); add('build',{fk:'mvp',care:1},'Build the MVP','Nothing sells until something exists.'); return out; }
  if(G.insight<35) add('talk',{n:8},'Interview 8 customers','You still know little about what customers pay for. Insight '+R(G.insight)+' of 100.');
  var need=G.needs.filter(function(n){ return n.real&&n.revealed&&n.cov<0.3&&!G.queue.some(function(q){ return q.tags&&q.tags.indexOf(n.id)>=0; }); })[0];
  if(need) add('build',{fk:'need:'+need.id,care:1},'Build '+need.name,'Customers told you they need this. It raises product fit.');
  if(!G.shipped.length && !G.queue.length) add('build',{fk:'mvp',care:1},'Build the MVP','You have not shipped anything yet.');
  if(G.insight>=40 && !G.flags.priceTried && G.arch!=='market') add('price',{price:Math.round(G.wtpMed*0.75)},'Set a price','You know enough to price. Free is not a business.');
  if(G.arch==='smb' && mrr<20000) add('outbound',{ch:'email',n:300},'Cold-email 300 '+w,'Outreach is the cheapest way to find early customers.');
  if(G.arch==='consumer' && !G.orders.social) add('market',{channel:'social',budget:500},'Pay creators $500 a month','Creators are cheap reach for young audiences.');
  if(G.arch==='market') add('outbound',{ch:'email',n:100,side:'supply'},'Recruit '+((seg.supplyWords&&seg.supplyWords[0])||'sellers'),'A marketplace without supply has nothing to sell.');
  if(SU.custCount(G)>=10){ if(!(G.feat&&G.feat.dashboard)&&!G.queue.some(function(q){ return q.plat==='dashboard'; })) add('build',{fk:'plat:dashboard',care:1},'Build the analytics dashboard','Unlocks the Dashboard tab so you can see churn and signups.'); }
  if(runway<5 && f.burn>0 && !G.round) add('cutburn',{pct:25},'Cut spending 25%','Under 5 months of cash. Cutting buys time.');
  if(runway<9 && f.burn>0 && !G.round && G.rounds.length===0 && G.t>5) add('raise',{stage:'preseed'},'Start raising','Raising takes months. Start before you are desperate.');
  if(G.founder.sanity<45) add('self',{kind:'weekend'},'Take the weekend off','Your sanity is '+R(G.founder.sanity)+'. At zero you burn out.');
  if(G.lastStand) add('layoff',{pct:25},'Lay off 25%','Payroll Friday. You need cash now.');
  var seen={}; return out.filter(function(c){ var k=c.aid+JSON.stringify(c.values); if(seen[k]) return false; seen[k]=1; return true; }).slice(0,5);
};
})();
