import { Request, Response } from "express";
import { withdrawalService } from "./withdrawal.service";
import { APIResponse } from "@/utils/APIResponse";
import { APIError } from "@/utils/APIError";

export class WithdrawalController {
    async initiateWithdrawal(req: Request, res: Response) {
        try {
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

            res.status(201).json(
                APIResponse.success(
                    "Withdrawal initiated successfully",
                    {
                        transaction: result.transaction,
                        withdrawal: result.withdrawal,
                    }
                )
            );
        } catch (error) {
            if (error instanceof APIError) {
                res.status(error.statusCode).json(APIResponse.error(error.message));
            } else {
                res.status(500).json(APIResponse.error("Internal server error"));
            }
        }
    }

    async confirmWithdrawal(req: Request, res: Response) {
        try {
            const { reference, success } = req.body;

            const result = await withdrawalService.confirmWithdrawal(reference, success);

            res.status(200).json(
                APIResponse.success(
                    success ? "Withdrawal confirmed successfully" : "Withdrawal failed and reversed",
                    result
                )
            );
        } catch (error) {
            if (error instanceof APIError) {
                res.status(error.statusCode).json(APIResponse.error(error.message));
            } else {
                res.status(500).json(APIResponse.error("Internal server error"));
            }
        }
    }
}

export const withdrawalController = new WithdrawalController();