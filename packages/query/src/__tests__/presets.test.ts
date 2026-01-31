import { describe, it, expect, beforeEach, vi } from 'vitest';
import { expandDatePreset, DATE_PRESETS } from '../presets.js';

describe('expandDatePreset', () => {
  beforeEach(() => {
    // Mock current date to 2026-01-31
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-31T12:00:00Z'));
  });

  it('expands last_7_days', () => {
    const result = expandDatePreset('last_7_days');
    expect(result?.start_date).toBe('2026-01-24');
    expect(result?.end_date).toBe('2026-01-31');
  });

  it('expands last_30_days', () => {
    const result = expandDatePreset('last_30_days');
    expect(result?.start_date).toBe('2026-01-01');
    expect(result?.end_date).toBe('2026-01-31');
  });

  it('expands last_90_days', () => {
    const result = expandDatePreset('last_90_days');
    expect(result?.start_date).toBe('2025-11-02');
    expect(result?.end_date).toBe('2026-01-31');
  });

  it('expands last_12_months', () => {
    const result = expandDatePreset('last_12_months');
    expect(result?.start_date).toBe('2025-01-31');
    expect(result?.end_date).toBe('2026-01-31');
  });

  it('expands year_to_date', () => {
    const result = expandDatePreset('year_to_date');
    expect(result?.start_date).toBe('2026-01-01');
    expect(result?.end_date).toBe('2026-01-31');
  });

  it('expands month_to_date', () => {
    const result = expandDatePreset('month_to_date');
    expect(result?.start_date).toBe('2026-01-01');
    expect(result?.end_date).toBe('2026-01-31');
  });

  it('expands quarter_to_date', () => {
    const result = expandDatePreset('quarter_to_date');
    expect(result?.start_date).toBe('2026-01-01');
    expect(result?.end_date).toBe('2026-01-31');
  });

  it('expands previous_month', () => {
    const result = expandDatePreset('previous_month');
    expect(result?.start_date).toBe('2025-12-01');
    expect(result?.end_date).toBe('2025-12-31');
  });

  it('expands previous_quarter', () => {
    const result = expandDatePreset('previous_quarter');
    expect(result?.start_date).toBe('2025-10-01');
    expect(result?.end_date).toBe('2025-12-31');
  });

  it('expands previous_year', () => {
    const result = expandDatePreset('previous_year');
    expect(result?.start_date).toBe('2025-01-01');
    expect(result?.end_date).toBe('2025-12-31');
  });

  it('returns null for unknown preset', () => {
    const result = expandDatePreset('unknown_preset');
    expect(result).toBeNull();
  });

  it('exports list of available presets', () => {
    expect(DATE_PRESETS).toContain('last_7_days');
    expect(DATE_PRESETS).toContain('last_30_days');
    expect(DATE_PRESETS).toContain('year_to_date');
  });
});
