import type { PromptTemplate } from '../openai.types.js';

/**
 * Brand-aware VIN parts compatibility prompt.
 *
 * Unlike the generic motors-enrichment prompt, this prompt:
 * 1. Injects brand-specific knowledge (VIN patterns, engine codes, part number formats)
 * 2. Includes platform sharing context
 * 3. Structures output by 18 standard categories
 * 4. Requires [VERIFY] markers on uncertain part numbers
 * 5. Includes recall data
 */
export const VIN_PARTS_COMPATIBILITY_PROMPT: PromptTemplate = {
  name: 'vin-parts-compatibility',
  systemPrompt: `You are an expert {{brand}} OEM parts specialist and eBay Motors listing analyst.

VEHICLE CONTEXT:
Year: {{year}}
Make: {{make}}
Model: {{model}}
Trim: {{trim}}
Engine: {{engine}} ({{engineCode}})
Transmission: {{transmission}}
Drivetrain: {{drivetrain}}
Platform: {{platform}}

BRAND-SPECIFIC KNOWLEDGE:
{{brandContext}}

PLATFORM SHARING:
{{platformSharing}}

TASK: Generate a comprehensive parts compatibility catalog for this vehicle.

RULES:
1. Use ONLY {{brand}} OEM part number format: {{partNumberFormat}}
2. Include at least 3 parts per major category (engine, transmission, brakes, suspension, body, lighting)
3. Include at least 2 parts per minor category (steering, electrical, cooling, fuel, exhaust, HVAC, interior, exterior trim, wheels, sensors, safety, maintenance)
4. Mark ANY part number you are not 100% certain about with [VERIFY] suffix
5. Include position/location for all parts (e.g., "Front Left", "Rear Right", "Upper", "Lower")
6. Include platform-shared parts where applicable (only for categories that share across platform)
7. Include known NHTSA recalls for this vehicle
8. Identify high-demand eBay Motors parts
9. Return ONLY valid JSON — NO trailing commas, NO markdown fences

CATEGORY STRUCTURE:
- engine_components: oil filters, spark plugs, air filters, belts, gaskets, timing, etc.
- transmission_components: fluid, filter, solenoids, etc.
- suspension_parts: struts, shocks, control arms, sway bar links, etc.
- brake_system: pads, rotors, calipers, lines, master cylinder, ABS
- steering_parts: tie rods, steering rack, power steering pump
- electrical_components: alternator, starter, battery, wiring
- cooling_system: radiator, thermostat, water pump, hoses, fan
- fuel_system: fuel pump, injectors, filter, rail
- exhaust_system: catalytic converter, muffler, manifold, O2 sensors
- hvac_parts: AC compressor, condenser, evaporator, heater core
- body_panels: hood, fenders, doors, trunk/hatch
- bumpers: front/rear bumper covers, reinforcement
- interior_parts: seats, dashboard, console, door panels
- exterior_trim: emblems, handles, mirror covers, grille
- lighting: headlights, tail lights, fog lights, bulbs
- wheels_tires: wheels, TPMS, lug nuts, wheel bearings
- sensors_modules: ABS sensors, O2 sensors, ECU, BCM, radar
- safety_components: airbags, seatbelts, pretensioners
- maintenance_parts: fluids, filters, wiper blades, bulbs`,

  userPrompt: `Generate the complete parts catalog for this vehicle:
{{year}} {{make}} {{model}} {{trim}}
Engine: {{engine}} ({{engineCode}})
Transmission: {{transmission}}
Drivetrain: {{drivetrain}}

Return JSON:
{
  "vehicle": {
    "year": "", "make": "", "model": "", "trim": "",
    "engine": "", "engineCode": "", "transmission": "",
    "drivetrain": "", "bodyStyle": "", "platform": ""
  },
  "recalls": [
    { "campaignNumber": "", "component": "", "summary": "", "severity": "low|medium|high" }
  ],
  "parts": {
    "category_id": [
      {
        "partName": "",
        "oemPartNumber": "",
        "position": "",
        "fitmentNotes": "",
        "aftermarketEquivalents": [""],
        "interchangeNumbers": [""],
        "commonFailure": false,
        "highDemandResale": false,
        "platformShared": false,
        "trimSpecific": "",
        "engineSpecific": "",
        "confidence": 0.0-1.0
      }
    ]
  },
  "platformSharedParts": {
    "sharedVehicles": [""],
    "shareableCategories": [""],
    "notes": ""
  },
  "ebayListingAnalysis": {
    "highValueParts": [""],
    "highDemandParts": [""],
    "recommendedListingTitle": "",
    "itemSpecifics": {}
  }
}`,

  jsonMode: true,
  temperature: 0.1,
  maxTokens: 8000,
};

/**
 * Compact version for low-value parts or quick lookups.
 * Returns fewer parts per category, omits interchange data.
 */
export const VIN_PARTS_COMPATIBILITY_COMPACT_PROMPT: PromptTemplate = {
  name: 'vin-parts-compatibility-compact',
  systemPrompt: `You are an automotive parts specialist. Given this vehicle, list the most important parts per category.

Vehicle: {{year}} {{make}} {{model}} {{trim}}
Engine: {{engine}} ({{engineCode}})
Platform: {{platform}}

BRAND KNOWLEDGE:
{{brandContext}}

Rules:
- 1-2 parts per category maximum
- Only include high-demand and maintenance parts
- Use {{brand}} OEM part number format
- Mark uncertain numbers with [VERIFY]
- Return ONLY valid JSON`,

  userPrompt: `List key parts for {{year}} {{make}} {{model}}.

Return JSON with parts object containing category arrays. Each part: { "partName", "oemPartNumber", "position", "highDemandResale" }`,

  jsonMode: true,
  temperature: 0.1,
  maxTokens: 3000,
};
