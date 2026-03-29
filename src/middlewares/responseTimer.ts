import { Request, Response, NextFunction } from "express";
import { winstonLogger } from "@/utils/logger"; // your existing logger (DB, console, etc.)

export const responseTimer = (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime.bigint(); // high-precision timer

    // When the response finishes, measure time
    res.on("finish", () => {
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1_000_000; // convert nanoseconds to ms

        // Example: log performance
        winstonLogger.info(`Handled ${req.method} ${req.originalUrl}`, {
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            durationMs: durationMs.toFixed(2),
        });
    });

    next();
};
