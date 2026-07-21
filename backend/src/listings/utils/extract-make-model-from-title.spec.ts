import { extractMakeModelFromTitle } from './extract-make-model-from-title.js';

describe('extractMakeModelFromTitle', () => {
  it('skips junk "s" token and reads C350 from Mercedes titles', () => {
    expect(
      extractMakeModelFromTitle(
        '2008 Mercedes-Benz s C350 AMG Front Left Headlight Asm A2046200991 OEM Used',
      ),
    ).toEqual({ make: 'Mercedes-Benz', model: 'C350' });
  });

  it('reads C-Class when written as two tokens', () => {
    expect(
      extractMakeModelFromTitle('2008 Mercedes-Benz C Class Brake Pad OEM Used'),
    ).toEqual({ make: 'Mercedes-Benz', model: 'C-Class' });
  });

  it('still extracts normal named models', () => {
    expect(
      extractMakeModelFromTitle('2018 Toyota Camry LE Brake Pad OEM Used'),
    ).toEqual({ make: 'Toyota', model: 'Camry' });
  });

  it('normalizes Chevorlet typo to Chevrolet', () => {
    expect(
      extractMakeModelFromTitle('2010 Chevorlet Camaro SS Hood OEM Used'),
    ).toEqual({ make: 'Chevrolet', model: 'Camaro' });
  });

  it('does not treat a bare single letter as the model when a stronger token follows', () => {
    expect(
      extractMakeModelFromTitle('2008 Mercedes-Benz x C300 Sedan Sensor OEM Used'),
    ).toEqual({ make: 'Mercedes-Benz', model: 'C300' });
  });
});
