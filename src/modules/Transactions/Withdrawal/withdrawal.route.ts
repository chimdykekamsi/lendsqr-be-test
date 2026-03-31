import { Router } from "express";
import { withdrawalController } from "./withdrawal.controller";
import { validateRequest } from "../../middlewares/validation.middleware";

const router = Router();

// Initiate withdrawal
router.post("/initiate", validateRequest({
    body: {
        amount: { type: "number", required: true, min: 0.01 },
        bankAccountDetails: { type: "string", required: true },
        description: { type: "string", required: false }
    }
}), withdrawalController.initiateWithdrawal);

// Confirm withdrawal (this might be called by a webhook or admin)
router.post("/confirm", validateRequest({
    body: {
        reference: { type: "string", required: true },
        success: { type: "boolean", required: true }
    }
}), withdrawalController.confirmWithdrawal);

export default router;