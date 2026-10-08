import { z } from 'zod';

// Validated once at boot — a missing/invalid variable fails fast here,
// not on the first request (backend doc §13).
try {
  process.loadEnvFile('.env');
} catch {
  // no .env file — defaults below apply
}

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().default(4000),
    // Unset in development → an in-memory MongoDB replica set, seeded at boot.
    MONGO_URI: z.string().optional(),
    MONGO_DB: z.string().default('prodify_dev'),
    // 'if-empty' seeds a fresh database; the in-memory DB is always seeded.
    SEED_ON_BOOT: z.enum(['always', 'if-empty', 'never']).default('if-empty'),
    // Both modes accept Prodify session tokens (issued by POST /auth/google).
    // dev additionally trusts "Bearer dev:<uid>" for the seeded test accounts.
    AUTH_MODE: z.enum(['dev', 'google']).default('dev'),
    // The Web OAuth client � native Google Sign-In mints ID tokens for this audience.
    GOOGLE_WEB_CLIENT_ID: z.string().optional(),
    // When set, ID tokens must also come from this Android client (the `azp` claim).
    GOOGLE_ANDROID_CLIENT_ID: z.string().optional(),
    // Signs Prodify session tokens. Dev falls back to a fixed key so tokens
    // survive restarts; production must set a real one.
    JWT_SECRET: z.string().min(32).default('prodify-dev-only-jwt-secret-change-me-0000'),
    // Comma-separated browser origins. Native apps send no Origin header.
    CORS_ORIGINS: z.string().default('http://localhost:8081,http://localhost:19006'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    // Background job cadence can be sped up for demos/tests.
    JOBS_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((v) => v === 'true'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      if (env.AUTH_MODE !== 'google') ctx.addIssue({ code: 'custom', message: 'production requires AUTH_MODE=google', path: ['AUTH_MODE'] });
      if (!process.env.JWT_SECRET) ctx.addIssue({ code: 'custom', message: 'production requires JWT_SECRET', path: ['JWT_SECRET'] });
      if (!env.MONGO_URI) ctx.addIssue({ code: 'custom', message: 'production requires MONGO_URI', path: ['MONGO_URI'] });
    }
    if (env.AUTH_MODE === 'google' && !env.GOOGLE_WEB_CLIENT_ID) {
      ctx.addIssue({ code: 'custom', message: 'AUTH_MODE=google requires GOOGLE_WEB_CLIENT_ID', path: ['GOOGLE_WEB_CLIENT_ID'] });
    }
  });

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:\n' + parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n'));
  process.exit(1);
}

export const env = parsed.data;
export const isDev = env.NODE_ENV !== 'production';
