"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.visibleTextContainsPartNumber = visibleTextContainsPartNumber;
exports.resolveVerifiedPhotoIdentity = resolveVerifiedPhotoIdentity;
const normalizeNumber = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
function visibleTextContainsPartNumber(visibleText, partNumber) {
    const expected = normalizeNumber(partNumber);
    if (!expected)
        return false;
    return visibleText.some((text) => {
        const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
        for (let start = 0; start < tokens.length; start++) {
            let joined = '';
            for (let end = start; end < tokens.length; end++) {
                joined += tokens[end];
                if (joined === expected)
                    return true;
                if (joined.length >= expected.length)
                    break;
            }
        }
        return false;
    });
}
function resolveVerifiedPhotoIdentity(identity, visibleText, expectedPartNumber) {
    if (!visibleTextContainsPartNumber(visibleText, expectedPartNumber))
        return null;
    const chosen = normalizeNumber(identity.partNumber ?? '');
    const expected = normalizeNumber(expectedPartNumber);
    if (!chosen || chosen === expected) {
        return { ...identity, partNumber: expectedPartNumber };
    }
    const pattern = new RegExp(`(?<![a-z0-9])${chosen.split('').join('[\\s./-]*')}(?![a-z0-9])`, 'gi');
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
//# sourceMappingURL=part-photo-evidence.util.js.map