import http from "node:http";
import { URL } from "node:url";

const PORT = Number(process.env.PORT || 3000);

const SOURCES = [
  "https://webgw.tse.ir/InstrumentProvider/api/v1/MarketWatch/MarketWatchOption/fa",
  "https://webgw.tse.ir/InstrumentProvider/api/v1/MarketWatch/MarketWatchTradeOption/fa"
];

const page = String.raw`<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>داشبورد اختیار معامله — قالب ۱</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#f3f5f7;color:#17202a;font-family:Tahoma,Arial,sans-serif}
.wrap{max-width:1500px;margin:auto;padding:12px}
.top,.card{background:#fff;border-radius:16px;padding:15px;margin-bottom:14px;box-shadow:0 2px 10px #0000000b}
.top{background:#17202a;color:#fff}
h1{font-size:22px;margin:0 0 8px}
h2{font-size:18px;margin:4px 0 14px}
h3{font-size:16px;margin:4px 0 12px}
.note{font-size:12px;line-height:2;color:#5b6570}
.top .note{color:#dbe3e8}
.selector{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:14px}
select,button{font:inherit;border-radius:10px;padding:10px 12px}
select{min-width:260px;border:1px solid #cfd5da;background:#fff;color:#17202a}
button{border:0;background:#fff;color:#17202a;font-weight:700;cursor:pointer}
.status{margin-top:12px;padding:9px 12px;background:#fff;color:#333;border-radius:10px;font-size:12px}
.pill{display:inline-block;padding:6px 10px;border-radius:999px;background:#eef1f4;margin:2px}
.month1{background:#ead9cc}
.month2{background:#e4e4e4}
.scroll{overflow:auto}
table{width:100%;border-collapse:collapse;min-width:1250px;font-size:12px}
th,td{border:1px solid #ddd;padding:8px;text-align:center;white-space:nowrap}
th{background:#eef1f4}
.green{color:#16823b;font-weight:700}
.red{color:#c62828;font-weight:700}
.empty{text-align:center;padding:28px;color:#666}
.risk-low{background:#dff3e5}
.risk-midlow{background:#e8f0d9}
.risk-mid{background:#fff4cc}
.risk-high{background:#ffe1c7}
.risk-vhigh{background:#ffd7d7}
.small{font-size:11px;color:#667}
</style>
</head>
<body>
<main class="wrap">
<section class="top">
<h1>🎯 داشبورد اختیار معامله — قالب ۱</h1>
<div class="note">تمام نمادهای دارای اختیار از داده بازار دریافت می‌شوند. انتخاب نماد، کل تحلیل قالب ۱ را برای همان نماد نمایش می‌دهد.</div>
<div class="selector">
<label for="symbol">نماد پایه:</label>
<select id="symbol"><option>در حال دریافت نمادها...</option></select>
<button id="refresh">↻ بروزرسانی</button>
</div>
<div id="status" class="status">در حال دریافت آخرین داده معتبر…</div>
</section>
<div id="app"></div>
</main>

<script>
const $=id=>document.getElementById(id);
const pct=(v)=>'<span class="'+(v>=0?'green':'red')+'">'+Number(v).toFixed(1)+'٪</span>';
const num=v=>Number.isFinite(Number(v))?Number(v).toLocaleString('fa-IR'):'—';
const safe=v=>Number.isFinite(Number(v))?Number(v):null;
const targets=[5,10,15,20,30,40,50];
const downs=[-3,-6,-9];

function profit(underlying,strike,premium,change){
  if(![underlying,strike,premium].every(Number.isFinite)||premium<=0)return null;
  const target=underlying*(1+change/100);
  return ((Math.max(target-strike,0)-premium)/premium)*100;
}
function risk(underlying,strike,premium){
  if(![underlying,strike,premium].every(Number.isFinite)||underlying<=0||premium<=0)
    return ['🔴 بسیار زیاد','risk-vhigh'];
  const distance=Math.abs((strike+premium-underlying)/underlying*100);
  if(distance<=1)return ['🟢 کم','risk-low'];
  if(distance<=2)return ['🟢🟡 متوسط','risk-midlow'];
  if(distance<=3)return ['🟡 متوسط','risk-mid'];
  if(distance<=4)return ['🟠 زیاد','risk-high'];
  return ['🔴 بسیار زیاد','risk-vhigh'];
}
function riskRank(label){
  return {'🟢 کم':1,'🟢🟡 متوسط':2,'🟡 متوسط':3,'🟠 زیاد':4,'🔴 بسیار زیاد':5}[label]||99;
}
function bestBy(rs,change){
  return rs.map(r=>({...r,p:profit(r.underlying,r.strike,r.premium,change)}))
    .filter(x=>Number.isFinite(x.p))
    .sort((a,b)=>b.p-a.p)[0]||null;
}
function table1(rs,monthColor,base){
  return `<section class="card"><h3>📊 جدول ۱ — مقایسه قراردادها</h3>
  <div class="scroll"><table><thead><tr>
  <th>نماد</th><th>قیمت پریمیوم</th><th>قیمت سهم پایه</th><th>اعمال</th><th>سر‌به‌سر</th><th>ارزش معاملات روز</th><th>ریسک</th>
  ${targets.map((x,i)=>`<th>${i+1} = +${x}٪ | ${num(base*(1+x/100))}</th>`).join('')}
  </tr></thead><tbody>
  ${rs.map(r=>{
    const rr=risk(r.underlying,r.strike,r.premium);
    return `<tr><td>${monthColor} ${r.symbol}</td><td>${num(r.premium)}</td><td>${num(r.underlying)}</td><td>${num(r.strike)}</td><td>${num(r.strike+r.premium)}</td><td>${num(r.dailyValue)}</td><td class="${rr[1]}">${rr[0]}</td>
    ${targets.map(x=>{const p=profit(r.underlying,r.strike,r.premium,x);return '<td>'+ (p==null?'—':pct(p)) +'</td>'}).join('')}</tr>`;
  }).join('')}
  </tbody></table></div></section>`;
}
function table2(rs,monthColor,base){
  return `<section class="card"><h3>📊 جدول ۲ — سناریوی نزولی</h3>
  <div class="scroll"><table><thead><tr><th>نماد</th><th>سر‌به‌سر</th>
  ${downs.map(x=>`<th>${x}٪ | ${num(base*(1+x/100))}</th>`).join('')}<th>ریسک</th></tr></thead><tbody>
  ${rs.map(r=>{
    const rr=risk(r.underlying,r.strike,r.premium);
    return `<tr><td>${monthColor} ${r.symbol}</td><td>${num(r.strike+r.premium)}</td>
    ${downs.map(x=>{const p=profit(r.underlying,r.strike,r.premium,x);return '<td>'+(p==null?'—':pct(p))+'</td>'}).join('')}
    <td class="${rr[1]}">${rr[0]}</td></tr>`;
  }).join('')}
  </tbody></table></div></section>`;
}
function riskSummary(rs,label){
  const sorted=[...rs].sort((a,b)=>riskRank(risk(a.underlying,a.strike,a.premium)[0])-riskRank(risk(b.underlying,b.strike,b.premium)[0]));
  const low=sorted[0], high=sorted[sorted.length-1];
  const balanced=[...rs].sort((a,b)=>{
    const ra=Math.abs(riskRank(risk(a.underlying,a.strike,a.premium)[0])-3);
    const rb=Math.abs(riskRank(risk(b.underlying,b.strike,b.premium)[0])-3);
    return ra-rb;
  })[0];
  const aggressive=[...rs].sort((a,b)=>(profit(b.underlying,b.strike,b.premium,30)||-999)-(profit(a.underlying,a.strike,a.premium,30)||-999))[0];
  return `<section class="card"><h3>🔎 خلاصه ریسک — ${label}</h3>
  <p>🛡️ کم‌ریسک‌ترین: <b>${low?.symbol||'—'}</b></p>
  <p>⚖️ متعادل‌ترین: <b>${balanced?.symbol||'—'}</b></p>
  <p>🚀 ریسک و بازده: <b>${aggressive?.symbol||'—'}</b></p>
  <p>🔥 تهاجمی: <b>${aggressive?.symbol||'—'}</b></p>
  <p>☢️ بسیار تهاجمی: <b>${high?.symbol||'—'}</b></p></section>`;
}
function table3(g1,g2){
  return `<section class="card"><h3>📊 جدول ۳ — بهترین گزینه در هر هدف</h3>
  <div class="scroll"><table><thead><tr><th>هدف اهرم</th><th>🥇 بهترین ماه اول</th><th>سود تقریبی</th><th>🥇 بهترین ماه دوم</th><th>سود تقریبی</th></tr></thead><tbody>
  ${targets.map(x=>{
    const a=bestBy(g1,x),b=bestBy(g2,x);
    return `<tr><td>+${x}٪</td><td>${a?'🟤 '+a.symbol:'—'}</td><td>${a?pct(a.p):'—'}</td><td>${b?'⚫ '+b.symbol:'—'}</td><td>${b?pct(b.p):'—'}</td></tr>`;
  }).join('')}</tbody></table></div></section>`;
}
function finalResult(g1,g2){
  const all=[...g1.map(x=>({...x,month:1})),...g2.map(x=>({...x,month:2}))];
  const labels=[
    ['🛡️ کم‌ریسک‌ترین',r=>riskRank(risk(r.underlying,r.strike,r.premium)[0])],
    ['⚖️ متعادل‌ترین از نظر ریسک/بازده',r=>Math.abs(riskRank(risk(r.underlying,r.strike,r.premium)[0])-3)*10-(profit(r.underlying,r.strike,r.premium,20)||0)],
    ['🚀 ریسک و بازده بالاتر',r=>-(profit(r.underlying,r.strike,r.premium,30)||-999)],
    ['🔥 تهاجمی',r=>-(profit(r.underlying,r.strike,r.premium,50)||-999)],
    ['☢️ بسیار تهاجمی',r=>-((profit(r.underlying,r.strike,r.premium,50)||-999)*1.1)]
  ];
  return `<section class="card"><h2>🎯 نتیجه نهایی</h2>${labels.map(([name,score],i)=>{
    const s=[...all].sort((a,b)=>score(a)-score(b))[0];
    return '<p>'+name+': <b>'+(s?(s.month===1?'🟤 ':'⚫ ')+s.symbol:'—')+'</b></p>';
  }).join('')}</section>
  <section class="card"><h3>🏆 بهترین انتخاب بر اساس هدف</h3><div class="scroll"><table><thead><tr><th>هدف</th><th>انتخاب</th></tr></thead><tbody>
  ${targets.map(x=>{const a=bestBy(g1,x),b=bestBy(g2,x);const z=[a,b].filter(Boolean).sort((u,v)=>v.p-u.p)[0];return '<tr><td>+'+x+'٪</td><td>'+(z?(z===a?'🟤 ':'⚫ ')+z.symbol:'—')+'</td></tr>'}).join('')}
  </tbody></table></div></section>`;
}
function render(rows,symbol){
  const selected=rows.filter(r=>r.baseSymbol===symbol);
  if(!selected.length){$('app').innerHTML='<section class="card empty">⚠️ برای این نماد، داده معتبر اختیار در منبع فعلی پیدا نشد. عددسازی نمی‌شود.</section>';return;}
  const groups={}; selected.forEach(r=>(groups[r.maturity]??=[]).push(r));
  const ms=Object.keys(groups).filter(Boolean).sort();
  const m1=ms[0],m2=ms[1],g1=(groups[m1]||[]).sort((a,b)=>(b.dailyValue||0)-(a.dailyValue||0)).slice(0,5),g2=(groups[m2]||[]).sort((a,b)=>(b.dailyValue||0)-(a.dailyValue||0)).slice(0,5);
  const base=safe((g1[0]||g2[0])?.underlying);
  let h='<section class="card"><h2>نماد پایه: '+symbol+'</h2><div class="note">ماه اول: '+(m1||'—')+' 🟤 &nbsp; | &nbsp; ماه دوم: '+(m2||'—')+' ⚫ &nbsp; | &nbsp; ماه سوم: حذف</div>';
  if(!base){h+='<div class="note">⚠️ قیمت سهم پایه از منبع فعلی قابل تأیید نیست؛ محاسبات عددی وابسته به آن نمایش داده نمی‌شود.</div></section>'; $('app').innerHTML=h;return;}
  h+='</section>';
  if(g1.length)h+=table1(g1,'🟤',base)+table2(g1,'🟤',base)+riskSummary(g1,'ماه اول');
  if(g2.length)h+=table1(g2,'⚫',base)+table2(g2,'⚫',base)+riskSummary(g2,'ماه دوم');
  h+=table3(g1,g2)+finalResult(g1,g2);
  $('app').innerHTML=h;
}
let cacheRows=[];
async function loadSymbols(keep=true){
  const r=await fetch('/api/symbols',{cache:'no-store'}),j=await r.json();
  const s=$('symbol'),old=s.value;
  s.innerHTML='';
  (j.symbols||[]).forEach(x=>{const o=document.createElement('option');o.value=x;o.textContent=x;s.appendChild(o)});
  if(keep&&[...s.options].some(o=>o.value===old))s.value=old;
}
async function load(){
  $('status').textContent='در حال دریافت آخرین داده معتبر بازار…';
  try{
    const r=await fetch('/api/options?symbol='+encodeURIComponent($('symbol').value),{cache:'no-store'});
    const j=await r.json();
    cacheRows=j.data||[];
    render(cacheRows,$('symbol').value);
    $('status').textContent=(j.marketOpen?'🟢 بازار باز':'🔴 بازار بسته')+' — آخرین دریافت: '+new Date(j.updatedAt).toLocaleString('fa-IR')+' — بروزرسانی خودکار: هر ۳۰ ثانیه';
  }catch(e){
    $('status').textContent='⚠️ داده تازه قابل دریافت نیست؛ هیچ عدد ساختگی نمایش داده نمی‌شود.';
    $('app').innerHTML='<section class="card empty">منبع بازار فعلاً پاسخ معتبر نداد.</section>';
  }
}
$('refresh').onclick=load;
$('symbol').addEventListener('change',load);
(async()=>{try{await loadSymbols(false);if($('symbol').value)await load()}catch(e){$('status').textContent='⚠️ دریافت فهرست نمادها ناموفق بود.'}})();
setInterval(async()=>{try{await loadSymbols(true)}catch(e){};load()},30000);
</script>
</body>
</html>`;

