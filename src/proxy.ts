import { HttpsProxyAgent } from "https-proxy-agent";
import { ProxyAgent, setGlobalDispatcher } from "undici";

export function getProxyUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env.HTTPS_PROXY ?? env.https_proxy ?? env.HTTP_PROXY ?? env.http_proxy;
}

export function configureGlobalProxy(env: NodeJS.ProcessEnv = process.env): void {
  const proxyUrl = getProxyUrl(env);
  if (!proxyUrl) return;

  setGlobalDispatcher(new ProxyAgent(proxyUrl));
  console.info(`[proxy] using ${redactProxyUrl(proxyUrl)} for HTTPS requests`);
}

export function createWebSocketProxyAgent(env: NodeJS.ProcessEnv = process.env): HttpsProxyAgent<string> | undefined {
  const proxyUrl = getProxyUrl(env);
  return proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;
}

function redactProxyUrl(proxyUrl: string): string {
  try {
    const url = new URL(proxyUrl);
    if (url.username || url.password) {
      url.username = "***";
      url.password = "***";
    }
    return url.toString();
  } catch {
    return "<invalid proxy url>";
  }
}
