import "dotenv/config";
import { z } from "zod";

const ConfigSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_WEBHOOK_SECRET: z.string().min(1),
  WECOM_WEBHOOK_URL: z.string().url(),
  PUBLIC_BASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(8787),
  GUARD_MENTION_MOBILES: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : [],
    ),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return ConfigSchema.parse(env);
}
