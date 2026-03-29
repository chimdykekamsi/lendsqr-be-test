import "dotenv/config";
import { env } from "@/configs/env";
import { createApp } from "./app";
import { winstonLogger } from "./utils/logger";

const app = createApp();


const PORT = env.PORT || 4000;
app.listen(PORT, async () => {
    winstonLogger.info(`🚀 Server running on port ${PORT}`);
});

process.on("unhandledRejection", (reason, promise) => {
    winstonLogger.error("Unhandled Rejection at:", promise, "reason:", reason);
    process.exit(1);
});

process.on("uncaughtException", (err) => {
    winstonLogger.error("Uncaught Exception:", err);
    process.exit(1);
});
