import { ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FashionIntakeService } from './fashion-intake.service';
import { FashionListingsService } from './fashion-listings.service';
import type { CreateFashionIntakeDto } from './fashion.dto';
import type { User } from '../auth/entities/user.entity';

const user = { id: 'actor-1' } as User;
type Reservations = {
  reserveNumber: (organizationId: string, batch: string) => Promise<number>;
};
const dto: CreateFashionIntakeDto = {
  captureId: '11111111-1111-4111-8111-111111111111',
  sku: 'AVP-0100-M',
  batch: 'AVP',
  labelSize: 'M',
  frontImageUrl: 'https://example.test/front.webp',
  backImageUrl: 'https://example.test/back.webp',
  tagImageUrls: ['https://example.test/tag.webp'],
};
function fixture() {
  const repo = {
    findOneBy: jest.fn().mockResolvedValue(null),
    createQueryBuilder: jest.fn(),
  };
  const db = {
    getRepository: jest.fn().mockReturnValue(repo),
    transaction: jest.fn(),
  };
  const organizations = {
    resolveOrganizationId: jest
      .fn()
      .mockResolvedValue({ organizationId: 'org-1' }),
  };
  const listings = {
    create: jest.fn(),
    publicProduct: jest.fn((value: unknown) => value),
  };
  const queue = { add: jest.fn().mockResolvedValue({}) };
  const events = { emit: jest.fn() };
  const service = new FashionIntakeService(
    db as unknown as DataSource,
    organizations as any,
    listings as any,
    {} as any,
    queue as any,
    events as any,
  );
  return { service, repo, db, listings, queue, events, organizations };
}
describe('Fashion capture reliability', () => {
  it('returns the saved capture on retry without stock or queue side effects', async () => {
    const f = fixture();
    const saved = {
      id: 'saved',
      sku: dto.sku,
      verticalAttributes: {
        _captureId: dto.captureId,
        _intakeCreatedBy: user.id,
      },
    };
    f.repo.findOneBy.mockResolvedValue(saved);
    expect(await f.service.create(user, dto)).toBe(saved);
    expect(f.listings.create).not.toHaveBeenCalled();
    expect(f.events.emit).not.toHaveBeenCalled();
    expect(f.queue.add).not.toHaveBeenCalled();
    expect(f.repo.findOneBy).toHaveBeenCalledWith({
      sku: dto.sku,
      organizationId: 'org-1',
      vertical: 'fashion',
    });
  });
  it('recovers overlapping saves after the unique SKU constraint rejects the second write', async () => {
    const f = fixture();
    const saved = {
      id: 'saved',
      verticalAttributes: {
        _captureId: dto.captureId,
        _intakeCreatedBy: user.id,
      },
    };
    f.repo.findOneBy.mockResolvedValueOnce(null).mockResolvedValueOnce(saved);
    f.listings.create.mockRejectedValue(
      new ConflictException('SKU already exists'),
    );
    expect(await f.service.create(user, dto)).toBe(saved);
    expect(f.events.emit).not.toHaveBeenCalled();
    expect(f.queue.add).not.toHaveBeenCalled();
  });
  it.each([
    { _captureId: 'different', _intakeCreatedBy: user.id },
    { _captureId: dto.captureId, _intakeCreatedBy: 'another-actor' },
  ])('never replays another capture or actor: %j', async (attributes) => {
    const f = fixture();
    f.repo.findOneBy.mockResolvedValue({ verticalAttributes: attributes });
    f.listings.create.mockRejectedValue(
      new ConflictException('SKU already exists'),
    );
    await expect(f.service.create(user, dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
  it('returns a durable draft even while Redis is unresponsive', async () => {
    jest.useFakeTimers();
    const f = fixture();
    f.listings.create.mockResolvedValue({
      id: 'saved',
      title: 'Pending',
      sku: dto.sku,
    });
    f.queue.add.mockReturnValue(new Promise(() => undefined));
    const setStatus = jest
      .spyOn(
        f.service as unknown as {
          setStatus: (...args: unknown[]) => Promise<void>;
        },
        'setStatus',
      )
      .mockResolvedValue(undefined);
    const result = await f.service.create(user, dto);
    expect(result.id).toBe('saved');
    expect(f.events.emit).toHaveBeenCalledTimes(1);
    expect(f.queue.add).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(10_001);
    expect(setStatus).toHaveBeenCalledWith(
      'saved',
      'org-1',
      'failed',
      expect.any(Array),
    );
    jest.useRealTimers();
  });
  it('checks all size suffixes when skipping an occupied garment number', async () => {
    const f = fixture();
    const builder = {
      where: jest.fn().mockReturnThis(),
      getExists: jest
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false),
    };
    f.repo.createQueryBuilder.mockReturnValue(builder);
    jest
      .spyOn(f.service as unknown as Reservations, 'reserveNumber')
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(101);
    expect(
      await f.service.nextSku(user, { batch: 'avp', sizeSuffix: 'm' }),
    ).toEqual({ batch: 'AVP', number: 101, sku: 'AVP-0101-M' });
    expect(builder.where).toHaveBeenCalledWith(
      'p.sku = :base OR p.sku LIKE :sized',
      { base: 'AVP-0100', sized: 'AVP-0100-%' },
    );
  });
  it('allocates above every organization counter under a shared prefix lock', async () => {
    const f = fixture();
    const query = jest.fn().mockResolvedValue([]);
    query.mockImplementation((sql: string) =>
      Promise.resolve(
        sql.includes('MAX(last_value)') ? [{ last_value: '12345' }] : [],
      ),
    );
    f.db.transaction.mockImplementation(
      (work: (manager: { query: typeof query }) => Promise<number>) =>
        work({ query }),
    );
    expect(
      await (f.service as unknown as Reservations).reserveNumber(
        'org-1',
        'AVP',
      ),
    ).toBe(12346);
    expect(query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
      ['fashion-sku', 'AVP'],
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('EXCLUDED.last_value'),
      ['org-1', 'AVP', 12346],
    );
  });
  it('replays a direct Add Item save without creating a second review or audit record', async () => {
    const f = fixture();
    const saved = {
      id: 'saved',
      verticalAttributes: {
        _captureId: dto.captureId,
        _createdByUserId: user.id,
      },
    };
    f.repo.findOneBy.mockResolvedValue(saved);
    const service = new FashionListingsService(
      f.db as unknown as DataSource,
      f.organizations as any,
      {} as any,
      {} as any,
      {} as any,
    );
    jest.spyOn(service, 'publicProduct').mockReturnValue(saved as any);
    expect(
      await service.create(user, {
        captureId: dto.captureId,
        sku: dto.sku,
        title: 'Garment',
        verticalAttributes: {},
      }),
    ).toBe(saved);
    expect(f.db.transaction).not.toHaveBeenCalled();
  });
});
