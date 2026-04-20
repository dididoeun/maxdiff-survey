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

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS survey_admins (
      id TEXT PRIMARY KEY,
      surveyId TEXT NOT NULL,
      userId TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (surveyId) REFERENCES surveys(id),
      FOREIGN KEY (userId) REFERENCES users(id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_survey_admins_unique ON survey_admins(surveyId, userId);
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      surveyId TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      options TEXT NOT NULL DEFAULT '[]',
      required INTEGER NOT NULL DEFAULT 1,
      questionOrder INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (surveyId) REFERENCES surveys(id)
    );
    CREATE TABLE IF NOT EXISTS general_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      surveyId TEXT NOT NULL,
      questionId TEXT NOT NULL,
      respondentId TEXT NOT NULL,
      answer TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (surveyId) REFERENCES surveys(id),
      FOREIGN KEY (questionId) REFERENCES questions(id)
    );
  `);

  // Add userId column to existing surveys table (ignore if already exists)
  try {
    await db.execute("ALTER TABLE surveys ADD COLUMN userId TEXT");
  } catch {
    // Column already exists
  }

  // Add status column to existing surveys table (ignore if already exists)
  try {
    await db.execute("ALTER TABLE surveys ADD COLUMN status TEXT NOT NULL DEFAULT 'published'");
  } catch {
    // Column already exists
  }

  // Add multipleAnswers column to existing questions table (ignore if already exists)
  try {
    await db.execute("ALTER TABLE questions ADD COLUMN multipleAnswers INTEGER NOT NULL DEFAULT 0");
  } catch {
    // Column already exists
  }

  // Add MaxDiff block meta columns (title, best/worst labels)
  try {
    await db.execute("ALTER TABLE surveys ADD COLUMN maxdiffTitle TEXT NOT NULL DEFAULT ''");
  } catch {
    // Column already exists
  }
  try {
    await db.execute("ALTER TABLE surveys ADD COLUMN bestLabel TEXT NOT NULL DEFAULT ''");
  } catch {
    // Column already exists
  }
  try {
    await db.execute("ALTER TABLE surveys ADD COLUMN worstLabel TEXT NOT NULL DEFAULT ''");
  } catch {
    // Column already exists
  }

  // 설문 설명 컬럼
  try {
    await db.execute("ALTER TABLE surveys ADD COLUMN description TEXT NOT NULL DEFAULT ''");
  } catch {
    // Column already exists
  }
}
