import winston from "winston";

export const winstonLogger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
            const metaString = Object.keys(meta).length
                ? ` | META: ${JSON.stringify(meta)}`
                : "";
            return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaString}`;
        })
    ),
    transports: [
        new winston.transports.File({ filename: "logs/error.log", level: "error" }),
        new winston.transports.File({ filename: "logs/combined.log" }),
        new winston.transports.Console(),
    ],
});