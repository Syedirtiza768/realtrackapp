export declare function verifyWebhook(secret: string | undefined, body: Buffer, timestamp?: string, signature?: string): void;
export declare function payloadHash(value: unknown): string;
export declare function cents(value: string): bigint;
export declare function money(value: bigint): string;
