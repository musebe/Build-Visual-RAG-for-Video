import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/lib/config/env";
import type { Database } from "@/lib/supabase/database";

let client: ReturnType<typeof createClient<Database>> | undefined;

export function getSupabaseAdmin() {
  if (!client) {
    const env = getServerEnv();
    client = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return client;
}
