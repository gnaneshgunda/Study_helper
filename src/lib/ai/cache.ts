import crypto from "crypto";

/**
 * Hash an AI input (task + messages) to a stable cache key.
 */
export function hashInput(task: string, messages: unknown[]): string {
  const payload = JSON.stringify({ task, messages });
  return crypto.createHash("sha256").update(payload).digest("hex");
}
