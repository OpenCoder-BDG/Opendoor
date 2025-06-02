import { Logger } from './Logger';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
  expectedErrors?: (error: any) => boolean;
}

export class CircuitBreaker {
  private logger = Logger.getInstance();
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;
  private readonly options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = {
      failureThreshold: options.failureThreshold || 5,
      resetTimeout: options.resetTimeout || 60000, // 1 minute
      monitoringPeriod: options.monitoringPeriod || 10000, // 10 seconds
      expectedErrors: options.expectedErrors || (() => true)
    };
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        this.logger.info('Circuit breaker transitioning to HALF_OPEN');
      } else {
        throw new Error('Circuit breaker is OPEN - operation not allowed');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= 3) { // Require 3 successes to close
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        this.logger.info('Circuit breaker CLOSED - service recovered');
      }
    }
  }

  private onFailure(error: any): void {
    if (!this.options.expectedErrors!(error)) {
      return; // Don't count unexpected errors
    }

    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      this.successCount = 0;
      this.logger.warn('Circuit breaker OPEN - service still failing');
    } else if (this.failureCount >= this.options.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.logger.warn(`Circuit breaker OPEN - failure threshold (${this.options.failureThreshold}) exceeded`);
    }
  }

  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime >= this.options.resetTimeout;
  }

  getState(): CircuitState {
    return this.state;
  }

  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime
    };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.logger.info('Circuit breaker manually reset');
  }
}

// Factory for creating circuit breakers with common configurations
export class CircuitBreakerFactory {
  static createForDatabase(): CircuitBreaker {
    return new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 30000, // 30 seconds
      monitoringPeriod: 5000,
      expectedErrors: (error) => {
        // Only count connection and timeout errors
        return error.code === 'ECONNREFUSED' || 
               error.code === 'ETIMEDOUT' ||
               error.message?.includes('timeout');
      }
    });
  }

  static createForContainer(): CircuitBreaker {
    return new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 60000, // 1 minute
      monitoringPeriod: 10000,
      expectedErrors: (error) => {
        // Count Docker API errors
        return error.statusCode >= 500 ||
               error.message?.includes('Docker') ||
               error.message?.includes('container');
      }
    });
  }

  static createForExternal(): CircuitBreaker {
    return new CircuitBreaker({
      failureThreshold: 10,
      resetTimeout: 120000, // 2 minutes
      monitoringPeriod: 15000,
      expectedErrors: (error) => {
        // Count HTTP errors and network issues
        return error.code === 'ENOTFOUND' ||
               error.code === 'ECONNRESET' ||
               (error.response && error.response.status >= 500);
      }
    });
  }
}