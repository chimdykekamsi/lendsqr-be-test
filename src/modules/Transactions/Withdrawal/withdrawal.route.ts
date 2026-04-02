import { NextFunction, Request, Response, Router } from "express";
import { withdrawalController } from "./withdrawal.controller";
import { validate } from "@/middlewares/validation.middleware";
import { confirmWithdrawalSchema, initiateWithdrawalSchema } from "./withdrawal.type";
import { rateLimiter } from "@/middlewares/rateLimiter";
import { idempotency } from "@/modules/Idempotency/idempotency.middleware";

const router = Router();

// Initiate withdrawal
router.post(
    "/initiate",
    rateLimiter(),
    validate(initiateWithdrawalSchema),
    idempotency,
    withdrawalController.initiateWithdrawal
);

// Confirm withdrawal (this might be called by a webhook or admin)
router.post(
    "/confirm",
    rateLimiter(),
    validate(confirmWithdrawalSchema),
    (req: Request, _res: Response, next: NextFunction) => {
        // pass reference as idempotency key for confirmation to ensure idempotency on confirmations as well
        req.headers["idempotency-key"] = req.body.reference;
        next();
    },
    idempotency,
    withdrawalController.confirmWithdrawal
);

export default router;