import { sendJson } from "../utils/async.js";
import { getProviderStatus } from "../services/modelGateway.js";

const fmpKey = () => process.env.FMP_API_KEY;
const finnhubKey = () => process.env.FINNHUB_API_KEY;
const newsApiKey = () => process.env.ALPHAVANTAGE_API_KEY || process.env.TWELVEDATA_API_KEY;
const webSearchKey = () => process.env.TAVILY_API_KEY || process.env.SERPAPI_API_KEY;

export function handleStatusApi(req, res) {
  const hasFmp = fmpKey();
  const hasNews = finnhubKey() || newsApiKey();
  const hasWebSearch = webSearchKey();
  const aiStatus = getProviderStatus();

  sendJson(res, 200, {
    sources: [
      { id: "market", name: "港股行情", status: "ok", detail: "Tencent Finance 免费接口" },
      { id: "financials", name: "财务数据", status: hasFmp ? "ok" : "limited", detail: hasFmp ? "FMP 已配置" : "Tencent 财经基础数据（PE/PB/市值），详细财报需配置 FMP_API_KEY" },
      { id: "news", name: "新闻舆情", status: hasNews ? "ok" : "limited", detail: hasNews ? "Yahoo RSS + Bing + 东方财富" : "Yahoo RSS + Bing + 东方财富（国内可用）" },
      { id: "web_evidence", name: "网页证据层", status: hasWebSearch ? "ok" : "limited", detail: hasWebSearch ? "Tavily / SerpAPI 已配置，公开搜索会缓存到 SQLite" : "未配置专业搜索 API，使用 Yahoo/Bing 公开兜底" },
      { id: "filings", name: "公告数据", status: "limited", detail: "HKEX 网页解析（Beta）" }
    ],
    evidenceBacklog: [
      { id: "financial_snapshots", label: "财报三表与估值倍数", priority: "P0", providers: ["FMP", "EODHD", "Finnhub"] },
      { id: "hkex_filings", label: "HKEX 公告与公司 IR PDF", priority: "P0", providers: ["HKEXnews", "Company IR"] },
      { id: "web_evidence", label: "可信 web 搜索证据层", priority: "P1", providers: ["Bing Search", "SerpAPI"] },
      { id: "analyst_estimates", label: "一致预期与目标价", priority: "P1", providers: ["Finnhub", "FMP", "EODHD"] }
    ],
    ai: aiStatus,
    db: { companies: "654+" },
    updatedAt: new Date().toISOString()
  });
}
