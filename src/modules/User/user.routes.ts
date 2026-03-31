import { Router } from "express";
import { authenticate } from "../Auth/auth.middleware";
import { userController } from "./user.controller";

const userRouter = Router();


/**
 * @route  GET /users/me
 * @desc   Get authenticated user's profile with wallets
 * @access Private
 */
userRouter.get(
  "/me",
  authenticate,
  userController.getProfile
);

export default userRouter;
