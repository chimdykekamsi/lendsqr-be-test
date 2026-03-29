import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    // Fundings
    await knex.schema.createTable("fundings", (table) => {
        table.increments("id").primary();
        table
            .integer("transaction_id")
            .unsigned()
            .notNullable()
            .references("id")
            .inTable("transactions")
            .onDelete("CASCADE");
        table
            .integer("wallet_id")
            .unsigned()
            .notNullable()
            .references("id")
            .inTable("wallets")
            .onDelete("CASCADE");
        table.string("payment_reference", 255).nullable();
        table.string("provider", 100).nullable().defaultTo("MANUAL");
        table.timestamp("created_at").defaultTo(knex.fn.now());

        table.index(["wallet_id"]);
        table.index(["transaction_id"]);
    });

    // Transfers
    await knex.schema.createTable("transfers", (table) => {
        table.increments("id").primary();
        table
            .integer("transaction_id")
            .unsigned()
            .notNullable()
            .references("id")
            .inTable("transactions")
            .onDelete("CASCADE");
        table
            .integer("sender_wallet_id")
            .unsigned()
            .notNullable()
            .references("id")
            .inTable("wallets")
            .onDelete("CASCADE");
        table
            .integer("receiver_wallet_id")
            .unsigned()
            .notNullable()
            .references("id")
            .inTable("wallets")
            .onDelete("CASCADE");
        table.timestamp("created_at").defaultTo(knex.fn.now());

        table.index(["sender_wallet_id"]);
        table.index(["receiver_wallet_id"]);
        table.index(["transaction_id"]);
    });

    // Withdrawals
    await knex.schema.createTable("withdrawals", (table) => {
        table.increments("id").primary();
        table
            .integer("transaction_id")
            .unsigned()
            .notNullable()
            .references("id")
            .inTable("transactions")
            .onDelete("CASCADE");
        table
            .integer("wallet_id")
            .unsigned()
            .notNullable()
            .references("id")
            .inTable("wallets")
            .onDelete("CASCADE");
        table.string("bank_account_id", 100).notNullable();
        table.string("settlement_reference", 255).unique().nullable();
        table
            .enum("processing_status", ["PENDING", "PROCESSING", "SETTLED", "FAILED"])
            .notNullable()
            .defaultTo("PENDING");
        table.text("failure_reason").nullable();
        table.timestamp("created_at").defaultTo(knex.fn.now());

        table.index(["wallet_id"]);
        table.index(["transaction_id"]);
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists("withdrawals");
    await knex.schema.dropTableIfExists("transfers");
    await knex.schema.dropTableIfExists("fundings");
}