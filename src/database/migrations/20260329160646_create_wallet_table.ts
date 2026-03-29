import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable("wallets", (table) => {
        table.increments("id").primary();
        table
            .integer("user_id")
            .unsigned()
            .nullable() //made user_id nullable to allow for holding wallet logic
            .references("id")
            .inTable("users")
            .unique()
            .onDelete("CASCADE");
        table
            .enum("wallet_type", ["MAIN", "HOLDING", "FEE", "SYSTEM"])
            .notNullable()
            .defaultTo("MAIN");
        table
            .bigInteger("balance")
            .notNullable()
            .defaultTo(0)
            .comment("Balance in kobo/cents");// I'm saving balance at lowest denomination, precision will be handled on the application layer
        table.timestamp("created_at").defaultTo(knex.fn.now());
        table.timestamp("updated_at").defaultTo(knex.fn.now());
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists("wallets");
}