/**
 * secFilings — US primary-filing adapter (SEC EDGAR). Free, no API key; SEC only
 * asks for a descriptive User-Agent. This is the US counterpart to filingData.js's
 * HKEX path: latest 8-K / 10-Q / 10-K so the agent can anchor on real events.
 *
 *   getUsFilings("AAPL") → { providerStatus, source, filings:[{title,filingType,publishedAt,url}], ... }
 *
 * Parsing is split into pure functions (parseSecSubmissions) so it is unit-testable
 * without network.
 */

import { bareSymbol } from "./market.js";
import { normalizeTicker } from "./data.js";

const SEC_UA = process.env.SEC_USER_AGENT || "Luvio Research research@luvio.app";
// Forms worth surfacing: current reports, quarterly/annual, foreign-issuer equivalents.
const FORMS_OF_INTEREST = new Set(["8-K", "10-Q", "10-K", "10-K/A", "10-Q/A", "6-K", "20-F", "40-F", "8-K/A"]);

let tickerMapCache = null;
let tickerMapFetchedAt = 0;
const TICKER_MAP_TTL_MS = 24 * 60 * 60 * 1000;

async function fetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": SEC_UA, Accept: "application/json" }
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`${response.status} ${text.slice(0, 120)}`);
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

/** Build a { TICKER → 10-digit CIK } lookup from SEC's company_tickers.json (pure). */
export function buildTickerCikMap(raw) {
  const map = {};
  const rows = raw && typeof raw === "object" ? Object.values(raw) : [];
  for (const row of rows) {
    if (!row?.ticker || row.cik_str == null) continue;
    map[String(row.ticker).toUpperCase()] = String(row.cik_str).padStart(10, "0");
  }
  return map;
}

async function tickerToCik(ticker) {
  const symbol = bareSymbol(ticker).toUpperCase();
  const fresh = tickerMapCache && Date.now() - tickerMapFetchedAt < TICKER_MAP_TTL_MS;
  if (!fresh) {
    const raw = await fetchJson("https://www.sec.gov/files/company_tickers.json", 9000);
    tickerMapCache = buildTickerCikMap(raw);
    tickerMapFetchedAt = Date.now();
  }
  const cik = tickerMapCache[symbol];
  if (!cik) throw new Error(`SEC 没有匹配到 ${symbol} 的 CIK`);
  return cik;
}

/**
 * Turn an EDGAR submissions payload into a clean filings list (pure).
 * @param {object} json   - the data.sec.gov submissions JSON
 * @param {string} cik    - 10-digit CIK (used to build the document URL)
 * @param {number} limit  - max filings to return
 */
export function parseSecSubmissions(json, cik, limit = 12) {
  const recent = json?.filings?.recent;
  if (!recent || !Array.isArray(recent.form)) return [];
  const cikNum = String(cik).replace(/^0+/, "");
  const out = [];
  for (let i = 0; i < recent.form.length; i++) {
    const form = recent.form[i];
    if (!FORMS_OF_INTEREST.has(form)) continue;
    const accession = recent.accessionNumber?.[i] || "";
    const accessionNoDash = accession.replace(/-/g, "");
    const primaryDoc = recent.primaryDocument?.[i] || "";
    const desc = recent.primaryDocDescription?.[i] || recent.items?.[i] || "";
    const url = accessionNoDash && primaryDoc
      ? `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accessionNoDash}/${primaryDoc}`
      : `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=${encodeURIComponent(form)}`;
    out.push({
      title: desc ? `${form} · ${String(desc).slice(0, 80)}` : form,
      filingType: form,
      publishedAt: recent.filingDate?.[i] || "",
      url,
      source: "SEC EDGAR"
    });
    if (out.length >= limit) break;
  }
  return out;
}

export async function getUsFilings(ticker) {
  try {
    const cik = await tickerToCik(ticker);
    const json = await fetchJson(`https://data.sec.gov/submissions/CIK${cik}.json`, 9000);
    const filings = parseSecSubmissions(json, cik);
    if (!filings.length) throw new Error("SEC EDGAR 没有返回目标表格");
    return {
      ticker: normalizeTicker(ticker),
      providerStatus: "ok",
      source: "SEC EDGAR",
      filings,
      asOf: new Date().toISOString(),
      errors: []
    };
  } catch (error) {
    return {
      ticker: normalizeTicker(ticker),
      providerStatus: "missing",
      source: "未接入",
      filings: [],
      asOf: new Date().toISOString(),
      errors: [error.message]
    };
  }
}

export function _resetSecCache() {
  tickerMapCache = null;
  tickerMapFetchedAt = 0;
}
