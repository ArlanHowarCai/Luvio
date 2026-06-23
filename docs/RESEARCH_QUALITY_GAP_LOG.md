# 研究质量差距日志 — Luvio vs HoneClaw（BABA 实测复盘）

> 记录日期：2026-06-23
> 触发：用户用同一个阿里巴巴问题分别问 HoneClaw（hone-claw.com）和 Luvio，对比两份回答。
> 目标：找出真正的质量差距，定位根因到 `file:line`，再给方案候选。**先找差距，再看方案。**
> 关联：`docs/DATA_SOURCE_STRATEGY.md`、`docs/PLATFORM_BENCHMARK.md`、记忆 `honeclaw-competitive-analysis`。

---

## 0. 一句话结论（最重要，先看这条）

**这次差距 90% 不在"分析能力/提示词/推理框架"，而在"数据接地"（data grounding）。**
Luvio 的回答骨架（赔率、证伪条件、三层赚钱机制、辩证 Bull/Bear/Base、长期画像）其实和 HoneClaw 持平甚至更结构化；但它是在**对着一份静态本地档案 + 一个行情价**做高质量推理，而 HoneClaw 是在**对着本季度真实财报数字 + 实时行情 + 实时新闻**做推理。

换句话说：**我们不缺一个更聪明的大脑，我们缺给大脑喂新鲜事实的管线。** 这是个好消息——数据管线比"提示词调教"可控得多。

---

## 1. 两份回答的硬对比（复现证据）

| 维度 | HoneClaw | Luvio | 差距性质 |
|------|----------|-------|----------|
| 行情 | $102.60 盘中、10:34 EDT、-2.26%、1月-20.75%、YTD-30.00%、TTM PE 16.62、股息 1.0% | 98.95 HKD 收盘（腾讯财经）✅ | Luvio 有价、缺涨跌幅/区间回报/TTM PE 真值 |
| 财报数字 | Q4 FY26 收入 ¥2433.8亿(+3%/+11%调整)、云 ¥416.26亿(+38%)、AI产品 ¥89.71亿(连续11季三位数)、经营亏损 ¥8.48亿(去年+¥284.65亿)、调整后 EBITA ¥51.02亿(-84%)、季度 FCF -¥173亿、全年 FCF -¥466.09亿 | **全部"当前未核到"**；PE 用"市场预估利润约900亿"**估算**约14倍 | **致命**：核心财务事实 0 条真值，且违反自己的纪律"不能用模型猜数字" |
| 分部数据 | 云、AI 产品、淘天逐项有数 | 只能定性谈"云待验证" | 缺分部口径 |
| 新闻/事件 | 读了阿里官方业绩 PDF，得出"市场在杀确定性溢价" | 论点是"电商竞争未减、云与国际待验证"——**过去3年任何时点都成立** | 缺本季度增量事件 |
| 来源 | MarketWatch + 阿里 IR + 业绩 PDF（一手） | 阿里 IR、HKEXnews、腾讯财经（**入口链接，非具体抓取到的数字**） | 缺一手抽取 |
| 估值区间 | TTM PE 16.62（真值） | 77.18/98.95/126.66 = **现价±25% 机械带**，"中性=现价"自循环 | 估值无信息量 |
| 自评置信度 | 高（有一手数据兜底） | "约六成" | Luvio 诚实，但天花板被档案锁死 |
| 输出结构 | 事实/推断/结论/动作/证伪 5 层散文 | 结论/事实/推断/估值风险/动作/证伪/我的判断/还缺什么 — **更细** | **Luvio 持平或更强** |
| 可视化 | 纯 Markdown 文本 | decisionPanel + 估值条 + 溯源卡 + 置信度芯片 | **Luvio 明显更强（产品化）** |

**复现证据**：Luvio 回答里的护城河（商家生态/支付物流协同/云基础设施/品牌心智）、Bull/Bear、估值区间，与 `src/data.js:174-178` 的硬编码 9988.HK 档案**逐字一致**——证明这一轮几乎完全由静态 seed 驱动，而非实时数据。

