import authRouter from "@/modules/Auth/auth.routes";
import transactionRouter from "@/modules/Transactions/transaction.route";
import userRouter from "@/modules/User/user.routes";
import { Router } from "express";

const routes = Router();

routes.use("/auth", authRouter);
routes.use("/users", userRouter);
routes.use("/transactions", transactionRouter);

export default routes;