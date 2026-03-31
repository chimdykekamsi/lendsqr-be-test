import { rateLimiter } from "@/middlewares/rateLimiter";
import { validate } from "@/middlewares/validation.middleware";
import { idempotency } from "@/modules/Idempotency/idempotency.middleware";
import { NextFunction, Request, Response, Router } from "express";
import { confirmDepositDto, initiateDepositSchema } from "./deposit.type";
import { depositController } from "./deposit.controller";

const depositRouter = Router();

/**
 * @route POST /transactions/deposits/initialize
 * @desc Initialize a deposit transaction
 * @access Private
 */
depositRouter.post(
    "/initiate",
    rateLimiter(5, 10),
    validate(initiateDepositSchema),
    idempotency,
    depositController.initiateDeposit
)

/**
 * @route POST /transactions/deposits/confirm
 * @desc Confirm a deposit transaction (assuming the payment gateway will call this webhook after payment completion)
 * @access Private - assuming the authenticate middleware is the webhook signature verification in this case.
 */

depositRouter.post(
    "/confirm",
    validate(confirmDepositDto),
    (req: Request, _res: Response, next: NextFunction) => {
        // pass reference as idempotency key for confirmation to ensure idempotency on confirmations as well
        req.headers["idempotency-key"] = req.body.reference;
        next();
    },
    idempotency,
    depositController.confirmDeposit
)


export default depositRouter;
