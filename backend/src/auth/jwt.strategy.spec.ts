import type { Request } from 'express';
import { fromAuthHeaderOrQueryParam } from './jwt.strategy.js';

function request(input: Partial<Request>): Request {
  return {
    method: 'GET',
    originalUrl: '/',
    headers: {},
    query: {},
    ...input,
  } as Request;
}

describe('JWT request extraction', () => {
  it('always accepts a bearer header', () => {
    expect(
      fromAuthHeaderOrQueryParam(
        request({ headers: { authorization: 'Bearer header-token' } }),
      ),
    ).toBe('header-token');
  });

  it('accepts a query token only for the motors progress SSE route', () => {
    expect(
      fromAuthHeaderOrQueryParam(
        request({
          originalUrl:
            '/api/motors-intelligence/products/product-1/progress?token=sse-token',
          query: { token: 'sse-token' },
        }),
      ),
    ).toBe('sse-token');
    expect(
      fromAuthHeaderOrQueryParam(
        request({
          originalUrl: '/api/catalog-products?token=stolen-token',
          query: { token: 'stolen-token' },
        }),
      ),
    ).toBeNull();
  });
});
