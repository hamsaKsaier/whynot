import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getHostnameMode, isSuperadminHostname, getAdminUrl } from '../hostname';

function mockHostname(hostname: string, protocol = 'https:', port = '') {
  Object.defineProperty(window, 'location', {
    value: { hostname, protocol, port },
    writable: true,
    configurable: true,
  });
}

describe('hostname', () => {
  beforeEach(() => {
    mockHostname('admin.whynot.skrum.io');
  });

  describe('getHostnameMode', () => {
    it('returns "superadmin" for superadmin.whynot.skrum.io', () => {
      mockHostname('superadmin.whynot.skrum.io');
      expect(getHostnameMode()).toBe('superadmin');
    });

    it('returns "superadmin" for superadmin.localhost', () => {
      mockHostname('superadmin.localhost');
      expect(getHostnameMode()).toBe('superadmin');
    });

    it('returns "admin" for admin.whynot.skrum.io', () => {
      mockHostname('admin.whynot.skrum.io');
      expect(getHostnameMode()).toBe('admin');
    });

    it('returns "admin" for localhost', () => {
      mockHostname('localhost');
      expect(getHostnameMode()).toBe('admin');
    });

    it('returns "admin" for any unknown hostname', () => {
      mockHostname('staging.example.com');
      expect(getHostnameMode()).toBe('admin');
    });
  });

  describe('isSuperadminHostname', () => {
    it('returns true for superadmin hostname', () => {
      mockHostname('superadmin.whynot.skrum.io');
      expect(isSuperadminHostname()).toBe(true);
    });

    it('returns false for admin hostname', () => {
      mockHostname('admin.whynot.skrum.io');
      expect(isSuperadminHostname()).toBe(false);
    });
  });

  describe('getAdminUrl', () => {
    it('returns correct admin URL without port', () => {
      mockHostname('superadmin.whynot.skrum.io', 'https:', '');
      expect(getAdminUrl()).toBe('https://admin.whynot.skrum.io');
    });

    it('returns correct admin URL with port', () => {
      mockHostname('superadmin.whynot.skrum.io', 'http:', '5184');
      expect(getAdminUrl()).toBe('http://admin.whynot.skrum.io:5184');
    });
  });
});
