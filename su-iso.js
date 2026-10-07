/* RUNWAY - isometric office renderer. Canvas 2D, no dependencies.
   The office is the dashboard: it grows with the company and reacts to the numbers. */
(function(){
var SU = (window.SU = window.SU || {});
var Iso = (SU.Iso = {});
var HW=32, HH=16, ZU=28;            /* half tile width, half tile height, pixels per unit of height */
var cv=null, ctx=null, dpr=1, cssW=0, cssH=0;
var cam={ox:0,oy:0,s:1}, insetFn=null;
var sc=null;                        /* scene */
var running=false, lastT=0, frameAcc=0, wallClock=0;
var handlers={}, hits=[], hover=null, mouse={x:-1,y:-1,in:false};
var bg=null, bgx=null, bgKey='', bgTick=-1;
var fade={a:0,dir:0,cb:null}, banners=[], parts=[], bubbles=[];

/* ------------------------------------------------------------ colour helpers */
var shadeCache={}, faceCache={};
function hex2rgb(h){ h=h.replace('#',''); if(h.length===3) h=h.split('').map(function(c){ return c+c; }).join(''); var n=parseInt(h,16); return [(n>>16)&255,(n>>8)&255,n&255]; }
function shade(h,f){ var k=h+'|'+f; if(shadeCache[k]) return shadeCache[k]; var c=hex2rgb(h), r; if(f>=0) r=c.map(function(v){ return Math.round(v+(255-v)*f); }); else r=c.map(function(v){ return Math.round(v*(1+f)); }); return (shadeCache[k]='rgb('+r.join(',')+')'); }
function faces(h){ if(faceCache[h]) return faceCache[h]; return (faceCache[h]={top:shade(h,0.24),left:shade(h,-0.07),right:shade(h,-0.26)}); }
function toHex(n){ n=Math.max(0,Math.min(255,Math.round(n))); return (n<16?'0':'')+n.toString(16); }
function mix(a,b,t){ var x=hex2rgb(a), y=hex2rgb(b); return '#'+[0,1,2].map(function(i){ return toHex(x[i]+(y[i]-x[i])*t); }).join(''); }
var SKIN=['#f2d3b5','#e6b995','#c98e63','#9c6742','#6b4528'];
var HAIR=['#2b2118','#5a3b22','#a1661f','#d8b45a','#b5352b','#8a8f99'];
var SHIRT=['#4c78c9','#e0597a','#3aa38b','#e0922d','#7b5fc4','#c4553a','#5a6b7d','#2e9bb5'];
var ROLECOL={eng:'#4c78c9',design:'#e0597a',pm:'#7b5fc4',sdr:'#3aa38b',ae:'#2e9bb5',cs:'#e0922d',mkt:'#c4553a',cos:'#5a6b7d',vp:'#2b2f3a',mgr:'#8a6d3b'};
var ROLEABBR={eng:'ENG',design:'DESIGN',pm:'PM',mgr:'MGR',sdr:'SDR',ae:'AE',cs:'SUPPORT',mkt:'MKT',cos:'CoS',vp:'VP'};
var showLabels=true;
Iso.setLabels=function(v){ showLabels=!!v; };
var OUT='rgba(30,25,45,.30)';

/* ------------------------------------------------------------ projection and primitives */
function P(x,y,z){ return [cam.ox+(x-y)*HW*cam.s, cam.oy+((x+y)*HH-(z||0)*ZU)*cam.s]; }
function poly(pts,fill,stroke,lw){
  ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]); for(var i=1;i<pts.length;i++) ctx.lineTo(pts[i][0],pts[i][1]); ctx.closePath();
  if(fill){ ctx.fillStyle=fill; ctx.fill(); } if(stroke){ ctx.strokeStyle=stroke; ctx.lineWidth=lw||1; ctx.stroke(); }
}
function box(x,y,z,w,d,h,col,o){
  var f=typeof col==='string'? faces(col):col; o=o||{}; var st=o.stroke===undefined? OUT : o.stroke;
  if(!o.noRight) poly([P(x+w,y,z),P(x+w,y+d,z),P(x+w,y+d,z+h),P(x+w,y,z+h)], o.fr||f.right, st);
  if(!o.noLeft)  poly([P(x,y+d,z),P(x+w,y+d,z),P(x+w,y+d,z+h),P(x,y+d,z+h)], o.fl||f.left, st);
  if(!o.noTop)   poly([P(x,y,z+h),P(x+w,y,z+h),P(x+w,y+d,z+h),P(x,y+d,z+h)], o.ft||f.top, st);
}
/* rectangle on a vertical plane. axis 'y': plane gy=c spanning gx a0..a1; axis 'x': plane gx=c spanning gy a0..a1 */
function vrect(axis,c,a0,a1,z0,z1,fill,stroke,lw){
  var p; if(axis==='x') p=[P(c,a0,z0),P(c,a1,z0),P(c,a1,z1),P(c,a0,z1)]; else p=[P(a0,c,z0),P(a1,c,z0),P(a1,c,z1),P(a0,c,z1)];
  poly(p,fill,stroke,lw);
}
function hrect(x,y,z,w,d,fill,stroke){ poly([P(x,y,z),P(x+w,y,z),P(x+w,y+d,z),P(x,y+d,z)],fill,stroke); }
function shadowAt(x,y,w,d,a){ ctx.globalAlpha=a||0.16; poly([P(x-0.04,y-0.04,0),P(x+w+0.22,y-0.04,0),P(x+w+0.22,y+d+0.22,0),P(x-0.04,y+d+0.22,0)],'#1a1030'); ctx.globalAlpha=1; }
function ell(sx,sy,rx,ry,fill){ ctx.beginPath(); ctx.ellipse(sx,sy,rx,ry,0,0,Math.PI*2); ctx.fillStyle=fill; ctx.fill(); }
/* local 2D frame on a wall: 1 local px = 1 px along the wall (tile = 36px) and 1 px of height (unit = 28px) */
function wall(axis,c,u,v,fn){
  u=u/36; v=v/28; var s=cam.s; ctx.save();
  if(axis==='y') ctx.transform(HW*s/36,HH*s/36,0,ZU*s/28, cam.ox+(u-c)*HW*s, cam.oy+((u+c)*HH-v*ZU)*s);
  else ctx.transform(HW*s/36,-HH*s/36,0,ZU*s/28, cam.ox+(c-u)*HW*s, cam.oy+((c+u)*HH-v*ZU)*s);
  fn(); ctx.restore();
}
function rrect(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath(); }
function rnd01(seed){ var x=Math.sin(seed*127.1+311.7)*43758.5453; return x-Math.floor(x); }

/* ------------------------------------------------------------ stages */
var STAGES={
  garage:{W:7,D:6,H:3.0,label:'The Garage',wall:'#e7dcc8',floor:'#bdb6ab',trim:'#9a8b73',line:'#a89f90',rows:[1.0,3.6],bands:[3.22,5.7],aisle:0.5,
          slots:[[0.9,1.0],[4.4,1.0],[0.9,3.6],[4.4,3.6]],door:{kind:'garage',a:2.0,b:5.8,cx:3.65},wins:[],tv:{axis:'x',pos:5.55,w:1.6,h:0.9,z:1.7},board:[0.95,3.55],poster:null,dart:null},
  studio:{W:9,D:8.2,H:3.3,label:'The Studio',wall:'#e8eef3',floor:'#d6bf98',trim:'#8fa0b3',line:'#c4ab82',rows:[1.0,3.7],bands:[3.3,5.95],aisle:0.8,
          slots:[[1.5,1.0],[3.9,1.0],[6.3,1.0],[1.5,3.7],[3.9,3.7],[6.3,3.7]],door:{kind:'door',a:4.4,b:5.6,cy:5.0},wins:[[1.7,3.7],[4.0,6.0]],tv:{axis:'y',pos:6.4,w:2.1,h:1.2,z:1.9},board:[1.45,4.15],poster:0.4,dart:true},
  office:{W:11,D:9.8,H:3.5,label:'The Office',wall:'#e9e9f1',floor:'#c4c9d1',trim:'#7e8aa0',line:'#b3b9c3',rows:[1.0,3.5,6.0],bands:[3.12,5.62,8.15],aisle:0.8,
          slots:[[1.5,1.0],[3.9,1.0],[6.3,1.0],[8.7,1.0],[1.5,3.5],[3.9,3.5],[6.3,3.5],[8.7,3.5],[1.5,6.0],[3.9,6.0]],door:{kind:'door',a:5.4,b:6.6,cy:6.0},wins:[[1.7,4.1],[4.4,6.8]],tv:{axis:'y',pos:7.2,w:2.1,h:1.2,z:1.9},board:[1.45,5.0],poster:0.4,dart:true},
  hq:    {W:13,D:10.6,H:3.7,label:'Headquarters',wall:'#efeee8',floor:'#bcc4cc',trim:'#66748a',line:'#aab3bd',rows:[1.0,3.5,6.0],bands:[3.12,5.62,8.5],aisle:0.8,
          slots:[[1.5,1.0],[3.9,1.0],[6.3,1.0],[8.7,1.0],[11.1,1.0],[1.5,3.5],[3.9,3.5],[6.3,3.5],[8.7,3.5],[11.1,3.5],[1.5,6.0],[3.9,6.0],[6.3,6.0]],door:{kind:'door',a:6.4,b:7.6,cy:7.0},wins:[[1.7,4.1],[4.4,6.8],[7.1,9.5]],tv:{axis:'y',pos:9.9,w:2.1,h:1.2,z:1.9},board:[1.45,6.0],poster:0.4,dart:true}
};
Iso.STAGES=STAGES;
function stageFor(G){ return STAGES[G.space]?G.space:'garage'; }
Iso.stageFor=stageFor;

/* ------------------------------------------------------------ scene construction */
function newScene(stageKey,G){
  var st=STAGES[stageKey];
  var s={key:stageKey,st:st,W:st.W,D:st.D,H:st.H,people:[],visitors:[],desks:[],props:[],dog:null,state:{},era:G?G.startKey:'2024',
    stand:{coffee:{x:0.55,y:1.45},board:{x:0.8,y:2.6},meet:[],rack:{x:0,y:0}},seed:G?G.seed:7,t0:wallClock};
  var x0=st.slots; s.slotList=x0.map(function(p,i){ return {i:i,x:p[0],y:p[1],w:2,d:1,face:'y',who:null,req:false}; });
  /* props per stage */
  var pr=s.props;
  if(stageKey==='garage'){
    pr.push({t:'crates',x:6.0,y:0.15,w:0.85,d:0.85});
    pr.push({t:'coffee',x:0.1,y:0.1,w:0.8,d:0.85,crate:true});
    pr.push({t:'fridge',x:1.0,y:0.15,w:0.62,d:0.62,mini:true});
    pr.push({t:'plant',x:6.2,y:5.2,sz:0.9});
    s.stand.meet=[{x:3.4,y:4.7},{x:3.9,y:4.7}]; s.stand.rack={x:5.6,y:0.9};
  } else if(stageKey==='studio'){
    pr.push({t:'coffee',x:0.1,y:0.1,w:0.8,d:0.85});
    pr.push({t:'fridge',x:1.0,y:0.15,w:0.7,d:0.7});
    pr.push({t:'plant',x:8.0,y:0.3,sz:1.0}); pr.push({t:'plant',x:8.1,y:5.9,sz:1.1});
    pr.push({t:'printer',x:7.8,y:2.9,w:0.7,d:0.6});
    pr.push({t:'rug',x:5.5,y:5.75,w:3.0,d:1.15,c:'#7aa8c9'});
    s.stand.meet=[{x:5.4,y:6.4},{x:8.8,y:6.4},{x:7.0,y:5.7}]; s.stand.rack={x:8.2,y:3.9};
  } else if(stageKey==='office'){
    pr.push({t:'coffee',x:0.1,y:0.1,w:0.9,d:0.9}); pr.push({t:'fridge',x:1.1,y:0.15,w:0.75,d:0.75});
    pr.push({t:'rack',x:9.9,y:0.15,w:0.85,d:0.8});
    pr.push({t:'plant',x:10.1,y:2.9,sz:1.1}); pr.push({t:'plant',x:5.9,y:8.0,sz:1.0});
    pr.push({t:'mtable',x:7.7,y:6.5,w:2.4,d:1.2});
    pr.push({t:'rug',x:7.1,y:5.9,w:3.6,d:2.4,c:'#8e9cc0'});
    [8.4,9.1,9.8].forEach(function(cx){ pr.push({t:'mchair',x:cx-0.27,y:6.0-0.27,w:0.54,d:0.54,dir:3}); pr.push({t:'mchair',x:cx-0.27,y:8.0-0.27,w:0.54,d:0.54,dir:1}); });
    s.stand.meet=[{x:7.1,y:6.5},{x:10.8,y:6.8},{x:7.1,y:7.5}]; s.stand.rack={x:10.3,y:1.3};
  } else {
    pr.push({t:'coffee',x:0.1,y:0.1,w:1.0,d:0.9}); pr.push({t:'fridge',x:1.2,y:0.15,w:0.8,d:0.8});
    pr.push({t:'rack',x:12.0,y:0.15,w:0.9,d:0.8});
    pr.push({t:'plant',x:12.2,y:3.0,sz:1.2}); pr.push({t:'plant',x:8.1,y:8.4,sz:1.1});
    pr.push({t:'mtable',x:9.8,y:7.0,w:2.6,d:1.2});
    pr.push({t:'rug',x:9.2,y:6.4,w:3.8,d:2.5,c:'#9aa5c4'});
    [10.5,11.2,11.9].forEach(function(cx){ pr.push({t:'mchair',x:cx-0.27,y:6.5-0.27,w:0.54,d:0.54,dir:3}); pr.push({t:'mchair',x:cx-0.27,y:8.65-0.27,w:0.54,d:0.54,dir:1}); });
    s.stand.meet=[{x:9.2,y:7.6},{x:12.8,y:7.6},{x:9.2,y:6.6}]; s.stand.rack={x:12.3,y:1.4};
  }
  return s;
}

