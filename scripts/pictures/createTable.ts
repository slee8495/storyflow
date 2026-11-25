// One-off: applies createTable.sql (additive, IF NOT EXISTS).
// npx tsx --env-file=.env.local scripts/pictures/createTable.ts
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
sql
  .unsafe(fs.readFileSync(path.join(__dirname, "createTable.sql"), "utf8"))
  .then(() => console.log("chapter_pictures ok"))
  .finally(() => sql.end());
