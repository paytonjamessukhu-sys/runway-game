/* RUNWAY - data: segments, ideas, cofounders, traits, investors, rivals, roles. ASCII only. */
(function(){
var SU = (window.SU = window.SU || {});

/* ------------------------------------------------------------ roles */
/* salary = 2024 base (before 1.3 loading and era.salaryIdx) */
SU.ROLES = {
  eng:   {name:'Engineer',        sal:{junior:90e3, mid:150e3, senior:190e3, staff:230e3}, ramp:{junior:5,mid:3,senior:3,staff:3}, eq:{junior:0.0005,mid:0.001,senior:0.0025,staff:0.004}},
  design:{name:'Designer',        sal:{junior:100e3,mid:150e3, senior:180e3, staff:210e3}, ramp:{junior:4,mid:3,senior:3,staff:3}, eq:{junior:0.0005,mid:0.001,senior:0.002,staff:0.003}},
  pm:    {name:'Product manager', sal:{junior:110e3,mid:149e3, senior:185e3, staff:215e3}, ramp:{junior:4,mid:3,senior:3,staff:3}, eq:{junior:0.0005,mid:0.001,senior:0.002,staff:0.003}},
  sdr:   {name:'SDR',             sal:{junior:60e3, mid:70e3,  senior:85e3,  staff:95e3},  ramp:{junior:2,mid:2,senior:2,staff:2}, eq:{junior:0.0002,mid:0.0003,senior:0.0005,staff:0.0008}},
  ae:    {name:'Account exec',    sal:{junior:100e3,mid:135e3, senior:170e3, staff:200e3}, ramp:{junior:4,mid:4,senior:4,staff:4}, eq:{junior:0.0005,mid:0.001,senior:0.002,staff:0.003}},
  cs:    {name:'Customer success',sal:{junior:70e3, mid:90e3,  senior:115e3, staff:135e3}, ramp:{junior:2,mid:2,senior:2,staff:2}, eq:{junior:0.0003,mid:0.0005,senior:0.001,staff:0.0015}},
  mkt:   {name:'Marketer',        sal:{junior:80e3, mid:120e3, senior:150e3, staff:180e3}, ramp:{junior:3,mid:3,senior:3,staff:3}, eq:{junior:0.0005,mid:0.001,senior:0.002,staff:0.003}},
  mgr:   {name:'Manager',          sal:{junior:95e3, mid:125e3, senior:155e3, staff:185e3}, ramp:{junior:2,mid:2,senior:2,staff:2}, eq:{junior:0.0004,mid:0.0008,senior:0.0015,staff:0.0025}},
  ml:    {name:'ML researcher',     sal:{junior:150e3,mid:230e3, senior:320e3, staff:450e3}, ramp:{junior:4,mid:4,senior:4,staff:4}, eq:{junior:0.001,mid:0.002,senior:0.004,staff:0.007}},
  cos:   {name:'Chief of staff',  sal:{junior:160e3,mid:160e3, senior:180e3, staff:200e3}, ramp:{junior:3,mid:3,senior:3,staff:3}, eq:{junior:0.005,mid:0.005,senior:0.006,staff:0.007}},
  vp:    {name:'VP',              sal:{junior:250e3,mid:250e3, senior:280e3, staff:320e3}, ramp:{junior:4,mid:4,senior:4,staff:4}, eq:{junior:0.01,mid:0.01,senior:0.012,staff:0.015}}
};
SU.LEVEL_MULT = {junior:0.6, mid:1.0, senior:1.5, staff:2.0};
SU.ROLE_RE = [
  ['cos',   /\bchief of staff\b/],
  ['vp',    /\b(vp|vice president|head of (?:sales|marketing|engineering|product|growth|design|customer success|ops|operations|finance|people)|cto|coo|cfo|cmo|cro)\b/],
  ['sdr',   /\b(sdrs?|bdrs?|sales development|cold callers?)\b/],
  ['ae',    /\b(account (?:exec|executive)s?|aes?|sales ?reps?|sales ?people|salespeople|salesperson|sales hires?|closers?)\b/],
  ['cs',    /\b(customer success|customer support|support (?:reps?|agents?|specialists?|staff|people|person|team)|cs reps?|csms?)\b/],
  ['mkt',   /\b(marketers?|marketing (?:managers?|leads?|hires?|people|person)|growth (?:hackers?|marketers?|leads?)|content (?:writers?|marketers?))\b/],
  ['design',/\b(designers?|ux|ui)\b/],
  ['pm',    /\b(product managers?|pms?|product leads?)\b/],
  ['eng',   /\b(engineers?|developers?|devs?|programmers?|swes?|coders?|backend|frontend|full.?stack)\b/]
];
SU.LEVEL_RE = [['junior',/\b(junior|jr|entry.?level|intern)\b/],['staff',/\b(staff|principal)\b/],['senior',/\b(senior|sr|experienced|lead)\b/],['mid',/\b(mid|mid.?level|intermediate)\b/]];

/* ------------------------------------------------------------ segments */
function need(id,name,kw){ return {id:id,name:name,kw:kw}; }
SU.SEG = {
  practice:{id:'practice',arch:'smb',name:'Practice managers',who:'dentists and practice managers',words:['dentist','dentists','practice','orthodont','vet','vets','clinic','clinics','hygienist'],
    priceSens:0.5, qualityBar:0.7, wtp:260, defaultPrice:179, churnMo:0.035, reply:0.08, cpc:5.5, adCap:6000, salesCycle:1,
    aff:{outbound:0.9,ads:0.3,content:0.35,social:0.1,events:0.6,referral:0.4,launch:0.2},
    needs:[need('ins','insurance verification',['insurance','verify','verification','eligibility','payer']),need('rem','no-show reminders',['reminder','no-show','noshow','sms','text message','confirm']),need('book','online booking',['booking','book online','online scheduling']),need('recall','recall campaigns',['recall','reactivat','win back']),need('fin','treatment financing',['financing','payment plan','loan']),need('rep','multi-location reports',['multi-location','multi location','reporting','reports']),need('rev','review requests',['review','reputation'])],
    herrings:[need('dark','dark mode',['dark mode']),need('bot','AI chatbot',['chatbot','chat bot','ai assistant'])],
    quote:'If it does not talk to the insurance portal, it is one more tab I babysit.', quoteName:'Gail, Pruitt Family Dental', skeptic:'Twelve dollars? What is the catch?'},
  owner:{id:'owner',arch:'smb',name:'Owner-operators',who:'restaurant and shop owners',words:['restaurant','restaurants','diner','cafe','cafes','owner','owners','shop','shops','roofer','roofers','contractor','contractors','bar','bars','bakery'],
    priceSens:0.9, qualityBar:0.5, wtp:120, defaultPrice:89, churnMo:0.06, reply:0.04, cpc:2.8, adCap:4000, salesCycle:0,
    aff:{outbound:0.7,ads:0.5,content:0.2,social:0.5,events:0.3,referral:0.6,launch:0.2},
    needs:[need('sched','staff scheduling',['schedul','shift','roster']),need('waste','food waste tracking',['waste','inventory','prep','cost']),need('deliv','delivery-app fees',['delivery','doordash','fee']),need('menu','menu pricing',['menu','margin','pricing']),need('tips','tip payouts',['tip','payout','payroll'])],
    herrings:[need('tok','loyalty tokens',['token','crypto']),need('web','a website',['website','web site'])],
    quote:'I read your email at 1am between closing and cleaning the fryer.', quoteName:'Rosa, Rosa\'s Taqueria', skeptic:'Does it work on my phone? I am never at a desk.'},
  finance:{id:'finance',arch:'smb',name:'Finance teams',who:'CFOs and finance teams',words:['cfo','cfos','finance','accountant','accountants','controller','controllers','bookkeeper'],
    priceSens:0.4, qualityBar:0.8, wtp:900, defaultPrice:600, churnMo:0.015, reply:0.03, cpc:12, adCap:10000, salesCycle:3,
    aff:{outbound:0.6,ads:0.3,content:0.8,social:0.2,events:0.5,referral:0.5,launch:0.3},
    needs:[need('close','month-end close',['close','month-end','month end','reconcil']),need('appr','approvals',['approval','workflow','sign-off']),need('audit','audit trail',['audit','trail','compliance']),need('erp','ERP sync',['erp','netsuite','sync','integrat']),need('multi','multi-entity',['multi-entity','entities','consolidat'])],
    herrings:[need('dash','dashboards',['dashboard','chart'])],
    quote:'Show me the audit trail or show me the door.', quoteName:'Hal, CFO', skeptic:'Where is your SOC 2?'},
  lawfirm:{id:'lawfirm',arch:'smb',name:'Law firms',who:'partners and associates at law firms',words:['lawyer','lawyers','attorney','attorneys','law firm','law firms','partner','associates','paralegal','paralegals','counsel'],
    priceSens:0.35, qualityBar:0.85, wtp:700, defaultPrice:450, churnMo:0.02, reply:0.04, cpc:11, adCap:8000, salesCycle:3,
    aff:{outbound:0.7,ads:0.3,content:0.7,social:0.15,events:0.7,referral:0.6,launch:0.3},
    needs:[need('redline','redlining and suggestions',['redline','suggest','markup','track changes']),need('clause','a clause library',['clause','playbook','template']),need('cite','citations you can check',['citation','source','cite','verify']),need('conf','client confidentiality',['confidential','privilege','private','secure']),need('batch','reviewing a whole deal room',['batch','deal room','bulk','diligence'])],
    herrings:[need('chat','a friendly chatbot',['chatbot','chat bot','assistant']),need('voice','voice dictation',['voice','dictate'])],
    quote:'If it makes up one case, I am done. Show me the source for every claim.', quoteName:'Priya, litigation partner', skeptic:'Does anything you train on touch our client documents?'},
  ecom:{id:'ecom',arch:'smb',name:'Online stores',who:'online store owners',words:['ecommerce','e-commerce','online store','online stores','shopify','store owner','store owners','merchant','merchants','dtc','brand','brands'],
    priceSens:0.8, qualityBar:0.55, wtp:180, defaultPrice:129, churnMo:0.05, reply:0.05, cpc:3.6, adCap:5000, salesCycle:0,
    aff:{outbound:0.5,ads:0.7,content:0.4,social:0.5,events:0.2,referral:0.6,launch:0.4},
    needs:[need('defl','answering the common tickets',['ticket','faq','deflect','answer']),need('order','order lookup and tracking',['order','tracking','shipment','status']),need('ret','handling returns',['return','refund','exchange']),need('tone','matching your brand voice',['tone','voice','brand']),need('lang','other languages',['language','multilingual','translate'])],
    herrings:[need('phone','a phone line',['phone','call center']),need('avatar','an animated avatar',['avatar','mascot'])],
    quote:'I do not want a demo. I want my inbox to empty itself by Friday.', quoteName:'Jonah, runs a candle shop', skeptic:'What happens when it says something wrong to my customer?'},
  creators:{id:'creators',arch:'consumer',name:'Creators',who:'hobbyist artists and creators',words:['creators','artists','designers','illustrators','makers','hobbyists','streamers'],
    priceSens:0.85, qualityBar:0.7, wtp:12, defaultPrice:9.99,
    aff:{outbound:0.05,ads:0.5,content:0.5,social:0.9,events:0.2,referral:0.8,launch:0.6},
    needs:[need('style','consistent styles',['style','consistent','same look','character']),need('speed','fast results',['fast','speed','quick','instant']),need('edit','editing the result',['edit','tweak','inpaint','adjust']),need('lic','a license you can sell with',['license','commercial','copyright','sell']),need('hd','print-quality output',['resolution','print','hd','upscale'])],
    herrings:[need('feed','a public feed',['feed','gallery']),need('coin','paying in tokens',['token','credits','coin'])],
    quote:'I would pay today if I could sell what it makes without a lawyer.', quoteName:'Mina, illustrator', skeptic:'Did you train this on my art?'},
  locals:{id:'locals',arch:'venue',name:'The neighborhood locals',who:'neighborhood regulars who want a cheap, easy night out',words:['locals','neighbors','regulars','neighbourhood','neighborhood','dive','pub'],
    priceSens:0.9, qualityBar:0.4, wtp:15, defaultPrice:14, traffic:46, churnMo:0.09,
    aff:{outbound:0.5,ads:0.35,content:0.3,social:0.5,events:0.8,referral:0.9,launch:0.5},
    needs:[need('cheap','cheap pints',['cheap','pint','price','special']),need('jukebox','a jukebox and music',['jukebox','music','playlist']),need('pool','a pool table',['pool','darts','games']),need('late','staying open late',['late','hours','open late']),need('nofrills','no-frills and no snobs',['dive','casual','unpretentious'])],
    herrings:[need('bottle','bottle service',['bottle','vip']),need('menu','a tasting menu',['tasting','prix fixe'])],
    quote:'I want one place where nobody makes me feel dumb for ordering a beer.', quoteName:'Mick, regular since 2009', skeptic:'Another new owner. How long this time?'},
  cocktail:{id:'cocktail',arch:'venue',name:'The after-work crowd',who:'young professionals who want a great drink and a nice room',words:['professionals','cocktail','lounge','drinks','after work','date night'],
    priceSens:0.45, qualityBar:0.85, wtp:26, defaultPrice:22, traffic:34, churnMo:0.1,
    aff:{outbound:0.3,ads:0.5,content:0.7,social:0.9,events:0.6,referral:0.8,launch:0.6},
    needs:[need('craft','craft cocktails',['cocktail','craft','mixology','house-made']),need('vibe','a room with atmosphere',['atmosphere','ambiance','lighting','music']),need('res','reservations',['reservation','book','table']),need('small','small plates',['food','plates','bites','snacks']),need('quiet','a place you can talk',['quiet','talk','conversation'])],
    herrings:[need('tv','big screens',['tv','screens','game']),need('wings','cheap wings',['wings','cheap food'])],
    quote:'If the drinks are lazy and the room is loud, I will not come back.', quoteName:'Dev, product manager', skeptic:'Seventeen dollars for a cocktail?'},
  sports:{id:'sports',arch:'venue',name:'The game-day crowd',who:'sports fans who want screens, wings and a loud room',words:['sports','fans','game day','game','wings','screens'],
    priceSens:0.75, qualityBar:0.5, wtp:20, defaultPrice:17, traffic:52, churnMo:0.1,
    aff:{outbound:0.4,ads:0.5,content:0.3,social:0.7,events:0.95,referral:0.8,launch:0.6},
    needs:[need('screens','plenty of screens',['screen','tv','game','stream']),need('wings','good wings and bar food',['wings','food','kitchen','burger']),need('special','game-day specials',['special','deal','happy hour']),need('seats','seats that fill up fast',['seats','space','crowd','tables']),need('sound','the sound on',['sound','audio','volume'])],
    herrings:[need('wine','a wine list',['wine','sommelier']),need('quiet2','a quiet corner',['quiet','library'])],
    quote:'I do not care about the cocktails. Can I see the whole game from my seat?', quoteName:'Dee, season ticket holder', skeptic:'Do you even show the away games?'},
  dates:{id:'dates',arch:'venue',name:'The date-night couples',who:'couples and small groups who want something special',words:['couples','dates','wine','date night','candle'],
    priceSens:0.35, qualityBar:0.9, wtp:34, defaultPrice:30, traffic:28, churnMo:0.08,
    aff:{outbound:0.2,ads:0.4,content:0.9,social:0.8,events:0.5,referral:0.9,launch:0.5},
    needs:[need('list','a wine list worth reading',['wine','list','sommelier','pairing']),need('cheese','a cheese and charcuterie board',['cheese','board','charcuterie','food']),need('candle','low light and quiet',['candle','quiet','lighting','romantic']),need('staff','staff who actually know things',['staff','knowledge','service']),need('patio2','a patio',['patio','outdoor','terrace'])],
    herrings:[need('dj','a DJ night',['dj','dance']),need('tv2','a TV',['tv','screen'])],
    quote:'We come when we want to hear each other talk.', quoteName:'Ana and Luis, anniversary', skeptic:'Is the staff going to rush us?'},
  genz:{id:'genz',arch:'consumer',name:'Group chat',who:'Gen Z friend groups',words:['gen z','teen','teens','students','college','friends','roommates','group chat'],
    priceSens:0.95, qualityBar:0.5, wtp:6, defaultPrice:4.99, priceSensConsumer:1,
    aff:{outbound:0.05,ads:0.5,content:0.3,social:0.9,events:0.1,referral:0.9,launch:0.5},
    needs:[need('share','sharing with friends',['share','invite','friends','social']),need('streak','streaks',['streak','daily','habit']),need('priv','privacy from parents',['privacy','private','hidden']),need('split','splitting costs',['split','bill','venmo','payment']),need('aes','aesthetics',['aesthetic','theme','beautiful','design'])],
    herrings:[need('desk','a desktop app',['desktop','windows app','mac app'])],
    quote:'lowkey would pay if my friends were on it', quoteName:'a college sophomore', skeptic:'is it free tho'},
  parents:{id:'parents',arch:'consumer',name:'Carpool command',who:'busy parents',words:['parents','moms','dads','families','family','school','kids'],
    priceSens:0.6, qualityBar:0.6, wtp:9, defaultPrice:6.99,
    aff:{outbound:0.1,ads:0.5,content:0.5,social:0.5,events:0.2,referral:0.8,launch:0.3},
    needs:[need('cal','shared calendar',['calendar','schedule','sync']),need('pool','carpool matching',['carpool','matching','ride']),need('ver','verified drivers',['verified','background','safety','driver']),need('meal','meal plans',['meal','recipe','dinner'])],
    herrings:[need('game','gamification',['game','points','badges'])],
    quote:'If I have to explain it to my husband, it is too complicated.', quoteName:'Dana, mom of three', skeptic:'Is my kids data safe?'},
  cooks:{id:'cooks',arch:'market',name:'Home cooks x neighbors',who:'home cooks and hungry neighbors',supplyWord:'cooks',demandWord:'neighbors',supplyNoun:'cooks',demandNoun:'neighbors',
    words:['cooks','cook','chefs','neighbors','neighbours'],supplyWords:['cook','cooks','chef','chefs'],demandWords:['neighbor','neighbors','neighbour','eaters','diners'],
    priceSens:0.7, qualityBar:0.6, wtp:28, defaultPrice:28, aov:28, takeDefault:0.15, takeTol:0.18, capacity:8, freq:2.0, adCpa:8,
    aff:{outbound:0.7,ads:0.5,content:0.3,social:0.6,events:0.3,referral:0.7,launch:0.4},
    needs:[need('trust','trust and safety',['verified','safety','insurance','background']),need('pay','fast payouts',['payment','payout','escrow']),need('disc','discovery',['search','discover','recommend','matching']),need('rate','ratings',['rating','review','photo']),need('sched','pickup scheduling',['schedule','pickup','delivery'])],
    herrings:[need('feed','a social feed',['feed','social']),need('chat','in-app chat',['chat','message'])],
    quote:'If I cannot get paid the same week, I am out.', quoteName:'Marisol, home cook', skeptic:'Who is liable if someone gets sick?'},
  tutors:{id:'tutors',arch:'market',name:'Tutors x parents',who:'tutors and anxious parents',supplyWord:'tutors',demandWord:'parents',supplyNoun:'tutors',demandNoun:'parents',
    words:['tutor','tutors','teachers','parents'],supplyWords:['tutor','tutors','teacher','teachers'],demandWords:['parent','parents','families'],
    priceSens:0.55, qualityBar:0.8, wtp:55, defaultPrice:55, aov:55, takeDefault:0.2, takeTol:0.25, capacity:10, freq:4, adCpa:25,
    aff:{outbound:0.6,ads:0.6,content:0.5,social:0.4,events:0.3,referral:0.8,launch:0.3},
    needs:[need('vet','vetted tutors',['vetted','verified','background','credential']),need('match','good matching',['matching','recommend','subject']),need('pay','easy payments',['payment','payout','invoice']),need('prog','progress reports',['progress','report','notes']),need('sched','scheduling',['schedule','calendar','booking'])],
    herrings:[need('vid','custom video platform',['video platform','own video']),need('game','gamification',['game','badges'])],
    quote:'I just want someone good who shows up.', quoteName:'Priya, parent of two', skeptic:'How do I know they are qualified?'},
  handy:{id:'handy',arch:'market',name:'Handymen x homeowners',who:'handymen and homeowners',supplyWord:'handymen',demandWord:'homeowners',supplyNoun:'handymen',demandNoun:'homeowners',
    words:['handymen','handyman','plumbers','plumber','homeowners','electricians'],supplyWords:['handyman','handymen','plumber','plumbers','electrician','electricians','contractors'],demandWords:['homeowner','homeowners','renters','landlords'],
    priceSens:0.6, qualityBar:0.7, wtp:120, defaultPrice:120, aov:120, takeDefault:0.12, takeTol:0.16, capacity:6, freq:0.5, adCpa:30,
    aff:{outbound:0.6,ads:0.7,content:0.4,social:0.3,events:0.3,referral:0.6,launch:0.3},
    needs:[need('trust','trust and safety',['verified','safety','insurance','license']),need('price','upfront pricing',['quote','pricing','estimate','upfront']),need('sched','same-week booking',['schedule','booking','same week','availability']),need('pay','payments and payouts',['payment','payout','escrow']),need('rate','reviews',['rating','review'])],
    herrings:[need('ar','AR measuring',['ar ','augmented']),need('chat','chat',['chat','message'])],
    quote:'Show up when you say you will and I will pay anything.', quoteName:'Jim, homeowner', skeptic:'Last guy ghosted me. Why are you different?'}
};
/* words that point at a segment (for parsing) */
SU.segFromText = function(t){
  var best=null, bw=0;
  for(var id in SU.SEG){ var s=SU.SEG[id], c=0; (s.words||[]).forEach(function(w){ if(new RegExp('\\b'+w+'\\b').test(t)) c++; }); if(c>bw){ bw=c; best=id; } }
  return best;
};

/* ------------------------------------------------------------ ideas */
SU.IDEAS = [
  {id:'molarity',name:'Molarity',tag:'Insurance verification and reminders for dental practices',arch:'smb',segId:'practice',ai:false},
  {id:'vetdesk',name:'VetDesk',tag:'Scheduling and reminders for vet clinics',arch:'smb',segId:'practice',ai:false},
  {id:'prepline',name:'PrepLine',tag:'Prep lists and waste tracking for restaurants',arch:'smb',segId:'owner',ai:false},
  {id:'gutterly',name:'Gutterly',tag:'A CRM and quoting app for roofers',arch:'smb',segId:'owner',ai:false},
  {id:'closekit',name:'CloseKit',tag:'Month-end close for mid-market finance teams',arch:'smb',segId:'finance',ai:false},
  {id:'ledgerlark',name:'LedgerLark',tag:'AI bookkeeping copilot for finance teams (a wrapper, a bit)',arch:'smb',segId:'finance',ai:true,twist:'A model maker may ship your feature'},
  {id:'counsel',name:'Counsel',tag:'AI contract review for law firms. Accuracy is everything.',arch:'smb',segId:'lawfirm',ai:true,biz:'ai',twist:'One made-up case can end you'},
  {id:'helpbot',name:'HelpBot',tag:'An AI agent that answers support tickets for online stores',arch:'smb',segId:'ecom',ai:true,biz:'ai',twist:'Inference costs eat your margin'},
  {id:'prism',name:'Prism',tag:'AI image studio for hobbyist creators',arch:'consumer',segId:'creators',ai:true,biz:'ai',twist:'Copyright fights and a model race'},
  {id:'splitsy',name:'Splitsy',tag:'Group-chat bill splitting for friends',arch:'consumer',segId:'genz',ai:false},
  {id:'streakbook',name:'Streakbook',tag:'Reading streaks with your friends',arch:'consumer',segId:'genz',ai:false},
  {id:'ghostgym',name:'GhostGym',tag:'Workout accountability with friends',arch:'consumer',segId:'genz',ai:false},
  {id:'carpoolcmd',name:'Carpool Command',tag:'Shared school calendar and carpool matching',arch:'consumer',segId:'parents',ai:false},
  {id:'supperclub',name:'Supper Club',tag:'Home cooks sell dinners to their neighbors',arch:'market',segId:'cooks',ai:false},
  {id:'tutorloop',name:'TutorLoop',tag:'Vetted tutors for anxious parents',arch:'market',segId:'tutors',ai:false},
  {id:'fixitsat',name:'Fixit Saturday',tag:'Handymen and homeowners, same week',arch:'market',segId:'handy',ai:false}
];
SU.IDEAS.push(
  {id:'rustyanchor',name:'The Rusty Anchor',tag:'A dive bar for the neighborhood. Cheap pints and a jukebox.',arch:'venue',segId:'locals',biz:'bar',twist:'Thin margins, loyal regulars'},
  {id:'velvethour',name:'Velvet Hour',tag:'A cocktail lounge for the after-work crowd.',arch:'venue',segId:'cocktail',biz:'bar',twist:'Quality or nothing'},
  {id:'overtime',name:'Overtime',tag:'A sports bar built around game day.',arch:'venue',segId:'sports',biz:'bar',twist:'Brutal peaks and quiet Tuesdays'},
  {id:'corkcandle',name:'Cork and Candle',tag:'A quiet wine bar for date night.',arch:'venue',segId:'dates',biz:'bar',twist:'Small room, big tabs'}
);
SU.IDEAS.forEach(function(i){ if(!i.biz) i.biz=i.ai?'ai':({smb:'tech',consumer:'consumer',market:'market'})[i.arch]; });
SU.BIZ = [
  {id:'tech',name:'Tech startup',icon:'T',blurb:'Sell software to businesses. Real money per customer. Slow to win, hard to kill.',diff:'Steady grind'},
  {id:'ai',name:'AI company',icon:'AI',blurb:'Models, GPUs and hype. Your product decays unless you keep training, and every customer costs real compute.',diff:'Arms race'},
  {id:'consumer',name:'Consumer app',icon:'C',blurb:'Tiny price, huge volume. Needs a viral loop.',diff:'Lottery ticket'},
  {id:'bar',name:'Bar',icon:'B',blurb:'A real room with real rent. Foot traffic, staff shifts, and a Friday night to survive. Thin margins, loyal regulars.',diff:'Thin margins'},
  {id:'market',name:'Marketplace',icon:'M',blurb:'Two sides to grow at once. Brutal at first.',diff:'Chicken and egg'}
];
SU.ARCH_NAME = {smb:'SMB software',consumer:'Consumer subscription',market:'Marketplace',venue:'Bar and restaurant'};
SU.ARCH_START = {
  smb:     {cash:62400, fixed:1400, Q:10, price:null},
  consumer:{cash:48000, fixed:1100, Q:12, price:null},
  market:  {cash:55000, fixed:1600, Q:8,  price:null},
  venue:   {cash:95000, fixed:2400, Q:32, price:null}
};

/* ------------------------------------------------------------ founders */
SU.BACKGROUNDS = [
  {id:'bigco',name:'Ex-BigCo engineer',skills:{p:2,t:4,s:1,c:2},free:1,cash:60000,sanity:80,cred:55,perk:'Ships fast',flaw:'Sales effort counts less',flags:{salesMult:0.85,buildBonus:0.15}},
  {id:'dropout',name:'Dropout hacker',skills:{p:2,t:3,s:1,c:4},cash:8000,sanity:90,cred:40,perk:'Hard to burn out',flaw:'Investors doubt you',flags:{kilnBonus:10}},
  {id:'domain',name:'Domain expert',skills:{p:4,t:1,s:2,c:2},cash:35000,sanity:80,cred:55,perk:'Knows the customer',flaw:'Slower builder',flags:{insight:30,buildMult:0.9}},
  {id:'mba',name:'MBA consultant',skills:{p:2,t:1,s:3,c:3},free:1,cash:90000,sanity:80,cred:50,perk:'Warm intros',flaw:'Forum skeptics pounce',flags:{warmIntro:1,skeptic:0.2}}
];
SU.COFOUNDERS = [
  {id:'nadia',name:'Nadia Okafor',arch:'The Architect',skills:{p:3,t:5,s:1,c:2},trait:'Perfectionist: debt grows slower, builds a bit slower',wants:'craft, autonomy, no crunch',likes:['refactor','compliance','self'],dislikes:['culture:crunch','ethics','announce:deadline'],flags:{debtMult:0.7,velMult:0.9,cto:true},
    voice:'I love you, but I can read a bank statement.'},
  {id:'theo',name:'Theo Marchetti',arch:'The Closer',skills:{p:2,t:1,s:5,c:4},trait:'Overpromiser: closes more, sometimes promises features you do not have',wants:'a big outcome, a title, equity',likes:['fundraise','outbound','launch','market'],dislikes:['price:cut','finance:bootstrap','self'],flags:{closeMult:1.3,promiseP:0.3},
    voice:'I told a 12-chair chain we have SSO. How hard can SSO be?'},
  {id:'sam',name:'Sam Lindqvist',arch:'The Believer',skills:{p:4,t:2,s:2,c:3},trait:'Glue: team morale up; vetoes dark patterns',wants:'the mission, customer love',likes:['talk','talkto','self'],dislikes:['ethics','fire','pivot'],flags:{moraleTeam:6,vetoEthics:true},
    voice:'If we do that, I am not sure who we are anymore.'}
];

/* ------------------------------------------------------------ traits */
/* fx: velMult, closeMult, moraleTeam, attrMult, burnMult(team), launchMult ; flags */
SU.ROLE_GUIDE = {
  eng:   {tag:'Builds the product', does:['Adds build points every month. Junior 0.6x, mid 1x, senior 1.5x, staff 2x.','Build points ship features, pay down tech debt and lift quality.','Takes 3 to 5 months to reach full speed.'], best:'You have features customers asked for waiting in the queue.', limit:'Past 8 people the team slows about 3% for every extra person (a VP halves that). Tired engineers build slower.', pair:'Designers and PMs multiply what engineers build.'},
  design:{tag:'Makes every engineer faster', does:['Adds 10% to your whole engineering team’s build speed, per designer.','Only your first 3 designers count.','On their own they build nothing: with no engineers there is nothing to multiply.'], best:'You already have 2 or more engineers.', limit:'The 4th designer adds nothing.', pair:'Engineers.'},
  pm:    {tag:'Keeps the team pointed the right way', does:['Adds 5% to build speed per PM.','Only your first 2 PMs count.'], best:'A team of about 6 or more, when work starts to sprawl.', limit:'The 3rd PM adds nothing.', pair:'Engineers and designers.'},
  sdr:   {tag:'Sends outreach every month, on autopilot', does:['Each SDR contacts about 1,200 prospects a month, every month, for about $60 a month in tools.','Works for business products and marketplaces. Does nothing for consumer apps.','They find leads. Account execs close them.'], best:'You have a product to sell and know who buys it.', limit:'Cheap, but the leads are only as good as your product fit and price.', pair:'Account execs.'},
  ae:    {tag:'Closes the deals outreach finds', does:['Raises your close rate about 12% per account exec (first 3 count), scaled by their skill.','Only matters when you sell to businesses (SMB). Does nothing for consumer apps or marketplaces.'], best:'You get replies and meetings but too few customers.', limit:'Without leads to close they do nothing.', pair:'SDRs and outreach.'},
  cs:    {tag:'Keeps customers from leaving', does:['You can handle about 300 customers yourself. Each support person adds capacity for 150 more.','Past that capacity, churn jumps 20%.'], best:'You are near 250 customers, or churn is climbing.', limit:'Below the capacity limit an extra hire adds nothing.', pair:'Everyone who sells.'},
  mkt:   {tag:'Makes marketing spend work harder', does:['Each marketer makes your ads, content, social and events bring in about 15% more (first 3 count), scaled by skill and ramp-up.','Only helps if you are actually spending on those channels.'], best:'You already have a marketing channel that works.', limit:'No spend, no effect.', pair:'Marketing spend on the Sales tab.'},
  ml:    {tag:'Makes every training run stronger', does:['Each researcher makes your training runs about 25% stronger (first 3 count).','Slows the model decay: your product falls behind the frontier more slowly.','Pricey: $230K or more a year, with real equity.'], best:'You are an AI company and you keep training models.', limit:'No effect unless you are an AI company.', pair:'Training runs and GPUs.'},
  mgr:   {tag:'Handles the small stuff for you', does:['Adds 1 focus every month: a whole extra move, because they take the small jobs off your plate.','Runs up to 2 of your pinned (repeat) moves for free. Pin outreach, marketing or anything else, and it costs you no focus.','Keeps the team rested: +1 energy for everyone every month.'], best:'You are running out of focus, or you keep repeating the same moves every month.', limit:'The first 2 managers count. Pinned moves are the ones with the repeat icon.', pair:'Anything you can pin.'},
  cos:   {tag:'Gives you your time back', does:['Adds 2 focus every month, for as long as they stay.','That is two more moves per month: the strongest hire for a busy founder.'], best:'You keep running out of focus.', limit:'Only one is needed. Available from Act 3.', pair:'Everyone.'},
  vp:    {tag:'Runs a whole department', does:['Halves the slowdown a big team causes (the penalty above 8 people).','Counts as a key hire when investors size you up.'], best:'You have 10 or more people, or you are about to raise.', limit:'Very expensive: $250K or more and 1% or more in equity. Available from Act 3.', pair:'A big team.'}
};
SU.BIZ_ROLES = {
  bar:{
    list:['eng','cs','design','mkt','mgr'],
    eng:{name:'Bartender',sal:{junior:34e3,mid:42e3,senior:54e3,staff:64e3},ramp:{junior:2,mid:1,senior:1,staff:1},eq:{junior:0,mid:0,senior:0.001,staff:0.002}},
    cs:{name:'Server',sal:{junior:28e3,mid:34e3,senior:44e3,staff:52e3},ramp:{junior:1,mid:1,senior:1,staff:1},eq:{junior:0,mid:0,senior:0.0005,staff:0.001}},
    design:{name:'Chef',sal:{junior:40e3,mid:58e3,senior:78e3,staff:96e3},ramp:{junior:2,mid:2,senior:2,staff:2},eq:{junior:0,mid:0.001,senior:0.002,staff:0.003}},
    mkt:{name:'Promoter',sal:{junior:34e3,mid:46e3,senior:60e3,staff:72e3},ramp:{junior:2,mid:2,senior:2,staff:2},eq:{junior:0,mid:0.0005,senior:0.001,staff:0.002}},
    mgr:{name:'Manager',sal:{junior:50e3,mid:66e3,senior:86e3,staff:104e3},ramp:{junior:2,mid:2,senior:2,staff:2},eq:{junior:0.001,mid:0.002,senior:0.004,staff:0.006}},
    guide:{
      eng:{tag:'Pours the drinks',does:['Each bartender serves about 40 guests a night, on top of the 30 you can handle yourself.','Fast, friendly bartenders lift your rating.','Without enough bartenders you turn away customers on busy nights.'],best:'Your busy nights are bigger than your staff can handle.',limit:'Past what your seats can hold, more bartenders add nothing.',pair:'Servers and a bigger room.'},
      cs:{tag:'Works the floor',does:['Each server handles about 26 guests a night.','Good service lifts your rating and your tabs.'],best:'You have tables and a floor to cover.',limit:'Needs bartenders behind the bar too.',pair:'Bartenders.'},
      design:{tag:'Runs the kitchen',does:['A chef lifts the average tab about 4% (first 2). Food brings in a different crowd.','Needs the Kitchen upgrade to do much.','Better food lifts your rating.'],best:'You have built a kitchen, or your tabs are too low.',limit:'Pricey, and idle without a kitchen.',pair:'The Kitchen upgrade.'},
      mkt:{tag:'Packs the room',does:['Each promoter makes your marketing and events bring in about 15% more (first 3).','Only helps if you spend on marketing or host nights.'],best:'Your room is empty on slow nights.',limit:'No spend, no effect.',pair:'Events and marketing spend.'},
      mgr:{tag:'Runs the night so you do not have to',does:['Adds 1 focus every month.','Runs up to 2 pinned (repeat) moves for free.','Keeps the team rested: +1 energy for everyone every month.'],best:'You are working every night.',limit:'The first 2 managers count.',pair:'Anything you can pin.'}
    }
  }
};
SU.TERMS={
  bar:{tabProduct:'Venue',tabCustomers:'Regulars',tabSales:'Promotion',buildSpeed:'Build-out speed',buildSpeedSub:'points a month',quality:'Room quality',debt:'Wear and grime',debtOk:'Fresh',debtWatch:'Getting grubby',debtBad:'Health inspector bait',refactor:'Deep clean and repairs',refactorBlurb:'Scrub, fix and repaint. Wear comes down.',customers:'Regulars',customersCap:'Regulars',opening:'Open the doors',features:'Upgrades',roadmap:'Projects',price:'Average tab',priceMo:'per guest',mvp:'Doors'}
};
SU.T=function(G,k,d){ var t=G&&SU.TERMS[G.biz]; return (t&&t[k]!==undefined)?t[k]:d; };
SU.ROLES_BASE=null; SU.ROLE_GUIDE_BASE=null; SU.currentBiz=null;
/* swap the job names, pay and text to match the kind of business that is being played */
SU.setBiz=function(biz){
  if(!SU.ROLES_BASE){ SU.ROLES_BASE=JSON.parse(JSON.stringify(SU.ROLES)); SU.ROLE_GUIDE_BASE=JSON.parse(JSON.stringify(SU.ROLE_GUIDE)); }
  if(SU.currentBiz===biz) return; SU.currentBiz=biz;
  Object.keys(SU.ROLES_BASE).forEach(function(r){ SU.ROLES[r]=JSON.parse(JSON.stringify(SU.ROLES_BASE[r])); SU.ROLE_GUIDE[r]=JSON.parse(JSON.stringify(SU.ROLE_GUIDE_BASE[r])); });
  if(SU.CAT&&SU.CAT.actions){ var AC=SU.CAT.actions; ['refactor','talk','townhall','price'].forEach(function(id){ var a=AC[id]; if(!a) return; if(!a._t){ a._t=a.title; a._b=a.blurb; } a.title=a._t; a.blurb=a._b; });
    if(biz==='bar'){ AC.refactor.title='Deep clean and repairs'; AC.refactor.blurb='Scrub, fix and repaint. Wear and grime comes down.'; AC.talk.title='Talk to your regulars'; AC.talk.blurb='Pull up a stool and ask what would make them come more often.'; AC.townhall.title='Write to your regulars'; AC.townhall.blurb='A newsletter and a thank-you. Builds trust.'; AC.price.title='Set your menu prices'; AC.price.blurb='Too high and the room empties. Too low and you work for free.'; } }
  var o=SU.BIZ_ROLES[biz]; if(!o) return;
  Object.keys(o).forEach(function(r){ if(r==='list'||r==='guide') return; SU.ROLES[r]=o[r]; });
  if(o.guide) Object.keys(o.guide).forEach(function(r){ SU.ROLE_GUIDE[r]=o.guide[r]; });
};
SU.TRAITS = {
  tenx:{name:'10x, abrasive',vel:1.8,moraleTeam:-4,conflict:0.15,desc:'Builds almost twice as fast. The team grumbles.'},
  glue:{name:'Glue',moraleTeam:4,desc:'Makes the whole team happier.'},
  rainmaker:{name:'Rainmaker',close:1.3,desc:'Closes deals other people cannot.'},
  truth:{name:'Truth-teller',truth:true,desc:'Tells you what nobody else will.'},
  flight:{name:'Flight risk',attr:2,desc:'Will probably leave within a year or two.'},
  founder:{name:'Founder-in-waiting',leaves:true,desc:'Will leave to start their own company.'},
  night:{name:'Night owl',vel:1.1,crunchOk:true,desc:'Fast, and fine with crunch.'},
  climber:{name:'Ladder climber',wantsPromo:true,desc:'Wants promotions. Gets restless without them.'},
  mentor:{name:'Mentor',mentor:true,desc:'Helps new people ramp up.'},
  spreadsheet:{name:'Spreadsheet brain',burn:0.95,desc:'Quietly cuts waste.'},
  hype:{name:'Hype machine',launch:1.4,desc:'Makes launches louder.'},
  quiet:{name:'Quiet quitter',quiet:true,desc:'Fades out after a few months.'},
  ethicist:{name:'Ethicist',ethic:true,desc:'Speaks up when you cut corners.'}
};
SU.TRAIT_IDS = Object.keys(SU.TRAITS);
SU.WANTS = ['pay','mission','autonomy','stability','title'];
SU.WANT_TEXT = {pay:'better pay',mission:'a mission they believe in',autonomy:'freedom to work their way',stability:'job security',title:'a bigger title'};

/* ------------------------------------------------------------ investors */
/* axes: G growth, E efficiency, M market obsession, F founder bias, C contrarian, H hype sensitivity */
SU.INVESTORS = [
  {id:'priya',venue:true,name:'Priya Raman',fund:'operator angel',stages:['preseed'],check:[25e3,100e3],ax:{G:.5,E:.4,M:.4,F:.9,C:.3,H:.3},from:2004,to:2099,vd:1.0,speed:1.2,tags:[],quirk:'Warm intros after she invests.',voice:'I will invest, but I am also telling you your onboarding is bad.'},
  {id:'benny',name:'Benny Szabo',fund:'Scrappy Ventures',stages:['preseed','seed'],check:[250e3,1e6],ax:{G:.7,E:.3,M:.5,F:.7,C:.2,H:.7},from:2008,to:2099,vd:1.0,speed:1.3,tags:['consumer'],quirk:'Texts at midnight; pushes launches.',voice:'Ship it Friday, fix it Monday.'},
  {id:'kiln',name:'Kiln Accelerator',fund:'accelerator',stages:['preseed'],check:[20e3,500e3],ax:{G:.6,E:.5,M:.5,F:.8,C:.2,H:.4},from:2006,to:2099,vd:0.9,speed:0.9,tags:[],quirk:'Demo Day brings press.',voice:'Make something people want.',kiln:true},
  {id:'margaret',name:'Margaret Rhee',fund:'Larkspur Partners',stages:['seed','A','B','C'],check:[3e6,50e6],ax:{G:.9,E:.4,M:1,F:.5,C:.2,H:.4},from:1999,to:2099,vd:1.15,speed:0.9,tags:['big'],quirk:'Passes on small markets.',voice:'I do not need you to be right. I need you to be enormous.'},
  {id:'felix',name:'Dr. Felix Amsel',fund:'Vertical Thesis Fund',stages:['seed','A'],check:[1e6,10e6],ax:{G:.5,E:.7,M:.6,F:.5,C:.3,H:.1},from:2005,to:2099,vd:0.95,speed:0.8,tags:['smb'],quirk:'Loves design partners; diligence runs deep.',voice:'Walk me through that claim like I am a dentist.'},
  {id:'grant',name:'Grant Tolliver',fund:'Apex Crossover',stages:['B','C'],check:[20e6,200e6],ax:{G:.8,E:.9,M:.5,F:.2,C:.1,H:.3},from:2014,to:2099,vd:1.0,speed:1.0,tags:[],quirk:'Rule of 40 gate.',voice:'Send the cohort file. I will read the deck later. Maybe.'},
  {id:'lena',name:'Lena Strand',fund:'Gargantua Ventures',stages:['A','B','C'],check:[2e6,20e6],ax:{G:.4,E:.5,M:.7,F:.3,C:.1,H:.3},from:2000,to:2099,vd:1.0,speed:1.0,tags:[],corp:true,quirk:'Her right of first refusal scares other buyers.',voice:'We see a lot of synergies. Mostly ours.'},
  {id:'bryce',name:'Bryce Calloway',fund:'Moonshot Opportunity Fund',stages:['preseed','seed','A','B'],check:[5e6,50e6],ax:{G:1,E:.1,M:.6,F:.6,C:0,H:1},from:2020.7,to:2022.2,vd:1.2,speed:1.5,tags:[],tourist:true,quirk:'Pre-empts at 2-3x. Vanishes in a correction.',voice:'We closed in 36 hours because we trust founders. Also FOMO.'},
  {id:'eleanor',venue:true,name:'Eleanor Whitcombe',fund:'family office',stages:['seed','A','B'],check:[500e3,10e6],ax:{G:.3,E:.8,M:.4,F:.6,C:.5,H:.1},from:1999,to:2099,vd:0.85,speed:0.7,tags:[],quirk:'Patient; bridge-friendly.',voice:'My grandfather built a shoe empire on four percent a year. Impress me with boring.'},
  {id:'odile',name:'Odile Brandt',fund:'Contrarian Capital',stages:['seed','A','B'],check:[1e6,15e6],ax:{G:.6,E:.5,M:.5,F:.6,C:1,H:0},from:1999,to:2099,vd:1.0,speed:1.0,tags:[],quirk:'More interested when everyone else passes.',voice:'Everyone passed? Now I am listening.'},
  {id:'hana',name:'Hana Kobayashi',fund:'AI super-angel',stages:['preseed','seed'],check:[100e3,1e6],ax:{G:.8,E:.3,M:.7,F:.8,C:.4,H:.8},from:2023,to:2099,vd:1.05,speed:1.4,tags:['ai'],quirk:'Asks whether the model or the workflow is the moat.',voice:'Is the model the moat or the workflow? The wrong answer is the model.'},
  {id:'hank',name:'Hank Dobrowski',fund:'a regular with savings',stages:['preseed'],check:[25e3,150e3],ax:{G:.3,E:.7,M:.2,F:.8,C:.3,H:.2},from:1999,to:2099,vd:0.85,speed:1.2,tags:[],venue:'only',quirk:'Wants his stool kept for him.',voice:'I have been drinking here twenty years. I would rather own a piece than watch it close.'},
  {id:'neighborbank',name:'Neighborhood Savings',fund:'small-business loan',stages:['preseed','seed'],check:[50e3,500e3],ax:{G:.2,E:.9,M:.3,F:.6,C:.1,H:.1},from:1999,to:2099,vd:0.8,speed:0.8,tags:[],venue:'only',quirk:'Cares about rent coverage, not buzz.',voice:'Show me three months of deposits and we can talk about a line of credit.'},
  {id:'harborline',name:'Harborline Hospitality',fund:'restaurant group',stages:['seed'],check:[400e3,3e6],ax:{G:.6,E:.6,M:.5,F:.5,C:.2,H:.3},from:1999,to:2099,vd:1.0,speed:1.0,tags:[],venue:'only',quirk:'Wants to turn one good room into five.',voice:'One great bar is a hobby. Five is a company. Let us talk about locations.'},
  {id:'rusty',name:'Rusty Delacroix',fund:'Portal Money',stages:['preseed','seed'],check:[1e6,5e6],ax:{G:1,E:0,M:.8,F:.5,C:0,H:1},from:1999,to:2000.3,vd:1.2,speed:1.5,tags:[],quirk:'Invests in eyeballs.',voice:'You have a dot-com? Then you have a valuation.'}
];
SU.investor = function(id){ for(var i=0;i<SU.INVESTORS.length;i++) if(SU.INVESTORS[i].id===id) return SU.INVESTORS[i]; return null; };

/* ------------------------------------------------------------ rivals */
SU.RIVALS = [
  {id:'krellix',name:'Krellix',boss:'Thad Brannigan',persona:'Blitzscaler',blurb:'"We are not a company, we are a movement. Also, we are hiring 40 SDRs."',cash:8e6,burn:380e3,Q:18,price:0.8,hype:55,ethics:0.3,growth:1.5,raise:12,weak:'Collapses when money gets scarce.'},
  {id:'slowoak',name:'Slow Oak Software',boss:'Mara Osei',persona:'Bootstrapper',blurb:'Profitable since month 9. Writes 4,000-word posts about it.',cash:400e3,burn:-8e3,Q:24,price:1.1,hype:15,ethics:0.9,growth:1.0,raise:0,weak:'Grows about 3% a month.'},
  {id:'mirrormint',name:'MirrorMint',boss:'Dex Faraday',persona:'Copycat',blurb:'Ships your feature, with a gradient.',cash:700e3,burn:60e3,Q:20,price:0.8,hype:25,ethics:0.4,growth:0.8,raise:0,weak:'Quality stalls under 70.'},
  {id:'gargantua',name:'Gargantua Systems',boss:'Linda Stroud',persona:'Incumbent',blurb:'"We are excited to welcome this category into our suite. For free."',cash:9e9,burn:0,Q:55,price:0.0,hype:40,ethics:0.6,growth:0,raise:0,weak:'Slow, and a poor fit for niche needs.',late:true}
];
SU.RIVAL_ALIAS={bar:{
  krellix:{name:'The Gilded Tap',boss:'Chaz Whitfield',persona:'Chain expander',blurb:'"Our fourth location opens in March. The playlists are all the same, on purpose."'},
  slowoak:{name:'Rosa\'s Taproom',boss:'Rosa Delgado',persona:'Old guard',blurb:'Forty years on the corner. Everyone has a story about the jukebox.'},
  mirrormint:{name:'Copycat Cocktail Co.',boss:'Dex Faraday',persona:'Copycat',blurb:'Your menu, one block over, with more neon.'},
  gargantua:{name:'Harborline Hospitality',boss:'Linda Stroud',persona:'Restaurant group',blurb:'"We love independent bars. We would love to own one."'}
}};
SU.rivalById = function(id,biz){ for(var i=0;i<SU.RIVALS.length;i++) if(SU.RIVALS[i].id===id){ var base=SU.RIVALS[i], al=biz&&SU.RIVAL_ALIAS[biz]&&SU.RIVAL_ALIAS[biz][id]; if(!al) return base; var o={}; for(var k in base) o[k]=base[k]; for(var k2 in al) o[k2]=al[k2]; return o; } return null; };

/* customer-facing quote helper */
SU.segQuote = function(seg){ return {who:seg.quoteName, text:seg.quote}; };
})();