function n(v){
  const x=Number(String(v??"").replace(/,/g,""));
  return Number.isFinite(x)?x:null;
}
function pick(o,...keys){
  for(const k of keys)if(o?.[k]!==undefined&&o?.[k]!==null&&o?.[k]!=="")return o[k];
  return null;
}
function arrayFrom(raw){
  if(Array.isArray(raw))return raw;
  for(const k of ["data","Data","items","Items","result","Result","marketWatch","MarketWatch","rows","Rows"])
    if(Array.isArray(raw?.[k]))return raw[k];
  return [];
}
function inferBase(o,symbol){
  const explicit=pick(o,"UnderlyingSymbol","underlyingSymbol","BaseSymbol","baseSymbol","Underlying","underlying","Base","base","UnderlyingInstrumentSymbol");
  if(explicit)return String(explicit);
  const name=String(pick(o,"Name","name","Description","description")||"");
  const m=name.match(/(?:اختیار|آپشن).*?([آ-یA-Za-z][آ-یA-Za-z0-9]*)/);
  if(m)return m[1];
  return null;
}
function norm(raw){
  return arrayFrom(raw).map(o=>{
    const symbol=String(pick(o,"Symbol","symbol","InstrumentSymbol","instrumentSymbol","Name","name")||"").trim();
    const baseSymbol=inferBase(o,symbol);
    const maturity=String(pick(o,"Maturity","maturity","ExerciseDate","exerciseDate","MaturityDate","maturityDate","Date","date","JalaliMaturityDate")||"").trim();
    return {
      symbol,baseSymbol,maturity,
      premium:n(pick(o,"LastPrice","lastPrice","Price","price","LastTradedPrice","lastTradedPrice","PrcLast","Last","last","PClosing")),
      underlying:n(pick(o,"UnderlyingPrice","underlyingPrice","BasePrice","basePrice","UnderlyingLastPrice","underlyingLastPrice","UnderlyingClose","underlyingClose")),
      strike:n(pick(o,"Strike","strike","ExercisePrice","exercisePrice","StrikePrice","strikePrice")),
      dailyValue:n(pick(o,"DailyValue","dailyValue","TradeValue","tradeValue","Value","value","VolumeValue","volumeValue","QTotCap","qTotCap","TotalTradeValue")),
      lastTime:pick(o,"LastTradeTime","lastTradeTime","Time","time","UpdateTime","updateTime")
    };
  }).filter(x=>x.symbol&&x.maturity&&x.baseSymbol&&x.premium!=null&&x.strike!=null);
}
async function getJson(u){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),10000);
  try{
    const r=await fetch(u,{signal:c.signal,headers:{"User-Agent":"Mozilla/5.0","Accept":"application/json"}});
    if(!r.ok)throw new Error("HTTP "+r.status);
    return await r.json();
  }finally{clearTimeout(t)}
}
async function freshData(){
  for(const u of SOURCES){
    try{
      const d=norm(await getJson(u));
      if(d.length)return {data:d,source:u};
    }catch{}
  }
  return {data:[],source:null};
}
async function handler(req,res){
  const u=new URL(req.url,"http://localhost");
  if(u.pathname==="/health"){
    res.writeHead(200,{"content-type":"application/json"});
    return res.end(JSON.stringify({ok:true}));
  }
  if(u.pathname==="/api/options"||u.pathname==="/api/symbols"){
    const got=await freshData(),data=got.data;
    const marketOpen=data.some(x=>x.lastTime);
    const symbols=[...new Set(data.map(x=>x.baseSymbol).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"fa"));
    if(u.pathname==="/api/symbols"){
      res.writeHead(data.length?200:503,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});
      return res.end(JSON.stringify({updatedAt:new Date().toISOString(),marketOpen,symbols}));
    }
    const requested=u.searchParams.get("symbol");
    const filtered=requested?data.filter(x=>x.baseSymbol===requested):data;
    res.writeHead(data.length?200:503,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});
    return res.end(JSON.stringify({updatedAt:new Date().toISOString(),marketOpen,source:got.source? "TSETMC":"unavailable",data:filtered}));
  }
  res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});
  res.end(page);
}
http.createServer(handler).listen(PORT,()=>console.log("listening "+PORT));