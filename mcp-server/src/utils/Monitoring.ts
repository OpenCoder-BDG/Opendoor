import { Logger } from './Logger';
import { performance } from 'perf_hooks';
import os from 'os';

export interface MetricData {
  name: string;
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

export interface PerformanceMetrics {
  responseTime: number;
  throughput: number;
  errorRate: number;
  memoryUsage: number;
  cpuUsage: number;
  activeConnections: number;
}

export class MonitoringService {
  private logger = Logger.getInstance();
  private metrics: Map<string, MetricData[]> = new Map();
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private startTime = Date.now();

  // Performance tracking
  private requestCount = 0;
  private errorCount = 0;
  private responseTimeSum = 0;
  private lastCpuUsage = process.cpuUsage();
  private lastCpuTime = Date.now();

  constructor() {
    // Start periodic metric collection
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000); // Every 30 seconds

    // Start metric cleanup
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 300000); // Every 5 minutes
  }

  // Counter methods
  incrementCounter(name: string, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    this.counters.set(key, (this.counters.get(key) || 0) + 1);
    this.recordMetric(name, this.counters.get(key)!, labels);
  }

  // Gauge methods
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    this.gauges.set(key, value);
    this.recordMetric(name, value, labels);
  }

  // Histogram methods
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    if (!this.histograms.has(key)) {
      this.histograms.set(key, []);
    }
    this.histograms.get(key)!.push(value);
    this.recordMetric(name, value, labels);
  }

  // Timer utility
  startTimer(name: string, labels?: Record<string, string>) {
    const start = performance.now();
    return {
      end: () => {
        const duration = performance.now() - start;
        this.recordHistogram(`${name}_duration_ms`, duration, labels);
        return duration;
      }
    };
  }

  // Request tracking
  trackRequest(method: string, path: string, statusCode: number, duration: number): void {
    this.requestCount++;
    this.responseTimeSum += duration;

    const labels = { method, path, status: statusCode.toString() };
    
    this.incrementCounter('http_requests_total', labels);
    this.recordHistogram('http_request_duration_ms', duration, labels);

    if (statusCode >= 400) {
      this.errorCount++;
      this.incrementCounter('http_errors_total', labels);
    }
  }

  // Container metrics
  trackContainerOperation(operation: string, type: string, success: boolean, duration: number): void {
    const labels = { operation, type, success: success.toString() };
    
    this.incrementCounter('container_operations_total', labels);
    this.recordHistogram('container_operation_duration_ms', duration, labels);

    if (!success) {
      this.incrementCounter('container_errors_total', labels);
    }
  }

  // Session metrics
  trackSessionOperation(operation: string, success: boolean, duration: number): void {
    const labels = { operation, success: success.toString() };
    
    this.incrementCounter('session_operations_total', labels);
    this.recordHistogram('session_operation_duration_ms', duration, labels);
  }

  // Database metrics
  trackDatabaseOperation(operation: string, success: boolean, duration: number): void {
    const labels = { operation, success: success.toString() };
    
    this.incrementCounter('database_operations_total', labels);
    this.recordHistogram('database_operation_duration_ms', duration, labels);

    if (!success) {
      this.incrementCounter('database_errors_total', labels);
    }
  }

  private recordMetric(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    this.metrics.get(key)!.push({
      name,
      value,
      timestamp: Date.now(),
      labels
    });
  }

  private getMetricKey(name: string, labels?: Record<string, string>): string {
    if (!labels) return name;
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return `${name}{${labelStr}}`;
  }

  private collectSystemMetrics(): void {
    // Memory metrics
    const memUsage = process.memoryUsage();
    this.setGauge('process_memory_rss_bytes', memUsage.rss);
    this.setGauge('process_memory_heap_used_bytes', memUsage.heapUsed);
    this.setGauge('process_memory_heap_total_bytes', memUsage.heapTotal);
    this.setGauge('process_memory_external_bytes', memUsage.external);

    // System memory
    this.setGauge('system_memory_total_bytes', os.totalmem());
    this.setGauge('system_memory_free_bytes', os.freemem());
    this.setGauge('system_memory_usage_percent', 
      ((os.totalmem() - os.freemem()) / os.totalmem()) * 100);

    // CPU metrics
    const currentCpuUsage = process.cpuUsage(this.lastCpuUsage);
    const currentTime = Date.now();
    const timeDiff = currentTime - this.lastCpuTime;
    
    if (timeDiff > 0) {
      const cpuPercent = ((currentCpuUsage.user + currentCpuUsage.system) / 1000) / timeDiff * 100;
      this.setGauge('process_cpu_usage_percent', cpuPercent);
    }

    this.lastCpuUsage = process.cpuUsage();
    this.lastCpuTime = currentTime;

    // Load average (Unix systems)
    if (os.loadavg) {
      const loadAvg = os.loadavg();
      this.setGauge('system_load_1m', loadAvg[0]);
      this.setGauge('system_load_5m', loadAvg[1]);
      this.setGauge('system_load_15m', loadAvg[2]);
    }

    // Uptime
    this.setGauge('process_uptime_seconds', (Date.now() - this.startTime) / 1000);
    this.setGauge('system_uptime_seconds', os.uptime());

    // Performance metrics
    if (this.requestCount > 0) {
      const avgResponseTime = this.responseTimeSum / this.requestCount;
      const errorRate = (this.errorCount / this.requestCount) * 100;
      
      this.setGauge('http_avg_response_time_ms', avgResponseTime);
      this.setGauge('http_error_rate_percent', errorRate);
      this.setGauge('http_throughput_rps', this.requestCount / ((Date.now() - this.startTime) / 1000));
    }
  }

  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [key, metrics] of this.metrics.entries()) {
      const filtered = metrics.filter(m => m.timestamp > cutoff);
      if (filtered.length === 0) {
        this.metrics.delete(key);
      } else {
        this.metrics.set(key, filtered);
      }
    }

    // Clean up histogram data older than 1 hour
    const histogramCutoff = Date.now() - (60 * 60 * 1000);
    for (const [key, values] of this.histograms.entries()) {
      if (values.length > 1000) { // Keep only recent 1000 values
        this.histograms.set(key, values.slice(-1000));
      }
    }
  }

  getMetrics(): Record<string, any> {
    const result: Record<string, any> = {};

    // Current gauge values
    for (const [key, value] of this.gauges.entries()) {
      result[key] = value;
    }

    // Counter values
    for (const [key, value] of this.counters.entries()) {
      result[key] = value;
    }

    // Histogram statistics
    for (const [key, values] of this.histograms.entries()) {
      if (values.length > 0) {
        const sorted = [...values].sort((a, b) => a - b);
        result[`${key}_count`] = values.length;
        result[`${key}_sum`] = values.reduce((a, b) => a + b, 0);
        result[`${key}_avg`] = values.reduce((a, b) => a + b, 0) / values.length;
        result[`${key}_min`] = sorted[0];
        result[`${key}_max`] = sorted[sorted.length - 1];
        result[`${key}_p50`] = sorted[Math.floor(sorted.length * 0.5)];
        result[`${key}_p95`] = sorted[Math.floor(sorted.length * 0.95)];
        result[`${key}_p99`] = sorted[Math.floor(sorted.length * 0.99)];
      }
    }

    return result;
  }

  getHealthMetrics(): PerformanceMetrics {
    const memUsage = process.memoryUsage();
    const avgResponseTime = this.requestCount > 0 ? this.responseTimeSum / this.requestCount : 0;
    const errorRate = this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0;
    const throughput = this.requestCount / ((Date.now() - this.startTime) / 1000);

    return {
      responseTime: avgResponseTime,
      throughput,
      errorRate,
      memoryUsage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      cpuUsage: this.gauges.get('process_cpu_usage_percent') || 0,
      activeConnections: this.gauges.get('active_connections') || 0
    };
  }

  // Prometheus-style metrics export
  exportPrometheusMetrics(): string {
    const lines: string[] = [];
    
    for (const [key, value] of this.gauges.entries()) {
      lines.push(`# TYPE ${key} gauge`);
      lines.push(`${key} ${value}`);
    }

    for (const [key, value] of this.counters.entries()) {
      lines.push(`# TYPE ${key} counter`);
      lines.push(`${key} ${value}`);
    }

    return lines.join('\n');
  }

  reset(): void {
    this.metrics.clear();
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.requestCount = 0;
    this.errorCount = 0;
    this.responseTimeSum = 0;
    this.startTime = Date.now();
  }
}

// Singleton instance
export const monitoring = new MonitoringService();