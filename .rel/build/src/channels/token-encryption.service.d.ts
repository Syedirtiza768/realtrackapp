import { ConfigService } from '@nestjs/config';
export declare class TokenEncryptionService {
    private readonly config;
    private readonly logger;
    private readonly key;
    constructor(config: ConfigService);
    encrypt(plaintext: string): string;
    decrypt(ciphertext: string): string;
}
