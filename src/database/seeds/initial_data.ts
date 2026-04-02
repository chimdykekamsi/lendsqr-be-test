import type { Knex } from "knex";

export async function seed(knex: Knex): Promise<void> {
    // Clean up in reverse FK order
    await knex("idempotency_keys").del();
    await knex("ledger_entries").del();
    await knex("fundings").del();
    await knex("transfers").del();
    await knex("withdrawals").del();
    await knex("transactions").del();
    await knex("wallets").del();
    await knex("users").del();

    // Seed users
    const [aliceId] = await knex("users").insert({
        name: "Alice Okafor",
        email: "alice@demo.com",
        phone: "+2348011111111",
        created_at: new Date(),
        updated_at: new Date(),
    });

    const [bobId] = await knex("users").insert({
        name: "Bob Emeka",
        email: "bob@demo.com",
        phone: "+2348022222222",
        created_at: new Date(),
        updated_at: new Date(),
    });

    // Seed wallets
    await knex("wallets").insert([
        {
            user_id: aliceId,
            wallet_type: "MAIN",
            balance: 0, // ₦5,000
            created_at: new Date(),
            updated_at: new Date(),
        },
        {
            user_id: bobId,
            wallet_type: "MAIN",
            balance: 0, // ₦2,000
            created_at: new Date(),
            updated_at: new Date(),
        },
        {
            user_id: null,
            wallet_type: "HOLDING",
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

    console.log("✅ Seed complete: 2 users, 4 wallets created");
}