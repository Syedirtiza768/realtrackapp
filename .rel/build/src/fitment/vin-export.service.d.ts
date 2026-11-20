import { VinDecodeService, type VinDecodeResult } from './vin-decode.service.js';
import { OpenAiService } from '../common/openai/openai.service.js';
export declare class VinExportService {
    private readonly vinDecode;
    private readonly openai;
    private readonly logger;
    constructor(vinDecode: VinDecodeService, openai: OpenAiService);
    generatePipelineInput(vin: string): Promise<{
        buffer: Buffer;
        filename: string;
        vehicleInfo: VinDecodeResult;
        partCount: number;
        categoryCount: number;
    }>;
    private getCategoryCode;
}