/* ------------------------------------------------------------ camera / layout */
function layoutCam(){
  if(!cv||!sc) return;
  var W=sc.W, D=sc.D, H=sc.H;
  var minX=-D*HW, maxX=W*HW, minY=-H*ZU-6, maxY=(W+D)*HH+12;
  var bw=maxX-minX+60, bh=maxY-minY+60;
  var ins=insetFn?insetFn():null; if(!ins) ins={l:0,t:0,r:0,b:0};
  var aw=Math.max(80,cssW-ins.l-ins.r), ah=Math.max(80,cssH-ins.t-ins.b);
  var s=Math.min(aw/bw, ah/bh); var cap=insetFn?2.4:1.55; if(s>cap) s=cap;
  cam.s=s; cam.ox=ins.l+aw/2-((minX+maxX)/2)*s; cam.oy=ins.t+ah/2-((minY+maxY)/2)*s;
  bgKey='';
}
Iso.resize=function(){
  if(!cv) return; var r=cv.getBoundingClientRect(); if(r.width<10) return;
  dpr=Math.min(2,window.devicePixelRatio||1); cssW=r.width; cssH=r.height;
  cv.width=Math.round(cssW*dpr); cv.height=Math.round(cssH*dpr);
  bg=document.createElement('canvas'); bg.width=cv.width; bg.height=cv.height; bgx=bg.getContext('2d'); bgKey='';
  layoutCam();
};

/* ------------------------------------------------------------ time of day */
function tod(){ /* 0 dawn .. 0.5 noon .. 1 night, loops in 150s of wall time */ return ((wallClock/150)%1); }
function dayPhase(){
  var t=tod(); /* 0..1: 0-0.1 dawn, 0.1-0.55 day, 0.55-0.68 dusk, 0.68-0.95 night, 0.95-1 dawn */
  if(t<0.08) return {k:'dawn',n:0.35-t*3}; if(t<0.55) return {k:'day',n:0}; if(t<0.68) return {k:'dusk',n:(t-0.55)/0.13*0.6}; if(t<0.95) return {k:'night',n:0.6+0.15*Math.sin((t-0.68)/0.27*Math.PI)}; return {k:'dawn',n:Math.max(0,0.6-(t-0.95)*12)};
}
function skyColors(ph){
  if(ph.k==='day') return ['#8cc4ee','#d6ecfb']; if(ph.k==='dawn') return ['#f3b48f','#fbe3c7']; if(ph.k==='dusk') return ['#6a74b8','#f1a97e']; return ['#10173a','#2a3566'];
}

/* ------------------------------------------------------------ background (floor + walls + wall decor) */
function bgDraw(){
  var st=sc.st, W=sc.W, D=sc.D, H=sc.H, S=sc.state, ph=dayPhase();
  var key=(S.rmKey||'')+(S.shopKey||'')+(S.shop&&S.shop.sign?'s':'')+sc.key+'|'+Math.round(cam.s*100)+'|'+Math.floor(wallClock/2)+'|'+(S.cust||0)+'|'+(S.runwayBand||0)+'|'+(S.tvKey||'')+'|'+(S.rival||0)+'|'+(S.lastStand?1:0);
  if(key===bgKey) return; bgKey=key;
  var main=ctx; ctx=bgx; bgx.setTransform(dpr,0,0,dpr,0,0); bgx.clearRect(0,0,cssW,cssH);
  /* backdrop */
  var g=bgx.createLinearGradient(0,0,0,cssH); g.addColorStop(0,'#eef1f7'); g.addColorStop(1,'#dfe5ef'); bgx.fillStyle=g; bgx.fillRect(0,0,cssW,cssH);
  bgx.fillStyle='rgba(120,130,160,.10)'; for(var gx=0;gx<cssW;gx+=26) for(var gy=0;gy<cssH;gy+=26) bgx.fillRect(gx,gy,1.5,1.5);
  /* base slab */
  box(-0.3,-0.3,-0.35,W+0.3,D+0.3,0.35,mix(st.floor,'#6b6f7a',0.35),{stroke:OUT});
  /* floor */
  var FA=st.floor, FB=shade(st.floor,-0.05);
  if(sc.key==='studio'||sc.key==='garage'){
    for(var i=0;i<W;i++) for(var j=0;j<D;j++){ var wx=Math.min(1,W-i), wy=Math.min(1,D-j); hrect(i,j,0,wx,wy,((i+j)&1)?FA:FB,'rgba(60,50,40,.08)'); }
    if(sc.key==='studio'){ ctx.strokeStyle=st.line; ctx.lineWidth=1; for(var k=0;k<=D;k+=0.5){ var a=P(0,k,0), b=P(W,k,0); ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.globalAlpha=0.25; ctx.stroke(); ctx.globalAlpha=1; } }
  } else {
    for(var i2=0;i2<W;i2++) for(var j2=0;j2<D;j2++){ var wx2=Math.min(1,W-i2), wy2=Math.min(1,D-j2); hrect(i2,j2,0,wx2,wy2,((i2+j2)&1)?FA:FB,'rgba(40,50,70,.07)'); }
  }
  if(sc.key==='garage'){ ctx.globalAlpha=0.16; ell(P(2.2,3.0,0)[0],P(2.2,3.0,0)[1],30*cam.s,13*cam.s,'#2a2a30'); ell(P(5.0,2.6,0)[0],P(5.0,2.6,0)[1],18*cam.s,8*cam.s,'#2a2a30'); ctx.globalAlpha=1; }
  /* walls */
  var wallRight=mix(st.wall,'#ffffff',0.15), wallLeft=shade(st.wall,-0.10);
  var wf={top:shade(st.trim,0.35),left:wallRight,right:wallLeft};
  box(0,-0.3,0,W,0.3,H,wf,{stroke:OUT});          /* right wall (plane gy=0) */
  box(-0.3,0,0,0.3,D,H,wf,{stroke:OUT});          /* left wall (plane gx=0) */
  box(-0.3,-0.3,0,0.3,0.3,H,wf,{stroke:OUT});
  /* skirting */
  vrect('y',0,0,W,0,0.18,st.trim); vrect('x',0,0,D,0,0.18,shade(st.trim,-0.12));
  /* windows on the right wall */
  var wins=st.wins;
  var sky=skyColors(ph);
  wins.forEach(function(w,idx){
    var a=w[0], b=w[1];
    wall('y',0,a*36,(H-0.5)*28,function(){
      var ww=(b-a)*36, hh=(H-1.45)*28; var gr=ctx.createLinearGradient(0,0,0,hh); gr.addColorStop(0,sky[0]); gr.addColorStop(1,sky[1]);
      ctx.fillStyle=gr; ctx.fillRect(0,0,ww,hh);
      if(ph.k==='night'||ph.k==='dusk'){ ctx.fillStyle='rgba(255,255,230,.8)'; for(var q=0;q<7;q++){ ctx.fillRect(rnd01(q+idx*9)*ww, rnd01(q*3+idx)*hh*0.5, 1.6,1.6); } }
      /* skyline */
      var city=(sc.key==='studio'?0.45:sc.key==='office'?0.7:0.95);
      for(var bx=0;bx<ww;bx+=12){ var bh2=(8+rnd01(bx*0.13+idx*5)*hh*0.75*city); ctx.fillStyle=(ph.k==='night')?'#1a2145':(ph.k==='dusk'?'#4a4f8a':'#9db4cc'); ctx.fillRect(bx,hh-bh2,11,bh2);
        if(ph.k==='night'||ph.k==='dusk'){ ctx.fillStyle='rgba(255,226,140,.8)'; for(var wy3=hh-bh2+4;wy3<hh-3;wy3+=7){ if(rnd01(bx+wy3)>0.55) ctx.fillRect(bx+2,wy3,2.4,2.4); if(rnd01(bx*2+wy3)>0.6) ctx.fillRect(bx+6,wy3,2.4,2.4); } } }
      if(ph.k==='day'){ ctx.fillStyle='rgba(255,255,255,.85)'; ctx.beginPath(); ctx.ellipse(ww*0.3,hh*0.28,16,6,0,0,6.3); ctx.ellipse(ww*0.4,hh*0.25,12,5,0,0,6.3); ctx.fill(); }
      if(ph.k==='night'){ ctx.fillStyle='#f6f1d0'; ctx.beginPath(); ctx.arc(ww*0.75,hh*0.28,6,0,6.3); ctx.fill(); }
      ctx.strokeStyle=shade(st.trim,-0.2); ctx.lineWidth=3; ctx.strokeRect(0,0,ww,hh); ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(ww/2,0); ctx.lineTo(ww/2,hh); ctx.moveTo(0,hh*0.55); ctx.lineTo(ww,hh*0.55); ctx.stroke();
    });
  });
  /* garage door */
  if(sc.key==='garage'){
    var d=st.door;
    wall('y',0,d.a*36,2.7*28,function(){
      var ww=(d.b-d.a)*36, hh=2.7*28; var open=hh*0.45;
      var gr=ctx.createLinearGradient(0,0,0,open); gr.addColorStop(0,sky[0]); gr.addColorStop(1,sky[1]); ctx.fillStyle=gr; ctx.fillRect(0,hh-open,ww,open);
      ctx.fillStyle=(ph.k==='night')?'#1b2a33':'#8fb98a'; ctx.fillRect(0,hh-open*0.3,ww,open*0.3);
      ctx.fillStyle=(ph.k==='night')?'#2a3050':'#9aa3ad'; ctx.fillRect(ww*0.12,hh-open*0.7,18,open*0.42); ctx.fillRect(ww*0.62,hh-open*0.6,24,open*0.32);
      var dc=ctx.createLinearGradient(0,0,0,hh-open); dc.addColorStop(0,'#cfd5dc'); dc.addColorStop(1,'#b6bec8'); ctx.fillStyle=dc; ctx.fillRect(0,0,ww,hh-open);
      ctx.strokeStyle='rgba(60,70,85,.45)'; ctx.lineWidth=1; for(var y=8;y<hh-open;y+=9){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(ww,y); ctx.stroke(); }
      ctx.strokeStyle='#6c7684'; ctx.lineWidth=3; ctx.strokeRect(0,0,ww,hh);
    });
  }
  /* normal door on the left wall */
  if(sc.key!=='garage'){
    var dd=st.door;
    wall('x',0,dd.b*36,2.4*28,function(){
      var ww=(dd.b-dd.a)*36, hh=2.4*28; ctx.fillStyle=shade('#7a5a3a',0.0); ctx.fillRect(0,0,ww,hh); ctx.fillStyle='rgba(255,255,255,.12)'; ctx.fillRect(4,5,ww-8,hh*0.38); ctx.fillRect(4,hh*0.5,ww-8,hh*0.42);
      ctx.fillStyle='#e8c76b'; ctx.beginPath(); ctx.arc(ww-8,hh*0.55,2.4,0,6.3); ctx.fill();
      ctx.strokeStyle=shade(st.trim,-0.25); ctx.lineWidth=3; ctx.strokeRect(0,0,ww,hh);
      if(S.lastStand||S.runwayBand===3){ ctx.fillStyle='#fdf3c9'; ctx.fillRect(ww*0.18,hh*0.18,ww*0.52,hh*0.3); ctx.strokeStyle='#c4452f'; ctx.lineWidth=1.2; ctx.strokeRect(ww*0.18,hh*0.18,ww*0.52,hh*0.3); ctx.fillStyle='#c4452f'; ctx.font='bold 7px sans-serif'; ctx.fillText('FINAL',ww*0.22,hh*0.3); ctx.fillText('NOTICE',ww*0.2,hh*0.4); }
    });
  }
  if(S.shop&&S.shop.sign&&sc.key!=='garage'){ var dd0=st.door; wall('x',0,dd0.b*36,(2.55)*28,function(){ var nm=(S.name||'').toUpperCase().slice(0,7); ctx.font='bold 10px sans-serif'; ctx.shadowColor='#ff3d9a'; ctx.shadowBlur=8; ctx.fillStyle='#ff7ac2'; ctx.fillText(nm,2,10); ctx.shadowBlur=0; }); }
  /* customer wall (left wall), dashboard TV, decor */
  drawCustomerWall(st.board[0],st.board[1]);
  drawTV(st.tv);
  drawDecor(wins);
  /* rival dartboard above the coffee machine */
  if(S.rival>0.15 && st.dart){ wall('x',0,1.0*36,2.75*28,function(){ ctx.fillStyle='#3a2f2f'; ctx.beginPath(); ctx.arc(14,14,14,0,6.3); ctx.fill(); ctx.fillStyle='#d9534f'; ctx.beginPath(); ctx.arc(14,14,10,0,6.3); ctx.fill(); ctx.fillStyle='#f4efe6'; ctx.beginPath(); ctx.arc(14,14,6.5,0,6.3); ctx.fill(); ctx.fillStyle='#d9534f'; ctx.beginPath(); ctx.arc(14,14,2.4,0,6.3); ctx.fill(); ctx.fillStyle='#2b2118'; ctx.font='bold 6px sans-serif'; ctx.fillText(S.rivalName||'RIVAL',-2,-3); }); }
  /* floor items drawn flat: rugs */
  sc.props.forEach(function(p){ if(p.t==='rug'){ var c=p.c||'#8aa'; hrect(p.x,p.y,0.01,p.w,p.d,mix(c,'#ffffff',0.2),'rgba(40,40,60,.18)'); hrect(p.x+0.15,p.y+0.15,0.012,p.w-0.3,p.d-0.3,null,'rgba(255,255,255,.55)');
    if(p.logo){ var lc=P(p.x+p.w/2,p.y+p.d/2,0.02); ctx.save(); ctx.translate(lc[0],lc[1]); ctx.transform(1,0.5,-1,0.5,0,0); ctx.scale(cam.s*0.9,cam.s*0.9); ctx.fillStyle=S.brand||'#fff'; ctx.beginPath(); ctx.arc(0,0,Math.min(p.w,p.d)*10,0,6.3); ctx.fill(); ctx.fillStyle='#fff'; ctx.font='bold '+Math.round(Math.min(p.w,p.d)*14)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText((S.name||'R').charAt(0).toUpperCase(),0,1); ctx.restore(); } } });
  /* trophy shelf on the left wall: one more trophy for every company level */
  if(sc.hasTrophy){ var ty0=(AMEN[sc.key]||AMEN.garage).trophy[0]; var lv=Math.min(9,(S.lvl||1)-1);
    wall('x',0,(ty0+1.35)*36,2.35*28,function(){ var ww=1.35*36, hh=1.1*28; ctx.fillStyle='#8a6b3e'; ctx.fillRect(0,0,ww,hh); ctx.fillStyle='#f2e8d2'; ctx.fillRect(2,2,ww-4,hh-4); ctx.fillStyle='#8a6b3e'; ctx.fillRect(2,hh/2-1,ww-4,2.5);
      for(var i=0;i<lv;i++){ var row=i<5?0:1, col=i<5?i:i-5, bx=5+col*9.5, by=row?hh-5:hh/2-3; ctx.fillStyle=['#e5b73b','#c9ced6','#d98b4a','#e5b73b','#6fcf97'][i%5]; if(i%3===0){ ctx.beginPath(); ctx.moveTo(bx,by-9); ctx.lineTo(bx+7,by-9); ctx.lineTo(bx+5.5,by-3); ctx.lineTo(bx+1.5,by-3); ctx.closePath(); ctx.fill(); ctx.fillRect(bx+2.8,by-3,1.4,3); ctx.fillRect(bx+1,by,5,1.5); } else if(i%3===1){ ctx.beginPath(); ctx.arc(bx+3.5,by-4,3.4,0,6.3); ctx.fill(); ctx.fillRect(bx+2.5,by-1,2,3); } else { ctx.beginPath(); for(var k=0;k<5;k++){ var a1=-1.57+k*1.257, a2=a1+0.628; ctx.lineTo(bx+3.5+Math.cos(a1)*4,by-4+Math.sin(a1)*4); ctx.lineTo(bx+3.5+Math.cos(a2)*1.7,by-4+Math.sin(a2)*1.7); } ctx.closePath(); ctx.fill(); } }
      ctx.strokeStyle='#8a6b3e'; ctx.lineWidth=2; ctx.strokeRect(0,0,ww,hh); }); }
  ctx=main;
}
function drawCustomerWall(a,b,axis){
  var S=sc.state, n=S.cust||0; var len=b-a; var cols=Math.max(4,Math.floor(len*36/16)), rows=3;
  wall('x',0,b*36,2.75*28,function(){
    var ww=len*36, hh=2.1*28; ctx.fillStyle='#f7f4ea'; ctx.fillRect(0,0,ww,hh); ctx.strokeStyle='#8a8f98'; ctx.lineWidth=3; ctx.strokeRect(0,0,ww,hh);
    ctx.fillStyle='#2a3350'; ctx.font='bold 9px sans-serif'; ctx.fillText('CUSTOMERS',6,12); ctx.fillStyle='#3a8f6a'; ctx.fillText(String(Math.round(n)),ww-6-ctx.measureText(String(Math.round(n))).width,12);
    var cap=cols*rows, per=Math.max(1,Math.ceil(n/cap)), shown=Math.min(cap,Math.ceil(n/per));
    var cols2=['#ffe27a','#ffb199','#9fd8ff','#b9f0c0','#e6c3ff'];
    for(var i=0;i<shown;i++){ var cx=6+(i%cols)*((ww-12)/cols), cy=19+Math.floor(i/cols)*((hh-24)/rows); ctx.save(); ctx.translate(cx+6,cy+6); ctx.rotate((rnd01(i*3.1)-0.5)*0.25); ctx.fillStyle=cols2[i%5]; ctx.fillRect(-6,-6,12,12); ctx.fillStyle='rgba(0,0,0,.12)'; ctx.fillRect(-6,4,12,2); ctx.restore(); }
    if(!n){ ctx.fillStyle='#9aa0ad'; ctx.font='italic 8px sans-serif'; ctx.fillText('no customers yet. be the first.',6,hh/2+8); }
    if(per>1){ ctx.fillStyle='#6a7080'; ctx.font='7px sans-serif'; ctx.fillText('1 note = '+per,6,hh-4); }
  });
}
function drawTV(tv){
  var S=sc.state, w=tv.w, h=tv.h, z=tv.z;
  wall(tv.axis,0,tv.pos*36,(z+h)*28,function(){
    var ww=w*36, hh=h*28; ctx.fillStyle='#14161d'; rrect(0,0,ww,hh,3); ctx.fill(); ctx.fillStyle='#0f2236'; ctx.fillRect(3,3,ww-6,hh-6);
    var rb=S.runwayBand; var col=rb===3?'#ff6b5a':rb===2?'#ffc857':'#5be3a1';
    ctx.fillStyle=col; ctx.font='bold 7.5px monospace'; ctx.fillText('RUNWAY '+(S.runwayTxt||'--'),6,13);
    ctx.fillStyle='#9fd0ff'; ctx.fillText('MRR '+(S.mrrTxt||'$0'),6,23);
    var hist=S.hist||[]; if(hist.length>1){ var mx=Math.max.apply(null,hist)||1; ctx.strokeStyle='#5be3a1'; ctx.lineWidth=1.2; ctx.beginPath(); var x0=ww*0.5, wd=ww-x0-6, y1=hh-6, ht=hh-30; hist.forEach(function(v,i){ var px=x0+wd*i/(hist.length-1), py=y1-ht*(v/mx); if(i) ctx.lineTo(px,py); else ctx.moveTo(px,py); }); ctx.stroke(); }
    if(h>1){ ctx.fillStyle='#7f8aa3'; ctx.font='6px sans-serif'; ctx.fillText(S.tvLine||'',6,hh-6); }
  });
}
function drawRoadmap(u0,w){
  var S=sc.state, q=S.queue||[], ww=w*36;
  wall('y',0,u0*36,2.9*28,function(){
    ctx.fillStyle='#fffdf6'; ctx.fillRect(0,0,ww,40); ctx.fillStyle=S.brand||'#4c6ef5'; ctx.fillRect(0,0,ww,8); ctx.fillStyle='#fff'; ctx.font='bold 6px sans-serif'; ctx.fillText('ROADMAP',3,6.3);
    q.slice(0,3).forEach(function(it,i){ var y=12+i*9; ctx.fillStyle='#2a3350'; ctx.font='5.5px sans-serif'; ctx.fillText(String(it.n).slice(0,w>1.2?14:10),3,y+3.5); ctx.fillStyle='#e3e8f2'; ctx.fillRect(3,y+4.5,ww-6,2.2); ctx.fillStyle='#2f9e6e'; ctx.fillRect(3,y+4.5,(ww-6)*it.p,2.2); });
    if(!q.length){ ctx.fillStyle='#9aa0ad'; ctx.font='italic 5.5px sans-serif'; ctx.fillText('nothing queued',3,22); }
    ctx.fillStyle='#2f9e6e'; for(var k=0;k<Math.min(S.shipped||0,ww/6-1);k++) ctx.fillRect(3+k*6,34,4.5,4);
    ctx.strokeStyle='#8a8f98'; ctx.lineWidth=1.2; ctx.strokeRect(0,0,ww,40);
  });
}
function drawDecor(wins){
  var st=sc.st, W=sc.W, H=sc.H, key=sc.key;
  if(key==='garage'){
    drawRoadmap(5.85,1.05);
    ctx.save(); for(var i2=0;i2<14;i2++){ var u=0.2+i2*(W-0.4)/13, a=P(u,0.05,H-0.35+0.12*Math.sin(i2*1.7)); var cc=['#ff6b6b','#ffd166','#4ecdc4','#a78bfa'][i2%4]; ctx.globalAlpha=0.9; ell(a[0],a[1],2.6*cam.s,2.6*cam.s,cc); ctx.globalAlpha=0.22; ell(a[0],a[1],7*cam.s,7*cam.s,cc); ctx.globalAlpha=1; }
    for(var i3=0;i3<10;i3++){ var v=0.2+i3*(sc.D-0.4)/9, b=P(0.05,v,H-0.35+0.1*Math.sin(i3*1.9)); var c3=['#ffd166','#ff6b6b','#4ecdc4','#a78bfa'][i3%4]; ctx.globalAlpha=0.9; ell(b[0],b[1],2.6*cam.s,2.6*cam.s,c3); ctx.globalAlpha=0.22; ell(b[0],b[1],7*cam.s,7*cam.s,c3); ctx.globalAlpha=1; } ctx.restore();
  } else {
    drawRoadmap(st.poster,1.3);
    wall('x',0,(sc.D-0.2)*36,2.6*28,function(){ ctx.fillStyle='#fff7e1'; ctx.fillRect(0,0,40,22); ctx.fillStyle='#2a3350'; ctx.font='bold 7px sans-serif'; ctx.fillText('TALK TO',3,9); ctx.fillText('CUSTOMERS',3,18); ctx.strokeStyle='#999'; ctx.strokeRect(0,0,40,22); });
  }
}

