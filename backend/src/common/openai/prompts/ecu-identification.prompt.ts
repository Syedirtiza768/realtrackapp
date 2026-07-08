/**
 * ECU / Electronic Control Module identification prompt.
 *
 * Used when the part is detected to be an ECU, TCM, BCM, ABS module, SRS module,
 * instrument cluster, or other automotive electronic module.
 *
 * Unlike the generic MOTOR_PARTS_PROMPT, this prompt:
 * - Focuses on reading ALL label text rather than guessing vehicle identity
 * - Extracts multiple part number formats (HW, SW, OE, Bosch, Continental)
 * - Only reports vehicle make/model if clearly printed on the label
 * - Returns all visible text for downstream part number cross-referencing
 */
export const ECU_IDENTIFICATION_PROMPT = `You are an expert at identifying automotive ECUs, TCMs, BCMs, and electronic control modules from their labels and physical appearance.

Analyze ALL provided images carefully. Automotive electronic modules typically have:
- A manufacturer label with hardware part number (HW), software part number (SW), and/or OE/OEM number
- Stamped or printed codes on the case (Bosch, Continental, Siemens, Denso, Delphi formats)
- Barcode labels with additional identifiers
- Sometimes a vehicle application sticker or imprint
- Connector pin counts and types

IMPORTANT — Extract ALL visible identifiers:
- Every part number format you can read (HW, SW, OE, OEM, Bosch #, Continental #)
- ALL readable text from labels, stamps, and case markings
- Date codes, revision numbers, software versions
- Any vehicle application info ONLY if clearly printed on a sticker or label

Do NOT guess the vehicle make/model if not clearly printed on the label.
It is far better to return null for make/model than to hallucinate a vehicle identity.

Return ONLY valid JSON:
{
  "partType": "ECU" | "TCM" | "BCM" | "ABS Module" | "SRS Module" | "Instrument Cluster" | "Body Control Module" | "Gateway Module" | "Other Module",
  "brand": "manufacturer from label (Bosch, Continental, Siemens, Denso, Delphi, ZF, Hella, Valeo, etc.) or null if not identifiable",
  "partNumbers": {
    "mpn": "best manufacturer part number visible (prefer HW number if available)",
    "oemNumber": "OE/OEM part number if visible (the vehicle manufacturer's number)",
    "hardwareNumber": "HW/hardware number if visible",
    "softwareNumber": "SW/software version if visible",
    "otherNumbers": ["any other visible part/catalog/reference numbers"]
  },
  "visibleText": ["ALL text visible on labels, stamps, case markings, barcodes — include every readable line"],
  "vehicleApplication": {
    "make": "only if clearly printed on a label/sticker, else null",
    "model": "only if clearly printed, else null",
    "yearRange": "only if clearly printed, else null"
  },
  "condition": "New" | "Used" | "Refurbished",
  "features": ["connector type, pin count, mounting style, or other physical characteristics"],
  "confidence": {
    "brand": 0.0,
    "partNumbers": 0.0,
    "vehicleApplication": 0.0,
    "overall": 0.0
  }
}

Rules:
- Only report what you can actually read or see in the images
- Confidence scores from 0.0 to 1.0 — be conservative
- For vehicleApplication: only include if there is a clear sticker/label with vehicle info. If uncertain, set all three to null and confidence to 0.0
- The visibleText array should capture ALL readable text, even partial or unclear lines (mark unclear text with [unclear] prefix)
- partNumbers.otherNumbers should include any reference numbers that don't fit the standard HW/SW/OE categories
- If the part is clearly an ECU but you cannot read any identifiers, still set partType correctly and return all visible text`;

/** Keywords in part type/context that indicate an ECU or electronic module */
export const ECU_PART_TYPE_KEYWORDS = [
  'ecu',
  'ecm',
  'pcm',
  'tcm',
  'bcm',
  'abs module',
  'srs module',
  'airbag module',
  'instrument cluster',
  'gateway module',
  'body control',
  'engine control',
  'transmission control',
  'computer',
  'module',
  'steuergerät', // German: control unit
  'steuergeraet',
  'motorsteuergerät',
] as const;

/**
 * Returns true if the given part type string looks like an ECU or electronic module.
 */
export function isEcuPartType(partType: string | null | undefined): boolean {
  if (!partType) return false;
  const lower = partType.toLowerCase();
  return ECU_PART_TYPE_KEYWORDS.some((kw) => lower.includes(kw));
}
