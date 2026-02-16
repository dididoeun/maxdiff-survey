import { createClient, Client } from "@libsql/client";

let client: Client | null = null;

export function getDb(): Client {
  if (!client) {
    client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}

export async function initDb() {
  const db = getDb();
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS surveys (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      items TEXT NOT NULL,
      setSize INTEGER NOT NULL DEFAULT 4,
      jobRoles TEXT NOT NULL DEFAULT '[]',
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      surveyId TEXT NOT NULL,
      respondentId TEXT NOT NULL,
      jobRole TEXT NOT NULL DEFAULT '',
      round INTEGER NOT NULL,
      setBatch TEXT NOT NULL,
      bestItem TEXT NOT NULL,
      worstItem TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (surveyId) REFERENCES surveys(id)
    );
  `);
}