---

## 2. 维度化打分（满分 10）

| 维度 | Luvio | HoneClaw | 说明 |
|------|:---:|:---:|------|
| 推理框架/纪律 | 8 | 8 | `RESEARCH_DISCIPLINE` 宪法（`prompts.js:10`）对标 soul.md，持平 |
| 输出结构 | 8 | 7 | Luvio 分层更细、有证伪条件表 |
| 产品化/可视化 | 8 | 5 | decisionPanel/估值条/溯源卡，HoneClaw 是纯文本 |
| **数据接地（行情）** | 6 | 9 | 腾讯有价，但缺涨跌幅/区间/TTM PE |
| **数据接地（财报三表）** | **2** | **9** | **港股没有真三表源；这是核心痛点** |
| **数据接地（一手公告/PDF）** | **2** | **8** | 没有抓取并抽取最新业绩 PDF |
| **数据接地（实时新闻/事件）** | **2** | **8** | 无 Tavily key + 沙箱墙搜索引擎 → 证据 0 条 |
| 估值真实性 | 3 | 7 | 港股是机械 PE 带，非真倍数/DCF |
| 商业价值 | 6 | 8 | 用户能感知到"它没真在读最新财报" |

**结论：Luvio 在"脑"上 7-8 分，在"接地"上 2-3 分。HoneClaw 反过来。用户感受到的"质量差"几乎全部来自接地分。**

---

## 3. 根因链（可追溯到代码）

为什么 Luvio 必然退回本地档案？四条根因，每条都能在代码里指出：

### 根因 A：港股没有真三表数据源（最致命）
- "阿里巴巴"在 seed 里是 `9988.HK`（`src/data/hkStocks.js:15`），问题走港股路径。
- `getFinancials()`（`src/financialData.js:454`）顺序 FMP→Finnhub→Yahoo→Tencent。
- FMP 免费档对港股 **premium 封锁**；Finnhub/Yahoo 沙箱内不可达/覆盖差 → 落到 `fetchTencentFinancials`（`src/financialData.js:322`）。
- 腾讯那条**只返回 price/PE/PB/marketCap**，`revenue / netIncome / operatingCashFlow / freeCashFlow` **全部写死 null**（`src/financialData.js:359-377`）。
- ⇒ **任何港股都拿不到收入/利润/现金流。** 财务质量评分、估值、"赚不赚钱"全部塌方到档案。

### 根因 B：没有一手公告/业绩 PDF 的"抽数"能力
- HoneClaw 直接读了阿里业绩 PDF 把数字抠出来。
- Luvio 有 `documentParser.js` / `filingData.js`，但 `getRecentFilings` 只回**公告标题列表**，不把最新季度业绩表抽成结构化数字。
- ⇒ 同一份阿里官方 PDF（Luvio 来源里甚至列了 IR 链接），我们从没真正读进去。

### 根因 C：实时新闻/Web 证据在部署环境里等于 0
- 无 `TAVILY_API_KEY`；沙箱墙了 DuckDuckGo/Bing/Yahoo 搜索。
- `researchWebEvidence`（`src/server/services/webEvidenceService.js:463`）返回 evidence 0 条 → "近期发生了什么"这层死掉。
- ⇒ 模型没有任何本季度增量，论点只能写成"过去3年都对"的万能话。

### 根因 D：估值引擎对港股是自循环
- `displayValuation` 缺真 EPS/FCF 时回退"现价±25% PE 带"（见 roadmap 记忆 + `valuationEngine.js`）。
- 77.18/98.95/126.66 ≈ 98.95×0.78 / 98.95 / 98.95×1.28。
- ⇒ "中性=现价"，估值从价格反推、对价格不构成任何独立判断。

### 提示词层的放大效应（非根因，但加剧）
- `buildChatPrompt`（`src/server/services/answerComposer.js:568`）在真数据缺失时，把"本地公司档案"（moat/bull/bear/metrics）作为主素材注入，`liveFinancials` 显示"完整三表暂未核到（仅本地档案口径）"。
- 诚实纪律（"当前未核到"）是对的，但它把回答**天花板锁死在档案质量**上。

