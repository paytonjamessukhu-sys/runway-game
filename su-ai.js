/* RUNWAY - optional Claude extras through the claude.ai "sample" capability. One click each, no typing.
   The game never needs it. Each call runs on the viewer's own Claude account and asks consent first. */
(function(){
'use strict';
var SU = window.SU, UI = window.UI, fm = SU.fmtMoney, esc = UI.esc, $ = UI.$;
var AI = (SU.AI = {sample:null});
var ctl=null;
AI.probe=function(cb){
  try{ if(window.claude && typeof window.claude.use==='function'){ window.claude.use('sample').then(function(s){ AI.sample=(typeof s==='function')?s:null; cb(!!AI.sample); },function(){ cb(false); }); return; } }catch(e){}
  cb(false);
};
function copyFor(e){
  var c=e&&e.code;
  if(c==='not_granted'){ UI.S.aiOk=false; return 'Claude is not allowed for this page, so the extras are off. The game works the same without it.'; }
  if(c==='rate_limited') return 'Too many requests, or your Claude usage limit is reached. Try again in a bit.';
  if(c==='cancelled') return '';
  if(c==='session_expired') return 'Sign in to Claude again, then retry.';
  if(c==='invalid_json'||c==='empty_completion') return 'Claude gave an answer I could not use. Try again.';
  return 'Claude could not answer just now. Try again later.';
}
function stateText(g){
  var f=SU.fin(g), b=SU.pmfBand(g), gr=SU.growthMo(g);
  var l=['Company: '+g.name+' ('+g.idea.tag+'), selling to '+SU.seg(g).who+'. Date: '+SU.dateStr(g)+'. Era: '+SU.era(g).name+'.',
    'Cash '+fm(g.cash)+', monthly burn '+fm(Math.max(0,f.burn))+(f.burn<=0?' (profitable by '+fm(-f.burn)+')':'')+', runway '+(f.burn<=0?'infinite':f.runway.toFixed(1)+' months')+'.',
    'Monthly revenue '+fm(g.mrr||0)+', customers '+SU.custCount(g)+', growth '+Math.round(gr*100)+'% a month.',
    'Product-market fit looks like '+b.lo+' to '+b.hi+' of 100. Customer insight '+Math.round(g.insight)+' of 100. Quality '+Math.round(g.Q)+'.',
    'Team: you'+(g.co?', cofounder '+g.co.name:' (solo)')+', plus '+g.team.length+' hires. Sanity '+Math.round(g.founder.sanity)+', morale '+Math.round(g.morale)+'.',
    'Raised so far: '+(g.rounds.length?g.rounds.map(function(r){ return fm(r.amount)+' '+r.stage; }).join(', '):'nothing')+'.'+(g.round?' A '+g.round.stage+' round is open.':'')];
  var needs=g.needs.filter(function(n){ return n.revealed&&n.real; }).map(function(n){ return n.name; }); if(needs.length) l.push('Needs customers confirmed: '+needs.join(', ')+'.');
  var j=g.journal.slice(-5).map(function(e){ return e.date+': '+e.text; }); if(j.length) l.push('Recent: '+j.join(' | '));
  return l.join('\n');
}
AI.advice=function(){
  if(!AI.sample) return;
  UI.modal('<h2>Ask Claude</h2><p class="sm muted">A startup advisor reads your numbers. It sees only what you see and runs on your own Claude account.</p><div id="advOut" class="sec"><div class="muted">Thinking...</div></div><div class="foot"><button class="btn" id="advStop">Stop</button><button class="btn primary" data-act="close-modal">Close</button></div>');
  var g=UI.G(); ctl=new AbortController(); $('#advStop').onclick=function(){ ctl.abort(); };
  var prompt='You are a seasoned startup advisor coaching a founder inside a startup simulation game. Be direct, specific and kind. Use only the facts given. Do not invent numbers.\n\n'+stateText(g)+
    '\n\nWhat should the founder do next, and what should they stop doing? Reply with only JSON like {"advice":"2 to 4 short sentences","moves":["a short move","another"]}. Each move is one short sentence that names a concrete action, like "Interview 8 customers" or "Raise prices 10%". At most 3 moves.';
  AI.sample.json(prompt,{signal:ctl.signal,modelTier:'default'}).then(function(r){
    $('#advOut').innerHTML='<div class="pv"><b>Advisor</b><div>'+esc(r.advice||'')+'</div>'+((r.moves||[]).length?'<ul style="margin:4px 0 0;padding-left:18px">'+r.moves.slice(0,3).map(function(m){ return '<li>'+esc(m)+'</li>'; }).join('')+'</ul>':'')+'</div>';
  }).catch(function(e){ var el=$('#advOut'); if(el) el.innerHTML='<div class="muted">'+esc(copyFor(e)||'Stopped.')+'</div>'; });
};
AI.story=function(){
  var g=UI.G(); if(!AI.sample||!g||!g.over) return; var o=g.over;
  var moments=g.moments.slice(-12).map(function(m){ return m.text; }).join('\n- ');
  var prompt='Write the story of a startup for its founder to keep, in the voice of a thoughtful tech magazine feature. About 220 words, 3 short paragraphs, plain language, no bullet points, no headline. Use only the facts below and invent no numbers. Fictional company, fictional people.\n\n'+stateText(g)+'\n\nHow it ended: '+(o.title||o.type)+' ('+o.type+'). Founder take-home '+fm(o.takeHome||0)+'. Score '+o.score+'.\nKey moments:\n- '+moments;
  var out=$('#storyTxt'); if(out) out.textContent='Thinking...'; var btn=$('[data-act=story]'); if(btn) btn.disabled=true;
  AI.sample(prompt,{modelTier:'default',onText:function(u){ if(out) out.textContent=u.text; UI.S.story=u.text; }}).then(function(r){ UI.S.story=r.text; if(out) out.textContent=r.text; })
  .catch(function(e){ if(out) out.textContent=(e&&e.text)||copyFor(e)||''; }).then(function(){ var b=$('[data-act=story]'); if(b) b.disabled=false; });
};
})();
