import { Request, Response } from "express";
import { withdrawalService } from "./withdrawal.service";
import { APIError } from "@/utils/APIError";
import { idempotentControllerWrapper } from "@/utils/helpers";

export class WithdrawalController {
    initiateWithdrawal = idempotentControllerWrapper(async (req: Request, _res: Response) => {
        const { amount, bankAccountDetails, description } = req.body;
        const user_id = req.user?.id;

        if (!user_id) {
            throw APIError.Unauthorized("User not authenticated");
        }

        const result = await withdrawalService.initiateWithdrawal(
            user_id,
            amount,
            bankAccountDetails,
            description
        );

        return {
            message: "Withdrawal initiated successfully",
            data: result,
            statusCode: 201,
        }
    });

    confirmWithdrawal = idempotentControllerWrapper(async (req: Request, _res: Response) => {
        const { reference, success } = req.body;

        const result = await withdrawalService.confirmWithdrawal(reference, success);

        return {
            message: success ? "Withdrawal confirmed successfully" : "Withdrawal failed",
            data: result,
            statusCode: success ? 200 : 400,
        }
    });
}

export const withdrawalController = new WithdrawalController();