// Temporary debug endpoint — shows what auth headers/cookies are arriving
// Visit /api/debug to diagnose CF Access header issues
// Remove this file once auth is confirmed working

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, locals }) => {
  const headers: Record<string, string> = {};
  for (const [k, v] of request.headers.entries()) {
    if (k.includes('cf-') || k.includes('cookie') || k === 'host') {
      headers[k] = k.includes('authorization') || k === 'cookie'
        ? v.slice(0, 60) + '…'   // truncate sensitive values
        : v;
    }
  }

  return json({
    locals_user: locals.user,
    auth_headers: headers,
  });
};
