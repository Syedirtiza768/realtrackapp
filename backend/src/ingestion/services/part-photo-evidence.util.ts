export interface PhotoPartIdentity {
  partName?: string;
  partNumber?: string;
  note?: string;
}

const normalizeNumber = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Match complete OCR tokens, allowing spaces/hyphens within a printed number. */
export function visibleTextContainsPartNumber(
  visibleText: string[],
  partNumber: string,
): boolean {
  const expected = normalizeNumber(partNumber);
  if (!expected) return false;
  return visibleText.some((text) => {
    const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
    for (let start = 0; start < tokens.length; start++) {
      let joined = '';
      for (let end = start; end < tokens.length; end++) {
        joined += tokens[end];
        if (joined === expected) return true;
        if (joined.length >= expected.length) break;
      }
    }
    return false;
  });
}

/** Multiple numbers can be printed on a part; retain the requested, OCR-verified one. */
export function resolveVerifiedPhotoIdentity(
  identity: PhotoPartIdentity,
  visibleText: string[],
  expectedPartNumber: string,
): PhotoPartIdentity | null {
  if (!visibleTextContainsPartNumber(visibleText, expectedPartNumber))
    return null;
  const chosen = normalizeNumber(identity.partNumber ?? '');
  const expected = normalizeNumber(expectedPartNumber);
  if (!chosen || chosen === expected) {
    return { ...identity, partNumber: expectedPartNumber };
  }

  // A model may pick a different genuine label identifier. Do not carry that
  // choice into the primary title/MPN or present it as confirmed interchange.
  const pattern = new RegExp(
    `(?<![a-z0-9])${chosen.split('').join('[\\s./-]*')}(?![a-z0-9])`,
    'gi',
  );
  const partName = identity.partName
    ?.replace(pattern, '')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    partName,
    partNumber: expectedPartNumber,
    note: `${partName || 'Automotive part'} with visible label reference ${expectedPartNumber}. Compare the label and assembly details with your existing part and verify vehicle fitment before purchase.`,
  };
}
