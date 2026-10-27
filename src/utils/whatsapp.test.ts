import { describe, it, expect, vi, afterEach } from 'vitest';
import { createWhatsAppUrl, getWhatsAppNumber } from './whatsapp';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv('VITE_SUPABASE_URL', 'https://test-project.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
});

describe('createWhatsAppUrl', () => {
  it('converts a locally typed number to the international form wa.me needs', () => {
    expect(createWhatsAppUrl('Halo', '0812-3456-7890')).toBe('https://wa.me/6281234567890?text=Halo');
  });
  it('encodes the message', () => {
    expect(createWhatsAppUrl('Halo & selamat', '+62 812 1')).toContain('text=Halo%20%26%20selamat');
  });
  it('uses the configured studio number when no number is given', () => {
    vi.stubEnv('VITE_WHATSAPP_NUMBER', '0896-7734-3212');
    expect(getWhatsAppNumber()).toBe('6289677343212');
    expect(createWhatsAppUrl('Hi')).toBe('https://wa.me/6289677343212?text=Hi');
  });
  it('never invents a recipient when the studio number is not configured', () => {
    vi.stubEnv('VITE_WHATSAPP_NUMBER', '');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(getWhatsAppNumber()).toBe('');
    expect(createWhatsAppUrl('Hi')).toBe('https://wa.me/?text=Hi');
  });
});
