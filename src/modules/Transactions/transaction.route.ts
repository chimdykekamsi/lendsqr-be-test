import { Router } from "express";
import { authenticate } from "../Auth/auth.middleware";
import depositRouter from "./Deposit/deposit.route";
import withdrawalRouter from "./Withdrawal/withdrawal.route";

const transactionRouter = Router();

transactionRouter.use(authenticate);

transactionRouter.use("/deposits", depositRouter);
transactionRouter.use("/withdrawals", withdrawalRouter);

export default transactionRouter;