/* ------------------------------------------------------------ props (drawn in depth order) */
var DRAW={};
DRAW.crates=function(o){ shadowAt(o.x,o.y,o.w,o.d); box(o.x,o.y,0,o.w,o.d,0.55,'#b88a4e'); box(o.x+0.05,o.y+0.05,0.55,o.w-0.1,o.d-0.1,0.4,'#c69a5c'); };
DRAW.counter=function(o){ shadowAt(o.x,o.y,o.w,o.d); box(o.x,o.y,0,o.w,o.d,0.95,'#7a5a3a'); box(o.x-0.04,o.y-0.04,0.95,o.w+0.08,o.d+0.08,0.08,'#d9d4c8');
  box(o.x+0.15,o.y+0.25,1.03,0.5,0.5,0.4,'#c9ced6'); box(o.x+0.2,o.y+0.32,1.43,0.4,0.36,0.1,'#b23a3a'); box(o.x+0.3,o.y+0.85,1.03,0.2,0.2,0.2,'#2d3340');
  var by=o.y+o.d-0.5; box(o.x+0.15,o.y+o.d-0.45,1.03,0.14,0.14,0.14,'#f4f1ea'); box(o.x+0.4,o.y+o.d-0.5,1.03,0.14,0.14,0.14,'#f4f1ea');
  if(Math.floor(wallClock*2)%4<3){ var a=P(o.x+0.4,o.y+0.5,1.5); ctx.strokeStyle='rgba(255,255,255,.75)'; ctx.lineWidth=1.3; ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.quadraticCurveTo(a[0]+3*cam.s,a[1]-7*cam.s,a[0]-1*cam.s,a[1]-14*cam.s-(wallClock*6%4)); ctx.stroke(); }
  [0.4,1.2].forEach(function(yy){ if(yy<o.d) { box(o.x+o.w+0.05,o.y+yy,0,0.3,0.3,0.12,'#3b4252'); box(o.x+o.w+0.17,o.y+yy+0.12,0.12,0.06,0.06,0.45,'#555'); box(o.x+o.w+0.05,o.y+yy,0.57,0.3,0.3,0.07,'#c26a5a'); } }); };
DRAW.nappod=function(o){ shadowAt(o.x,o.y,o.w,o.d); box(o.x,o.y,0,o.w,o.d,0.35,'#e8ecf2'); box(o.x+0.05,o.y+0.05,0.35,o.w-0.1,o.d-0.1,0.45,'#6fa8dc'); box(o.x,o.y,0.8,o.w,o.d,0.12,'#e8ecf2');
  vrect('y',o.y+o.d,o.x+0.15,o.x+o.w-0.15,0.45,0.72,'rgba(200,230,255,.55)'); var glow=0.5+0.4*Math.sin(wallClock*1.4); var a=P(o.x+o.w/2,o.y+o.d/2,0.9); ctx.globalAlpha=0.35*glow; ell(a[0],a[1]-2,10*cam.s,6*cam.s,'#9fd0ff'); ctx.globalAlpha=1;
  if(Math.floor(wallClock/2)%2===0){ var z=P(o.x+o.w/2,o.y+o.d,1.15); ctx.fillStyle='rgba(60,80,130,.8)'; ctx.font='bold '+Math.round(9*cam.s)+'px sans-serif'; ctx.fillText('z',z[0]+(wallClock*3%6),z[1]-(wallClock*5%8)); } };
DRAW.deck=function(o){ for(var i=0;i<Math.floor(o.w/0.4);i++) box(o.x+i*0.4,o.y,0,0.38,o.d,0.07,(i%2)?'#b98a56':'#c99a66'); };
DRAW.umbrella=function(o){ shadowAt(o.x,o.y,o.w,o.d,0.12); box(o.x+o.w/2-0.03,o.y+o.d/2-0.03,0.07,0.06,0.06,1.5,'#777'); var c=P(o.x+o.w/2,o.y+o.d/2,1.6); ctx.beginPath(); ctx.ellipse(c[0],c[1],26*cam.s,12*cam.s,0,Math.PI,0); ctx.closePath(); ctx.fillStyle='#ff7a59'; ctx.fill(); ctx.strokeStyle='rgba(0,0,0,.2)'; ctx.stroke();
  box(o.x+0.05,o.y+o.d-0.1,0.07,0.5,0.2,0.18,'#f4efe6'); };
