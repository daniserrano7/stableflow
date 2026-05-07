import { z } from "zod";

const envSchema = z.object({
  PONDER_RPC_URL_8453: z.string().url(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid indexer environment variables", parsedEnv.error.flatten().fieldErrors);
  throw new Error("Invalid indexer environment variables");
}

export const env = parsedEnv.data;
