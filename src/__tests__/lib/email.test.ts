/**
 * Tests for src/lib/email.ts
 *
 * Security invariant verified:
 *  - Module throws at load time when DEFAULT_FROM_EMAIL is not set
 *  - Module loads successfully when DEFAULT_FROM_EMAIL is present
 */

// Prevent Resend from making real network calls
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn() },
  })),
}));

describe('email module — DEFAULT_FROM_EMAIL startup assertion', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('throws when DEFAULT_FROM_EMAIL is not set', () => {
    delete process.env.DEFAULT_FROM_EMAIL;

    expect(() => {
      require('@/lib/email');
    }).toThrow('DEFAULT_FROM_EMAIL environment variable is required');
  });

  it('loads successfully when DEFAULT_FROM_EMAIL is set', () => {
    process.env.DEFAULT_FROM_EMAIL = 'help@example.com';

    expect(() => {
      require('@/lib/email');
    }).not.toThrow();
  });
});
