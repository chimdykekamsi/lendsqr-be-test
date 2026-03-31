import { Request, Response, NextFunction } from "express";
import { userService } from "./user.service";
import { authService } from "../Auth/auth.service";
import { APIResponse } from "@/utils/APIResponse";

export class UserController {

  async createUser(
    req: Request,
    res: Response
  ) {
    const user = await userService.createUser(req.body);
    const token = authService.generateToken(user);

    return APIResponse.success(res, "User created successfully", { user, token }, 201);
  }

  /**
   * POST /auth/login
   * Faux login — returns a token for an existing user by email
   */
  async login(req: Request, res: Response, next: NextFunction) {

    const { email } = req.body;
    const result = await authService.login(email);

    return APIResponse.success(res, "Login successful", result);
  }

  /**
   * GET /users/me
   * Get the authenticated user's profile with wallets
   */
  async getProfile(
    req: Request,
    res: Response
  ) {
    const user_id = req.user!.id;
    const profile = await userService.getUserWithWallet(user_id);

    return APIResponse.success(res, "Profile retrieved", profile);
  }
}

export const userController = new UserController();