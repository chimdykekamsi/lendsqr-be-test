import { Request, Response, NextFunction } from "express";
import { idempotencyService } from "./idempotency.service";
import { IdempotencyStatus } from "./idempotency.type";
import { APIError } from "@/utils/APIError";
import { APIResponse } from "@/utils/APIResponse";

/**
 * Idempotency middleware.
 * Reads the `Idempotency-Key` header and short-circuits the request
 * if a matching completed key is found, returning the cached response.
 */
export const idempotency = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const idempotencyKey = req.headers["idempotency-key"] as string | undefined;

  if (!idempotencyKey) {
    throw APIError.BadRequest("Missing Idempotency-Key header");
    return;
  }

  const userId = req.user?.id;

  if (!userId) {
    next();
    return;
  }

  const existing = await idempotencyService.getExistingKey(
    userId,
    idempotencyKey
  );

  if (existing) {

    if (await idempotencyService.isRequestHashMatching(existing, req.body) === false) {
      throw APIError.Conflict("Request body does not match previous request for this Idempotency-Key");
    }

    if (existing.status === IdempotencyStatus.PROCESSING) {
      throw APIError.Conflict("Request with this Idempotency-Key is already being processed");
    }

    if (existing.status === IdempotencyStatus.COMPLETED) {
      const cached = idempotencyService.parseResponse(existing);
      return APIResponse.success(res, cached!.message, cached!.data, cached!.statusCode);
    }
  }

  // Store key and attach to request for downstream use
  await idempotencyService.createKey(userId, idempotencyKey, req.body);
  req.idempotencyKey = idempotencyKey;

  next();
};
