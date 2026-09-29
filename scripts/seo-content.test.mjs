#!/usr/bin/env node
/**
 * Tests for the deterministic SEO title/description composer.
 * Run: node --test scripts/seo-content.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TITLE_MAX,
  DESCRIPTION_MAX,
  displayPart,
  isRemanProne,
  normalizePosition,
  tidyFitments,
  chassisCodes,
  titlePosition,
  buildSeoTitle,
  buildSeoDescription,
  mergeYearRanges,
} from './seo-content.mjs';

const fit = (make, model, yearStart, yearEnd, generation = '', position = '') => ({ make, model, yearStart, yearEnd, generation, position });

test('reproduces the store house style exactly (Febest control arm for BMW X5 X6 E70 E71)', () => {
  const title = buildSeoTitle(
    { brand: 'Febest', mpn: '1924-E70FUPL', partType: 'Control Arm' },
    [fit('BMW', 'X5', 2007, 2013, 'E70', 'Front Upper Left'), fit('BMW', 'X6', 2008, 2014, 'E71', 'Front Upper Left')],
  );
  assert.equal(title, 'Febest 1924-E70FUPL Control Arm Front Upper Left for BMW X5 X6 E70 E71');
});

test('the make appears once, with all of its models', () => {
  const title = buildSeoTitle(
    { brand: 'Mevotech', mpn: 'TXK5320', partType: 'Ball Joint' },
    [fit('Chevrolet', 'S10', 1984, 2004, '', 'Front Upper'), fit('Chevrolet', 'Blazer', 1984, 1994, '', 'Front Upper'), fit('GMC', 'S15', 1984, 1990, '', 'Front Upper')],
  );
  assert.equal(title, 'Mevotech TXK5320 Ball Joint Front Upper for Chevy S10 Blazer GMC S15');
  assert.equal(title.match(/Chevy/g).length, 1);
});

test('a position that differs between applications is left out of the title', () => {
  // SKF BR930071 is a REAR bearing on Honda/Acura but a FRONT bearing on Chrysler/Dodge.
  const fits = [fit('Acura', 'TL', 1998, 2003, '', 'Rear'), fit('Honda', 'Accord', 1998, 2003, '', 'Rear'), fit('Chrysler', '300', 2005, 2010, 'LX', 'Front'), fit('Dodge', 'Charger', 2006, 2010, 'LX', 'Front')];
  assert.equal(titlePosition(tidyFitments(fits)), '');
  const title = buildSeoTitle({ brand: 'Skf', mpn: 'BR930071', partType: 'Wheel Bearing & Hub Assembly' }, fits);
  assert.ok(title.length <= TITLE_MAX, title);
  assert.doesNotMatch(title, /\b(Rear|Front)\b/);
  assert.match(title, /^SKF BR930071 Wheel Bearing & Hub Assembly for Acura TL/);
});

test('a position missing on some applications is not promoted to the title', () => {
  assert.equal(titlePosition(tidyFitments([fit('Ford', 'F-150', 2015, 2020, '', 'Front'), fit('Ford', 'F-250', 2015, 2020, '', '')])), '');
});

test('position casing is normalized', () => {
  assert.equal(normalizePosition('front upper'), 'Front Upper');
  assert.equal(normalizePosition('Front left'), 'Front Left');
  assert.equal(normalizePosition('rear'), 'Rear');
  assert.equal(normalizePosition('in-tank'), 'In-Tank');
  assert.equal(normalizePosition(''), '');
});

test('only real chassis codes are added to the title, not words like Classic', () => {
  const fits = tidyFitments([fit('Chevrolet', 'Silverado 1500', 2007, 2013, 'GMT900', 'Front Left'), fit('GMC', 'Sierra 1500', 2007, 2007, 'Classic', 'Front Left'), fit('Chrysler', '300', 2005, 2010, 'LX', 'Front Left')]);
  assert.deepEqual(chassisCodes(fits), ['GMT900', 'LX']);
});

test('titles never exceed 80 characters and never end on a dangling "for"', () => {
  const many = Array.from({ length: 28 }, (_, i) => fit(`Make${i}`, `Model Number ${i}`, 2000, 2010, '', 'Front'));
  const cases = [
    [{ brand: 'Mevotech', mpn: 'TXK5320', partType: 'Ball Joint' }, many],
    [{ brand: 'NAPA', mpn: '242-6829', partType: 'An Extraordinarily Long Part Type Description Assembly Kit With Extras' }, [fit('Chevrolet', 'Silverado 1500 Crew Cab Limited', 2007, 2013, 'GMT900')]],
    [{ brand: 'Skf', mpn: 'BR930071', partType: 'Wheel Bearing & Hub Assembly' }, many.slice(0, 3)],
  ];
  for (const [row, fits] of cases) {
    const title = buildSeoTitle(row, fits);
    assert.ok(title.length <= TITLE_MAX, `${title.length}: ${title}`);
    assert.doesNotMatch(title, /\bfor$/i, title);
    assert.match(title, /^(SKF|NAPA|Mevotech) /);
  }
});

test('richer titles are preferred when they fit: more vehicles before dropping detail', () => {
  const title = buildSeoTitle({ brand: 'Delphi', mpn: 'FE0415', partType: 'Fuel Pump' }, [fit('Hyundai', 'Elantra', 2001, 2006, '', 'In-Tank'), fit('Mitsubishi', 'Eclipse', 2000, 2005, '', 'In-Tank')]);
  assert.equal(title, 'Delphi FE0415 Fuel Pump In-Tank for Hyundai Elantra Mitsubishi Eclipse');
});

test('part-type acronyms are upper-cased', () => {
  assert.equal(displayPart('cv axle assembly'), 'CV Axle Assembly');
  assert.equal(displayPart('ABS sensor'), 'ABS Sensor');
});

test('tidyFitments drops invalid records and duplicates', () => {
  const tidy = tidyFitments([
    fit('BMW', 'X5', 2007, 2013), fit('bmw', 'x5', 2007, 2013), { make: '', model: 'X', yearStart: 2000 }, { make: 'Ford', model: 'F-150', yearStart: 'n/a' }, null,
  ]);
  assert.equal(tidy.length, 1);
});

/* ── description ─────────────────────────────────────────────────────────── */