---

## 4. Luvio 已经领先、必须保住的（不要在补数据时改坏）

1. 结构化 `decisionPanel` + 估值条 + 溯源卡 + 置信度芯片 —— HoneClaw 纯文本，这是我们的产品壁垒。
2. `RESEARCH_DISCIPLINE` 宪法（概率优先/四层输出/证伪条件/禁止编数字）—— 与 soul.md 同级。
3. 长期公司画像记忆（P2.1）—— 架构对标 HoneClaw 的 `company_profiles`。
4. HK + US 双市场（HoneClaw 只做美股）。
5. 诚实的缺口/置信度标注 —— 比"自信编数字"安全，是正确的底线。

---

## 5. 方案候选（先记录，未承诺实现；按性价比排序）

> 原则：补"接地"，不动"脑"。每条都要落到一张标准化财务快照表，让"赚不赚钱/贵不贵/现金流"统一取数（呼应 `DATA_SOURCE_STRATEGY.md` 的 `financial_snapshots` 设想）。

**S1（最高性价比）港股真财报来源。** 三选一或组合：
- (a) 解析 HKEXnews / 公司 IR 的业绩公告 PDF → 抽收入/利润/经营现金流/FCF/分红回购，写入 `financial_snapshots`。复用现有 `documentParser.js`。**这条直接对标 HoneClaw 读 PDF 的打法。**
- (b) 对"BABA"这类双重上市标的，**优先路由到美股 ADR**（FMP 免费档有真三表，AAPL 已验证 83/100），HK 价单独显示。需要一张 ADR↔H 股映射。
- (c) 接一个覆盖港股基本面的付费档（FMP premium / EODHD）。最快但要花钱。

**S2 一手业绩 PDF 抽数管线。** `getRecentFilings` 之后增加"取最新业绩公告 PDF → 抽关键财务表 → 结构化"。这同时解决"分部数据"缺口（云/AI/淘天分部）。

**S3 让实时证据在生产环境真的活起来。** 配 `TAVILY_API_KEY`（免费 1000/月）+ 部署到非沙箱环境验证 `researchWebEvidence` 真出证据。这是"本季度增量新闻"的来源。

**S4 港股估值去自循环。** 有了真 EPS/FCF 后，`displayValuation` 用真倍数/反向 DCF，而不是现价±25%。

**S5 行情补全。** 港股行情补"涨跌幅、1月/YTD 区间回报、TTM PE 真值"（HoneClaw 有，我们缺），让"事实"层第一段就硬。

**建议落地顺序：S1(a) + S2 一起做（一手 PDF 抽数是港股的命门）→ S3（生产环境实时证据）→ S5 → S4。** S1(b) ADR 路由可作为"立刻见效"的临时桥：今天就能让阿里/腾讯类标的拿到真三表。

---

## 5.5 已拍板的方向（2026-06-24）

用户三个岔路口全选推荐：
1. **方式 = 外科手术·美股优先**（不大重写；保住已领先的脑/可视化/纪律，只硬化数据层）。
2. **港股 = 先冻结保留**（不删 hkStocks/HK 路由/腾讯回退；美股聚焦期默认路由到美股，等美股达标再补港股真财报）。
3. **侧栏 = 图标工具条 + 行情快照**（行情上位，四按钮压成一条图标条）。

### 执行计划（按性价比 + 体感痛点排序）

