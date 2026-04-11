import { init } from "@instantdb/react";
import schema from "@/instant.schema";

export const db = init({
  appId: "52c6a678-6f76-4082-ae80-b3c7a65a9216",
  schema,
});
