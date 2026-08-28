import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createHandler } from "./handler.js";

Deno.serve(createHandler({
  fetchImpl: fetch,
  env: (name: string) => Deno.env.get(name),
}));
