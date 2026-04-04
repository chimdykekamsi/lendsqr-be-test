import type { Knex } from "knex";

/**
 * Fix: the `key` column had a plain UNIQUE constraint, meaning two different
 * users could not share the same key string — throwing a DB-level unique
 * constraint violation before the service could scope the lookup by user_id.
 *
 * The correct constraint is a composite unique on (user_id, key):
 * the same key string is allowed across different users, but a single user
 * cannot create two active records with the same key.
 */
export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable("idempotency_keys", (table) => {
        // Drop the plain unique index on key alone
        table.dropUnique(["key"]);

        // Add composite unique: one key string per user
        table.unique(["user_id", "key"]);
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable("idempotency_keys", (table) => {
        table.dropUnique(["user_id", "key"]);
        table.unique(["key"]);
    });
}