import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable("ledger_entries", (table) => {
        table.increments("id").primary();
        table
            .integer("wallet_id")
            .unsigned()
            .notNullable()
            .references("id")
            .inTable("wallets")
            .onDelete("CASCADE");
        table
            .integer("transaction_id")
            .unsigned()
            .notNullable()
            .references("id")
            .inTable("transactions")
            .onDelete("CASCADE");
        table
            .enum("entry_type", ["CREDIT", "DEBIT"])
            .notNullable();
        table.bigInteger("amount").notNullable().comment("Amount in kobo/cents");
        table
            .bigInteger("balance_before")
            .notNullable()
            .comment("Balance before entry in kobo/cents");
        table
            .bigInteger("balance_after")
            .notNullable()
            .comment("Balance after entry in kobo/cents");
        table.timestamp("created_at").defaultTo(knex.fn.now());

        table.index(["wallet_id"]);
        table.index(["transaction_id"]);
        table.index(["entry_type"]);
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists("ledger_entries");
}