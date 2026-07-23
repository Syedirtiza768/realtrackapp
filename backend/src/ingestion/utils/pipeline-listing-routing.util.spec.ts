import {
  buildActiveIdBySku,
  routePipelineListingRecords,
} from './pipeline-listing-routing.util';

describe('pipeline-listing-routing.util (simple delete + re-import)', () => {
  it('updates active SKUs in place', () => {
    const activeIdBySku = buildActiveIdBySku([
      { id: 'active-1', customLabelSku: 'BMW-520I-BLACK-FD18' },
    ]);
    const result = routePipelineListingRecords(
      [{ customLabelSku: 'BMW-520I-BLACK-FD18', title: 'refresh' }],
      activeIdBySku,
    );
    expect(result.rowsToUpdate).toEqual([
      {
        id: 'active-1',
        lr: { customLabelSku: 'BMW-520I-BLACK-FD18', title: 'refresh' },
      },
    ]);
    expect(result.rowsToInsert).toEqual([]);
  });

  it('inserts a NEW listing when SKU is only soft-deleted (does not recover)', () => {
    // Soft-deleted rows are excluded from activeIdBySku by the SQL filter
    // (`deletedAt IS NULL`). Soft-deleted BMW-520I-BLACK-RD77 is therefore
    // absent here — same as production after a user delete.
    const activeIdBySku = new Map<string, string>();
    const result = routePipelineListingRecords(
      [
        {
          customLabelSku: 'BMW-520I-BLACK-RD77',
          title: '2014-2016 BMW 520i Right Roller Sunblind',
        },
      ],
      activeIdBySku,
    );

    expect(result.rowsToUpdate).toEqual([]);
    expect(result.rowsToInsert).toHaveLength(1);
    expect(result.rowsToInsert[0].customLabelSku).toBe('BMW-520I-BLACK-RD77');
    // Contract: pipeline never recovers; it only inserts. Soft-deleted row
    // remains soft-deleted in DB (unchanged by this routing).
  });

  it('inserts brand-new SKUs and drops intra-file duplicates', () => {
    const result = routePipelineListingRecords(
      [
        { customLabelSku: 'NEW-SKU-1' },
        { customLabelSku: 'NEW-SKU-1' },
        { customLabelSku: 'NEW-SKU-2' },
      ],
      new Map(),
    );
    expect(result.rowsToInsert.map((r) => r.customLabelSku)).toEqual([
      'NEW-SKU-1',
      'NEW-SKU-2',
    ]);
    expect(result.droppedDuplicates).toBe(1);
  });
});
