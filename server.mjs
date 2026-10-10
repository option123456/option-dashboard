import http from "node:http";
import { readFile } from "node:fs/promises";

const PORT = Number(process.env.PORT || 10000);
const HOST = "0.0.0.0";
const TSE_URL = "https://cdn.tsetmc.com/api/Instrument/GetInstrumentOptionMarketWatch/1";
const cache = { at: 0, rows: null, error: null };
const TTL_MS = 20_000;

const send = (res, status, data, type = "application/json; charset=utf-8") => {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" });
  res.end(typeof data === "string" ? data : JSON.stringify(data));
};
const allStrings = (v, out = []) => {
  if (v && typeof v === "object") {
    if (Array.isArray(v)) v.forEach(x => allStrings(x, out));
    else Object.values(v).forEach(x => allStrings(x, out));
  } else if (typeof v === "string") out.push(v);
  return out;
};
const flatten = (v, out = []) => {
  if (Array.isArray(v)) v.forEach(x => flatten(x, out));
  else if (v && typeof v === "object") {
    const values = Object.values(v);
    if (values.some(x => x === null || ["string", "number", "boolean"].includes(typeof x))) out.push(v);
    for (const x of values) if (x && typeof x === "object") flatten(x, out);
  }
  return out;
};
const pick = (row, patterns) => {
  for (const p of patterns) {
    const k = Object.keys(row).find(key => p.test(key));
    if (k !== undefined && row[k] !== "" && row[k] !== null) return row[k];
  }
  return null;
};
const normalize = row => ({
  raw: row,
  name: pick(row, [/^lVal18AFC_C$/i, /symbol.*option/i, /option.*symbol/i, /^lVal18AFC$/i, /^name$/i]),
  underlying: pick(row, [/lVal18AFC.*U/i, /underlying.*name/i, /base.*symbol/i, /symbol.*base/i]),
  premium: pick(row, [/^pClosing_P$/i, /option.*closing/i, /^pClosing$/i, /^pDrCotVal_P$/i]),
  underlyingPrice: pick(row, [/^pClosing_U$/i, /underlying.*price/i, /base.*price/i, /^pClosing.*under/i]),
  strike: pick(row, [/^strikePrice$/i, /strike/i]),
  tradedValue: pick(row, [/^qTotCap_C?$/i, /traded.*value/i, /trade.*value/i]),
  volume: pick(row, [/^qTotTran5J_C?$/i, /volume/i]),
  remainingDay: pick(row, [/^remainingDay$/i, /remaining.*day/i]),
  endDate: pick(row, [/^endDate$/i, /expire.*date/i, /maturity/i]),
  code: pick(row, [/^insCode_C$/i, /^insCode$/i, /instrument.*code/i])
});
async function getRows(force = false) {
  if (!force && cache.rows && Date.now() - cache.at < TTL_MS) return { rows: cache.rows, fetchedAt: cache.at };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const r = await fetch(TSE_URL, { signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; OptionDashboard/1.0)", "Accept": "application/json,text/plain,*/*", "Referer": "https://tsetmc.com/" } });
    if (!r.ok) throw new Error("منبع بورس پاسخ HTTP " + r.status + " داد.");
    const body = await r.json();
    const rows = flatten(body);
    if (!rows.length) throw new Error("پاسخ منبع دریافت شد اما ساختار داده قابل شناسایی نبود.");
    cache.rows = rows; cache.at = Date.now(); cache.error = null;
    return { rows, fetchedAt: cache.at };
  } catch (e) {
    cache.error = e.name === "AbortError" ? "مهلت اتصال به منبع بورس تمام شد." : e.message;
    throw new Error(cache.error);
  } finally { clearTimeout(timer); }
}
async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/health") return send(res, 200, "ok", "text/plain; charset=utf-8");
  if (url.pathname === "/api/symbols") return send(res, 200, ["اهرم"]);
  if (url.pathname === "/api/options") {
    try {
      const { rows, fetchedAt } = await getRows(url.searchParams.get("refresh") === "1");
      const normalized = rows.map(normalize);
      // Only include records explicitly linked to اهرم; do not guess from unrelated contracts.
      const matched = normalized.filter(x => allStrings(x.raw).some(s => s.includes("اهرم")));
      return send(res, 200, {
        symbol: "اهرم",
        source: TSE_URL,
        fetchedAt: new Date(fetchedAt).toISOString(),
        sourceRows: rows.length,
        matchedRows: matched.length,
        schema: rows[0] ? Object.keys(rows[0]) : [],
        options: matched
      });
    } catch (e) {
      return send(res, 502, { error: e.message, source: TSE_URL, liveData: false });
    }
  }
  if (url.pathname === "/" || url.pathname === "/index.html") {
    try { return send(res, 200, await readFile(new URL("./index.html", import.meta.url), "utf8"), "text/html; charset=utf-8"); }
    catch { return send(res, 500, "فایل داشبورد پیدا نشد.", "text/plain; charset=utf-8"); }
  }
  return send(res, 404, { error: "مسیر پیدا نشد." });
}
http.createServer(handler).listen(PORT, HOST, () => console.log("Option dashboard listening on " + PORT));
