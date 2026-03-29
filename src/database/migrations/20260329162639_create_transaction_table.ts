import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable("transactions", (table) => {
        table.increments("id").primary();
        table
            .enum("type", ["FUNDING", "TRANSFER", "WITHDRAWAL", "REFUND"]) // future support for fees and other transaction types
            .notNullable();
        table
            .enum("status", ["PENDING", "SUCCESSFUL", "FAILED"])
            .notNullable()
            .defaultTo("PENDING");
        table.bigInteger("amount").notNullable().comment("Amount in kobo/cents");
        table.string("reference", 100).notNullable().unique();
        table
            .integer("parent_transaction_id")
            .unsigned()
            .nullable()
            .references("id")
            .inTable("transactions")
            .onDelete("SET NULL"); // this will allow the system track related tansactions, ie: fees, refund, reversal, etc
        table.text("description").nullable();
        table.timestamp("created_at").defaultTo(knex.fn.now());
        table.timestamp("updated_at").defaultTo(knex.fn.now());

        table.index(["reference"]);
        table.index(["status"]);
        table.index(["type"]);
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists("transactions");
}