DRAW.coffee=function(o){
  shadowAt(o.x,o.y,o.w,o.d);
  if(o.lvl>=2&&!o.crate){ box(o.x,o.y,0,o.w,o.d,0.75,'#e8e6df'); var zq=0.75; box(o.x+0.06,o.y+0.08,zq,0.55,0.46,0.5,'#c9ced6'); box(o.x+0.06,o.y+0.08,zq+0.5,0.55,0.46,0.1,'#b23a3a'); box(o.x+0.14,o.y+0.46,zq+0.2,0.1,0.1,0.18,'#2d3340'); box(o.x+0.38,o.y+0.46,zq+0.2,0.1,0.1,0.18,'#2d3340');
    box(o.x+0.68,o.y+0.28,zq,0.14,0.14,0.14,'#f4f1ea'); if(Math.floor(wallClock*2)%4<3){ var a2=P(o.x+0.32,o.y+0.3,zq+0.62); ctx.strokeStyle='rgba(255,255,255,.75)'; ctx.lineWidth=1.3; ctx.beginPath(); ctx.moveTo(a2[0],a2[1]); ctx.quadraticCurveTo(a2[0]+3*cam.s,a2[1]-7*cam.s,a2[0]-1*cam.s,a2[1]-14*cam.s-(wallClock*6%4)); ctx.stroke(); } return; } box(o.x,o.y,0,o.w,o.d,o.crate?0.5:0.75,o.crate?'#b88a4e':'#e8e6df');
  var z=o.crate?0.5:0.75; box(o.x+0.1,o.y+0.1,z,0.38,0.34,0.42,'#2d3340'); box(o.x+0.14,o.y+0.18,z+0.28,0.3,0.12,0.08,'#6a7385');
  box(o.x+0.52,o.y+0.28,z,0.14,0.14,0.14,'#f4f1ea');
  if(Math.floor(wallClock*2)%4<3){ var a=P(o.x+0.59,o.y+0.35,z+0.2); ctx.strokeStyle='rgba(255,255,255,.7)'; ctx.lineWidth=1.2; ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.quadraticCurveTo(a[0]+3*cam.s,a[1]-6*cam.s,a[0]-1*cam.s,a[1]-12*cam.s-(wallClock*6%4)); ctx.stroke(); }
};
DRAW.fridge=function(o){ shadowAt(o.x,o.y,o.w,o.d); var h=o.mini?0.9:1.7; box(o.x,o.y,0,o.w,o.d,h,'#d9dee6'); vrect('y',o.y+o.d,o.x+o.w*0.82,o.x+o.w*0.9,h*0.35,h*0.75,'#8c95a5'); vrect('y',o.y+o.d,o.x+0.04,o.x+o.w-0.04,h*0.62,h*0.63,'rgba(0,0,0,.25)'); };
DRAW.printer=function(o){ shadowAt(o.x,o.y,o.w,o.d); box(o.x,o.y,0,o.w,o.d,0.55,'#b9bfc9'); box(o.x+0.05,o.y+0.05,0.55,o.w-0.1,o.d-0.1,0.2,'#e6e9ee'); };
DRAW.plant=function(o){
  var sz=o.sz||1; shadowAt(o.x,o.y,0.5,0.5); box(o.x+0.08,o.y+0.08,0,0.34,0.34,0.3,'#c4764a'); var sw=Math.sin(wallClock*1.3+o.x)*0.015;
  for(var i=0;i<6;i++){ var a=i*1.05, lx=o.x+0.25+Math.cos(a)*0.12, ly=o.y+0.25+Math.sin(a)*0.12; box(lx-0.07+sw,ly-0.07,0.3+0.1*(i%3),0.14,0.14,0.42*sz,(i%2)?'#3d9a5e':'#52b46f'); }
  box(o.x+0.19+sw,o.y+0.19,0.3+0.5*sz,0.12,0.12,0.2*sz,'#6fcf8a');
};
DRAW.rack=function(o){
  var S=sc.state; shadowAt(o.x,o.y,o.w,o.d); box(o.x,o.y,0,o.w,o.d,1.9,'#2d323d'); var inc=S.incident; if(o.glow&&!inc){ var ga=P(o.x+o.w/2,o.y+o.d,1.0); ctx.globalAlpha=0.18+0.08*Math.sin(wallClock*2); ell(ga[0],ga[1],16*cam.s,22*cam.s,'#5b9bff'); ctx.globalAlpha=1; }
  for(var i=0;i<7;i++){ var zz=0.15+i*0.24; vrect('y',o.y+o.d,o.x+0.08,o.x+o.w-0.08,zz,zz+0.16,'#1a1e27'); var on=(Math.floor(wallClock*3+i*1.7)%3)>0; vrect('y',o.y+o.d,o.x+0.12,o.x+0.22,zz+0.05,zz+0.1,inc?'#ff4d4d':(on?'#5be3a1':'#2f6f58')); vrect('y',o.y+o.d,o.x+0.28,o.x+0.36,zz+0.05,zz+0.1,(Math.floor(wallClock*5+i)%2)?'#ffc857':'#6b5a2a'); }
  if(inc){ var a=P(o.x+o.w/2,o.y+o.d/2,2.0); ctx.globalAlpha=0.35+0.2*Math.sin(wallClock*8); ell(a[0],a[1]-4,14*cam.s,10*cam.s,'#555'); ctx.globalAlpha=1; }
};
DRAW.mtable=function(o){ shadowAt(o.x,o.y,o.w,o.d); box(o.x+0.2,o.y+0.2,0,0.3,o.d-0.4,0.7,'#4a4f5c'); box(o.x+o.w-0.5,o.y+0.2,0,0.3,o.d-0.4,0.7,'#4a4f5c'); box(o.x,o.y,0.7,o.w,o.d,0.1,'#d8c7a6');
  if(sc.state.sheetLive){ var p=P(o.x+o.w/2,o.y+o.d/2,0.82); ctx.fillStyle='#fff'; poly([[p[0]-9*cam.s,p[1]],[p[0],p[1]-5*cam.s],[p[0]+9*cam.s,p[1]],[p[0],p[1]+5*cam.s]],'#fffdf4','#999'); ctx.fillStyle='#2e9b6b'; ctx.font='bold '+Math.round(9*cam.s)+'px sans-serif'; ctx.fillText('$',p[0]-3*cam.s,p[1]+3*cam.s); } };
DRAW.couch=function(o){ shadowAt(o.x,o.y,o.w,o.d); box(o.x,o.y,0,o.w,o.d,0.4,'#c26a5a'); box(o.x,o.y,0.4,o.w,0.28,0.5,'#b25a4a'); box(o.x,o.y,0.4,0.22,o.d,0.28,'#b25a4a'); box(o.x+o.w-0.22,o.y,0.4,0.22,o.d,0.28,'#b25a4a'); };
DRAW.pingpong=function(o){ shadowAt(o.x,o.y,o.w,o.d); box(o.x+0.15,o.y+0.1,0,0.1,0.1,0.7,'#444'); box(o.x+o.w-0.25,o.y+o.d-0.2,0,0.1,0.1,0.7,'#444'); box(o.x+0.15,o.y+o.d-0.2,0,0.1,0.1,0.7,'#444'); box(o.x+o.w-0.25,o.y+0.1,0,0.1,0.1,0.7,'#444'); box(o.x,o.y,0.7,o.w,o.d,0.07,'#2f7bd0'); box(o.x+o.w/2-0.02,o.y,0.77,0.04,o.d,0.14,'#f4f4f4');
  var t=wallClock*1.6, bx=o.x+o.w/2+Math.sin(t)*o.w*0.4, bz=0.9+Math.abs(Math.sin(t*2))*0.35; var a=P(bx,o.y+o.d/2,bz); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(a[0],a[1],2.2*cam.s,0,6.3); ctx.fill(); };
DRAW.mchair=function(o){ drawChair(o.x+0.27,o.y+0.27,o.dir,'#4a5a8a'); };
DRAW.beanbag=function(o){ shadowAt(o.x,o.y,o.w,o.d); box(o.x,o.y,0,o.w,o.d,0.4,o.c||'#e86a92'); };

/* desks */
function deskStyle(){ var k=sc.key; if(sc.state.shop&&sc.state.shop.execdesks) return {top:'#5a3b26',leg:'#22262e',thick:0.09,exec:true}; return k==='garage'?{top:'#d3b98b',leg:'#8a6b3e',thick:0.08}: k==='studio'?{top:'#f1ece2',leg:'#c9c2b4',thick:0.07}: k==='office'?{top:'#e4e0d6',leg:'#4a5060',thick:0.07}:{top:'#8a5a3a',leg:'#2a2f3a',thick:0.08}; }
function drawScreen(occ,u0,sy,v1,mw,crt,idx){
  var rl=occ.role, tt=wallClock+idx*1.7;
  wall('y',sy,u0*36,v1*28,function(){
    var ww=(mw-0.1)*36, hh=(crt?0.36:0.34)*28; var bgc=(rl==='eng')?'#0f1c2e':(rl==='design')?'#f4f1ff':(rl==='ae'||rl==='sdr'||rl==='mkt')?'#eef7f2':'#10223a'; if(idx>0) bgc=(idx===1?'#0e1a24':'#161226'); ctx.fillStyle=bgc; ctx.fillRect(0,0,ww,hh);
    var n=5, flash=occ.flash>0&&idx===0;
    if(flash){ ctx.fillStyle='#26c281'; ctx.fillRect(0,0,ww,hh); ctx.fillStyle='#fff'; ctx.font='bold 8px sans-serif'; ctx.fillText('SHIPPED',3,hh/2+3); }
    else if(idx>0){ ctx.strokeStyle=idx===1?'#5be3a1':'#ffb34d'; ctx.lineWidth=1.3; ctx.beginPath(); for(var q=0;q<9;q++){ var px=3+q*(ww-6)/8, py=hh-4-((Math.sin(q*0.9+tt*0.5+idx)+1.3)/2.6)*(hh-8); if(q) ctx.lineTo(px,py); else ctx.moveTo(px,py); } ctx.stroke(); for(var r=0;r<3;r++){ ctx.fillStyle='rgba(255,255,255,.35)'; ctx.fillRect(3,3+r*4,ww*0.3*(0.5+0.5*rnd01(r+idx*3)),1.6); } }
    else if(rl==='design'){ for(var i=0;i<4;i++){ ctx.fillStyle=['#ff7aa2','#7aa8ff','#ffd166','#6fcf97'][i]; ctx.fillRect(4+i*12+(Math.sin(tt*2+i)*2),5+i*3,9,9); } }
    else if(rl==='sdr'||rl==='ae'||rl==='mkt'||rl==='cs'){ ctx.strokeStyle='#26a37a'; ctx.lineWidth=1.4; ctx.beginPath(); for(var j=0;j<10;j++){ var px2=3+j*(ww-6)/9, py2=hh-4-((Math.sin(j*0.7+tt*0.4)+1.4)/2.6)*(hh-8)*(0.4+0.6*j/9); if(j) ctx.lineTo(px2,py2); else ctx.moveTo(px2,py2); } ctx.stroke(); }
    else { for(var k=0;k<n;k++){ var len=(0.3+0.6*rnd01(k*5+Math.floor(tt*1.4+k)))*ww*0.8; ctx.fillStyle=['#7ee0a8','#7fb4ff','#ffd479','#c79bff','#8fd3e8'][k%5]; ctx.fillRect(4+(k%2)*5,3+k*5.4,len,2.6); } }
  });
}
function drawDesk(d){
  var sd=deskStyle(), x=d.x, y=d.y, w=d.w, dd=d.d; var S=sc.state; var era=sc.era; var sh=S.shop||{};
  /* standing desks glide up and down on their own */
  var dh=0.7; if(sh.standing||sh.execdesks){ dh=0.7+0.3*(0.5+0.5*Math.sin(wallClock*0.35+d.t*1.3)); }
  shadowAt(x,y,w,dd,0.18);
  /* legs */
  [[x+0.06,y+0.06],[x+w-0.14,y+0.06],[x+0.06,y+dd-0.14],[x+w-0.14,y+dd-0.14]].forEach(function(p){ box(p[0],p[1],0,0.08,0.08,dh,sd.leg,{stroke:'rgba(30,25,45,.2)'}); });
  box(x,y,dh,w,dd,sd.thick,sd.top);
  var z=dh+sd.thick, occ=d.who;
  /* monitors on the far (back) side, screens face +y. One, two (Big monitors) or three (Video wall) */
  var crt=(era==='1999')||(era==='2008'&&sc.key==='garage');
  var nScr=crt?1:(sh.monitors2?3:(sh.monitors?2:1));
  var sw=crt?0.8:(nScr===3?0.52:(nScr===2?0.7:0.8)), gap=crt?0:(nScr===3?0.06:(nScr===2?0.08:0)); var total=nScr*sw+(nScr-1)*gap; var mx0=x+(w-total)/2;
  for(var si=0;si<nScr;si++){
    var mx=mx0+si*(sw+gap), mw=sw;
    if(crt){ box(mx+0.1,y+0.12,z,mw-0.2,0.5,0.06,'#c9c4b6'); box(mx,y+0.12,z+0.06,mw,0.5,0.55,'#d6d1c2'); vrect('y',y+0.62,mx+0.07,mx+mw-0.07,z+0.14,z+0.55,'#13223a'); }
    else { box(mx+mw/2-0.12,y+0.2,z,0.24,0.14,0.05,'#6b7280'); box(mx+mw/2-0.04,y+0.24,z+0.05,0.08,0.06,0.2,'#6b7280'); box(mx,y+0.2,z+0.22,mw,0.06,0.42,'#262a33'); vrect('y',y+0.26,mx+0.03,mx+mw-0.03,z+0.25,z+0.61,'#101a2c'); }
    var sy=crt?y+0.62:y+0.26;
    if(occ){ drawScreen(occ,mx+0.05,sy,z+(crt?0.52:0.6),mw,crt,si); }
  }
  if(nScr>1 && occ){ var gl=P(x+w/2,y+0.3,z+0.4); ctx.globalAlpha=0.10; ell(gl[0],gl[1],34*cam.s,14*cam.s,'#7fb4ff'); ctx.globalAlpha=1; }
  /* keyboard, mug, lamp */
  box(x+0.5,y+0.7,z,0.7,0.22,0.03,'#4b5160'); box(x+w-0.35,y+0.42,z,0.14,0.14,0.15,'#fff',{stroke:'rgba(30,25,45,.25)'});
  if(d.t%3===0){ box(x+0.1,y+0.18,z,0.2,0.2,0.05,'#555'); box(x+0.17,y+0.25,z+0.05,0.05,0.05,0.4,'#666'); box(x+0.1,y+0.18,z+0.4,0.2,0.18,0.1,'#ffd966'); }
  if(d.t%4===1){ box(x+0.12,y+0.35,z,0.22,0.22,0.1,'#c4764a'); box(x+0.16,y+0.39,z+0.1,0.14,0.14,0.25,'#52b46f'); }
  if(sd.exec){ box(x+w-0.5,y+0.2,z,0.18,0.18,0.05,'#2b6b4a'); box(x+w-0.43,y+0.27,z+0.05,0.04,0.04,0.3,'#8a8f98'); box(x+w-0.55,y+0.2,z+0.35,0.3,0.14,0.07,'#1f9a63'); }
  if(d.req){ /* hiring sign */
    var a=P(x+w/2,y+dd+0.2,0.95); ctx.save(); ctx.translate(a[0],a[1]); ctx.fillStyle='#fff8dc'; rrect(-24*cam.s,-9*cam.s,48*cam.s,17*cam.s,3*cam.s); ctx.fill(); ctx.strokeStyle='#c9a227'; ctx.lineWidth=1.2; ctx.stroke(); ctx.fillStyle='#8a6a00'; ctx.font='bold '+Math.round(9*cam.s)+'px sans-serif'; ctx.textAlign='center'; ctx.fillText('HIRING',0,3*cam.s); ctx.restore();
  }
}
function chairColor(){ var sh=sc.state.shop||{}; return sh.execdesks?'#2b2b31':(sh.chairs?'#1f9a8a':'#3b4252'); }
function drawChair(cx,cy,dir,col){
  var c=col||chairColor(); var x=cx-0.27,y=cy-0.27;
  box(cx-0.04,cy-0.04,0,0.08,0.08,0.32,'#555',{stroke:'rgba(0,0,0,.2)'}); box(x,y,0.32,0.54,0.54,0.09,c);
  if(dir===3){ box(x,y+0.46,0.41,0.54,0.08,0.5,c); if(sc.state.shop&&(sc.state.shop.chairs||sc.state.shop.execdesks)){ box(x+0.12,y+0.46,0.91,0.3,0.08,0.18,c); box(x-0.06,y+0.12,0.58,0.06,0.34,0.05,'#222'); box(x+0.54,y+0.12,0.58,0.06,0.34,0.05,'#222'); } } else if(dir===2) box(x+0.46,y,0.41,0.08,0.54,0.5,c); else if(dir===0) box(x,y,0.41,0.08,0.54,0.5,c); else box(x,y,0.41,0.54,0.08,0.5,c);
}

