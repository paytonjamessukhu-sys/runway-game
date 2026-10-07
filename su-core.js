/* RUNWAY - core: namespace, utils, seeded RNG streams, eras, save/load. Plain IIFE, no deps. */
(function(){
var SU = (window.SU = window.SU || {});
SU.VERSION = 1;

/* ------------------------------------------------------------ utils */
var clamp = SU.clamp = function(x,a,b){ return x<a?a:(x>b?b:x); };
SU.lerp = function(a,b,t){ return a+(b-a)*t; };
SU.sum = function(a,f){ var s=0; for(var i=0;i<a.length;i++) s+= f? f(a[i],i): a[i]; return s; };
SU.cap1 = function(s){ return s? s.charAt(0).toUpperCase()+s.slice(1) : s; };
SU.fmtMoney = function(n){
  var neg = n<0, a=Math.abs(n), s;
  if(a>=1e9) s='$'+(a/1e9).toFixed(a>=1e10?1:2)+'B';
  else if(a>=1e6) s='$'+(a/1e6).toFixed(a>=1e7?1:2)+'M';
  else if(a>=1e5) s='$'+Math.round(a/1e3)+'K';
  else if(a>=1e3) s='$'+(a/1e3).toFixed(1)+'K';
  else s='$'+Math.round(a);
  return (neg?'-':'')+s;
};
SU.fmtNum = function(n){ var a=Math.abs(n); return a>=1e6? (n/1e6).toFixed(2)+'M' : a>=1e4? Math.round(n/1e3)+'K' : a>=1e3? (n/1e3).toFixed(1)+'K' : String(Math.round(n)); };
SU.pct = function(x,d){ return (x*100).toFixed(d===undefined?0:d)+'%'; };

/* ------------------------------------------------------------ RNG streams */
function hash(str){ var h=2166136261; for(var i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return h|0; }
SU.hash = hash;
var STREAMS = ['events','market','people','rivals','media','pitch','macro','misc'];
SU.rngInit = function(G, seed){ G.seed=seed; G.rs={}; STREAMS.forEach(function(n){ G.rs[n]=hash(seed+':'+n); }); };
SU.rnd = function(G, s){
  s = s||'misc'; var a = (G.rs[s] = (G.rs[s] + 0x6D2B79F5)|0);
  var t = Math.imul(a ^ (a>>>15), 1|a); t = (t + Math.imul(t ^ (t>>>7), 61|t)) ^ t;
  return ((t ^ (t>>>14))>>>0)/4294967296;
};
SU.randn = function(G,s){ var u=SU.rnd(G,s)||1e-9, v=SU.rnd(G,s); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); };
SU.chance = function(G,p,s){ return SU.rnd(G,s) < p; };
SU.int = function(G,a,b,s){ return a+Math.floor(SU.rnd(G,s)*(b-a+1)); };
SU.pick = function(G,arr,s){ return arr&&arr.length? arr[Math.floor(SU.rnd(G,s)*arr.length)] : undefined; };
SU.shuffle = function(G,arr,s){ var a=arr.slice(); for(var i=a.length-1;i>0;i--){ var j=Math.floor(SU.rnd(G,s)*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } return a; };
SU.wpick = function(G,arr,wf,s){ var tot=0,i; for(i=0;i<arr.length;i++) tot+=Math.max(0,wf(arr[i])); if(!(tot>0)) return arr[0]; var r=SU.rnd(G,s)*tot; for(i=0;i<arr.length;i++){ r-=Math.max(0,wf(arr[i])); if(r<=0) return arr[i]; } return arr[arr.length-1]; };
SU.poisson = function(G,lam,s){
  if(lam<=0) return 0;
  if(lam>30) return Math.max(0, Math.round(lam + Math.sqrt(lam)*SU.randn(G,s)));
  var L=Math.exp(-lam), k=0, p=1; do{ k++; p*=SU.rnd(G,s); }while(p>L && k<200); return k-1;
};
SU.binom = function(G,n,p,s){
  n=Math.round(n); if(n<=0||p<=0) return 0; if(p>=1) return n;
  if(n<60){ var c=0; for(var i=0;i<n;i++) if(SU.rnd(G,s)<p) c++; return c; }
  return clamp(Math.round(n*p + Math.sqrt(n*p*(1-p))*SU.randn(G,s)),0,n);
};

/* ------------------------------------------------------------ eras */
/* [S]/[R]/[D] values from the research notes; calibrated, not gospel. */
SU.PHASES = {
  mania:     {name:'Dot-com mania',    fundAvail:1.6, valMult:2.2, salaryIdx:0.45, cpcIdx:0.6,  cpiIdx:0.8, ipoWindow:0.95, downRound:0.05, close:[1,2],   diligence:0.3, replyIdx:1.3, mult:15},
  bust:      {name:'The bust',         fundAvail:0.4, valMult:0.35,salaryIdx:0.42, cpcIdx:0.4,  cpiIdx:0.7, ipoWindow:0.05, downRound:0.45, close:[5,9],   diligence:1.0, replyIdx:1.2, mult:2},
  growth:    {name:'Web 2.0 recovery', fundAvail:0.9, valMult:0.9, salaryIdx:0.55, cpcIdx:0.35, cpiIdx:0.6, ipoWindow:0.5,  downRound:0.12, close:[3,5],   diligence:0.8, replyIdx:1.1, mult:5},
  crash:     {name:'The crash',        fundAvail:0.45,valMult:0.5, salaryIdx:0.52, cpcIdx:0.3,  cpiIdx:0.5, ipoWindow:0.05, downRound:0.30, close:[5,8],   diligence:0.9, replyIdx:1.1, mult:2.5},
  mobile:    {name:'Mobile gold rush', fundAvail:0.8, valMult:0.8, salaryIdx:0.58, cpcIdx:0.25, cpiIdx:0.3, ipoWindow:0.35, downRound:0.10, close:[3,5],   diligence:0.7, replyIdx:1.0, mult:5},
  unicorn:   {name:'Unicorn era',      fundAvail:1.1, valMult:1.1, salaryIdx:0.85, cpcIdx:0.9,  cpiIdx:0.9, ipoWindow:0.6,  downRound:0.08, close:[2,4],   diligence:0.6, replyIdx:0.95,mult:7},
  pause:     {name:'The Pause',        fundAvail:0.7, valMult:0.8, salaryIdx:0.9,  cpcIdx:0.8,  cpiIdx:0.8, ipoWindow:0.3,  downRound:0.15, close:[3,5],   diligence:0.7, replyIdx:0.9, mult:7},
  zero:      {name:'Zero-rate boom',   fundAvail:1.5, valMult:1.7, salaryIdx:0.95, cpcIdx:1.2,  cpiIdx:1.0, ipoWindow:0.9,  downRound:0.04, close:[0.5,1.5],diligence:0.3,replyIdx:0.9, mult:18},
  correction:{name:'The correction',   fundAvail:0.6, valMult:0.6, salaryIdx:1.0,  cpcIdx:1.0,  cpiIdx:1.0, ipoWindow:0.1,  downRound:0.20, close:[5,9],   diligence:1.0, replyIdx:0.9, mult:6},
  ai:        {name:'AI boom',          fundAvail:0.9, valMult:1.0, salaryIdx:1.0,  cpcIdx:1.0,  cpiIdx:1.0, ipoWindow:0.4,  downRound:0.15, close:[3,6],   diligence:0.8, replyIdx:0.8, mult:7}
};
SU.PHASE_TL = [
  {y:1999,m:1,key:'mania'},{y:2000,m:4,key:'bust'},{y:2003,m:7,key:'growth'},{y:2008,m:9,key:'crash'},{y:2010,m:1,key:'mobile'},
  {y:2017,m:1,key:'unicorn'},{y:2020,m:3,key:'pause'},{y:2020,m:9,key:'zero'},{y:2022,m:3,key:'correction'},{y:2023,m:6,key:'ai'}
];
/* typical pre-money (post-money cap for pre-seed) by stage, per phase. */
SU.ROUND_BASE = {
  mania:     {preseed:3e6,  seed:8e6,  A:25e6, B:60e6,  C:150e6},
  bust:      {preseed:1.5e6,seed:3.5e6,A:9e6,  B:25e6,  C:60e6},
  growth:    {preseed:3e6,  seed:5e6,  A:13e6, B:40e6,  C:100e6},
  crash:     {preseed:3e6,  seed:5e6,  A:12e6, B:40e6,  C:90e6},
  mobile:    {preseed:5e6,  seed:7e6,  A:15e6, B:50e6,  C:120e6},
  unicorn:   {preseed:8e6,  seed:11e6, A:35e6, B:110e6, C:280e6},
  pause:     {preseed:7e6,  seed:10e6, A:30e6, B:80e6,  C:200e6},
  zero:      {preseed:12e6, seed:15e6, A:48e6, B:150e6, C:400e6},
  correction:{preseed:10e6, seed:12e6, A:35e6, B:80e6,  C:160e6},
  ai:        {preseed:10e6, seed:16e6, A:45e6, B:100e6, C:200e6},
  aiHot:     {preseed:20e6, seed:28e6, A:90e6, B:250e6, C:600e6}
};
SU.phaseKey = function(y,m){ var k='mania'; for(var i=0;i<SU.PHASE_TL.length;i++){ var p=SU.PHASE_TL[i]; if(y>p.y || (y===p.y && m>=p.m)) k=p.key; } return k; };
SU.era = function(G){
  var k = SU.phaseKey(G.year,G.month), b = SU.PHASES[k], o = {key:k};
  for(var f in b) o[f]=b[f];
  if(k==='ai' && G.idea && G.idea.ai){ o.fundAvail=1.8; o.valMult=2.0; o.close=[1,3]; o.mult=15; o.hot=true; }
  o.base = (o.hot? SU.ROUND_BASE.aiHot : SU.ROUND_BASE[k]);
  return o;
};
SU.MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
SU.dateStr = function(G){ return SU.MONTHS[G.month-1]+' '+G.year; };

/* ------------------------------------------------------------ names */
SU.NAMES = {
  first:['Maya','Dev','Priya','Jon','Alex','Sam','Ines','Omar','Lena','Theo','Nadia','Kai','Rosa','Hal','Mira','Tomas','Ayo','Bea','Cleo','Dani','Eli','Fern','Gus','Hana','Ivo','June','Kofi','Luz','Moe','Noor','Otto','Pia','Quinn','Raj','Suki','Tariq','Uma','Vic','Wren','Yuki','Zane','Ben','Cora','Dmitri','Esme','Finn','Gita','Hugo','Isla','Jules'],
  last:['Patel','Okafor','Lindqvist','Castellanos','Marchetti','Nguyen','Kowalski','Haddad','Brandt','Osei','Faraday','Strand','Rhee','Tolliver','Amsel','Calloway','Whitcombe','Delacroix','Kobayashi','Szabo','Raman','Ortiz','Bauer','Silva','Khan','Moreau','Fischer','Reyes','Park','Novak','Adeyemi','Larsen','Mensah','Costa','Ivanov','Sato','Dubois','Flynn','Gupta','Hale']
};
SU.fullName = function(G,s){ return SU.pick(G,SU.NAMES.first,s||'people')+' '+SU.pick(G,SU.NAMES.last,s||'people'); };

/* ------------------------------------------------------------ save / load */
var KEY='su_runway_v1';
SU.save = function(G, slot){ try{ localStorage.setItem(KEY+'_'+(slot||'auto'), JSON.stringify(G)); localStorage.setItem(KEY+'_last', slot||'auto'); return true; }catch(e){ return false; } };
SU.load = function(slot){ try{ var s=localStorage.getItem(KEY+'_'+(slot||'auto')); if(!s) return null; var G=JSON.parse(s); return G && G.v===SU.VERSION ? G : null; }catch(e){ return null; } };
SU.hasSave = function(slot){ try{ return !!localStorage.getItem(KEY+'_'+(slot||'auto')); }catch(e){ return false; } };
SU.clearSave = function(slot){ try{ localStorage.removeItem(KEY+'_'+(slot||'auto')); }catch(e){} };
SU.exportText = function(G){ try{ return 'RUNWAY1:'+btoa(unescape(encodeURIComponent(JSON.stringify(G)))); }catch(e){ return ''; } };
SU.importText = function(t){ t=(t||'').trim(); if(t.indexOf('RUNWAY1:')!==0) throw new Error('bad'); var G=JSON.parse(decodeURIComponent(escape(atob(t.slice(8))))); if(G.v!==SU.VERSION) throw new Error('version'); return G; };
SU.clone = function(G){ return JSON.parse(JSON.stringify(G)); };

/* learned phrases (parser gets better for this player; localStorage, try/catch) */
SU.learned = function(){ try{ return JSON.parse(localStorage.getItem(KEY+'_learn')||'{}'); }catch(e){ return {}; } };
SU.learn = function(phrase, entry){ try{ var l=SU.learned(); l[phrase]=entry; var ks=Object.keys(l); if(ks.length>200) delete l[ks[0]]; localStorage.setItem(KEY+'_learn',JSON.stringify(l)); }catch(e){} };
})();
