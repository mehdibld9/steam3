import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

const databaseUrl = process.env.DATABASE_URL;
const useSsl =
  process.env.DATABASE_SSL === "true" ||
  /supabase\.(co|com)/i.test(databaseUrl);

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  },
});
