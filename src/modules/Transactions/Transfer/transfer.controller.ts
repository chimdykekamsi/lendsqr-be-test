import { Request, Response } from "express";
import { transferService } from "./transfer.service";
import { APIError } from "@/utils/APIError";
import { idempotentControllerWrapper } from "@/utils/helpers";

export class TransferController {
    initiateTransfer = idempotentControllerWrapper(async (req: Request, _res: Response) => {
        const { receiver_id, amount, description } = req.body;
        const sender_user_id = req.user?.id;

        if (!sender_user_id) {
            throw APIError.Unauthorized("User not authenticated");
        }

        const result = await transferService.initiateTransfer(
            sender_user_id,
            receiver_id,
            amount,
            description
        );

        return {
            message: "Transfer completed successfully",
            data: result,
            statusCode: 201,
        };
    });
}

export const transferController = new TransferController();