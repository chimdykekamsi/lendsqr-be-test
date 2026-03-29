import express, { Application } from "express";
import cors from "cors";
import { rateLimiter } from "./middlewares/rateLimiter";
import { errorHandler } from "./middlewares/errorHandler";
import routes from "./configs/routes";
import { APIError } from "@/utils/APIError";
import { responseTimer } from "./middlewares/responseTimer";
import { winstonLogger } from "@/utils/logger";

export const createApp = (): Application => {
    const app = express();

    app.use(responseTimer);
    app.use(express.json({ limit: "5mb" }));
    app.use(express.urlencoded({ extended: true }));

    app.use(cors());
    app.use(rateLimiter(50, 1));

    // --- Health Check ---
    app.get("/", (_, res) => {
        res.json({ status: "ok", message: "LendsQR API is running 🚀" });
    });

    // --- Routes ---
    app.use("/api/v1", (req, res, next) => {
        winstonLogger.info(`Received ${req.method} ${req.url}`);
        next()
    }, routes);

    app.use(() => {
        throw APIError.NotFound("Route not found");
    })

    // --- Error Handling ---
    app.use(errorHandler);

    return app;
};
