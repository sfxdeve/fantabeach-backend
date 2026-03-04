import "@dotenvx/dotenvx/config";
import { env } from "./lib/env.js";
import { logger } from "./lib/logger.js";
import { bootstrap } from "./app.js";

async function run(): Promise<void> {
  const { app, shutdown } = await bootstrap();

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "FantaBeach backend started");
  });

  const handleSignal = (signal: NodeJS.Signals) => {
    logger.info({ signal }, "Shutdown signal received");

    const timeout = setTimeout(async () => {
      logger.error("Forced shutdown after timeout");

      await shutdown();

      process.exit(1);
    }, 10000);

    server.close(async () => {
      clearTimeout(timeout);

      await shutdown();

      process.exit(0);
    });
  };

  process.on("SIGINT", handleSignal);

  process.on("SIGTERM", handleSignal);

  process.on("unhandledRejection", (reason, promise) => {
    logger.error({ reason, promise }, "Unhandled promise rejection");
  });

  process.on("uncaughtException", (error) => {
    logger.error({ error }, "Uncaught exception");

    process.exit(1);
  });
}

run().catch((error) => {
  logger.error({ error }, "Unhandled startup error");

  process.exit(1);
});
