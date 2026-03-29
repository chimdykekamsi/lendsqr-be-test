import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable("idempotency_keys", (table) => {
        table.increments("id").primary();
        table
            .integer("user_id")
            .unsigned()
            .notNullable()
            .references("id")
            .inTable("users")
            .onDelete("CASCADE");
        table.string("key", 100).notNullable().unique();
        table.text("request_hash").nullable();
        table.text("response").nullable();
        table
            .enum("status", ["PROCESSING", "COMPLETED", "FAILED"])
            .notNullable()
            .defaultTo("PROCESSING");
        table.timestamp("created_at").defaultTo(knex.fn.now());
        table
            .timestamp("expires_at")
            .notNullable()
            .defaultTo(knex.raw("(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 24 HOUR))"));

        table.index(["key"]);
        table.index(["user_id"]);
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists("idempotency_keys");
}