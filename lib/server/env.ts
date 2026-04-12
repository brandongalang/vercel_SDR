import "server-only";

import { timingSafeEqual } from "node:crypto";

export function getRequiredServerEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

export function isDemoResetEnabled() {
  return process.env.ENABLE_DEMO_RESET === "true";
}

function secureCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function isAuthorizedDemoResetRequest(request: Request) {
  const expectedToken = process.env.DEMO_RESET_TOKEN?.trim();
  const providedToken = request.headers.get("x-demo-reset-token")?.trim();

  if (!expectedToken || !providedToken) {
    return false;
  }

  return secureCompare(expectedToken, providedToken);
}
