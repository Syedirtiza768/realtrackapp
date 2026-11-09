import {
  checkListingText,
  decide,
  findPhrase,
  mergeComplianceConfig,
  riskScore,
  type ComplianceListing,
} from './fashion-compliance.rules.js';

const base: ComplianceListing = {
  title: "Lacoste Men's Polo Shirt Navy Size 4",
  description: 'Classic pique polo in good used condition.',
  brand: 'Lacoste',
  brandSpecific: 'Lacoste',
  price: 35,
  categoryId: '185100',
  categoryName: 'Casual Button-Down Shirts',
};

const run = (patch: Partial<ComplianceListing>) =>
  checkListingText({ ...base, ...patch });
const codes = (patch: Partial<ComplianceListing>) =>
  run(patch).issues.map((i) => i.code);

describe('fashion compliance text rules', () => {
  it('passes a clean, consistent listing', () => {
    const r = run({});
    expect(decide(r.issues)).toBe('PASS');
    expect(r.fixes).toEqual([]);
    expect(riskScore(r.issues)).toBeLessThan(10);
  });

  it('blocks replica-type wording in the title', () => {
    const r = run({ title: 'Lacoste Polo Shirt AAA Quality 1:1 Replica' });
    expect(decide(r.issues)).toBe('BLOCKED');
    expect(r.issues.filter((i) => i.code === 'COUNTERFEIT_TERM').length).toBeGreaterThanOrEqual(2);
    expect(riskScore(r.issues)).toBeGreaterThanOrEqual(90);
  });

  it('does not treat fake fur or faux leather as counterfeit wording', () => {
    const r = run({ title: 'Lacoste Jacket Fake Fur Collar Faux Leather Trim' });
    expect(codes({ title: r.fixed.title })).not.toContain('COUNTERFEIT_TERM');
  });

  it('sends a negated disclaimer in the description to review, not block', () => {
    const r = run({ description: 'This is 100% genuine, not a replica.' });
    expect(r.issues.map((i) => i.code)).toContain('COUNTERFEIT_TERM_NEGATED');
    expect(decide(r.issues)).toBe('NEEDS_REVIEW');
  });

  it('sends brand comparisons to review instead of auto-fixing them', () => {
    const r = run({
      title: 'Chanel Inspired Tweed Jacket',
      brand: 'Unbranded',
      brandSpecific: 'Unbranded',
    });
    expect(r.issues.map((i) => i.code)).toContain('BRAND_COMPARISON');
    expect(decide(r.issues)).toBe('NEEDS_REVIEW');
    expect(r.fixed.title).toBe('Chanel Inspired Tweed Jacket');
  });

  it('removes extra brand names when the real brand is in the title', () => {
    const r = run({
      title: 'Lacoste Polo Shirt Ralph Lauren Tommy Hilfiger Navy',
    });
    expect(r.fixed.title).toBe('Lacoste Polo Shirt Navy');
    expect(decide(r.issues)).toBe('AUTO_FIXED');
  });

  it('flags a title brand that disagrees with the Brand specific', () => {
    const r = run({ title: 'Nike Polo Shirt Navy Size M' });
    expect(r.issues.map((i) => i.code)).toContain('BRAND_TITLE_MISMATCH');
    expect(decide(r.issues)).toBe('NEEDS_REVIEW');
  });

  it('flags brand field and Brand specific that disagree', () => {
    expect(codes({ brand: 'Nike' })).toContain('BRAND_FIELD_MISMATCH');
  });

  it('treats brand aliases as the same brand', () => {
    const r = run({
      title: 'BOSS Hugo Boss Mens Polo Sweater Teal Size L',
      brand: 'BOSS',
      brandSpecific: 'Hugo Boss',
    });
    expect(r.issues.map((i) => i.code)).not.toContain('BRAND_FIELD_MISMATCH');
    expect(r.issues.map((i) => i.code)).not.toContain('BRAND_TITLE_MISMATCH');
  });

  it('fills a missing Brand specific when the title starts with a known brand', () => {
    const r = run({ brand: null, brandSpecific: null });
    expect(r.fixed.brandSpecific).toBe('Lacoste');
    expect(r.fixes.some((f) => f.field === 'brand')).toBe(true);
    expect(decide(r.issues)).toBe('AUTO_FIXED');
  });

  it('sends a listing with no detectable brand to review', () => {
    const r = run({ title: 'Mens Polo Shirt Navy', brand: null, brandSpecific: null });
    expect(r.issues.map((i) => i.code)).toContain('BRAND_MISSING');
    expect(decide(r.issues)).toBe('NEEDS_REVIEW');
  });

  it('blocks a protected brand priced below its floor', () => {
    const r = run({
      title: 'Gucci GG Marmont Belt Black',
      brand: 'Gucci',
      brandSpecific: 'Gucci',
      price: 19.99,
    });
    expect(r.issues.map((i) => i.code)).toContain('PRICE_BELOW_BRAND_FLOOR');
    expect(decide(r.issues)).toBe('BLOCKED');
  });

  it('does not apply a price floor to a brand that is only mentioned', () => {
    const r = run({ title: 'Lacoste Coach Jacket Navy', price: 20 });
    expect(r.issues.map((i) => i.code)).not.toContain('PRICE_BELOW_BRAND_FLOOR');
  });

  it('removes filler words and emoji automatically', () => {
    const r = run({ title: "L@@K!! Lacoste Men's Polo Shirt 🔥 Navy WOW" });
    expect(r.fixed.title).toBe("Lacoste Men's Polo Shirt Navy");
    expect(decide(r.issues)).toBe('AUTO_FIXED');
  });

  it('flags Authenticity Guarantee categories', () => {
    const r = run({
      title: 'Nike Air Jordan 1 Retro High Sneakers Size 10',
      brand: 'Nike',
      brandSpecific: 'Nike',
      price: 180,
      categoryId: '15709',
      categoryName: "Men's Athletic Shoes",
    });
    expect(r.authenticityGuarantee).toBe('Sneakers');
    expect(decide(r.issues)).toBe('NEEDS_REVIEW');
  });

  it('flags a missing price', () => {
    expect(codes({ price: null })).toContain('PRICE_MISSING');
  });

  it('matches symbol phrases on boundaries', () => {
    expect(findPhrase('Watch 1:1 copy', '1:1')).toBe('1:1');
    expect(findPhrase('Size 11:15', '1:1')).toBeNull();
    expect(findPhrase('Repeat order', 'reps')).toBeNull();
  });

  it('lets an org override replace a rule list', () => {
    const cfg = mergeComplianceConfig({ blockTerms: ['bootleg'] });
    expect(cfg.blockTerms).toEqual(['bootleg']);
    expect(cfg.reviewPhrases.length).toBeGreaterThan(0);
    const r = checkListingText({ ...base, title: 'Lacoste Replica Polo' }, cfg);
    expect(r.issues.map((i) => i.code)).not.toContain('COUNTERFEIT_TERM');
  });
});
