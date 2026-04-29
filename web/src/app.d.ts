// Types for Cloudflare Pages platform bindings and app locals.
// See: https://kit.svelte.dev/docs/types#app

import type { D1Database } from '@cloudflare/workers-types';

declare global {
  namespace App {
    interface Platform {
      env: Env;
      cf: CfProperties;
      ctx: ExecutionContext;
    }
    interface Locals {
      // Set by hooks.server.ts after Cloudflare Access auth
      user: {
        email: string;
        teamId: number;
        teamName: string;
        isCommissioner: boolean;
      } | null;
    }
    // interface Error {}
    // interface PageData {}
  }
}

interface Env {
  DB: D1Database;
}

export {};
