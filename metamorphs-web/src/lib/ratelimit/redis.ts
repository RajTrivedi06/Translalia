// Rate limiting disabled for now (requires @upstash/redis and @upstash/ratelimit)
// TODO: Add rate limiting back when Redis dependencies are installed

export function getLimiter() {
  return null; // Disabled
}

export async function checkDailyLimit(
  userId: string,
  key: string,
  max: number
) {
  // Always allow for now
  return { allowed: true, current: 0, max } as const;
}
