import { Router } from "express";
import { authenticate } from "../Auth/auth.middleware";
import { walletController } from "./wallet.controller";

const walletRouter = Router();

// Apply authentication middleware to all wallet routes
walletRouter.use(authenticate);

// Get wallet balance endpoint
walletRouter.get("/balance", walletController.getBalance);

export default walletRouter;