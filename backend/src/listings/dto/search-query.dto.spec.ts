import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SearchQueryDto } from './search-query.dto';

async function errorsFor(input: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(SearchQueryDto, input);
  const errors = await validate(dto);
  return errors.map((e) => e.property);
}

describe('SearchQueryDto', () => {
  it('accepts a vertical string and leaves it optional', async () => {
    expect(await errorsFor({ vertical: 'automotive' })).toEqual([]);
    expect(await errorsFor({})).toEqual([]);
  });

  it('still validates sort against its allow-list', async () => {
    expect(await errorsFor({ sort: 'price_asc' })).toEqual([]);
    expect(await errorsFor({ sort: 'not_a_sort' })).toEqual(['sort']);
  });
});
