"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const typeorm_1 = require("typeorm");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const MULTI_WORD_MAKES = [
    'Land Rover',
    'Mercedes-Benz',
    'Mercedes Benz',
    'Alfa Romeo',
    'Aston Martin',
    'Rolls Royce',
    'Rolls-Royce',
];
const MAKE_ALIASES = {
    MERCEDES: 'Mercedes-Benz',
    'MERCEDES-BENZ': 'Mercedes-Benz',
    'MERCEDES BENZ': 'Mercedes-Benz',
    MERC: 'Mercedes-Benz',
    BENZ: 'Mercedes-Benz',
    VW: 'Volkswagen',
    VOLKSWAGON: 'Volkswagen',
    'LAND ROVER': 'Land Rover',
    LANDROVER: 'Land Rover',
    'ROLLS ROYCE': 'Rolls-Royce',
    'ROLLS-ROYCE': 'Rolls-Royce',
    'ALFA ROMEO': 'Alfa Romeo',
    'ASTON MARTIN': 'Aston Martin',
    MINI: 'MINI',
    BMW: 'BMW',
    CADILLAC: 'Cadillac',
};
const SKIP_WORDS = new Set([
    'FRONT',
    'REAR',
    'LEFT',
    'RIGHT',
    'UPPER',
    'LOWER',
    'INNER',
    'OUTER',
    'CENTER',
    'INTERIOR',
    'EXTERIOR',
    'BODY',
    'RADIO',
    'STEREO',
    'AUDIO',
    'HEADLIGHT',
    'TAILLIGHT',
    'DOOR',
    'WINDOW',
    'SEAT',
    'ENGINE',
    'TURBO',
    'ABS',
    'A/C',
    'AC',
    'AIR',
    'BRAKE',
    'POWER',
    'ELECTRIC',
    'ELECTRONIC',
    'CENTRAL',
    'CONTROL',
    'MODULE',
    'CONTINENTAL',
    'SIEMENS',
]);
const CHASSIS_RE = /^[A-Z]{0,2}\d{2,4}[A-Z]?$/i;
function isChassis(w) {
    if (w.length < 2 || w.length > 6)
        return false;
    return CHASSIS_RE.test(w);
}
const KNOWN_MAKES = new Set([
    'Acura',
    'Alfa Romeo',
    'Aston Martin',
    'Audi',
    'BMW',
    'Bentley',
    'Buick',
    'Cadillac',
    'Chevrolet',
    'Chrysler',
    'Citroen',
    'DS',
    'Dodge',
    'Ferrari',
    'Fiat',
    'Ford',
    'GMC',
    'Genesis',
    'Honda',
    'Hyundai',
    'Infiniti',
    'Jaguar',
    'Jeep',
    'Jetour',
    'Kia',
    'Lamborghini',
    'Land Rover',
    'Lexus',
    'Lincoln',
    'MINI',
    'Maserati',
    'Maybach',
    'Mazda',
    'Mercedes-Benz',
    'Mitsubishi',
    'Nissan',
    'Opel',
    'Peugeot',
    'Pontiac',
    'Porsche',
    'Ram',
    'Renault',
    'Rolls-Royce',
    'Saab',
    'Skoda',
    'Soueast',
    'Subaru',
    'Suzuki',
    'Tesla',
    'Toyota',
    'Volkswagen',
    'Volvo',
]);
const KNOWN_MAKES_UPPER = new Map();
for (const m of KNOWN_MAKES)
    KNOWN_MAKES_UPPER.set(m.toUpperCase(), m);
