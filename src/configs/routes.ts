import authRouter from "@/modules/Auth/auth.routes";
import transactionRouter from "@/modules/Transactions/transaction.route";
import userRouter from "@/modules/User/user.routes";
import walletRouter from "@/modules/Wallet/wallet.routes";
import { Router } from "express";

const routes = Router();

routes.use("/auth", authRouter);
routes.use("/users", userRouter);
routes.use("/transactions", transactionRouter);
routes.use("/wallet", walletRouter);

export default routes;