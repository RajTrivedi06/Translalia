declare module "@upstash/redis" {
  export class Redis {
    constructor(config: { url: string; token: string });
    get<T = unknown>(key: string): Promise<T | null>;
    setex(key: string, ttlSeconds: number, value: string): Promise<unknown>;
  }
}



