import type { Knex } from "knex";
import { env } from "./configs/env";

const baseConnection = {
  host: env.DB_HOST,
  user: env.DB_USER,
  password: env.DB_PASSWORD || "",
  database: env.DB_NAME,
  timezone: "Z",
};

const config: Record<string, Knex.Config> = {
  development: {
    client: "mysql2",
    connection: baseConnection,
    migrations: {
      directory: "./database/migrations",
      extension: "ts",
    },
    seeds: {
      directory: "./database/seeds",
      extension: "ts",
    },
    pool: { min: 2, max: 10 },
  },

  test: {
    client: "mysql2",
    connection: { ...baseConnection, database: `${env.DB_NAME}_test` },
    migrations: {
      directory: "./database/migrations",
      extension: "ts",
    },
    pool: { min: 2, max: 10 },
  },

  production: {
    client: "mysql2",
    connection: baseConnection,
    migrations: {
      extension: "ts",
      directory: "./database/migrations",
    },
    pool: { min: 2, max: 20 },
  },
};

export default config;