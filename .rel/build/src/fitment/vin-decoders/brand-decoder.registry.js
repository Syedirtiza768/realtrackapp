"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrandVinDecoderRegistry = void 0;
const common_1 = require("@nestjs/common");
const toyota_decoder_js_1 = require("./brands/toyota.decoder.js");
let BrandVinDecoderRegistry = class BrandVinDecoderRegistry {
    decoders = [];
    wmiIndex = new Map();
    constructor() {
        this.register(new toyota_decoder_js_1.ToyotaVinDecoder());
    }
    register(decoder) {
        this.decoders.push(decoder);
        for (const wmi of decoder.wmi) {
            this.wmiIndex.set(wmi.toUpperCase(), decoder);
        }
    }
    getDecoder(vinOrMake) {
        const wmi = vinOrMake.substring(0, 3).toUpperCase();
        const byWmi = this.wmiIndex.get(wmi);
        if (byWmi)
            return byWmi;
        const partialWmi = vinOrMake.substring(0, 2).toUpperCase();
        for (const [key, decoder] of this.wmiIndex) {
            if (key.startsWith(partialWmi))
                return decoder;
        }
        const normalizedMake = vinOrMake.trim().toLowerCase();
        for (const decoder of this.decoders) {
            if (decoder.brand.toLowerCase() === normalizedMake)
                return decoder;
            if (normalizedMake === 'lexus' && decoder.brand === 'Toyota')
                return decoder;
            if (normalizedMake === 'scion' && decoder.brand === 'Toyota')
                return decoder;
            if (normalizedMake === 'lincoln' && decoder.brand === 'Ford')
                return decoder;
            if (normalizedMake === 'acura' && decoder.brand === 'Honda')
                return decoder;
            if (normalizedMake === 'infiniti' && decoder.brand === 'Nissan')
                return decoder;
            if (normalizedMake === 'genesis' && decoder.brand === 'Hyundai')
                return decoder;
        }
        return null;
    }
    getRegisteredBrands() {
        return [...new Set(this.decoders.map((d) => d.brand))];
    }
    getAllPlatforms() {
        return this.decoders.flatMap((d) => d.knownPlatforms);
    }
    findPlatformForVehicle(make, model, year) {
        for (const platform of this.getAllPlatforms()) {
            for (const vehicle of platform.vehicles) {
                if (vehicle.make.toLowerCase() === make.toLowerCase() &&
                    vehicle.model.toLowerCase() === model.toLowerCase()) {
                    const [startStr, endStr] = vehicle.years.split('-');
                    const startYear = parseInt(startStr, 10);
                    const endYear = endStr === 'present' ? 2099 : parseInt(endStr, 10);
                    if (year >= startYear && year <= endYear) {
                        return platform;
                    }
                }
            }
        }
        return null;
    }
};
exports.BrandVinDecoderRegistry = BrandVinDecoderRegistry;
exports.BrandVinDecoderRegistry = BrandVinDecoderRegistry = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], BrandVinDecoderRegistry);
//# sourceMappingURL=brand-decoder.registry.js.map