const row = { brand: 'Skf', mpn: 'BR930071', partType: 'Wheel Bearing & Hub Assembly', upc: '85311281669', ean: '', oem: '', series: '' };

test('the description is HTML, escapes text, and lists every application with years', () => {
  const html = buildSeoDescription(row, [fit('Acura', 'TL', 1998, 2003, '', 'Rear'), fit('Honda', 'Accord', 1998, 2003, '', 'Rear')]);
  assert.match(html, /^<p><b>SKF BR930071 Wheel Bearing &amp; Hub Assembly - Rear<\/b> for Acura, Honda vehicles/);
  assert.match(html, /<li><b>Acura<\/b> TL: 1998-2003<\/li>/);
  assert.match(html, /<li><b>Honda<\/b> Accord: 1998-2003<\/li>/);
  assert.match(html, /<li>UPC: 85311281669<\/li>/);
  assert.match(html, /<li>Placement on vehicle: Rear<\/li>/);
  assert.doesNotMatch(html, /<script|<style/i);
  assert.ok(html.length <= DESCRIPTION_MAX);
});

test('per-application positions are shown only when they differ', () => {
  const html = buildSeoDescription(row, [fit('Acura', 'TL', 1998, 2003, '', 'Rear'), fit('Dodge', 'Charger', 2006, 2010, 'LX', 'Front')]);
  assert.match(html, /<li><b>Acura<\/b> TL: 1998-2003 - Rear<\/li>/);
  assert.match(html, /<li><b>Dodge<\/b> Charger: 2006-2010 \(LX\) - Front<\/li>/);
  assert.match(html, /Varies by application/);
});

