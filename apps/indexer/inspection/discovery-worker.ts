import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import type { InspectionArgs } from "./args.js";
import { createOperatorDb } from "./db.js";
import { runDiscovery } from "./discovery.js";

const workerEnvSchema = z.object({
  NODE_ENV: z.literal("production"),
  LABEL_DISCOVERY_SCHEDULE_ENABLED: z.literal("true"),
  LABEL_DISCOVERY_INTERVAL_MINUTES: z.coerce.number().int().min(30).max(1440).default(360),
  LABEL_DISCOVERY_RETRY_MINUTES: z.coerce.number().int().min(1).max(60).default(5),
  LABEL_DISCOVERY_WINDOW_MINUTES: z.coerce.number().int().min(1).max(1440).default(1440),
  LABEL_DISCOVERY_LIMIT: z.coerce.number().int().min(1).max(200).default(50),
  LABEL_DISCOVERY_COOLDOWN_MINUTES: z.coerce.number().int().min(1).max(10080).default(1440),
});

const run = async () => {
  const settings = workerEnvSchema.parse(process.env);
  const shutdown = new AbortController();
  const stop = () => shutdown.abort();
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  const args: InspectionArgs = {
    json: true,
    limit: settings.LABEL_DISCOVERY_LIMIT,
    minutes: settings.LABEL_DISCOVERY_WINDOW_MINUTES,
  };

  while (!shutdown.signal.aborted) {
    const db = createOperatorDb();
    let waitMinutes = settings.LABEL_DISCOVERY_INTERVAL_MINUTES;

    try {
      const report = await runDiscovery(db, args, {
        checkedCooldownMinutes: settings.LABEL_DISCOVERY_COOLDOWN_MINUTES,
      });
      console.log(JSON.stringify(report));
      if (report.status !== "completed") {
        waitMinutes = settings.LABEL_DISCOVERY_RETRY_MINUTES;
      }
    } catch (error) {
      waitMinutes = settings.LABEL_DISCOVERY_RETRY_MINUTES;
      console.error(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
          kind: "label_discovery",
          status: "failed",
          timestamp: new Date().toISOString(),
        }),
      );
    } finally {
      await db.close();
    }

    try {
      await delay(waitMinutes * 60_000, undefined, {
        signal: shutdown.signal,
      });
    } catch (error) {
      if (!shutdown.signal.aborted) {
        throw error;
      }
    }
  }
};

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