/* ------------------------------------------------------------ people */
function drawPerson(p){
  var look=p.look||{skin:1,hair:0,color:0,f:false}; var skin=SKIN[look.skin%5], hair=HAIR[look.hair%6]; var shirt=p.shirt||ROLECOL[p.role]||SHIRT[look.color%8];
  var pants=p.pants||'#37405a'; var dir=p.dir|0; var x=p.x, y=p.y; var sit=p.mode==='sit'; var walk=p.mode==='walk';
  var ph=p.ph||0; var sw=walk? Math.sin(ph*9)*0.11 : 0; var bob=walk? Math.abs(Math.sin(ph*9))*0.03 : (sit?0:Math.sin(wallClock*1.6+ph)*0.006);
  var fx=(dir===0?1:dir===2?-1:0), fy=(dir===1?1:dir===3?-1:0);   /* facing vector */
  var tw=(fx!==0)?0.2:0.34, td=(fx!==0)?0.34:0.2;               /* torso footprint */
  var zh=sit?0.46:0.44;                                           /* hip height */
  /* shadow */
  ctx.globalAlpha=0.2; var sp=P(x,y,0); ell(sp[0],sp[1]+1,13*cam.s,6*cam.s,'#1a1030'); ctx.globalAlpha=1;
  /* legs */
  var lw=0.13;
  if(sit){
    var ox=fx*0.14, oy=fy*0.14; /* thighs forward */
    [-1,1].forEach(function(sd){ var lx=x+(fx!==0?0:sd*0.09)-lw/2+fx*0.17, ly=y+(fy!==0?0:sd*0.09)-lw/2+fy*0.17; var tx=x+(fx!==0?0:sd*0.09)-lw/2+ox*0.2, ty=y+(fy!==0?0:sd*0.09)-lw/2+oy*0.2;
      /* shin */ box(lx,ly,0.06,lw,lw,zh-0.06,pants); box(tx,ty,zh-0.1,lw,lw,0.12,pants); box(tx+fx*0.15+ (fx<0?-0.05:0),ty+fy*0.15+(fy<0?-0.05:0),zh-0.1,lw+Math.abs(fx)*0.05,lw+Math.abs(fy)*0.05,0.12,pants); });
  } else {
    var order=(dir===0||dir===3)? [1,-1]:[-1,1];
    [-1,1].forEach(function(sd,i){ var off=(sd===1?sw:-sw); var lx=x+(fx!==0?off*fx:sd*0.085)-lw/2, ly=y+(fy!==0?off*fy:sd*0.085)-lw/2; box(lx,ly,bob,lw,lw,zh,pants); ell.length; });
  }
  /* torso */
  var tz=zh+bob+(sit?0.02:0); box(x-tw/2,y-td/2,tz,tw,td,0.38,shirt);
  /* arms */
  var armSw=walk?Math.sin(ph*9)*0.09:0; var typ=(sit&&p.typing)?Math.sin(wallClock*14+ph)*0.03:0;
  [-1,1].forEach(function(sd){
    var ax=x+(fx!==0?0:sd*(tw/2+0.05))-0.045+(fx!==0? -armSw*sd*fx: 0)+(sit?fx*0.18:0), ay=y+(fy!==0?0:sd*0+0)-0.045;
    if(fx!==0){ ay=y+sd*(td/2+0.05)-0.045; } else { ay=y-0.045+(walk? -armSw*sd*fy : 0)+(sit?fy*0.18:0); }
    var ah=sit?0.28:0.34, az=tz+0.38-ah+(sit?typ*sd:0);
    box(ax,ay,az,0.09,0.09,ah,shirt,{stroke:'rgba(30,25,45,.2)'});
    box(ax,ay,az-0.05,0.09,0.09,0.06,skin,{stroke:'rgba(30,25,45,.2)'});
  });
  /* head */
  var hz=tz+0.38+0.01; var hs=0.27; var hx=x-hs/2, hy=y-hs/2; var fsk=faces(skin);
  var back=(fx===-1||fy===-1);   /* facing away: we see the back of the head */
  var faceOpts={};
  if(dir===2){ faceOpts.fr=faces(hair).right; faceOpts.fl=fsk.left; }       /* +x face is the back of head */
  if(dir===3){ faceOpts.fl=faces(hair).left; faceOpts.fr=fsk.right; }       /* +y face is the back */
  box(hx,hy,hz,hs,hs,hs,skin,faceOpts);
  /* hair cap */
  var hh2=look.f?0.1:0.07; box(hx-0.015,hy-0.015,hz+hs-hh2+0.02,hs+0.03,hs+0.03,hh2,hair);
  if(look.f){ if(dir===2) box(hx+hs-0.01,hy,hz-0.05,0.07,hs,hs*0.9,hair); else if(dir===3) box(hx,hy+hs-0.01,hz-0.05,hs,0.07,hs*0.9,hair); else if(dir===0||dir===1){ box(hx-0.05*(dir===1?0:1),hy-0.05*(dir===0?0:1),hz-0.04,(dir===1?hs:0.06),(dir===0?hs:0.06),hs*0.8,hair); } }
  if(p.hat){ box(hx-0.03,hy-0.03,hz+hs-0.02,hs+0.06,hs+0.06,0.07,p.hat); }
  /* face */
  if(dir===0){ vrect('x',hx+hs,hy+0.06,hy+0.11,hz+0.14,hz+0.2,'#1a1a24'); vrect('x',hx+hs,hy+0.17,hy+0.22,hz+0.14,hz+0.2,'#1a1a24'); if(p.talk){ vrect('x',hx+hs,hy+0.1,hy+0.18,hz+0.05,hz+0.08,'#7a2a2a'); } }
  else if(dir===1){ vrect('y',hy+hs,hx+0.06,hx+0.11,hz+0.14,hz+0.2,'#1a1a24'); vrect('y',hy+hs,hx+0.17,hx+0.22,hz+0.14,hz+0.2,'#1a1a24'); if(p.talk){ vrect('y',hy+hs,hx+0.1,hx+0.18,hz+0.05,hz+0.08,'#7a2a2a'); } }
  if(p.tired){ if(dir===0) vrect('x',hx+hs,hy+0.05,hy+0.23,hz+0.1,hz+0.12,'rgba(100,60,120,.45)'); else if(dir===1) vrect('y',hy+hs,hx+0.05,hx+0.23,hz+0.1,hz+0.12,'rgba(100,60,120,.45)'); }
  /* accessories */
  if(p.mug){ var m=P(x+fx*0.2+0.05,y+fy*0.2+0.05,tz+0.18); box(x+fx*0.22,y+fy*0.22,tz+0.12,0.1,0.1,0.12,'#fff'); }
  if(p.carry){ box(x+fx*0.26-0.12,y+fy*0.26-0.12,tz+0.02,0.3,0.3,0.24,'#c69a5c'); }
  if(p.star){ var sp2=P(x,y,hz+hs+0.35+Math.sin(wallClock*3)*0.03); ctx.fillStyle='#ffb703'; ctx.beginPath(); ctx.moveTo(sp2[0],sp2[1]-5*cam.s); ctx.lineTo(sp2[0]+4*cam.s,sp2[1]+3*cam.s); ctx.lineTo(sp2[0]-4*cam.s,sp2[1]+3*cam.s); ctx.closePath(); ctx.fill(); }
  if(showLabels&&(p.kind==='emp'||p.kind==='you'||p.kind==='co')&&!p.leaving){ var lp=P(x,y,hz+hs+0.16); var role=p.kind==='you'?'YOU':(p.kind==='co'?'COFOUNDER':(ROLEABBR[p.role]||'')); var fn=(p.name||'').split(' ')[0]; var txt=role+(fn&&p.kind==='emp'?' \u00b7 '+fn:''); var fs=Math.max(8,Math.round(8.5*cam.s)); ctx.save(); ctx.font='bold '+fs+'px sans-serif'; var tw2=ctx.measureText(txt).width+10; var bx=lp[0]-tw2/2, by=lp[1]-fs-5; ctx.globalAlpha=0.93; ctx.fillStyle=p.kind==='you'?'#f2b01e':(p.kind==='co'?'#8b5cf6':(ROLECOL[p.role]||'#556')); rrect(bx,by,tw2,fs+5,3); ctx.fill(); ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(txt,lp[0],by+(fs+5)/2+0.5); var en=p.src&&p.src.energy!=null?p.src.energy:null; if(en!==null){ ctx.fillStyle=en<35?'#ff5a4d':(en<60?'#ffc83d':'#5be3a1'); ctx.beginPath(); ctx.arc(bx+tw2-3,by+3,2.6,0,6.3); ctx.fill(); } ctx.restore(); }
  if(p.suit){ vrect(fx!==0?'x':'y',(fx!==0?x+td/2:y+td/2),(fx!==0?y-0.03:x-0.03),(fx!==0?y+0.03:x+0.03),tz+0.04,tz+0.34,'#c4352f'); }
}
/* sitting person on a chair */
function drawSeated(o){ drawChair(o.cx,o.cy,o.dir,o.chair); if(o.p) drawPerson(o.p); }

function drawDog(dg){
  var x=dg.x,y=dg.y,dir=dg.dir|0, fx=(dir===0?1:dir===2?-1:0), fy=(dir===1?1:dir===3?-1:0); var wag=Math.sin(wallClock*14)*0.05; var walk=dg.mode==='walk'; var sw=walk?Math.sin(dg.ph*14)*0.06:0; var gold='#d9a441', dark='#b9852c';
  ctx.globalAlpha=0.2; var sp=P(x,y,0); ell(sp[0],sp[1]+1,12*cam.s,5*cam.s,'#1a1030'); ctx.globalAlpha=1;
  if(dg.mode==='sleep'){ box(x-0.25,y-0.15,0,0.5,0.3,0.14,gold); box(x+0.16*(fx||1)-0.07,y-0.08,0.04,0.17,0.17,0.15,dark); return; }
  var bw=(fx!==0)?0.46:0.22, bd=(fx!==0)?0.22:0.46;
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(l){ var lx=x+(fx!==0? l[0]*0.17*fx*-1:l[1]*0.07)-0.04+(fx!==0?sw*l[1]:0), ly=y+(fy!==0? l[0]*0.17*fy*-1:l[1]*0.07)-0.04+(fy!==0?sw*l[1]:0); box(lx,ly,0,0.08,0.08,0.2,dark,{stroke:'rgba(0,0,0,.2)'}); });
  box(x-bw/2,y-bd/2,0.18,bw,bd,0.2,gold);
  box(x+fx*0.27-0.1,y+fy*0.27-0.1,0.3,0.2,0.2,0.18,gold); box(x+fx*0.38-0.04,y+fy*0.38-0.04,0.32,0.09,0.09,0.07,'#3a2a1a');
  box(x-fx*0.3-0.04+(fy!==0?wag:0),y-fy*0.3-0.04+(fx!==0?wag:0),0.28,0.08,0.08,0.18,dark);
}

