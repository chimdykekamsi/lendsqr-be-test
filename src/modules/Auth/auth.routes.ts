import { validate } from "@/middlewares/validation.middleware";
import { Router } from "express";
import { createUserSchema, loginSchema } from "./auth.type";
import { userController } from "../User/user.controller";
import { rateLimiter } from "@/middlewares/rateLimiter";

const authRouter = Router();

/**
 * @route  POST /auth/login
 * @desc   Faux login — exchange email for a JWT token
 * @access Public
 */
authRouter.post(
  "/login",
  rateLimiter(10, 60), // Limit to 10 requests per hour per IP
  validate(loginSchema),
  userController.login
);

authRouter.post(
  "/register",
  rateLimiter(10, 60), // Limit to 5 requests per hour per IP
  validate(createUserSchema),
  userController.createUser
)

export default authRouter;
