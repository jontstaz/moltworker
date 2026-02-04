import type { Sandbox } from '@cloudflare/sandbox';

/**
 * Environment bindings for the Moltbot Worker
 */
export interface MoltbotEnv {
  Sandbox: DurableObjectNamespace<Sandbox>;
  ASSETS: Fetcher; // Assets binding for admin UI static files
  MOLTBOT_BUCKET: R2Bucket; // R2 bucket for persistent storage
  // AI Gateway configuration (preferred)
  AI_GATEWAY_API_KEY?: string; // API key for the provider configured in AI Gateway
  AI_GATEWAY_BASE_URL?: string; // AI Gateway URL (e.g., https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/anthropic)
  // Direct provider configuration (fallback)
  ZAI_API_KEY?: string;
  ZAI_BASE_URL?: string;
  ZAI_DEFAULT_HAIKU_MODEL?: string;
  ZAI_DEFAULT_SONNET_MODEL?: string;
  ZAI_DEFAULT_OPUS_MODEL?: string;
  MOONSHOT_API_KEY?: string;
  MOONSHOT_BASE_URL?: string;
  MOONSHOT_DEFAULT_MODEL?: string;
  OPENAI_API_KEY?: string;
  MOLTBOT_GATEWAY_TOKEN?: string; // Gateway token (mapped to OPENCLAW_GATEWAY_TOKEN for container)

  OPENCLAW_BIND_MODE?: string;
  DEV_MODE?: string; // Set to 'true' for local dev (skips CF Access auth + moltbot device pairing)
  DEBUG_ROUTES?: string; // Set to 'true' to enable /debug/* routes
  SANDBOX_SLEEP_AFTER?: string; // How long before sandbox sleeps: 'never' (default), or duration like '10m', '1h'
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_DM_POLICY?: string;
  TELEGRAM_ALLOW_FROM?: string;
  DISCORD_BOT_TOKEN?: string;
  DISCORD_DM_POLICY?: string;
  SLACK_BOT_TOKEN?: string;
  SLACK_APP_TOKEN?: string;
  // Cloudflare Access configuration for admin routes
  CF_ACCESS_TEAM_DOMAIN?: string; // e.g., 'myteam.cloudflareaccess.com'
  CF_ACCESS_AUD?: string; // Application Audience (AUD) tag
  // R2 credentials for bucket mounting (set via wrangler secret)
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  CF_ACCOUNT_ID?: string; // Cloudflare account ID for R2 endpoint
  // Browser Rendering binding for CDP shim
  BROWSER?: Fetcher;
  CDP_SECRET?: string; // Shared secret for CDP endpoint authentication
  WORKER_URL?: string; // Public URL of the worker (for CDP endpoint)
}

/**
 * Authenticated user from Cloudflare Access
 */
export interface AccessUser {
  email: string;
  name?: string;
}

/**
 * Hono app environment type
 */
export type AppEnv = {
  Bindings: MoltbotEnv;
  Variables: {
    sandbox: Sandbox;
    accessUser?: AccessUser;
  };
};

/**
 * JWT payload from Cloudflare Access
 */
export interface JWTPayload {
  aud: string[];
  email: string;
  exp: number;
  iat: number;
  iss: string;
  name?: string;
  sub: string;
  type: string;
}

/**
 * Installed plugin manifest entry
 */
export interface PluginManifest {
  name: string;
  installedAt: string;
  version?: string;
  dependencies?: string[];
}

/**
 * Installed skill manifest entry
 */
export interface SkillManifest {
  slug: string;
  installedAt: string;
  version?: string;
  dependencies?: string[];
}

/**
 * Combined installation manifest
 */
export interface InstallationManifest {
  plugins: PluginManifest[];
  skills: SkillManifest[];
  lastUpdated: string;
}

/**
 * Installation status
 */
export type InstallationStatus = 'idle' | 'installing' | 'completed' | 'failed';

/**
 * Installation job status
 */
export interface InstallationJob {
  id: string;
  type: 'plugin' | 'skill';
  target: string;
  status: InstallationStatus;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  output?: string[];
}
