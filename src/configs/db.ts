import knex, { Knex } from "knex";
import { env } from "./env";
import knexConfig from "../knexfile";

const environment = (env.NODE_ENV || "development") as keyof typeof knexConfig;

const db: Knex = knex(knexConfig[environment]!);

export default db;  