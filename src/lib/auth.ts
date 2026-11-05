import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@/db";
import { authSchema } from "@/db/schema";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/lib/password";

const fallbackSecret = "kosmanager-local-development-secret-change-before-deploy";
const secret = process.env.BETTER_AUTH_SECRET;
const deploymentOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;
const baseURL = process.env.BETTER_AUTH_URL ?? deploymentOrigin ?? "http://localhost:3000";
const vercelProductionOrigin = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : undefined;
const extraTrustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);
const trustedOrigins = [...new Set(
  [baseURL, process.env.NEXT_PUBLIC_APP_URL, deploymentOrigin, vercelProductionOrigin, ...extraTrustedOrigins]
    .filter((origin): origin is string => Boolean(origin)),
)];

if (process.env.NODE_ENV === "production" && (!secret || secret.length < 32 || secret.startsWith("REPLACE_"))) {
  throw new Error("BETTER_AUTH_SECRET wajib diisi dengan secret acak minimal 32 karakter.");
}

export const auth = betterAuth({
  appName: "KosManager",
  baseURL,
  secret: secret ?? fallbackSecret,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: MIN_PASSWORD_LENGTH,
    maxPasswordLength: MAX_PASSWORD_LENGTH,
  },
  trustedOrigins,
});
