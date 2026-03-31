import { Request, Response } from "express";
import { depositService } from "./deposit.service";
import { APIResponse } from "@/utils/APIResponse";
import { idempotencyService } from "@/modules/Idempotency/idempotency.service";

export class DepositController {
    async initiateDeposit(req: Request, res: Response) {
        const { amount, description } = req.body;
        const user_id = req.user!.id;
        console.log({ user_id, amount, description });
        const response = await depositService.initiateDeposit(user_id, amount, description);

        idempotencyService.completeKey(user_id, req.idempotencyKey!, {
            message: "Deposit initiated successfully",
            data: { transaction: response.transaction, paymentDetails: response.paymentDetails },
            statusCode: 201,
        });
        return APIResponse.success(res, "Deposit initiated successfully", response, 201);
    }

    async confirmDeposit(req: Request, res: Response) {
        try {
            const { reference } = req.body;

            const response = await depositService.confirmDeposit(reference);

            idempotencyService.completeKey(response.transaction.user_id!, req.idempotencyKey!, {
                message: "Deposit confirmed successfully",
                data: { transaction: response.transaction, funding: response.funding },
                statusCode: 200,
            });
            return APIResponse.success(res, "Deposit confirmed successfully", response, 200);
        } catch (error) {
            // In case of any error, we should fail the idempotencyKey
            idempotencyService.deleteKey(req.user!.id, req.idempotencyKey!);
            throw error;
        }
    }
}

export const depositController = new DepositController();