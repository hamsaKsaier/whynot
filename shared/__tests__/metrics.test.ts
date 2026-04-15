import { describe, it, expect, beforeEach } from 'vitest';
import { metrics } from '../utils/metrics';

describe('MetricsCollector', () => {
  beforeEach(() => {
    metrics.reset();
  });

  describe('increment', () => {
    it('increments a counter from zero', () => {
      metrics.increment('requests');
      expect(metrics.getCounter('requests')).toBe(1);
    });

    it('increments multiple times', () => {
      metrics.increment('requests');
      metrics.increment('requests');
      metrics.increment('requests');
      expect(metrics.getCounter('requests')).toBe(3);
    });

    it('tracks different counters independently', () => {
      metrics.increment('a');
      metrics.increment('b');
      metrics.increment('b');
      expect(metrics.getCounter('a')).toBe(1);
      expect(metrics.getCounter('b')).toBe(2);
    });

    it('supports tags', () => {
      metrics.increment('requests', { method: 'GET' });
      metrics.increment('requests', { method: 'POST' });
      metrics.increment('requests', { method: 'GET' });
      expect(metrics.getCounter('requests', { method: 'GET' })).toBe(2);
      expect(metrics.getCounter('requests', { method: 'POST' })).toBe(1);
    });
  });

  describe('getCounter', () => {
    it('returns 0 for unknown counters', () => {
      expect(metrics.getCounter('nonexistent')).toBe(0);
    });

    it('returns 0 for unknown tags', () => {
      metrics.increment('requests', { method: 'GET' });
      expect(metrics.getCounter('requests', { method: 'DELETE' })).toBe(0);
    });
  });

  describe('record', () => {
    it('records values for histogram', () => {
      metrics.record('latency', 100);
      metrics.record('latency', 200);
      const stats = metrics.getHistogramStats('latency');
      expect(stats).toEqual({
        count: 2,
        sum: 300,
        avg: 150,
        min: 100,
        max: 200,
      });
    });

    it('supports tags on recorded values', () => {
      metrics.record('latency', 50, { route: '/api' });
      metrics.record('latency', 150, { route: '/api' });
      const stats = metrics.getHistogramStats('latency', { route: '/api' });
      expect(stats?.avg).toBe(100);
    });

    it('trims values beyond 1000 per metric', () => {
      for (let i = 0; i < 1005; i++) {
        metrics.record('big', i);
      }
      const stats = metrics.getHistogramStats('big');
      expect(stats?.count).toBe(1000);
      expect(stats?.min).toBe(5);
    });
  });

  describe('getHistogramStats', () => {
    it('returns null for unknown histograms', () => {
      expect(metrics.getHistogramStats('nonexistent')).toBeNull();
    });

    it('calculates correct stats', () => {
      metrics.record('duration', 10);
      metrics.record('duration', 20);
      metrics.record('duration', 30);
      const stats = metrics.getHistogramStats('duration')!;
      expect(stats.count).toBe(3);
      expect(stats.sum).toBe(60);
      expect(stats.avg).toBe(20);
      expect(stats.min).toBe(10);
      expect(stats.max).toBe(30);
    });
  });

  describe('getSummary', () => {
    it('returns empty summary when no data', () => {
      const summary = metrics.getSummary();
      expect(summary.counters).toEqual({});
      expect(summary.histograms).toEqual({});
    });

    it('includes all counters and histograms', () => {
      metrics.increment('requests');
      metrics.record('latency', 100);
      const summary = metrics.getSummary();
      expect(summary.counters['requests']).toBe(1);
      expect(summary.histograms['latency']).toBeDefined();
      expect(summary.histograms['latency'].count).toBe(1);
    });
  });

  describe('reset', () => {
    it('clears all data', () => {
      metrics.increment('requests');
      metrics.record('latency', 100);
      metrics.reset();
      expect(metrics.getCounter('requests')).toBe(0);
      expect(metrics.getHistogramStats('latency')).toBeNull();
      expect(metrics.getSummary()).toEqual({ counters: {}, histograms: {} });
    });
  });

  describe('tag key sorting', () => {
    it('produces same key regardless of tag order', () => {
      metrics.increment('req', { b: '2', a: '1' });
      expect(metrics.getCounter('req', { a: '1', b: '2' })).toBe(1);
    });

    it('handles empty tags same as no tags', () => {
      metrics.increment('req');
      expect(metrics.getCounter('req', {})).toBe(1);
    });
  });

  describe('metrics trimming', () => {
    it('trims total metrics at 10k', () => {
      for (let i = 0; i < 10005; i++) {
        metrics.record(`m_${i % 100}`, i);
      }
      const summary = metrics.getSummary();
      expect(Object.keys(summary.histograms).length).toBeLessThanOrEqual(100);
    });
  });
});
