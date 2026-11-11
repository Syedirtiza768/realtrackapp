import { ConfigService } from '@nestjs/config';
import { OpenAiService } from '../../common/openai/openai.service.js';
import { EnrichmentRetryService } from '../../inventory/enrichment-retry.service.js';
import { SingleListingFormService } from './single-listing-form.service.js';

describe('Add Part recovery regressions', () => {
  it('bounds requests without an explicit completion limit', async () => {
    const service = new OpenAiService(
      new ConfigService({ OPENAI_API_KEY: 'test-only' }),
    );
    let requestedTokens: number | undefined;
    const create = jest.fn((request: { max_tokens: number }) => {
      requestedTokens = request.max_tokens;
      return Promise.resolve({
        choices: [{ message: { content: '{}' }, finish_reason: 'stop' }],
        usage: {},
      });
    });
    Object.assign(service, { client: { chat: { completions: { create } } } });
    await service.chat({ systemPrompt: 'test', userPrompt: 'test' });
    expect(requestedTokens).toBe(4096);
    await service.chat({
      systemPrompt: 'test',
      userPrompt: 'test',
      maxTokens: 2000,
    });
    expect(requestedTokens).toBe(2000);
  });

  it('classifies billing failures before numeric substrings in the message', () => {
    const service = Object.create(
      EnrichmentRetryService.prototype,
    ) as EnrichmentRetryService;
    const failure = service.classifyError(
      new Error(
        '402 This request requires more credits; can only afford 14001 tokens',
      ),
    );
    expect(failure.classification).toBe('permanent');
    expect(failure.reason).toMatch(/^provider_billing_402:/);
  });

  it('preserves the original provider error instead of reporting missing photo evidence', async () => {
    const error = Object.assign(new Error('402 Insufficient credits'), {
      status: 402,
    });
    const service = Object.create(
      SingleListingFormService.prototype,
    ) as SingleListingFormService;
    Object.assign(service, {
      runVisionLookup: jest.fn().mockRejectedValue(error),
      logger: { warn: jest.fn() },
    });
    await expect(
      service.lookupPart({
        partNumber: '11611611',
        imageUrls: ['https://example.com/1.jpg', 'https://example.com/2.jpg'],
      }),
    ).rejects.toBe(error);
  });
});
