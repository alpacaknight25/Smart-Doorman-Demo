import { loadConfig } from "./config.js";
import { OpenAIRealtimeController } from "./openai-realtime.js";
import { configureGlobalProxy } from "./proxy.js";
import { buildServer } from "./server.js";
import { VisitorService } from "./visitor-service.js";
import { JsonlVisitorStore } from "./visitor-store.js";
import { WeComNotifier } from "./wecom.js";

const config = loadConfig();
configureGlobalProxy();
const visitorService = new VisitorService(
  new JsonlVisitorStore(),
  new WeComNotifier(config.WECOM_WEBHOOK_URL, config.GUARD_MENTION_MOBILES),
);
const realtime = new OpenAIRealtimeController(config.OPENAI_API_KEY, config.OPENAI_WEBHOOK_SECRET, visitorService);
const app = await buildServer({
  realtime,
  visitorService,
  enableDevRoutes: process.env.NODE_ENV !== "production",
});

await app.listen({ port: config.PORT, host: "0.0.0.0" });
