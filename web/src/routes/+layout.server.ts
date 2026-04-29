import type { LayoutServerLoad } from './$types';

// Pass auth context from hooks → layout → pages so every page knows
// who is logged in without re-querying D1.
export const load: LayoutServerLoad = ({ locals }) => {
  return { user: locals.user };
};