/* ------------------------------------------------------------ scene update (people brains) */
function pathTo(p,target,via){
  var st=sc.st, a=[]; var bands=st.bands; var bx=p.x, by=p.y;
  /* the band in front of the current spot */
  function bandOf(y){ for(var i=0;i<bands.length;i++) if(bands[i]>y+0.05) return bands[i]; return bands[bands.length-1]; }
  var b1=(p.mode==='sit'||p.atSeat)? bandOf(p.y) : nearestBand(p.y);
  a.push({x:p.x,y:b1});
  var tb=(target.band!==undefined)?target.band:nearestBand(target.y);
  var ax=target.aisle!==undefined?target.aisle:(target.x<st.aisle+0.9? st.aisle : null);
  if(ax!==null){ a.push({x:ax,y:b1}); if(tb!==b1) a.push({x:ax,y:tb}); a.push({x:ax,y:target.y}); a.push({x:target.x,y:target.y}); }
  else { if(tb!==b1){ a.push({x:st.aisle,y:b1}); a.push({x:st.aisle,y:tb}); } a.push({x:target.x,y:tb}); if(Math.abs(target.y-tb)>0.01) a.push({x:target.x,y:target.y}); }
  return a;
}
function nearestBand(y){ var b=sc.st.bands, best=b[0], d=1e9; b.forEach(function(v){ var dd=Math.abs(v-y); if(dd<d){ d=dd; best=v; } }); return best; }
function doorPoint(){ var d=sc.st.door; if(d.kind==='garage') return {x:d.cx,y:0.45,aisle:d.cx,band:sc.st.bands[0]}; return {x:0.45,y:d.cy,aisle:sc.st.aisle,band:nearestBand(d.cy)}; }
function stepPerson(p,dt){
  if(p.mode==='walk' && p.path && p.path.length){
    var t=p.path[0], dx=t.x-p.x, dy=t.y-p.y, dist=Math.hypot(dx,dy), sp=(p.speed||1.5)*dt;
    if(dist<=sp){ p.x=t.x; p.y=t.y; p.path.shift(); if(!p.path.length){ p.mode=p.endMode||'stand'; p.dir=(p.endDir!==undefined)?p.endDir:p.dir; if(p.onArrive){ var f=p.onArrive; p.onArrive=null; f(p); } } }
    else { p.x+=dx/dist*sp; p.y+=dy/dist*sp; if(Math.abs(dx)>Math.abs(dy)) p.dir=dx>0?0:2; else p.dir=dy>0?1:3; }
    p.ph=(p.ph||0)+dt;
  }
}
function seatPerson(p,desk){ p.seatDesk=desk; p.x=desk.cx; p.y=desk.cy; p.dir=3; p.mode='sit'; p.atSeat=true; p.typing=true; }
function sendPerson(p,target,endMode,endDir,onArrive){
  if(p.mode==='walk') return;
  var route=pathTo(p,target); p.path=route; p.mode='walk'; p.atSeat=false; p.typing=false; p.endMode=endMode||'stand'; p.endDir=endDir; p.onArrive=onArrive; p.speed=1.45; p.ph=p.ph||0;
}
function goHome(p){
  var d=p.seatDesk; if(!d) return; var seat={x:d.cx,y:d.cy,band:undefined};
  var bandY=(function(){ var b=sc.st.bands; for(var i=0;i<b.length;i++) if(b[i]>d.cy+0.05) return b[i]; return b[b.length-1]; })();
  var route=[]; var cur=p;
  var nb=nearestBand(p.y); route.push({x:p.x,y:nb});
  if(Math.abs(nb-bandY)>0.01){ var ax=(p.x<sc.st.aisle+0.9)?p.x:sc.st.aisle; route.push({x:ax,y:nb}); route.push({x:ax,y:bandY}); }
  route.push({x:d.cx,y:bandY}); route.push({x:d.cx,y:d.cy});
  p.path=route; p.mode='walk'; p.atSeat=false; p.endMode='sit'; p.endDir=3; p.speed=1.45; p.onArrive=function(q){ q.atSeat=true; q.typing=true; q.carry=false; q.mug=false; };
}
var ACTIONS=['coffee','board','chat','rack','stretch'];
function brain(p,dt){
  if(p.kind!=='emp'&&p.kind!=='co'&&p.kind!=='you') return;
  if(p.mode==='sit'){ p.idle=(p.idle===undefined?4+Math.random()*10:p.idle)-dt; if(p.idle<=0 && !sc.noWander){ p.idle=10+Math.random()*16; if(p.kind==='you'&&Math.random()<0.6) return;
    var a=ACTIONS[Math.floor(Math.random()*ACTIONS.length)]; var tgt;
    if(a==='coffee'){ tgt=sc.stand.coffee; p.mug=true; sendPerson(p,{x:tgt.x,y:tgt.y,aisle:sc.st.aisle},'stand',3,function(q){ q.wait=2.5; q.after=function(){ goHome(q); }; }); }
    else if(a==='board'){ var b=sc.stand.board; sendPerson(p,{x:b.x,y:b.y,aisle:sc.st.aisle},'stand',2,function(q){ q.wait=3; q.after=function(){ goHome(q); }; }); }
    else if(a==='rack'&&sc.stand.rack&&sc.key!=='garage'){ var r=sc.stand.rack; sendPerson(p,{x:r.x,y:r.y,aisle:(r.x>sc.W-3?sc.W-1.3:undefined),band:nearestBand(r.y)},'stand',3,function(q){ q.wait=2; q.after=function(){ goHome(q); }; }); }
    else if(a==='chat'){ var others=sc.people.filter(function(o){ return o!==p&&o.seatDesk&&o.mode==='sit'; }); var o=others[Math.floor(Math.random()*others.length)]; if(o){ var bandY=nearestBand(o.seatDesk.cy+0.7); sendPerson(p,{x:o.seatDesk.cx+0.9,y:bandY,band:bandY},'stand',3,function(q){ q.talk=true; q.wait=3.2; q.after=function(){ q.talk=false; goHome(q); }; }); } }
    else { p.stretch=1.2; }
  } }
  else if(p.mode==='stand' && p.wait!==undefined){ p.wait-=dt; if(p.wait<=0){ p.wait=undefined; var f=p.after; p.after=null; if(f) f(); } }
}
function spawnVisitor(kind,opts){
  opts=opts||{}; var dp=doorPoint(); var v={id:'v'+Math.floor(Math.random()*1e9),kind:kind||'visitor',role:'visitor',look:{skin:Math.floor(Math.random()*5),hair:Math.floor(Math.random()*6),color:Math.floor(Math.random()*8),f:Math.random()<0.5},x:dp.x,y:dp.y,dir:sc.st.door.kind==='garage'?1:0,mode:'stand',visitor:true,pants:'#44506a'};
  if(kind==='investor'){ v.suit=true; v.shirt='#2a2f3a'; v.pants='#1e2230'; }
  if(kind==='customer'){ v.shirt=['#6aa7e0','#e07a5f','#81b29a','#f2cc8f'][Math.floor(Math.random()*4)]; }
  sc.visitors.push(v); return v;
}
function visitorJourney(v,mission){
  var dp=doorPoint(); var dir0=sc.st.door.kind==='garage'?1:0;
  v.x=dp.x; v.y=dp.y; v.mode='stand';
  var tgt=(mission==='board')? {x:sc.stand.board.x,y:sc.stand.board.y+0.6,aisle:sc.st.aisle} : (mission==='meet'? sc.stand.meet[(sc.visitors.indexOf(v))%sc.stand.meet.length] : sc.stand.meet[0]);
  var leaving=function(q){ q.wait=undefined; var d2=doorPoint(); q.path=null; sendPerson(q,{x:d2.x,y:d2.y,aisle:d2.aisle,band:d2.band},'stand',3,function(r){ r.gone=true; }); };
  v.atSeat=false; v.prevMode='stand';
  var b0=nearestBand(v.y);
  sendPerson(v,tgt,'stand',(mission==='board')?2:3,function(q){ q.wait=(mission==='meet')?9999:4.5; q.after=function(){ if(mission==='board'&&q.onNote) q.onNote(); leaving(q); }; if(mission==='board'&&q.onNote){ q.talk=true; } });
}
Iso.visitorsDone=function(){};


/* ------------------------------------------------------------ what you bought shows up in the room */
var AMEN={
  garage:{plants:[[0.15,2.7],[6.3,3.4]],rack:[6.2,2.4],logo:[0.2,4.6,1.0,0.8],couch:[0.05,4.9,0.65,1.5,'x'],beans:[[1.4,5.2],[2.0,5.1]],nap:[6.1,4.0],pong:null,counter:null,deck:null,trophy:[4.0,5.2]},
  studio:{plants:[[0.15,2.9],[8.45,1.3],[8.4,7.4]],rack:[8.3,1.2],logo:[0.15,4.5,1.5,1.1],couch:[0.5,7.0,1.9,0.7,'y'],beans:[[2.9,7.5],[3.6,7.6]],nap:[6.3,7.1],pong:null,counter:null,deck:null,trophy:[5.8,6.8]},
  office:{plants:[[0.15,4.4],[10.4,5.0],[10.3,9.0]],rack:[9.0,0.15],logo:[0.15,5.2,1.4,1.4],couch:[0.5,8.75,1.9,0.75,'y'],beans:[[3.0,9.15],[3.7,9.25]],nap:[9.0,8.9],pong:[5.0,8.75,2.4,1.1],counter:[0.2,2.0,0.85,1.9],deck:null,trophy:[7.0,8.4]},
  hq:    {plants:[[0.15,4.2],[12.3,5.0],[12.2,9.7]],rack:[11.0,0.15],logo:[0.15,6.0,1.5,1.5],couch:[0.5,9.45,2.1,0.75,'y'],beans:[[3.2,9.85],[3.9,9.95]],nap:[8.4,9.6],pong:[5.4,9.45,2.4,1.1],counter:[0.2,1.9,0.85,1.9],deck:[9.9,9.3,2.8,1.2],trophy:[7.9,9.2]}
};
Iso.AMEN=AMEN;
function applyShop(G){
  var s=sc, sh=G.shop||{}, A=AMEN[s.key]||AMEN.garage;
  s.props=s.props.filter(function(o){ return !o.shopId; });
  function add(id,o){ o.shopId=id; s.props.push(o); }
  s.props.forEach(function(o){ if(o.t==='coffee'){ o.lvl=sh.barista?3:(sh.espresso?2:1); } });
  if(sh.plants) A.plants.forEach(function(p){ add('plants',{t:'plant',x:p[0],y:p[1],sz:1.0}); });
  if(sh.mural) add('mural',{t:'rug',x:A.logo[0],y:A.logo[1],w:A.logo[2],d:A.logo[3],c:'#6c63d8',logo:true});
  if(sh.servers) add('servers',{t:'rack',x:A.rack[0],y:A.rack[1],w:0.8,d:0.75,glow:true});
  if(sh.lounge){ var c=A.couch; add('lounge',{t:'rug',x:c[0]-0.1,y:c[1]-0.1,w:Math.max(c[2],c[3])+3.0,d:Math.max(c[2],c[3])+0.8,c:'#c58a6a'}); s.props[s.props.length-1].w=(c[4]==='y'?c[2]+2.2:c[2]+0.5); s.props[s.props.length-1].d=(c[4]==='y'?c[3]+0.6:c[3]+0.5);
    add('lounge',{t:'couch',x:c[0],y:c[1],w:c[2],d:c[3]}); A.beans.forEach(function(b,i){ add('lounge',{t:'beanbag',x:b[0],y:b[1],w:0.62,d:0.62,c:['#e86a92','#4fb0c6'][i%2]}); }); }
  if(sh.gameroom&&A.pong) add('gameroom',{t:'pingpong',x:A.pong[0],y:A.pong[1],w:A.pong[2],d:A.pong[3]});
  if(sh.nap) add('nap',{t:'nappod',x:A.nap[0],y:A.nap[1],w:1.1,d:0.8});
  if(sh.barista&&A.counter) add('barista',{t:'counter',x:A.counter[0],y:A.counter[1],w:A.counter[2],d:A.counter[3]});
  if(sh.rooftop&&A.deck){ add('rooftop',{t:'deck',x:A.deck[0],y:A.deck[1],w:A.deck[2],d:A.deck[3]}); add('rooftop',{t:'umbrella',x:A.deck[0]+0.4,y:A.deck[1]+0.35,w:0.7,d:0.7}); add('rooftop',{t:'umbrella',x:A.deck[0]+1.7,y:A.deck[1]+0.35,w:0.7,d:0.7}); }
  s.hasTrophy=(S_lvl(G)>1);
}
function S_lvl(G){ return G.lvl||1; }

/* ------------------------------------------------------------ sync from game state */
Iso.sync=function(G,opts){
  opts=opts||{}; if(!cv) return;
  var key=stageFor(G);
  if(!sc){ sc=newScene(key,G); layoutCam(); populate(G,true); }
  else if(sc.key!==key && !opts.initial){ var want=key; startTransition(function(){ sc=newScene(want,G); layoutCam(); populate(G,true); }, STAGES[key].label); }
  else if(sc.key!==key){ sc=newScene(key,G); layoutCam(); populate(G,true); }
  else populate(G,false);
  updateState(G);
};
function updateState(G){
  var f=SU.fin(G), S=sc.state;
  S.name=G.name; S.brand=brandOf(G); S.cust=SU.custCount(G); S.mrr=G.mrr||0; S.mrrTxt=SU.fmtMoney(G.mrr||0);
  S.runway=f.runway; S.runwayTxt=f.burn<=0?'infinite':(f.runway>=99?'99+ mo':f.runway.toFixed(1)+' mo'); S.runwayBand=(f.burn<=0||f.runway>=9)?1:(f.runway>=3?2:3);
  S.lastStand=!!G.lastStand; S.hist=(G.mrrHist||[]).slice(-14); S.tvKey=S.hist.join(',')+'|'+S.runwayTxt+'|'+S.mrrTxt;
  S.tvLine=G.cash<0?'CASH NEGATIVE':'Cash '+SU.fmtMoney(G.cash);
  S.shop=G.shop||{}; S.lvl=G.lvl||1; S.shopKey=Object.keys(S.shop).sort().join(',')+'|L'+S.lvl; S.queue=G.queue.map(function(q){ return {n:q.name,p:q.scope?q.progress/q.scope:0}; }); S.shipped=G.shipped.length; S.rmKey=S.queue.map(function(q){ return q.n+Math.round(q.p*10); }).join('|')+'|'+S.shipped;
  S.hype=G.hype||0; S.sanity=G.founder.sanity; S.morale=G.morale; S.incident=(G.incidents>0&&G.flags&&G.flags.incidentT===G.t-1); S.sheetLive=!!(G.round&&G.round.sheets.some(function(s){ return s.state==='live'; }));
  var rv=G.rivals.filter(function(r){ return r.active&&r.presence>0.15; }).sort(function(a,b){ return b.presence-a.presence; })[0]; S.rival=rv?rv.presence:0; S.rivalName=rv?rv.name.toUpperCase().slice(0,9):'';
  S.sad=(f.runway<3&&f.burn>0)||G.founder.sanity<30; S.era=G.startKey;
  sc.era=G.startKey;
  applyShop(G);
}
function brandOf(G){ var m={smb:'#4c6ef5',consumer:'#e8590c',market:'#12b886'}; return m[G.arch]||'#4c6ef5'; }
function mkPerson(kind,src,role){
  var look=src&&src.look? src.look : {skin:1,hair:0,color:0,f:false};
  var p={id:src?src.id:'x',kind:kind,role:role||'eng',name:src?src.name:'',look:look,x:0,y:0,dir:3,mode:'sit',ph:Math.random()*6,src:src};
  if(kind==='you'){ p.shirt='#f2b01e'; p.star=true; p.look={skin:1,hair:0,color:0,f:false}; }
  if(kind==='co'){ p.shirt='#8b5cf6'; }
  return p;
}
function populate(G,fresh){
  var s=sc; var slots=s.slotList; var heads=[];
  /* people list in order: you, co, employees by join order */
  var order=[{id:'you',kind:'you',src:null}]; if(G.co) order.push({id:'co',kind:'co',src:G.co}); G.team.forEach(function(e){ order.push({id:e.id,kind:'emp',src:e}); });
  var existing={}; s.people.forEach(function(p){ existing[p.id]=p; });
  var keep=[]; var newOnes=[];
  var seatIdx=0;
  /* deskSlot assignment */
  slots.forEach(function(sl){ sl.who=null; sl.req=false; });
  order.forEach(function(o,i){
    var sl=slots[i]; var p=existing[o.id];
    if(!sl){ if(p) { p.hidden=true; keep.push(p); } return; }
    if(!p){ p=mkPerson(o.kind,o.src,o.kind==='emp'?o.src.role:(o.kind==='co'?'cos':'eng')); p.id=o.id; p.name=o.kind==='you'?(G.founder.name||'You'):o.src.name; if(o.kind==='co') p.role='pm'; if(o.kind==='you') p.role='eng'; newOnes.push(p); }
    p.hidden=false; p.src=o.src; p.name=o.kind==='you'?(G.founder.name||'You'):o.src.name; if(o.kind==='emp') p.role=o.src.role; if(o.kind==='emp') p.look=o.src.look||p.look; if(o.kind==='co') p.look=(o.src.look||p.look);
    sl.who=p; p.slot=sl; p.seatDesk=slotDesk(sl); keep.push(p);
    p.tired=(G.founder.sanity<35&&o.kind==='you')||(o.kind==='emp'&&o.src&&o.src.energy!=null&&o.src.energy<35);
  });
  /* people who left walk out */
  s.people.forEach(function(p){ if(!order.some(function(o){ return o.id===p.id; })){ if(!p.leaving){ p.leaving=true; p.carry=true; var d=doorPoint(); p.mode='stand'; sendPerson(p,{x:d.x,y:d.y,aisle:d.aisle,band:d.band},'stand',3,function(q){ q.gone=true; }); } keep.push(p); } });
  s.people=keep;
  /* hiring signs on empty desks */
  var open=G.reqs.length; for(var i=order.length;i<slots.length && open>0;i++){ slots[i].req=true; open--; }
  /* desks to show: occupied + req + 1 spare */
  var show=order.length+G.reqs.length+1; slots.forEach(function(sl,i){ sl.show=(i<Math.max(show,s.key==='garage'?2:3)); });
  /* place */
  if(fresh) s.people.forEach(function(p){ if(p.slot&&!p.leaving){ seatPerson(p,slotDesk(p.slot)); } });
  newOnes.forEach(function(p){ if(!fresh){ var dp=doorPoint(); p.x=dp.x; p.y=dp.y; p.mode='stand'; p.dir=sc.st.door.kind==='garage'?1:0; sendPerson(p,{x:p.slot.x+1,y:slotDesk(p.slot).cy,aisle:undefined,band:bandBefore(slotDesk(p.slot).cy)},'sit',3,function(q){ seatPerson(q,slotDesk(q.slot)); }); /* walk to the band then to the chair */ p.path=hirePath(p); } });
  /* dog */
  var hasDog=!!(G.shop&&G.shop.dog);
  if(hasDog && !s.dog){ s.dog={x:0.7,y:s.st.bands[s.st.bands.length-1],dir:1,mode:'sleep',ph:0,t:3}; }
  if(!hasDog) s.dog=null;
  if(s.dog && G.morale<30) s.dog.mode='sleep';
  s.hiddenCount=Math.max(0,order.length-slots.length);
  /* investors in the pipeline */
  syncInvestors(G);
}
function slotDesk(sl){ return {x:sl.x,y:sl.y,w:sl.w,d:sl.d,face:sl.face,cx:sl.x+1.0,cy:sl.y+1.58,slot:sl}; }
function bandBefore(y){ var b=sc.st.bands; for(var i=0;i<b.length;i++) if(b[i]>y+0.05) return b[i]; return b[b.length-1]; }
function hirePath(p){
  var d=slotDesk(p.slot), dp=doorPoint(); var by=bandBefore(d.cy); var route=[];
  if(sc.st.door.kind==='garage'){ route.push({x:dp.x,y:by}); route.push({x:d.cx,y:by}); route.push({x:d.cx,y:d.cy}); }
  else { route.push({x:sc.st.aisle,y:dp.y}); route.push({x:sc.st.aisle,y:by}); route.push({x:d.cx,y:by}); route.push({x:d.cx,y:d.cy}); }
  return route;
}
function syncInvestors(G){
  var want=[]; if(G.round){ G.round.pipe.forEach(function(pp){ if(pp.stage==='partner'||pp.stage==='sheet') want.push(pp.inv); }); }
  var have=sc.visitors.filter(function(v){ return v.kind==='investor'; });
  want.slice(0,3).forEach(function(id){ if(!have.some(function(v){ return v.inv===id; })){ var v=spawnVisitor('investor'); v.inv=id; visitorJourney(v,'meet'); } });
  have.forEach(function(v){ if(want.indexOf(v.inv)<0 && !v.leaveSent){ v.leaveSent=true; v.wait=undefined; var d=doorPoint(); sendPerson(v,{x:d.x,y:d.y,aisle:d.aisle,band:d.band},'stand',3,function(q){ q.gone=true; }); } });
}

