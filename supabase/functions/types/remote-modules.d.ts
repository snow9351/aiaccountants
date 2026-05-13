/**
 * Ambient modules for remote Deno URL imports.
 * The Vite/Node TypeScript project does not resolve `https://` specifiers; Edge Functions still load them at runtime under Deno.
 */
declare module "https://deno.land/std@0.177.0/http/server.ts" {
  export function serve(
    handler: (request: Request) => Response | Promise<Response>,
  ): void;
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export function createClient(
    supabaseUrl: string,
    supabaseKey: string,
    options?: Record<string, unknown>,
  ): any;
}

declare module "https://esm.sh/stripe@14?target=deno" {
  const Stripe: any;
  export default Stripe;
}
