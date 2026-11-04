import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@/db";
import { authSchema } from "@/db/schema";

const fallbackSecret = "kosmanager-local-development-secret-change-before-deploy";
const secret = process.env.BETTER_AUTH_SECRET;

if (process.env.NODE_ENV === "production" && (!secret || secret.length < 32 || secret.startsWith("REPLACE_"))) {
  throw new Error("BETTER_AUTH_SECRET wajib diisi dengan secret acak minimal 32 karakter.");
}

export const auth = betterAuth({
  appName: "KosManager",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: secret ?? fallbackSecret,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
  },
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:3000"],
});
