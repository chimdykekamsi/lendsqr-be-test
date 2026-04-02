import type { Knex } from "knex";

export async function seed(knex: Knex): Promise<void> {
    // Insert all system wallets ie: HOLDING, FEE, SYSTEM
    await knex("wallets").insert([
        {
            user_id: null,
            wallet_type: "HOLDING",
            balance: 0,
            created_at: new Date(),
            updated_at: new Date(),
        },
        {
            user_id: null,
            wallet_type: "FEE",
            balance: 0,
            created_at: new Date(),
            updated_at: new Date(),
        },
        {
            user_id: null,
            wallet_type: "SYSTEM",
            balance: 0,
            created_at: new Date(),
            updated_at: new Date(),
        }
    ]);

}