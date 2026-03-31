import { Request, Response, NextFunction } from "express";
import { JwtPayload } from "./auth.type";
import { APIError } from "@/utils/APIError";
import { authService } from "./auth.service";
import { userRepository } from "../User/user.repo";

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw APIError.Unauthorized("Authentication required");
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    const payload = authService.verifyToken(token as string);
    const user = await userRepository.findById(payload.user_id);
    if (!user) {
      throw APIError.Unauthorized("User not found");
    }
    req.user = {
      id: user.id,
      email: user.email
    };
    next();
  } catch {
    throw APIError.Unauthorized("Invalid or expired token");
  }
};
