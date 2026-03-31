import { createApp } from "./app";
import db from "./configs/db";
import { env } from "./configs/env";
import { winstonLogger } from "./utils/logger";


const PORT = Number(env.PORT) || 3000;

const startServer = async (): Promise<void> => {
    try {
        // Verify database connection
        await db.raw("SELECT 1");
        winstonLogger.info("Database connection established");
        const app = createApp();
        app.listen(PORT, () => {
            winstonLogger.info(`API running on port ${PORT}`);
            winstonLogger.info(`Environment: ${env.NODE_ENV}`);
            winstonLogger.info(`Health check: http://localhost:${PORT}/health`);
        });
    } catch (error) {
        winstonLogger.error("Failed to start server:", error);
        process.exit(1);
    }
};

startServer();

// Graceful shutdown
process.on("SIGTERM", async () => {
    winstonLogger.info("SIGTERM received — closing DB connections...");
    await db.destroy();
    process.exit(0);
});