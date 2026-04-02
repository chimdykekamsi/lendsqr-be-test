import { Knex } from "knex";
import { UserRow } from "./user.type";
import db from "@/configs/db";

export class UserRepository {

    private readonly table = "users";

    /**
     * Create a new user.
     */
    async create(userData: { name: string; email: string; phone?: string }, database: Knex | Knex.Transaction = db): Promise<UserRow["id"] | null> {
        const [userId] = await database<UserRow>(this.table).insert({
            name: userData.name,
            email: userData.email,
            phone: userData.phone ?? null,
        });
        return userId || null;
    }


    /**
     * Find a user by ID.
     */
    async findById(id: number, database: Knex | Knex.Transaction = db): Promise<UserRow | undefined> {
        return database<UserRow>(this.table).where({ id }).first();
    }

    /**
     * Find a user by email.
     */
    async findByEmail(email: string, database: Knex | Knex.Transaction = db): Promise<UserRow | undefined> {
        return database<UserRow>(this.table).where({ email }).first();
    }

}

export const userRepository = new UserRepository();