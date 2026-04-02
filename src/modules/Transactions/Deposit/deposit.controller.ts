import { Request, Response } from "express";
import { depositService } from "./deposit.service";
import { APIResponse } from "@/utils/APIResponse";
import { idempotencyService } from "@/modules/Idempotency/idempotency.service";
import { idempotentControllerWrapper } from "@/utils/helpers";

export class DepositController {

    initiateDeposit = idempotentControllerWrapper(async (req: Request, _res: Response) => {
        const { amount, description } = req.body;
        const user_id = req.user!.id;
        const response = await depositService.initiateDeposit(user_id, amount, description);

        const result = {
            message: "Deposit initiated successfully",
            data: response,
            statusCode: 201,
        }
        return result;
    });

    confirmDeposit = idempotentControllerWrapper(async (req: Request, _res: Response) => {

        const { reference } = req.body;

        const response = await depositService.confirmDeposit(reference);

        idempotencyService.completeKey(response.transaction.user_id!, req.idempotencyKey!, {
            message: "Deposit confirmed successfully",
            data: { transaction: response.transaction, funding: response.funding },
            statusCode: 200,
        });

        const result = {
            message: "Deposit confirmed successfully",
            data: response,
            statusCode: 200,
        }
        return result;
    });
}

export const depositController = new DepositController();