import { getDb } from "../../db/index.js";

function ensureWebEvidenceTable() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS web_evidence (
      id                TEXT PRIMARY KEY,
      ticker            TEXT NOT NULL,
      intent            TEXT NOT NULL,
      query             TEXT,
      title             TEXT,
      url               TEXT NOT NULL,
      source            TEXT,
      source_type       TEXT,
      snippet           TEXT,
      published_at      TEXT,
      fetched_at        TEXT NOT NULL,
      relevance_score   REAL,
      credibility_score REAL,
      content_hash      TEXT,
      raw_json          TEXT,
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_web_evidence_ticker_intent ON web_evidence(ticker, intent);
    CREATE INDEX IF NOT EXISTS idx_web_evidence_url ON web_evidence(url);
    CREATE INDEX IF NOT EXISTS idx_web_evidence_fetched_at ON web_evidence(fetched_at);
  `);
}

function safeJson(value) {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return null;
  }
}

function parseJson(value, fallback = null) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function hydrate(row) {
  if (!row) return null;
  return {
    id: row.id,
    ticker: row.ticker,
    intent: row.intent,
    query: row.query || "",
    title: row.title || "",
    url: row.url || "",
    source: row.source || "",
    sourceType: row.source_type || "",
    snippet: row.snippet || "",
    publishedAt: row.published_at || "",
    fetchedAt: row.fetched_at || "",
    relevanceScore: Number(row.relevance_score || 0),
    credibilityScore: Number(row.credibility_score || 0),
    contentHash: row.content_hash || "",
    raw: parseJson(row.raw_json, null)
  };
}

export function saveWebEvidence(items = []) {
  ensureWebEvidenceTable();
  if (!Array.isArray(items) || !items.length) return [];
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO web_evidence
      (id, ticker, intent, query, title, url, source, source_type, snippet, published_at, fetched_at, relevance_score, credibility_score, content_hash, raw_json, updated_at)
    VALUES
      (@id, @ticker, @intent, @query, @title, @url, @source, @sourceType, @snippet, @publishedAt, @fetchedAt, @relevanceScore, @credibilityScore, @contentHash, @rawJson, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      source = excluded.source,
      source_type = excluded.source_type,
      snippet = excluded.snippet,
      published_at = excluded.published_at,
      fetched_at = excluded.fetched_at,
      relevance_score = excluded.relevance_score,
      credibility_score = excluded.credibility_score,
      raw_json = excluded.raw_json,
      updated_at = datetime('now')
  `);
  const tx = db.transaction((rows) => {
    for (const item of rows) {
      if (!item?.ticker || !item?.intent || !item?.url) continue;
      stmt.run({
        id: item.id,
        ticker: item.ticker,
        intent: item.intent,
        query: item.query || "",
        title: item.title || "",
        url: item.url,
        source: item.source || "",
        sourceType: item.sourceType || "",
        snippet: item.snippet || "",
        publishedAt: item.publishedAt || "",
        fetchedAt: item.fetchedAt || new Date().toISOString(),
        relevanceScore: Number(item.relevanceScore || 0),
        credibilityScore: Number(item.credibilityScore || 0),
        contentHash: item.contentHash || "",
        rawJson: safeJson(item.raw || item)
      });
    }
  });
  tx(items);
  return items;
}

export function listWebEvidence({ ticker, intent, limit = 12, maxAgeHours = 48 } = {}) {
  ensureWebEvidenceTable();
  const db = getDb();
  const rows = db.prepare(`
    SELECT *
    FROM web_evidence
    WHERE ticker = @ticker
      AND intent = @intent
      AND datetime(fetched_at) >= datetime('now', @age)
    ORDER BY credibility_score DESC, relevance_score DESC, fetched_at DESC
    LIMIT @limit
  `).all({
    ticker,
    intent,
    age: `-${Math.max(1, Number(maxAgeHours || 48))} hours`,
    limit: Math.max(1, Math.min(50, Number(limit || 12)))
  });
  return rows.map(hydrate);
}
