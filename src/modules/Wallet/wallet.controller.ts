import { Request, Response } from "express";
import { walletService } from "./wallet.service";
import { APIResponse } from "@/utils/APIResponse";
import { APIError } from "@/utils/APIError";

export class WalletController {
    async getBalance(req: Request, res: Response) {
        const user_id = req.user?.id;
        if (!user_id) {
            throw APIError.Unauthorized("User not authenticated");
        }

        const wallet = await walletService.findByUserId(user_id);

        // Return balance in proper currency format (already converted in service)
        APIResponse.success(
            res,
            "Wallet balance retrieved successfully",
            {
                balance: wallet.balance,
                currency: "NGN" // Assuming NGN as default currency
            }
        );
    }
}

export const walletController = new WalletController();