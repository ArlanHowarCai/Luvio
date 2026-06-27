/**
 * Test isolation: point the SQLite connection at a throwaway temp file so the
 * suite never writes research_sessions / portfolio rows into the dev luvio.db.
 * Imported FIRST in every test file; db/index.js reads LUVIO_DB_PATH lazily.
 */
import { tmpdir } from "node:os";
import { join } from "node:path";

if (!process.env.LUVIO_DB_PATH) {
  process.env.LUVIO_DB_PATH = join(tmpdir(), `luvio-test-${process.pid}.db`);
}
