import { Router } from "express";
import { transferController } from "./transfer.controller";
import { validate } from "@/middlewares/validation.middleware";
import { initiateTransferSchema } from "./transfer.type";
import { rateLimiter } from "@/middlewares/rateLimiter";
import { idempotency } from "@/modules/Idempotency/idempotency.middleware";

const router = Router();

// Initiate transfer
router.post(
    "/",
    rateLimiter(10, 60), // 10 requests per minute for transfers
    validate(initiateTransferSchema),
    idempotency,
    transferController.initiateTransfer
);

export default router;