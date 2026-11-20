import { FitmentService } from './fitment.service.js';
import { VinDecodeService, type VinDecodeResult } from './vin-decode.service.js';
export declare class VinDbExportService {
    private readonly fitmentService;
    private readonly vinDecode;
    private readonly logger;
    constructor(fitmentService: FitmentService, vinDecode: VinDecodeService);
    exportListingsByVin(vin: string): Promise<{
        buffer: Buffer;
        filename: string;
        vehicleInfo: VinDecodeResult;
        listingCount: number;
        matchStrategy: string;
    }>;
    private buildXlsx;
}
