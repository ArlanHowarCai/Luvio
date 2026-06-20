import { companyByTicker, findCompany } from "../../data.js";
import { readJsonBody, sendJson } from "../utils/async.js";
import { classifyResearchIntent } from "../services/intentClassifier.js";
import { researchWebEvidence } from "../services/webEvidenceService.js";

export async function handleWebResearchApi(req, res) {
  try {
    const payload = await readJsonBody(req);
    const company = payload.company?.ticker
      ? companyByTicker(payload.company.ticker) || payload.company
      : findCompany(payload.question || payload.companyName || "");
    if (!company?.ticker) {
      sendJson(res, 400, { error: "缺少公司上下文，无法检索网页证据。" });
      return;
    }
    const intent = payload.intent || classifyResearchIntent(payload.question || "");
    const result = await researchWebEvidence({
      company,
      question: payload.question || "",
      intent,
      forceRefresh: Boolean(payload.forceRefresh)
    });
    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "网页证据检索失败" });
  }
}
