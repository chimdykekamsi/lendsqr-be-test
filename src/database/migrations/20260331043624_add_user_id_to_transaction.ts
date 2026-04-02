import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable("transactions", (table) => {
        table.integer("user_id").unsigned().references("id").inTable("users").onDelete("CASCADE");
    });
}


export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable("transactions", (table) => {
        table.dropColumn("user_id");
    });
}

