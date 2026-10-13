/* RUNWAY market map: every customer segment is a place on one map.
   Across: how much they pay. Down: how they buy (self-serve at the bottom, sales-heavy at the top).
   Used to pick where to start, and in the game to see where you are, how much of your market is left, and where a pivot could go. */
(function(){
var UI=window.UI, SU=window.SU;
var W=620, H=350, PAD=34;
var ARCH={smb:{col:'#4c6ef5',name:'Business software',y:0.22},market:{col:'#12b886',name:'Marketplaces',y:0.44},venue:{col:'#c8892b',name:'Bars and venues',y:0.65},consumer:{col:'#e8590c',name:'Consumer apps',y:0.86}};
var CYCLE=['self-serve, signs up fast','a few weeks to close','a couple of months to close','a quarter or more to close'];
var POOLS={practice:5000,owner:7200,finance:2200,lawfirm:1600,ecom:6000};
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function price(S){ return S.defaultPrice||S.wtp||(S.takeDefault?S.takeDefault*100:10); }
function money(n){ return n>=100?'$'+Math.round(n):'$'+n.toFixed(2).replace(/\.00$/,''); }

var NODES=null;
function build(){
  if(NODES) return NODES; var ids=Object.keys(SU.SEG), lo=Math.log(4), hi=Math.log(900);
  NODES=ids.map(function(id,i){ var S=SU.SEG[id]; var p=S.arch==='market'?(S.wtp||50):(S.defaultPrice||S.wtp||10);
    var x=PAD+(Math.log(Math.max(4,p))-lo)/(hi-lo)*(W-2*PAD-30);
    var base=ARCH[S.arch].y, y=base+(S.arch==='smb'?-0.02*(S.salesCycle||0):0);
    var r=S.arch==='smb'?(11+8*Math.min(1,(POOLS[id]||3000)/7200)):14;
    return {id:id,seg:S,x:x+10,y:y*H,r:r,arch:S.arch,price:p}; });
  /* push overlapping places apart, but keep each in its row */
  for(var it=0;it<80;it++){ for(var a=0;a<NODES.length;a++) for(var b=a+1;b<NODES.length;b++){ var A=NODES[a],B=NODES[b],dx=B.x-A.x,dy=B.y-A.y; if(Math.abs(dx)<78&&Math.abs(dy)<(A.r+B.r+20)){ var sx=(78-Math.abs(dx))/2, sy=((A.r+B.r+20)-Math.abs(dy))/2; var ux=dx>=0?1:-1, uy=dy===0?(a%2?1:-1):(dy>0?1:-1); if(sx<sy*1.5){ A.x-=ux*sx*0.6; B.x+=ux*sx*0.6; } A.y-=uy*sy*0.5; B.y+=uy*sy*0.5; } }
    NODES.forEach(function(n){ var base=ARCH[n.arch].y*H; n.y=Math.max(base-20,Math.min(base+16,n.y)); n.x=Math.max(PAD+14,Math.min(W-PAD-14,n.x)); }); }
  return NODES;
}
function gateText(id){ return ({finance:'Finance buyers want SOC 2. Without it you close about 40% fewer deals.',lawfirm:'Law firms close 30% fewer deals until your product has guardrails.',practice:'Past 30 customers you will need HIPAA compliance.'})[id]||''; }
function topChannel(S){ if(!S.aff) return ''; var best=null; Object.keys(S.aff).forEach(function(k){ if(best===null||S.aff[k]>S.aff[best]) best=k; }); return ({ads:'search ads',content:'content and SEO',social:'creators and social',events:'events',referral:'referrals',outbound:'outreach'})[best]||''; }
function ideasIn(id){ return SU.IDEAS.filter(function(i){ return (i.segId||i.seg)===id; }); }
UI.mapIdeasIn=ideasIn;

/* the picture */
UI.mapSvg=function(sel,g){
  var N=build(), cur=g?g.segId:null;
  var s='<svg viewBox="0 0 '+W+' '+H+'" class="mapsvg" role="img" aria-label="Market map">';
  s+='<rect x="0" y="0" width="'+W+'" height="'+H+'" rx="14" fill="#eef3fb"/>';
  /* rows */
  Object.keys(ARCH).forEach(function(k){ var y=ARCH[k].y*H; s+='<rect x="8" y="'+(y-38)+'" width="'+(W-16)+'" height="68" rx="10" fill="'+ARCH[k].col+'" opacity=".07"/><text x="16" y="'+(y-25)+'" class="mp-row" fill="'+ARCH[k].col+'">'+ARCH[k].name+'</text>'; });
  s+='<text x="'+PAD+'" y="'+(H-8)+'" class="mp-ax">pays little</text><text x="'+(W-PAD)+'" y="'+(H-8)+'" class="mp-ax" text-anchor="end">pays a lot</text>';
  s+='<text x="'+(W/2)+'" y="'+(H-8)+'" class="mp-ax" text-anchor="middle">what one customer pays</text>';
  s+='<line x1="'+PAD+'" y1="'+(H-20)+'" x2="'+(W-PAD)+'" y2="'+(H-20)+'" stroke="#9aa6c0" stroke-width="1" stroke-dasharray="3 4"/>';
  N.forEach(function(n){
    var rough=n.arch!=='smb', on=sel===n.id, you=cur===n.id, col=ARCH[n.arch].col;
    var gp=g&&you&&SU.pool&&SU.pool(g); var ring='';
    if(gp){ var frac=Math.max(0,Math.min(1,gp.mined/gp.total)), rr=n.r+6, C=2*Math.PI*rr; ring='<circle cx="'+n.x+'" cy="'+n.y+'" r="'+rr+'" fill="none" stroke="#c22a2a" stroke-width="3" stroke-dasharray="'+(C*frac).toFixed(1)+' '+C.toFixed(1)+'" transform="rotate(-90 '+n.x+' '+n.y+')"/>'; }
    var near=g&&!you&&g.arch===n.arch;
    s+='<g class="mp-n'+(on?' on':'')+(you?' you':'')+'" data-act="map-node" data-id="'+n.id+'" tabindex="0" role="button" aria-label="'+esc(n.seg.who||n.seg.name)+'">'+
      (on?'<circle cx="'+n.x+'" cy="'+n.y+'" r="'+(n.r+9)+'" fill="'+col+'" opacity=".18"/>':'')+ring+
      '<circle cx="'+n.x+'" cy="'+n.y+'" r="'+n.r+'" fill="'+(rough?'#fff':col)+'" stroke="'+col+'" stroke-width="'+(rough?2.2:2)+'"'+(rough?' stroke-dasharray="4 3"':'')+' opacity="'+(g&&!you&&!near?0.45:1)+'"/>'+
      (you?'<text x="'+n.x+'" y="'+(n.y+4.5)+'" text-anchor="middle" class="mp-you">YOU</text>':'')+
      '<text x="'+n.x+'" y="'+(n.y+n.r+13)+'" text-anchor="middle" class="mp-lab">'+esc(shortName(n.seg))+'</text></g>';
  });
  return s+'</svg>';
};
var SHORT={practice:'Dentists, clinics',owner:'Trades, shops',finance:'Finance teams',lawfirm:'Law firms',ecom:'Online stores',creators:'Creators',locals:'Locals',cocktail:'After-work',sports:'Game day',dates:'Date night',genz:'Group chat',parents:'Parents',cooks:'Home cooks',tutors:'Tutors',handy:'Handymen'};
function shortName(S){ return SHORT[S.id]||(S.name||'').slice(0,14); }

/* the card under the map */
UI.mapCard=function(id,g,mode){
  var n=build().filter(function(x){ return x.id===id; })[0]; if(!n) return '<div class="mapcard hint">Tap a place on the map. Each one is a different kind of customer with a different way to make money.</div>';
  var S=n.seg, rows=[], pool=POOLS[id];
  if(S.arch==='smb'){ rows.push(['Pays',money(S.defaultPrice)+' a month']); rows.push(['Buys',CYCLE[Math.min(3,S.salesCycle||0)]]); rows.push(['Stays',Math.round((1/(S.churnMo||0.05)))+' months on average']); if(pool) rows.push(['Reachable accounts','about '+pool.toLocaleString()+' (the market is finite)']); }
  else if(S.arch==='consumer'){ rows.push(['Pays',money(S.defaultPrice||S.wtp)+' a month']); rows.push(['Buys','taps install and moves on']); rows.push(['Needs','a viral loop: huge volume, tiny price']); }
  else if(S.arch==='venue'){ rows.push(['Spends',money(S.defaultPrice||S.wtp)+' a visit']); rows.push(['Comes back',Math.round(1/(S.churnMo||0.09))+' months before drifting off']); rows.push(['Needs','a room, staff and a good night out']); }
  else { rows.push(['Take rate',Math.round((S.takeDefault||0.1)*100)+'% of each deal']); rows.push(['Needs','sellers and buyers at the same time']); }
  var ch=topChannel(S); if(ch) rows.push(['Best way in',ch]);
  var gt=gateText(id); var ideas=ideasIn(id);
  var h='<div class="mapcard"><div class="mc-h"><b>'+esc(S.who?S.who.charAt(0).toUpperCase()+S.who.slice(1):S.name)+'</b><span class="pill '+(S.arch==='smb'?'good':'warn')+'">'+(S.arch==='smb'?'polished':'rough draft')+'</span></div>'+
    '<div class="mc-rows">'+rows.map(function(r){ return '<div><span>'+esc(r[0])+'</span><b>'+esc(r[1])+'</b></div>'; }).join('')+'</div>'+(gt?'<div class="mc-gate">Door: '+esc(gt)+'</div>':'');
  if(mode==='start'){
    h+='<div class="mc-ideas">'+(ideas.length?ideas.map(function(i){ var on=UI.S.setup&&UI.S.setup.idea===i.id; return '<button class="opt'+(on?' on':'')+'" data-act="pick-idea" data-id="'+i.id+'"><b>'+esc(i.name)+'</b><span class="tg">'+esc(i.tag)+'</span>'+(i.twist?'<span class="meta"><span class="pill blue">'+esc(i.twist)+'</span></span>':'')+'</button>'; }).join(''):'<div class="xs muted">No company starts here yet.</div>')+'</div>';
  } else if(g){
    if(id===g.segId){ var gp=SU.pool&&SU.pool(g); h+='<div class="mc-here"><b>You are here.</b>'+(gp?' You have contacted about '+Math.round(gp.mined)+' of about '+gp.total+' reachable accounts. The red ring shows how much of your market is used up.':'')+'</div>'; }
    else if(S.arch===g.arch) h+='<div class="mc-here">A neighbor. Moving here is a pivot: about half your customers leave and part of what you learned is lost.</div><div class="row"><button class="btn sm primary" data-act="map-pivot" data-id="'+id+'">Plan a pivot here</button></div>';
    else h+='<div class="mc-here muted">A different kind of business. You cannot pivot across business types, only start a new game there.</div>';
  }
  return h+'</div>';
};
/* in-game view */
UI.mapView=function(g){
  var sel=UI.S.mapSel||g.segId;
  return '<div class="dr-b"><div class="xs muted" style="margin-bottom:6px">Every place is a kind of customer. Across: what they pay. Down: how they buy. The red ring is how much of your market you have used up.</div>'+UI.mapSvg(sel,g)+UI.mapCard(sel,g,'game')+'</div>';
};
UI.mapStart=function(){
  var S=UI.S, idea=SU.IDEAS.filter(function(i){ return i.id===S.setup.idea; })[0]||SU.IDEAS[0];
  var sel=S.mapSel||(idea.segId||idea.seg);
  return '<h3>Where do you want to compete?</h3><p class="muted sm" style="margin-bottom:6px">Tap a place on the map. Business software is the polished one; the rest are rougher drafts.</p>'+UI.mapSvg(sel,null)+UI.mapCard(sel,null,'start');
};
})();
