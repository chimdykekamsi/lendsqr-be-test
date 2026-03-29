// import { APIError } from "@/utils/APIError";
// import { APIResponse } from "@/utils/APIResponse";
// import { NextFunction, Request, Response } from "express";

// // idempotency.middleware.ts
// export const idempotencyMiddleware = async (req: Request, res: Response, next: NextFunction) => {
//     const key = req.headers["idempotency-key"];

//     if (!key) {
//         throw APIError.BadRequest("Idempotency key required");
//     }

//     const existing = await idempotencyService.findByKey(key);

//     if (existing) {
//         if (existing.status === "COMPLETED") {
//             const existingResponse = JSON.parse(existing.response);
//             return APIResponse.success(res, existingResponse.message, existingResponse.data);
//         }

//         if (existing.status === "PROCESSING") {
//             return APIResponse.error(res, "Request already processing", 409);
//         }
//     }

//     req.idempotencyKey = key;

//     await idempotencyService.createProcessing(key, req.user.id);

//     next();
// };