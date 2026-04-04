import { env } from "@/configs/env";
import jwt from "jsonwebtoken";
import { JwtPayload } from "./auth.type";
import db from "@/configs/db";
import { APIError } from "@/utils/APIError";
import { UserRow } from "../User/user.type";
import { userRepository } from "../User/user.repo";

export class AuthService {
  private readonly secret = env.JWT_SECRET;
  private readonly expiresIn = "7d";

  /**
   * Generate a JWT token for a given user.
   * This is a faux authentication system — no passwords required.
   */
  generateToken(user: UserRow): string {
    const payload: JwtPayload = {
      user_id: user.id,
      email: user.email,
    };

    return jwt.sign(payload, this.secret, { expiresIn: this.expiresIn });
  }

  /**
   * Verify and decode a JWT token.
   */
  verifyToken(token: string): JwtPayload {
    return jwt.verify(token, this.secret) as JwtPayload;
  }

  /**
   * Login (faux) — finds the user by email and returns a token.
   * In a real system this would validate credentials.
   */
  async login(email: string): Promise<{ token: string; user: UserRow }> {
    const user = await userRepository.findByEmail(email);

    if (!user) {
      throw APIError.NotFound("User not found");
    }

    const token = this.generateToken(user);
    return { token, user };
  }
}

export const authService = new AuthService();
