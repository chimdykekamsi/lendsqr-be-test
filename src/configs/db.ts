import knex from "knex";
import { env } from "./env";
import config, { Environment } from "@/knexfile";

export const db = knex(config[env.NODE_ENV] || Environment.development);