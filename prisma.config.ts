// Prisma configuration for Siembra NC VMS
import * as dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

// Load .env.local for local development
dotenv.config({ path: ".env.local" });
// Fallback to .env if .env.local doesn't exist
dotenv.config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
