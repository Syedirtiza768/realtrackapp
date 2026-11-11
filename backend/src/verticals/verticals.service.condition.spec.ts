import { VerticalsService } from './verticals.service.js';

type ConditionMapper = {
  mapCondition(
    conditionId?: string | null,
    conditionLabel?: string | null,
  ): string | null;
  pickSupportedConditionId(
    condition: string | null,
    supportedConditions: string[],
    preferredId: string | null,
  ): string | null;
};

describe('VerticalsService Business & Industrial condition mapping', () => {
  const mapper = Object.create(
    VerticalsService.prototype,
  ) as ConditionMapper;

  it('preserves the canonical 3000 used condition', () => {
    expect(mapper.mapCondition('3000', 'USED')).toBe('USED_EXCELLENT');
  });

  it('infers 3000 for a generic used item with no numeric condition', () => {
    expect(mapper.mapCondition('', 'USED')).toBe('USED_EXCELLENT');
  });

  it('selects a category-supported used condition when the preferred ID is unavailable', () => {
    expect(
      mapper.pickSupportedConditionId(
        'USED_EXCELLENT',
        ['1000', '5000'],
        '3000',
      ),
    ).toBe('5000');
  });
});
