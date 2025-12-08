"use strict";
/**
 * Simple in-memory metrics collection
 * In production, this could be replaced with Prometheus, StatsD, etc.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.metrics = void 0;
class MetricsCollector {
    constructor() {
        this.metrics = [];
        this.counters = new Map();
        this.histograms = new Map();
        this.maxMetrics = 10000; // Keep last 10k metrics
    }
    /**
     * Increment a counter
     */
    increment(name, tags) {
        const key = this.getKey(name, tags);
        const current = this.counters.get(key) || 0;
        this.counters.set(key, current + 1);
    }
    /**
     * Record a value (for histograms/timings)
     */
    record(name, value, tags) {
        const key = this.getKey(name, tags);
        const values = this.histograms.get(key) || [];
        values.push(value);
        // Keep only last 1000 values per metric
        if (values.length > 1000) {
            values.shift();
        }
        this.histograms.set(key, values);
        // Also store as a metric
        this.metrics.push({
            name,
            value,
            timestamp: Date.now(),
            tags
        });
        // Trim old metrics
        if (this.metrics.length > this.maxMetrics) {
            this.metrics = this.metrics.slice(-this.maxMetrics);
        }
    }
    /**
     * Get counter value
     */
    getCounter(name, tags) {
        const key = this.getKey(name, tags);
        return this.counters.get(key) || 0;
    }
    /**
     * Get histogram statistics
     */
    getHistogramStats(name, tags) {
        const key = this.getKey(name, tags);
        const values = this.histograms.get(key);
        if (!values || values.length === 0) {
            return null;
        }
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);
        return {
            count: values.length,
            sum,
            avg,
            min,
            max
        };
    }
    /**
     * Get all metrics summary
     */
    getSummary() {
        const counters = {};
        const histograms = {};
        this.counters.forEach((value, key) => {
            counters[key] = value;
        });
        this.histograms.forEach((values, key) => {
            const stats = this.getHistogramStats(key);
            if (stats) {
                histograms[key] = stats;
            }
        });
        return { counters, histograms };
    }
    /**
     * Reset all metrics
     */
    reset() {
        this.metrics = [];
        this.counters.clear();
        this.histograms.clear();
    }
    getKey(name, tags) {
        if (!tags || Object.keys(tags).length === 0) {
            return name;
        }
        const tagStr = Object.entries(tags)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join(',');
        return `${name}{${tagStr}}`;
    }
}
// Singleton instance
exports.metrics = new MetricsCollector();
//# sourceMappingURL=metrics.js.map