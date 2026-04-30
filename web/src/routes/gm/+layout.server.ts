import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  if (!locals.user) {
    // Not logged in or email not in teams table
    throw redirect(303, '/');
  }
  return { user: locals.user };
};