/* ------------------------------------------------------------ frame loop */
function update(dt){
  wallClock+=dt;
  var S=sc.state;
  sc.people.forEach(function(p){ stepPerson(p,dt); brain(p,dt); if(p.flash>0) p.flash-=dt; if(p.stretch>0){ p.stretch-=dt; } });
  sc.visitors.forEach(function(p){ stepPerson(p,dt); if(p.mode==='stand' && p.wait!==undefined){ p.wait-=dt; if(p.wait<=0){ p.wait=undefined; var f=p.after; p.after=null; if(f) f(); } } });
  sc.people=sc.people.filter(function(p){ return !p.gone; }); sc.visitors=sc.visitors.filter(function(p){ return !p.gone; });
  /* ambient visitors */
  sc.visT=(sc.visT===undefined?8:sc.visT)-dt;
  if(sc.visT<=0){ sc.visT=14+Math.random()*30-(S.hype||0)*0.12; var cnt=sc.visitors.filter(function(v){ return v.kind!=='investor'; }).length; if(cnt<2 && (S.hype||0)>12){ var v=spawnVisitor('customer'); visitorJourney(v,'board'); } }
  /* dog */
  var dg=sc.dog; if(dg){ dg.t-=dt; if(dg.mode==='walk'){ var tg=dg.target; var dx=tg.x-dg.x, dy=tg.y-dg.y, dd=Math.hypot(dx,dy), sp=1.1*dt; if(dd<=sp){ dg.x=tg.x; dg.y=tg.y; dg.mode='sit2'; dg.t=3+Math.random()*4; } else { dg.x+=dx/dd*sp; dg.y+=dy/dd*sp; dg.dir=Math.abs(dx)>Math.abs(dy)?(dx>0?0:2):(dy>0?1:3); } dg.ph+=dt; }
    else if(dg.t<=0 && (S.morale||60)>=30){ var band=sc.st.bands[Math.floor(Math.random()*sc.st.bands.length)]; dg.target={x:(0.6+Math.random()*(sc.W-1.4)>sc.st.aisle?0.5+Math.random()*0.9: 0.7),y:band}; var rx=Math.random(); dg.target.x=rx<0.5? (0.6+rx*1.6): (sc.W-2+rx); if(dg.target.x>sc.W-0.8) dg.target.x=sc.W-0.8; dg.mode='walk'; }
    else if(dg.t<=0){ dg.mode='sleep'; dg.t=8; } else if(dg.mode==='sit2'&&dg.t<=0){ dg.mode='sleep'; dg.t=8; } }
  if(sc.endMode==='bell'){ sc.confT-=dt; if(sc.confT<=0){ sc.confT=1.3; Iso.fx.confetti(); Iso.fx.coins(); } }
  /* particles */
  parts.forEach(function(q){ q.life-=dt; q.x+=q.vx*dt; q.y+=q.vy*dt; q.z+=q.vz*dt; q.vz-=q.g*dt; }); parts=parts.filter(function(q){ return q.life>0; });
  bubbles.forEach(function(b){ b.life-=dt; }); bubbles=bubbles.filter(function(b){ return b.life>0; });
  banners.forEach(function(b){ b.life-=dt; }); banners=banners.filter(function(b){ return b.life>0; });
  if(fade.dir!==0){ fade.a+=fade.dir*dt*2.2; if(fade.dir>0&&fade.a>=1){ fade.a=1; fade.dir=-1; if(fade.cb){ var cb=fade.cb; fade.cb=null; cb(); } } else if(fade.dir<0&&fade.a<=0){ fade.a=0; fade.dir=0; } }
}
function drawables(){
  var list=[];
  var sd=sc.slotList;
  sd.forEach(function(sl){ if(!sl.show) return; var dk=slotDesk(sl); list.push({key:sl.x+sl.w+sl.y+sl.d,x0:sl.x,x1:sl.x+sl.w,y0:sl.y,y1:sl.y+sl.d,h:1.4,kind:'desk',id:'desk'+sl.i,draw:function(){ drawDesk({x:sl.x,y:sl.y,w:sl.w,d:sl.d,who:sl.who&&!sl.who.hidden?sl.who:null,t:sl.i,req:sl.req}); },info:{kind:'desk',slot:sl.i,mine:sl.who&&sl.who.kind==='you'}});
    var p=sl.who; var seated=p&&!p.hidden&&p.mode==='sit'&&p.seatDesk&&p.seatDesk.slot===sl;
    list.push({key:dk.cx+0.4+dk.cy+0.4,x0:dk.cx-0.4,x1:dk.cx+0.4,y0:dk.cy-0.4,y1:dk.cy+0.4,h:1.3,kind:seated?(p.kind==='emp'?'person':p.kind):'chair',id:seated?p.id:'chair'+sl.i,draw:function(){ drawSeated({cx:dk.cx,cy:dk.cy,dir:3,chair:chairColor(),p:seated?p:null}); },info:seated?{kind:p.kind,id:p.id,person:p}:null});
  });
  sc.props.forEach(function(o){ if(o.t==='rug'||o.skip) return; var fn=DRAW[o.t]; if(!fn) return; var w=o.w||0.6, d=o.d||0.6; list.push({key:o.x+w+o.y+d,x0:o.x,x1:o.x+w,y0:o.y,y1:o.y+d,h:o.t==='rack'?1.9:1.2,kind:'prop',id:o.t,draw:function(){ fn(o); },info:{kind:o.t}}); });
  function addP(p){ if(p.hidden) return; if(p.mode==='sit'&&p.seatDesk&&p.slot) return; list.push({key:p.x+0.2+p.y+0.2,x0:p.x-0.2,x1:p.x+0.2,y0:p.y-0.2,y1:p.y+0.2,h:1.4,kind:p.kind==='emp'?'person':p.kind,id:p.id,draw:function(){ drawPerson(p); },info:{kind:p.kind,id:p.id,person:p}}); }
  sc.people.forEach(addP); sc.visitors.forEach(addP);
  if(sc.dog) list.push({key:sc.dog.x+0.3+sc.dog.y+0.3,x0:sc.dog.x-0.3,x1:sc.dog.x+0.3,y0:sc.dog.y-0.3,y1:sc.dog.y+0.3,h:0.6,kind:'dog',id:'dog',draw:function(){ drawDog(sc.dog); },info:{kind:'dog'}});
  list.sort(function(a,b){ return a.key-b.key; });
  return list;
}
function draw(){
  ctx=cv.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,cssW,cssH);
  bgDraw(); ctx.drawImage(bg,0,0,cssW,cssH);
  var list=drawables(); hits=[];
  list.forEach(function(it){
    if(hover&&hover.id===it.id&&it.info){ ctx.save(); ctx.shadowColor='rgba(255,210,60,.95)'; ctx.shadowBlur=12; it.draw(); ctx.restore(); } else it.draw();
    if(it.info){ var a=P(it.x0,it.y0,it.h), b=P(it.x1,it.y0,it.h), c=P(it.x1,it.y1,0), d=P(it.x0,it.y1,0), e=P(it.x0,it.y0,0), f=P(it.x1,it.y1,it.h), g=P(it.x0,it.y1,it.h); var xs=[a[0],b[0],c[0],d[0],e[0],f[0],g[0]], ys=[a[1],b[1],c[1],d[1],e[1],f[1],g[1]]; hits.push({id:it.id,info:it.info,x0:Math.min.apply(null,xs),x1:Math.max.apply(null,xs),y0:Math.min.apply(null,ys),y1:Math.max.apply(null,ys),key:it.key}); }
  });
  /* wall hit areas: customer wall, TV, door */
  addWallHits();
  drawParticles(); drawBubbles(); drawBanners();
  drawOverlays();
  if(fade.a>0){ ctx.fillStyle='rgba(245,247,252,'+Math.min(1,fade.a)+')'; ctx.fillRect(0,0,cssW,cssH); }
}
function addWallHits(){
  var st=sc.st; var cw0=st.board[0], cw1=st.board[1];
  var p1=P(0,cw0,2.8), p2=P(0,cw1,2.8), p3=P(0,cw1,0.7), p4=P(0,cw0,0.7);
  hits.push({id:'wallboard',info:{kind:'board'},x0:Math.min(p1[0],p2[0],p3[0],p4[0]),x1:Math.max(p1[0],p2[0],p3[0],p4[0]),y0:Math.min(p1[1],p2[1]),y1:Math.max(p3[1],p4[1]),key:-1});
  var rmu=(sc.key==='garage')?5.85:st.poster, rmw=(sc.key==='garage')?1.05:1.3; var m1=P(rmu,0,2.9), m2=P(rmu+rmw,0,2.9), m3=P(rmu+rmw,0,1.7), m4=P(rmu,0,1.7); hits.push({id:'roadmap',info:{kind:'roadmap'},x0:Math.min(m1[0],m4[0]),x1:Math.max(m2[0],m3[0]),y0:Math.min(m1[1],m2[1]),y1:Math.max(m3[1],m4[1]),key:-1});
  var tv=st.tv, q1,q2,q3,q4;
  if(tv.axis==='y'){ q1=P(tv.pos,0,tv.z+tv.h); q2=P(tv.pos+tv.w,0,tv.z+tv.h); q3=P(tv.pos+tv.w,0,tv.z); q4=P(tv.pos,0,tv.z); }
  else { q1=P(0,tv.pos,tv.z+tv.h); q2=P(0,tv.pos-tv.w,tv.z+tv.h); q3=P(0,tv.pos-tv.w,tv.z); q4=P(0,tv.pos,tv.z); }
  hits.push({id:'tv',info:{kind:'tv'},x0:Math.min(q1[0],q2[0],q3[0],q4[0]),x1:Math.max(q1[0],q2[0],q3[0],q4[0]),y0:Math.min(q1[1],q2[1],q3[1],q4[1]),y1:Math.max(q1[1],q2[1],q3[1],q4[1]),key:-1});
  var dd=st.door; if(dd.kind==='garage'){ var r1=P(dd.a,0,2.7), r2=P(dd.b,0,2.7), r3=P(dd.b,0,0), r4=P(dd.a,0,0); hits.push({id:'door',info:{kind:'door'},x0:r1[0],x1:r2[0],y0:Math.min(r1[1],r2[1]),y1:Math.max(r3[1],r4[1]),key:-1}); }
  else { var r5=P(0,dd.a,2.4), r6=P(0,dd.b,2.4), r7=P(0,dd.b,0), r8=P(0,dd.a,0); hits.push({id:'door',info:{kind:'door'},x0:Math.min(r5[0],r6[0],r7[0],r8[0]),x1:Math.max(r5[0],r6[0],r7[0],r8[0]),y0:Math.min(r5[1],r6[1]),y1:Math.max(r7[1],r8[1]),key:-1}); }
}
function drawParticles(){
  parts.forEach(function(q){ var a=P(q.x,q.y,q.z); var al=Math.min(1,q.life/(q.fade||0.6)); ctx.globalAlpha=al;
    if(q.ch){ ctx.fillStyle=q.col; ctx.font='bold '+Math.round((q.sz||12)*cam.s)+'px sans-serif'; ctx.textAlign='center'; ctx.fillText(q.ch,a[0],a[1]); ctx.textAlign='left'; }
    else { ctx.fillStyle=q.col; ctx.fillRect(a[0]-1.5,a[1]-1.5,3.2*(q.sz||1),3.2*(q.sz||1)); } ctx.globalAlpha=1; });
}
function wrapText(t,max){ ctx.font='11px "Inter",system-ui,sans-serif'; var words=String(t).split(/\s+/), line='', out=[]; words.forEach(function(w){ var test=line?line+' '+w:w; if(ctx.measureText(test).width>max&&line){ out.push(line); line=w; } else line=test; }); if(line) out.push(line); return out.slice(0,5); }
function drawBubbles(){
  bubbles.forEach(function(b){
    var who=b.who; var pos=null; if(b.at){ pos=P(b.at.x,b.at.y,b.at.z||1.7); } else { var p=findPerson(who); if(!p) return; pos=P(p.x,p.y,(p.mode==='sit'?1.75:1.65)); }
    var lines=wrapText(b.text,150); var w=0; lines.forEach(function(l){ w=Math.max(w,ctx.measureText(l).width); }); w+=14; var h=lines.length*14+8; var al=Math.min(1,b.life/0.5); ctx.globalAlpha=al*(b.life>b.ttl-0.25?(b.ttl-b.life)/0.25:1);
    var x=Math.max(4,Math.min(cssW-w-4,pos[0]-w/2)), y=pos[1]-h-12-(b.lift||0); if(y<4) y=4;
    ctx.fillStyle='#fff'; ctx.strokeStyle=b.col||'#2a3350'; ctx.lineWidth=1.3; rrect(x,y,w,h,7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(Math.max(x+8,Math.min(x+w-8,pos[0]))-4,y+h); ctx.lineTo(pos[0],y+h+8); ctx.lineTo(Math.max(x+8,Math.min(x+w-8,pos[0]))+4,y+h); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#1d2433'; ctx.font='11px "Inter",system-ui,sans-serif'; lines.forEach(function(l,i){ ctx.fillText(l,x+7,y+14+i*14-1); }); ctx.globalAlpha=1;
  });
}
function drawBanners(){
  banners.forEach(function(b,i){ var age=b.ttl-b.life; var al=Math.min(1,age/0.25,b.life/0.5); var y=14+i*30-(1-Math.min(1,age/0.3))*10; ctx.globalAlpha=Math.max(0,al); ctx.font='bold 13px "Inter",system-ui,sans-serif'; var w=ctx.measureText(b.text).width+26; var x=cssW/2-w/2; ctx.fillStyle=b.bg||'#1d2433'; rrect(x,y,w,24,12); ctx.fill(); ctx.fillStyle=b.fg||'#fff'; ctx.textAlign='center'; ctx.fillText(b.text,cssW/2,y+16); ctx.textAlign='left'; ctx.globalAlpha=1; });
}
function drawOverlays(){
  var S=sc.state, ph=dayPhase();
  if(sc.endMode==='shutdown'||sc.endMode==='burnout'||sc.endMode==='fraud'){ ph={k:'night',n:0.7}; }
  if(sc.endMode==='fraud'){ var fl=Math.floor(wallClock*4)%2; ctx.fillStyle=fl?'rgba(255,40,40,.10)':'rgba(40,80,255,.10)'; ctx.fillRect(0,0,cssW,cssH); }
  /* night tint */
  if(ph.n>0.02){ ctx.save(); ctx.globalCompositeOperation='source-atop'; ctx.fillStyle='rgba(18,26,70,'+(ph.n*0.5)+')'; ctx.fillRect(0,0,cssW,cssH); ctx.restore();
    /* desk glows */
    ctx.save(); ctx.globalCompositeOperation='lighter'; sc.slotList.forEach(function(sl){ if(!sl.show||!sl.who) return; var a=P(sl.x+1,sl.y+0.45,1.0); var g=ctx.createRadialGradient(a[0],a[1],2,a[0],a[1],38*cam.s); g.addColorStop(0,'rgba(120,170,255,'+(ph.n*0.45)+')'); g.addColorStop(1,'rgba(120,170,255,0)'); ctx.fillStyle=g; ctx.fillRect(a[0]-40*cam.s,a[1]-40*cam.s,80*cam.s,80*cam.s); }); ctx.restore(); }
  /* danger vignette */
  if(S.lastStand||S.runwayBand===3){ var pulse=0.12+0.08*Math.sin(wallClock*(S.lastStand?6:2.6)); var g2=ctx.createRadialGradient(cssW/2,cssH/2,Math.min(cssW,cssH)*0.3,cssW/2,cssH/2,Math.max(cssW,cssH)*0.7); g2.addColorStop(0,'rgba(255,60,60,0)'); g2.addColorStop(1,'rgba(255,60,60,'+(pulse+(S.lastStand?0.1:0))+')'); ctx.fillStyle=g2; ctx.fillRect(0,0,cssW,cssH); }
  /* stage label */
  if(sc.hiddenCount>0){ ctx.fillText('+'+sc.hiddenCount+' more upstairs',cssW-130,cssH-12); }
}
function findPerson(id){ var r=null; sc.people.forEach(function(p){ if(p.id===id) r=p; }); sc.visitors.forEach(function(p){ if(p.id===id) r=p; }); return r; }

/* ------------------------------------------------------------ public effects API */
function startTransition(cb,label){ fade.dir=1; fade.cb=function(){ cb(); if(label) Iso.banner('Moved into '+label,'#2f9e6e'); }; }
Iso.banner=function(text,bg,ttl){ ttl=ttl||3; banners.push({text:text,bg:bg,life:ttl,ttl:ttl}); if(banners.length>3) banners.shift(); };
Iso.say=function(who,text,ttl,col){ ttl=ttl||6; bubbles=bubbles.filter(function(b){ return b.who!==who && b.text!==text; }); bubbles.push({who:who,text:text,life:ttl,ttl:ttl,col:col}); if(bubbles.length>3) bubbles.shift(); };
Iso.sayAt=function(x,y,text,ttl){ ttl=ttl||5; bubbles.push({at:{x:x,y:y,z:1.8},text:text,life:ttl,ttl:ttl}); if(bubbles.length>3) bubbles.shift(); };
function burst(x,y,z,n,col,o){ o=o||{}; for(var i=0;i<n;i++){ parts.push({x:x,y:y,z:z,vx:(Math.random()-0.5)*(o.sp||1.2),vy:(Math.random()-0.5)*(o.sp||1.2),vz:(o.up||1.4)+Math.random()*1.2,g:o.g===undefined?3.2:o.g,life:o.life||1.2,col:Array.isArray(col)?col[i%col.length]:col,ch:o.ch,sz:o.sz,fade:0.5}); } }
Iso.fx={
  coins:function(){ if(!sc) return; for(var i=0;i<26;i++){ parts.push({x:1+Math.random()*(sc.W-2),y:0.5+Math.random()*(sc.D-1),z:3.4+Math.random()*1.2,vx:0,vy:0,vz:-1.5-Math.random(),g:0,life:1.6+Math.random()*0.8,col:'#e0a800',ch:'$',sz:13,fade:0.5}); } },
  confetti:function(){ if(!sc) return; for(var i=0;i<60;i++){ parts.push({x:sc.W/2+(Math.random()-0.5)*4,y:sc.D/2+(Math.random()-0.5)*3,z:2.8+Math.random(),vx:(Math.random()-0.5)*2.4,vy:(Math.random()-0.5)*2.4,vz:1.5+Math.random()*2,g:3,life:2.2,col:['#ff6b6b','#ffd166','#4ecdc4','#a78bfa','#74c0fc'][i%5],sz:1.4,fade:0.6}); } },
  sparkle:function(p){ if(p) burst(p.x,p.y,1.3,10,['#ffe066','#fff3bf','#ffd43b'],{sp:0.9,up:1.2,g:1.5,life:0.9}); },
  smoke:function(){ if(!sc) return; var r=sc.props.filter(function(p){ return p.t==='rack'; })[0]; if(r) burst(r.x+0.4,r.y+0.4,1.9,10,'#6b6b6b',{sp:0.4,up:0.8,g:-0.2,life:1.6,sz:2}); },
  hearts:function(p){ if(p) burst(p.x,p.y,1.4,4,'#ff6b8b',{ch:'♥',sz:12,sp:0.5,up:1,g:0.2,life:1.4}); },
  zzz:function(p){ if(p) burst(p.x,p.y,1.5,3,'#6b7390',{ch:'z',sz:11,sp:0.2,up:0.7,g:-0.1,life:1.8}); }
};
Iso.person=function(id){ return sc?findPerson(id):null; };
Iso.stageName=function(){ return sc?sc.st.label:''; };
Iso.afterTurn=function(G,rec){
  if(!sc||!rec) return;
  try{
    var eng=sc.people.filter(function(p){ return p.role==='eng'&&!p.hidden; });
    if(rec.shipped&&rec.shipped.length){ var nm=rec.shipped[0].name||rec.shipped[0]; (eng.length?eng:sc.people).forEach(function(p){ p.flash=1.8; Iso.fx.sparkle(p); }); Iso.banner('Shipped: '+(typeof nm==='string'?nm:'a feature'),'#2f9e6e'); }
    var newC=Math.round(G.stat&&G.stat.newLast||0); for(var i=0;i<Math.min(3,newC);i++){ var v=spawnVisitor('customer'); (function(vv,first){ vv.onNote=function(){ Iso.fx.sparkle(vv); }; visitorJourney(vv,'board'); })(v,i===0); }
    if(rec.after&&rec.before&&rec.after.cash-rec.before.cash>40000) { Iso.fx.coins(); Iso.banner('Money in the bank: +'+SU.fmtMoney(rec.after.cash-rec.before.cash),'#b8860b'); }
    if(rec.lastStand) Iso.banner('PAYROLL FRIDAY','#c92a2a',4);
    var rx=rec.reactions; if(rx){ var who=null; if(rx.team){ if(G.co&&rx.team.who===G.co.name) who='co'; else { sc.people.forEach(function(p){ if(p.name===rx.team.who) who=p.id; }); } if(!who) who='you'; Iso.say(who,rx.team.text,6); }
      if(rx.customer&&Math.random()<0.7){ var cv2=spawnVisitor('customer'); cv2.onNote=null; visitorJourney(cv2,'board'); setTimeout(function(){ Iso.say(cv2.id,rx.customer.text,6,'#12805c'); },1800); } }
    if(G.founder.sanity<30){ var me=findPerson('you'); if(me) Iso.fx.zzz(me); }
    if(rec.newAchv&&rec.newAchv.length) Iso.banner('Achievement: '+rec.newAchv[0],'#7048e8');
  }catch(e){}
};
Iso.incident=function(){ if(sc){ sc.state.incident=true; Iso.fx.smoke(); } };
Iso.setHandlers=function(h){ handlers=h||{}; };
Iso.ending=function(type){
  if(!sc) return; sc.endMode=type; sc.noWander=true; sc.confT=0.2;
  var txt={bell:'THE BELL',sale:'ACQUIRED',acquihire:'ACQUIHIRED',indie:'PROFITABLE AND FREE',shutdown:'CLOSED',fraud:'UNDER INVESTIGATION',coup:'NEW CEO',burnout:'OUT OF OFFICE',decade:'TEN YEARS',zombie:'STILL HERE'}[type]||'THE END';
  Iso.banner(txt,type==='shutdown'||type==='fraud'||type==='burnout'?'#8a2b2b':'#2f7d57',60);
  if(type==='shutdown'||type==='burnout'){ sc.people.forEach(function(p){ if(p.kind==='emp'||p.kind==='co'){ p.carry=true; if(p.mode==='sit'){ var d=doorPoint(); sendPerson(p,{x:d.x,y:d.y,aisle:d.aisle,band:d.band},'stand',3,function(q){ q.gone=true; }); } } }); }
  if(type==='sale'||type==='acquihire'||type==='decade'||type==='indie') Iso.fx.confetti();
};

/* ------------------------------------------------------------ interaction */
function hitAt(x,y){
  var best=null; for(var i=hits.length-1;i>=0;i--){ var h=hits[i]; if(h.info&&x>=h.x0&&x<=h.x1&&y>=h.y0&&y<=h.y1){ if(h.key===-1){ if(!best) best=h; continue; } return h; } }
  return best;
}
function onMove(e){ var r=cv.getBoundingClientRect(); mouse.x=e.clientX-r.left; mouse.y=e.clientY-r.top; var h=hitAt(mouse.x,mouse.y); var id=h?h.id:null; if((hover?hover.id:null)!==id){ hover=h; cv.style.cursor=h?'pointer':'default'; if(handlers.hover) handlers.hover(h?h.info:null,mouse.x,mouse.y); } else if(h&&handlers.hover) handlers.hover(h.info,mouse.x,mouse.y); }
function onLeave(){ hover=null; if(handlers.hover) handlers.hover(null); }
function onClick(e){ var r=cv.getBoundingClientRect(); var h=hitAt(e.clientX-r.left,e.clientY-r.top); if(h&&handlers.pick) handlers.pick(h.info,e.clientX-r.left,e.clientY-r.top); }

/* ------------------------------------------------------------ lifecycle */
function loop(ts){
  if(!running) return; requestAnimationFrame(loop);
  if(!sc||!cv) return; if(document.hidden) { lastT=ts; return; }
  var dt=Math.min(0.1,(ts-lastT)/1000||0); lastT=ts; frameAcc+=dt; if(frameAcc<1/30) return; var step=frameAcc; frameAcc=0;
  update(step); draw();
}
var winBound=false, ro=null;
Iso.attach=function(canvas){
  cv=canvas; ctx=cv.getContext('2d'); hover=null;
  cv.addEventListener('mousemove',onMove); cv.addEventListener('mouseleave',onLeave); cv.addEventListener('click',onClick);
  cv.addEventListener('touchstart',function(e){ var t=e.touches[0]; var r=cv.getBoundingClientRect(); var h=hitAt(t.clientX-r.left,t.clientY-r.top); if(h&&handlers.pick) handlers.pick(h.info,t.clientX-r.left,t.clientY-r.top); },{passive:true});
  if(!winBound){ window.addEventListener('resize',function(){ Iso.resize(); }); winBound=true; }
  if(window.ResizeObserver){ if(ro) ro.disconnect(); ro=new ResizeObserver(function(){ Iso.resize(); }); ro.observe(cv.parentElement||cv); }
  Iso.resize();
};
Iso.init=function(canvas){ Iso.attach(canvas); Iso.start(); };
Iso.stop=function(){ running=false; };
Iso.start=function(){ if(!running){ running=true; lastT=performance.now(); requestAnimationFrame(loop); } };
Iso.setInsetFn=function(f){ insetFn=f; };
Iso.reset=function(){ insetFn=null; sc=null; parts=[]; bubbles=[]; banners=[]; hits=[]; fade={a:0,dir:0,cb:null}; };
Iso.renderOnce=function(){ if(sc&&cv){ draw(); } };
Iso.debug=function(){ return {sc:sc,cam:cam}; };
Iso.project=function(x,y,z){ return P(x,y,z); };
Iso.setTime=function(t){ wallClock=t; };
})();
