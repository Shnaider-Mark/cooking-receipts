import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = new Pool({ connectionString });
  const schemaPath = path.resolve(__dirname, "../../src/schema.sql");
  const sql = await readFile(schemaPath, "utf8");

  await pool.query(sql);
  await pool.end();
  console.log("Migration completed.");
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
