import db from "@/configs/db";
import { IdempotencyKeyRow, IdempotencyStatus } from "./idempotency.type";
import { hashObject } from "@/utils/helpers";

export class IdempotencyService {
  private readonly table = "idempotency_keys";

  /**
   * Check if an idempotency key already exists and is still valid.
   * Returns the cached response if found.
   */
  async getExistingKey(
    userId: number,
    key: string
  ): Promise<IdempotencyKeyRow | undefined> {
    return db<IdempotencyKeyRow>(this.table)
      .where({ user_id: userId, key })
      .where("expires_at", ">", new Date())
      .first();
  }

  /**
   * Create a new idempotency key record in PROCESSING state.
   */
  async createKey(
    userId: number,
    key: string,
    requestBody: unknown
  ): Promise<void> {
    const requestHash = hashObject(requestBody);

    await db<IdempotencyKeyRow>(this.table).insert({
      user_id: userId,
      key,
      request_hash: requestHash,
      status: IdempotencyStatus.PROCESSING,
      created_at: new Date(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
    });
  }

  /**
   * Mark an idempotency key as COMPLETED with the cached response.
   */
  async completeKey(
    userId: number,
    key: string,
    response: unknown
  ): Promise<void> {
    await db<IdempotencyKeyRow>(this.table)
      .where({ user_id: userId, key })
      .update({
        status: IdempotencyStatus.COMPLETED,
        response: JSON.stringify(response),
      });
  }

  /**
   * Mark an idempotency key as FAILED.
   */
  async failKey(userId: number, key: string): Promise<void> {
    await db<IdempotencyKeyRow>(this.table)
      .where({ user_id: userId, key })
      .update({ status: IdempotencyStatus.FAILED });
  }

  /**
   * Delete Key
   */
  async deleteKey(userId: number, key: string): Promise<void> {
    await db<IdempotencyKeyRow>(this.table)
      .where({ user_id: userId, key })
      .del();
  }

  /**
   * Parse the cached response for a completed idempotency key.
   */
  parseResponse(record: IdempotencyKeyRow): { message: string; data: unknown; statusCode: number } | null {
    if (!record.response) return null;
    try {
      return JSON.parse(record.response) as { message: string; data: unknown; statusCode: number };
    } catch {
      return null;
    }
  }

  /**
   * Check if existing key's request hash matches the current request body.
   * This can be used to detect if the client is retrying with different data.
   */
  async isRequestHashMatching(
    existing: IdempotencyKeyRow,
    requestBody: unknown
  ): Promise<boolean> {
    const requestHash = hashObject(requestBody);
    return existing.request_hash === requestHash;
  }
}

export const idempotencyService = new IdempotencyService();
