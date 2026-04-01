import { Router } from "express";
import { authenticate } from "../Auth/auth.middleware";
import depositRouter from "./Deposit/deposit.route";
import withdrawalRouter from "./Withdrawal/withdrawal.route";
import transferRouter from "./Transfer/transfer.route";
import { transactionController } from "./transaction.controller";

const transactionRouter = Router();

transactionRouter.use(authenticate);

transactionRouter.use("/deposits", depositRouter);
transactionRouter.use("/withdrawals", withdrawalRouter);
transactionRouter.use("/transfers", transferRouter);

// Get all transactions with filters and pagination
transactionRouter.get("/", transactionController.getTransactions);

// Get transaction by ID with full details
transactionRouter.get("/:id", transactionController.getTransactionById);

export default transactionRouter;
