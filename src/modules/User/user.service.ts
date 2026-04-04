import { karmaService } from "../Karma/karma.service";
import { APIError } from "@/utils/APIError";
import { WalletRow, WalletType } from "../Wallet/wallet.type";
import { CreateUserDTO, UserRow } from "./user.type";
import { walletService } from "../Wallet/wallet.service";
import { userRepository } from "./user.repo";
import db from "@/configs/db";

export class UserService {

  private readonly repository = userRepository;

  /**
   * Create a new user account.
   * Performs karma blacklist check before creating the user.
   * Automatically creates a MAIN wallet for the user.
   */
  async createUser(dto: CreateUserDTO): Promise<UserRow> {
    const { name, email, phone } = dto;

    // 1. Check if email already exists
    const existing = await this.repository.findByEmail(email);

    if (existing) {
      throw APIError.Conflict("A user with this email already exists");
    }

    // 2. Karma blacklist check (check both email and phone if provided)
    const [emailBlacklisted, phoneBlacklisted] = await Promise.all([
      karmaService.isBlacklisted(email),
      phone ? karmaService.isBlacklisted(phone) : Promise.resolve(false),
    ]);

    if (emailBlacklisted || phoneBlacklisted) {
      throw APIError.Forbidden(
        "User cannot be onboarded due to compliance restrictions"
      );
    }

    // 3. Create user + wallet atomically in a transaction
    return db.transaction(async (trx) => {
      const userId = await this.repository.create({ name, email, phone }, trx);

      if (!userId) throw APIError.Internal("Failed to create user");

      await walletService.createWallet(userId, WalletType.MAIN, trx);

      const user = await this.repository.findById(userId, trx);
      if (!user) {
        throw APIError.Internal("Failed to retrieve created user");
      };

      return user;
    });
  }


  /**
   * Get a user together with their wallets.
   */
  async getUserWithWallet(
    userId: number
  ): Promise<(UserRow & { wallet: WalletRow | null })> {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw APIError.NotFound("User not found");
    }

    const wallet = await walletService.findByUserId(userId);

    return { ...user, wallet };
  }
}

export const userService = new UserService();