const YEAR_RANGE_RE = /^#?\s*(\d{2,4})\s*(?:[-–]\s*(\d{2,4}|present|current))?\+?\s+/i;
function normaliseYear(y) {
    const n = parseInt(y, 10);
    if (n < 100) {
        return n >= 50 ? 1900 + n : 2000 + n;
    }
    return n;
}
function titleCase(s) {
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
function normaliseMake(raw) {
    const up = raw.toUpperCase();
    if (MAKE_ALIASES[up])
        return MAKE_ALIASES[up];
    if (KNOWN_MAKES_UPPER.has(up))
        return KNOWN_MAKES_UPPER.get(up);
    if (raw === raw.toUpperCase() && raw.length > 3)
        return titleCase(raw);
    return raw;
}
function isKnownMake(candidate) {
    const up = candidate.toUpperCase();
    return KNOWN_MAKES_UPPER.has(up) || !!MAKE_ALIASES[up];
}
function parseTitleFitment(title) {
    if (!title)
        return null;
    let rest = title.trim();
    let yearStart = null;
    let yearEnd = null;
    let matched = true;
    while (matched) {
        matched = false;
        const ym = rest.match(YEAR_RANGE_RE);
        if (ym) {
            yearStart = normaliseYear(ym[1]);
            const y2 = ym[2];
            if (y2 && !/present|current/i.test(y2)) {
                yearEnd = normaliseYear(y2);
            }
            else {
                yearEnd = yearStart;
            }
            rest = rest.slice(ym[0].length).trim();
            matched = true;
        }
        if (rest.startsWith('#')) {
            rest = rest.replace(/^#\s*/, '');
            matched = true;
        }
    }
    let make = null;
    for (const mw of MULTI_WORD_MAKES) {
        if (rest.toUpperCase().startsWith(mw.toUpperCase())) {
            make = normaliseMake(mw);
            rest = rest.slice(mw.length).trim();
            break;
        }
    }
    if (!make) {
        const parts = rest.split(/\s+/);
        if (parts.length < 2)
            return null;
        const rawMake = parts[0];
        if (SKIP_WORDS.has(rawMake.toUpperCase()))
            return null;
        if (!isKnownMake(rawMake))
            return null;
        make = normaliseMake(rawMake);
        rest = parts.slice(1).join(' ');
    }
    const words = rest.split(/\s+/);
    let model = null;
    let modelWords = [];
    for (let i = 0; i < words.length && i < 4; i++) {
        const w = words[i];
        if (!w)
            continue;
        if (isChassis(w) && !model)
            continue;
        if (SKIP_WORDS.has(w.toUpperCase()))
            break;
        if (!model) {
            model = w;
            modelWords.push(w);
            const nextW = words[i + 1];
            if (nextW && !SKIP_WORDS.has(nextW.toUpperCase()) && !isChassis(nextW)) {
                const combined = w + ' ' + nextW;
                const knownCompounds = [
                    'Range Rover',
                    'Flying Spur',
                    'Grand Cherokee',
                    'X-Trail',
                    'X Trail',
                ];
                const combinedUp = combined.toUpperCase();
                for (const kc of knownCompounds) {
                    if (combinedUp === kc.toUpperCase()) {
                        model = combined;
                        modelWords = [w, nextW];
                        const thirdW = words[i + 2];
                        if (thirdW &&
                            combined.toUpperCase() === 'RANGE ROVER' &&
                            thirdW.toUpperCase() === 'SPORT') {
                            model = combined + ' ' + thirdW;
                            modelWords.push(thirdW);
                        }
                        break;
                    }
                }
            }
            break;
        }
    }
    if (!model) {
        if (words[0] && isChassis(words[0])) {
            model = words[0];
        }
        else {
            return null;
        }
    }
    model = model.replace(/[,;:]+$/, '').trim();
    if (!model || model.length < 1)
        return null;
    return { make, model, yearStart, yearEnd };
}
function slugify(s) {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}
async function main() {
    const ds = new typeorm_1.DataSource({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || '5432'),
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'listingpro',
        synchronize: false,
    });
    await ds.initialize();
    console.log('Connected to database');
    const listings = await ds.query('SELECT id, title, description FROM listing_records');
    console.log(`Loaded ${listings.length} listings`);
    const parsedRows = [];
    const canonicalModel = new Map();
    let parsed = 0;
    let skipped = 0;
    for (const listing of listings) {
        const fitment = parseTitleFitment(listing.title);
        if (!fitment || !fitment.make || !fitment.model) {
            skipped++;
            continue;
        }
        parsed++;
        const modelSlug = slugify(fitment.model);
        const canonKey = fitment.make + '|||' + modelSlug;
        if (!canonicalModel.has(canonKey)) {
            canonicalModel.set(canonKey, fitment.model);
        }
        parsedRows.push({
            listingId: listing.id,
            make: fitment.make,
            model: canonicalModel.get(canonKey),
            yearStart: fitment.yearStart ?? 0,
            yearEnd: fitment.yearEnd ?? 0,
        });
    }
    console.log(`Parsed: ${parsed}, Skipped: ${skipped}`);
    const uniqueMakes = [...new Set(parsedRows.map((r) => r.make))].sort();
    console.log(`Unique makes (${uniqueMakes.length}):`, uniqueMakes.join(', '));
    const uniqueModels = [
        ...new Set(parsedRows.map((r) => r.make + '|||' + r.model)),
    ].sort();
    console.log(`Unique models: ${uniqueModels.length}`);
    const makeIdMap = new Map();
    const modelIdMap = new Map();
    console.log('Clearing existing fitment data...');
    await ds.query('DELETE FROM part_fitments');
    await ds.query('DELETE FROM fitment_models');
    await ds.query('DELETE FROM fitment_makes');
    makeIdMap.clear();
    for (const makeName of uniqueMakes) {
        const slug = slugify(makeName);
        const ins = await ds.query('INSERT INTO fitment_makes (name, slug) VALUES ($1, $2) RETURNING id', [makeName, slug]);
        makeIdMap.set(makeName, ins[0].id);
    }
    console.log(`Inserted ${makeIdMap.size} makes`);
    modelIdMap.clear();
    for (const key of uniqueModels) {
        const [makeName, modelName] = key.split('|||');
        const makeId = makeIdMap.get(makeName);
        const slug = slugify(modelName);
        const ins = await ds.query('INSERT INTO fitment_models (make_id, name, slug) VALUES ($1, $2, $3) RETURNING id', [makeId, modelName, slug]);
        modelIdMap.set(key, ins[0].id);
    }
    console.log(`Inserted ${modelIdMap.size} models`);
    console.log(`Inserting ${parsedRows.length} part_fitments...`);
    const BATCH_SIZE = 500;
    for (let i = 0; i < parsedRows.length; i += BATCH_SIZE) {
        const batch = parsedRows.slice(i, i + BATCH_SIZE);
        const values = [];
        const params = [];
        let pIdx = 1;
        for (const row of batch) {
            const makeId = makeIdMap.get(row.make);
            const modelId = modelIdMap.get(row.make + '|||' + row.model);
            values.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++})`);
            params.push(row.listingId, makeId, modelId, row.yearStart, row.yearEnd, 'ai_detected', 0.85);
        }
        try {
            await ds.query(`INSERT INTO part_fitments (listing_id, make_id, model_id, year_start, year_end, source, confidence)
         VALUES ${values.join(', ')}`, params);
        }
        catch (err) {
            console.error(`Batch error at offset ${i}:`, err.message);
        }
        if ((i / BATCH_SIZE) % 10 === 0) {
            process.stdout.write(`  ${i + batch.length}/${parsedRows.length}\r`);
        }
    }
    console.log(`\nDone! Inserted fitment rows.`);
    const counts = await Promise.all([
        ds.query('SELECT COUNT(*) as c FROM fitment_makes'),
        ds.query('SELECT COUNT(*) as c FROM fitment_models'),
        ds.query('SELECT COUNT(*) as c FROM part_fitments'),
    ]);
    console.log(`Final counts:`);
    console.log(`  fitment_makes:  ${counts[0][0].c}`);
    console.log(`  fitment_models: ${counts[1][0].c}`);
    console.log(`  part_fitments:  ${counts[2][0].c}`);
    const topMakes = await ds.query(`SELECT fm.name, COUNT(DISTINCT pf.listing_id) as cnt
     FROM part_fitments pf
     JOIN fitment_makes fm ON fm.id = pf.make_id
     GROUP BY fm.name ORDER BY cnt DESC LIMIT 10`);
    console.log('\nTop 10 makes:');
    topMakes.forEach((r) => console.log(`  ${r.name}: ${r.cnt} listings`));
    await ds.destroy();
}
main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=extract-fitment.js.map