test('reman-prone part types never claim to be new', () => {
  assert.equal(isRemanProne('Brake Caliper'), true);
  assert.equal(isRemanProne('Wheel Bearing'), false);
  for (const newParts of ['Fuel Pump', 'Water Pump', 'Blower Motor', 'Ball Joint', 'Tie Rod End']) assert.equal(isRemanProne(newParts), false, newParts);
  for (const reman of ['Starter Motor', 'Alternator', 'CV Axle Assembly', 'Steering Rack', 'AC Compressor']) assert.equal(isRemanProne(reman), true, reman);
  const html = buildSeoDescription({ brand: 'Napa', mpn: '242-6829', partType: 'Brake Caliper', upc: '805890653325' }, [fit('Chevrolet', 'Silverado 1500', 2007, 2013, 'GMT900', 'Front Left')]);
  assert.doesNotMatch(html, /\bnew\b/i);
  assert.doesNotMatch(html, /Condition:/);
});

test('parts that are not reman-prone are described as new replacement parts', () => {
  const html = buildSeoDescription(row, [fit('Acura', 'TL', 1998, 2003, '', 'Rear')]);
  assert.match(html, /new replacement part/);
  assert.match(html, /<li>Condition: New<\/li>/);
});

test('only facts we hold appear: no invented specifications, warranty or service promises', () => {
  const html = buildSeoDescription(row, [fit('Acura', 'TL', 1998, 2003, '', 'Rear')]);
  assert.doesNotMatch(html, /warranty|guarantee|OEM quality|premium|lifetime|free shipping|fast shipping|VIN/i);
});

test('user-supplied text is HTML-escaped', () => {
  const html = buildSeoDescription({ ...row, mpn: 'A<B>&C' }, [fit('Acura', 'TL', 1998, 2003, '', 'Rear')]);
  assert.match(html, /A&lt;B&gt;&amp;C/);
  assert.doesNotMatch(html, /A<B>/);
});

test('very long application lists stay under the publish limit with an honest overflow note', () => {
  const many = Array.from({ length: 220 }, (_, i) => fit(`Make${i % 40}`, `Model Name Long ${i}`, 1990 + (i % 20), 2000 + (i % 20), i % 3 ? '' : `GEN${i}`, 'Front'));
  const html = buildSeoDescription(row, many);
  assert.ok(html.length <= DESCRIPTION_MAX, `length ${html.length}`);
  assert.match(html, /Additional applications are listed in the item compatibility table/);
  assert.match(html, /<li>Manufacturer Part Number: BR930071<\/li>/, 'the identifiers survive truncation of the vehicle list');
});

test('interchange numbers and series are listed when present', () => {
  const html = buildSeoDescription({ ...row, brand: 'Mevotech', partType: 'Ball Joint', series: 'TTX', oem: 'CFE0415; E3902M' }, [fit('Chevrolet', 'S10', 1984, 2004, '', 'Front Upper')]);
  assert.match(html, /<li>Series: TTX<\/li>/);
  assert.match(html, /<li>Interchange \/ OE numbers: CFE0415, E3902M<\/li>/);
});

test('year ranges are merged and sorted per generation and position', () => {
  const tidy = tidyFitments([
    fit('Hyundai', 'Elantra', 2012, 2012, '', 'In-Tank'), fit('Hyundai', 'Elantra', 2010, 2011, '', 'In-Tank'),
    fit('Chevrolet', 'S10', 1984, 2004, '', 'Front Upper'), fit('Chevrolet', 'S10', 1984, 1994, '', 'Front Upper'),
  ]);
  assert.deepEqual(mergeYearRanges(tidy.filter((f) => f.model === 'Elantra')).map((f) => [f.yearStart, f.yearEnd]), [[2010, 2012]]);
  assert.deepEqual(mergeYearRanges(tidy.filter((f) => f.model === 'S10')).map((f) => [f.yearStart, f.yearEnd]), [[1984, 2004]]);
});

test('non-adjacent ranges and different generations are kept apart', () => {
  const tidy = tidyFitments([fit('Chevrolet', 'Silverado 1500', 1999, 2006), fit('Chevrolet', 'Silverado 1500', 2007, 2007, 'Classic'), fit('Chevrolet', 'Silverado 1500', 2014, 2018)]);
  const html = buildSeoDescription({ brand: 'Mevotech', mpn: 'TXK6539', partType: 'Ball Joint' }, tidy);
  assert.match(html, /<li><b>Chevrolet<\/b> Silverado 1500: 1999-2006; 2007 \(Classic\); 2014-2018<\/li>/);
});
