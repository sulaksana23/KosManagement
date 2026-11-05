import { spawnSync } from "node:child_process";

if (process.env.VERCEL_ENV !== "production") {
  console.log("[db:migrate] Migration otomatis dilewati di luar deployment Production Vercel.");
  process.exit(0);
}

const databaseUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("[db:migrate] DATABASE_URL_UNPOOLED atau DATABASE_URL belum tersedia di environment Production.");
}

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret || secret.length < 32 || secret.startsWith("REPLACE_")) {
  throw new Error("[auth] BETTER_AUTH_SECRET harus berisi secret acak minimal 32 karakter di environment Production.");
}

console.log("[db:migrate] Menerapkan migration Drizzle ke database Production.");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npmCommand, ["run", "db:migrate"], {
  env: { ...process.env, DATABASE_URL: databaseUrl },
  stdio: "inherit",
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
