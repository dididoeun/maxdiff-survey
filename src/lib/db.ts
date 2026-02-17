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
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE,
      image TEXT
    );
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      provider TEXT NOT NULL,
      providerAccountId TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS surveys (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      items TEXT NOT NULL,
      setSize INTEGER NOT NULL DEFAULT 4,
      jobRoles TEXT NOT NULL DEFAULT '[]',
      userId TEXT,
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

  // Add userId column to existing surveys table (ignore if already exists)
  try {
    await db.execute("ALTER TABLE surveys ADD COLUMN userId TEXT");
  } catch {
    // Column already exists
  }
}
