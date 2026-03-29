import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { winstonLogger } from "@/utils/logger";

export const rateLimiter = (
  maxRequests = 50,
  minute = 1
) =>
  rateLimit({
    windowMs: minute * 60 * 1000,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests, please try again later." },

    keyGenerator: (req) => {
      const ip =
        req.headers["x-forwarded-for"]?.toString().split(",")[0] ||
        req.socket.remoteAddress ||
        "unknown-ip";

      const userId = req.user?.id || "anonymous";
      const userAgent = req.headers["user-agent"] || "unknown-agent";

      const raw = `${ip}|${userId}|${userAgent}`;

      return crypto.createHash("sha256").update(raw).digest("hex");
    },

    handler: (req, res, next, options) => {
      const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
      const path = req.originalUrl;
      const method = req.method;
      const userAgent = req.headers["user-agent"];
      const userId = (req as any).user?.id;

      winstonLogger.warn("Rate limit exceeded", {
        ip,
        path,
        method,
        userAgent,
        userId,
        limit: maxRequests,
        windowMinutes: minute,
        timestamp: new Date().toISOString(),
      });

      return res.status(options.statusCode).json(options.message);
    },
  });
