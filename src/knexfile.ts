import type { Knex } from "knex";
import { env } from "./configs/env.js";

export enum Environment {
  development = "development",
  test = "test",
  production = "production",
}

const baseConfig: Knex.Config = {
  client: "mysql2",
  connection: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD || "",
    database: env.DB_NAME,
    timezone: "Z" //enforce to UTC
  },
  migrations: {
    extension: "ts",
    directory: "./database/migrations",
  },
};

const config: Record<string, Knex.Config> = {
  [Environment.development]: baseConfig,
  [Environment.production]: baseConfig,
};

export default config;