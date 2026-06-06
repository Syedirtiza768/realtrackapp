import {
  inferMarketplaceFromAccountName,
  SellerpunditMarketplaceRegistry,
} from './sellerpundit-marketplace.registry.js';

describe('SellerpunditMarketplaceRegistry', () => {
  const registry = new SellerpunditMarketplaceRegistry();

  it('infers EBAY_DE from SVG-DE account names', () => {
    expect(
      inferMarketplaceFromAccountName('(SVG-DE) German Salvage Dismantlers'),
    ).toBe('EBAY_DE');
    expect(inferMarketplaceFromAccountName('Blackline Autos De')).toBe('EBAY_DE');
  });

  it('infers EBAY_GB and EBAY_AU from SVG account names', () => {
    expect(
      inferMarketplaceFromAccountName('(SVG-UK) Brit Salvage Depot'),
    ).toBe('EBAY_GB');
    expect(
      inferMarketplaceFromAccountName('(SVG-AU) Southern Cross Autoparts'),
    ).toBe('EBAY_AU');
  });

  it('does not infer marketplace for generic US account names', () => {
    expect(inferMarketplaceFromAccountName('All About Mercedes')).toBeNull();
    expect(inferMarketplaceFromAccountName('Salvage Auto Parts')).toBeNull();
  });

  it('resolveMarketplaceForAccount falls back when name is ambiguous', () => {
    expect(
      registry.resolveMarketplaceForAccount(
        'All About Mercedes',
        'EBAY_MOTORS_US',
      ),
    ).toBe('EBAY_MOTORS_US');
    expect(
      registry.resolveMarketplaceForAccount(
        '(SVG-DE) German Salvage Dismantlers',
        'EBAY_MOTORS_US',
      ),
    ).toBe('EBAY_DE');
  });
});
