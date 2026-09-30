import "server-only";
import { init_experimental } from "@instantdb/admin";
import { getRequiredServerEnv } from "@/lib/server/env";

export function getAdminDb() {
  return init_experimental({
    appId: getRequiredServerEnv("NEXT_PUBLIC_INSTANT_APP_ID"),
    adminToken: getRequiredServerEnv("INSTANT_ADMIN_TOKEN"),
  });
}
