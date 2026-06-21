/**
 * Compare route — model-free, side-by-side comparison of 2–3 HK companies on the
 * dimensions that matter for a value call: valuation odds, profit quality, moat
 * and risks. Reuses the deterministic data + valuation + financial-quality
 * engines (no model round-trip), so it returns fast.
 */

import { sendJson } from "../utils/async.js";
import { companyByTicker } from "../../data.js";
import { collectDataSources } from "../services/dataSources.js";
import { displayValuation } from "../services/valuationEngine.js";
import { computeFinancialQuality } from "../services/financialQuality.js";

function num(value) {
  const n = parseFloat(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

async function buildCompareEntry(ticker) {
  const profile = companyByTicker(ticker);
  if (!profile) return { ticker, notFound: true };

  const data = await collectDataSources({ company: profile, suppliedMarketSnapshot: null });
  const market = data.marketSnapshot;
  const valuation = displayValuation(profile, market, data.financialsData);
  const fq = computeFinancialQuality(data.financialsData, { marketCap: market?.marketCap, pe: market?.pe });

  let odds = null;
  let upside = null;
  if (!valuation.cannotValueReason) {
    const price = num(valuation.currentPrice);
    const bull = num(valuation.bull);
    const bear = num(valuation.bear);
    if (price && bull && bear) {
      const up = (bull - price) / price;
      const down = (price - bear) / price;
      odds = down > 0.0001 ? Number((up / down).toFixed(1)) : null;
      upside = `+${(up * 100).toFixed(0)}%`;
    }
  }

  return {
    ticker: profile.ticker,
    name: profile.nameZh || profile.nameEn || profile.ticker,
    industry: profile.industry || profile.sector || "",
    price: market?.price ?? null,
    pe: market?.pe ?? profile.pe ?? null,
    qualityScore: fq.quality?.qualityScore ?? null,
    valuationMethod: valuation.cannotValueReason ? null : valuation.method,
    upside,
    odds,
    moat: (profile.moat || []).slice(0, 3),
    risks: (profile.risks || []).slice(0, 2)
  };
}

export async function handleCompareApi(req, res) {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
    const tickers = (url.searchParams.get("tickers") || "")
      .split(",")
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean)
      .filter((t, i, arr) => arr.indexOf(t) === i)
      .slice(0, 3);
    if (tickers.length < 2) {
      sendJson(res, 400, { error: "请提供至少 2 个港股代码（逗号分隔），最多 3 个。" });
      return;
    }
    const companies = await Promise.all(tickers.map(buildCompareEntry));
    sendJson(res, 200, { companies });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "对比失败" });
  }
}
