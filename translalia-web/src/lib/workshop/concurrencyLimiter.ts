/**
 * ISS-003: Simple concurrency limiter (semaphore) for bounded parallelism
 * 
 * Limits concurrent execution of async tasks to prevent rate-limit meltdowns
 * and excessive resource usage.
 */

export class ConcurrencyLimiter {
  private running = 0;
  private queue: Array<() => void> = [];
  private readonly maxConcurrent: number;

  constructor(maxConcurrent: number) {
    if (maxConcurrent < 1) {
      throw new Error("maxConcurrent must be >= 1");
    }
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Acquire a permit. Returns a promise that resolves when a permit is available.
   * Call release() on the returned object when done.
   */
  async acquire(): Promise<{ release: () => void }> {
    return new Promise((resolve) => {
      if (this.running < this.maxConcurrent) {
        this.running++;
        resolve({ release: () => this.release() });
      } else {
        this.queue.push(() => {
          this.running++;
          resolve({ release: () => this.release() });
        });
      }
    });
  }

  private release(): void {
    this.running--;
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) {
        next();
      }
    }
  }

  /**
   * Get current concurrency stats
   */
  getStats(): { running: number; queued: number; maxConcurrent: number } {
    return {
      running: this.running,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrent,
    };
  }
}
