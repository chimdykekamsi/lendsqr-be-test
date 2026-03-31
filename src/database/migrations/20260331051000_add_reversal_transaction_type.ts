import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable("transactions", (table) => {
        table.enum("type", ["FUNDING", "TRANSFER", "WITHDRAWAL", "REVERSAL", "REFUND"]).alter();
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable("transactions", (table) => {
        table.enum("type", ["FUNDING", "TRANSFER", "WITHDRAWAL", "REFUND"]).alter();
    });
}