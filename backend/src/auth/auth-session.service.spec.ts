import { JwtService } from '@nestjs/jwt';
import { AuthSessionService } from './auth-session.service.js';

describe('AuthSessionService', () => {
  it('revokes a bearer token by jti until its expiry', async () => {
    const redis = { set: jest.fn().mockResolvedValue('OK'), exists: jest.fn() };
    const jwt = {
      decode: jest.fn().mockReturnValue({
        jti: 'session-1',
        exp: Math.floor(Date.now() / 1000) + 300,
      }),
    };
    const service = new AuthSessionService(
      redis as any,
      jwt as unknown as JwtService,
    );

    await service.revokeBearerToken('Bearer signed-token');

    expect(redis.set).toHaveBeenCalledWith(
      'auth:revoked:session-1',
      '1',
      'EX',
      expect.any(Number),
    );
  });

  it('rejects a revoked session and accepts an active one', async () => {
    const redis = {
      set: jest.fn(),
      exists: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0),
    };
    const service = new AuthSessionService(redis as any, {} as JwtService);

    await expect(service.assertNotRevoked('revoked')).rejects.toThrow(
      'Session has been signed out',
    );
    await expect(service.assertNotRevoked('active')).resolves.toBeUndefined();
  });
});
