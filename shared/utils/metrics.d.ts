/**
 * Simple in-memory metrics collection
 * In production, this could be replaced with Prometheus, StatsD, etc.
 */
declare class MetricsCollector {
    private metrics;
    private counters;
    private histograms;
    private maxMetrics;
    /**
     * Increment a counter
     */
    increment(name: string, tags?: {
        [key: string]: string;
    }): void;
    /**
     * Record a value (for histograms/timings)
     */
    record(name: string, value: number, tags?: {
        [key: string]: string;
    }): void;
    /**
     * Get counter value
     */
    getCounter(name: string, tags?: {
        [key: string]: string;
    }): number;
    /**
     * Get histogram statistics
     */
    getHistogramStats(name: string, tags?: {
        [key: string]: string;
    }): {
        count: number;
        sum: number;
        avg: number;
        min: number;
        max: number;
    } | null;
    /**
     * Get all metrics summary
     */
    getSummary(): {
        counters: {
            [key: string]: number;
        };
        histograms: {
            [key: string]: any;
        };
    };
    /**
     * Reset all metrics
     */
    reset(): void;
    private getKey;
}
export declare const metrics: MetricsCollector;
export {};
//# sourceMappingURL=metrics.d.ts.map