- **P0 体感（先做，可浏览器验证）**：侧栏外科手术。`src/app.js:768` 四个 `snapshot-export` 全宽按钮 → 一条 4 图标工具条；新增行情快照（价/涨跌%/TTM PE/市值/YTD）。换掉 `◆◷▣↓` 手画字符。改 `styles.css`。**注意美股聚焦：快照取数要走真 FMP 数据。**
- **P1 接地核心**：① `buildChatPrompt`/`buildReportPrompt` 取数优先级——有真财报时**真数据压档案**，`liveFinancials` 为主、`本地档案` 降为辅。② 行情补时序：涨跌%、1月/YTD 区间回报、TTM PE 真值（美股 FMP/Finnhub 有）。③ 一致预期/目标价进估值（`getAnalystEstimates` 已有，接进 `displayValuation`）。
  - **✅ 已完成（2026-06-24）**：① 真财报前置——`answerComposer.js` 有 `financialsData.providerStatus==="ok"` 时用 `financialsToMarkdown` 前置"已核到的实时财报（…唯一事实源）"块,档案降为"定性参考,不能当财务数字来源",并加纪律规则。chat+report 两条提示词都改。③ 分析师目标价进估值——`valuationEngine.displayValuation` 加 `estimates` 参数:有一致目标价时用"分析师目标价区间"(包住现价,可视化自洽)替代机械±25%带,并在任何 band 上附 `analyst` 锚点(目标价+较现价上行+区间);`chat.js` 传 `result.estimatesData`;前端 `renderValuation` 新增"分析师目标价"行(已浏览器验证)。② 部分:行情**当日涨跌%**已进 facts;**1M/YTD 区间回报仍缺**(需历史价端点+非沙箱验证,留作 P1 收尾)。smoke.mjs 加 4 条断言,全绿(17 passed)。
- **P2 一手 + 实时**：① 美股 8-K/最新业绩 PDF 抽数 → 分部口径（云/AI/各 segment），复用 `documentParser.js`。② 配 `TAVILY_API_KEY` + 在非沙箱环境实测 `researchWebEvidence` 真出证据。
  - **✅ 已完成（2026-06-24）**：① 美股一手公告——新 `src/secFilings.js`(SEC EDGAR,免费无 key,只需 User-Agent):`tickerToCik`(company_tickers.json)+`parseSecSubmissions`(8-K/10-Q/10-K,URL 拼装)纯函数可单测;`filingData.getRecentFilings` 美股路由到 SEC、港股保持 HKEX。② 分部收入——`financialData.normalizeSegments`(纯,兼容 FMP flat/nested 两种形态)+`fetchFmpSegments`(`/stable/revenue-product-segmentation`)+`getRevenueSegments`;`dataSources` 美股专属、best-effort 抓取后挂到 `financialsData.segments`,`financialsToMarkdown` 渲染"分部收入(云/AI…占比)"→ 因 P1 已把该块前置为提示词唯一财务事实源,分部数据自动进模型。③ 实时新闻——`webEvidenceService.searchTavily` 代码已就绪,**只差配 `TAVILY_API_KEY`(免费 1000/月)+ 非沙箱实测**,无需改码。smoke.mjs +6 断言全绿(17 passed)。
  - **需要用户做的（key/钱）**：Tavily key 免费(实时新闻必需);SEC 免费;FMP 分部收入用现有 key 试,**免费档可能不含 segmentation → 若 402/403 自动跳过,要真分部数据可能需 FMP 付费档**。
- **测试隔离修复（2026-06-24）**：测试曾写真实 `luvio.db`(泄漏"test question"会话)。`db/index.js` DB 路径改为 `LUVIO_DB_PATH` 可覆盖且延迟读取;新 `tests/setupTestDb.mjs` 指向临时库,三个测试文件首行导入;已清掉泄漏行。验证:跑测试真实库行数不变。
- **P3 美股估值去自循环**：有真 EPS/FCF 时用真倍数/反向 DCF 替换"现价±25% 带"。

## 6. 留给下一轮的验证动作

- [ ] 在真实网络环境（非沙箱）实测：配 FMP key 后港股 `getFinancials` 是否仍 premium 封锁（确认 S1(c) 是否必须）。
- [ ] 实测 S1(b)：把"阿里巴巴"路由到 `BABA`(US) 时，FMP 免费档能否返回真三表；与 9988.HK 口径怎么并列展示。
- [ ] HKEXnews 业绩 PDF 的结构稳定性（能否稳定抽出主要财务表）。
- [ ] 配 Tavily 后，BABA 这类问题的 web evidence 实际条数与质量。
