export declare class FeatureFlag {
    id: string;
    key: string;
    enabled: boolean;
    description: string | null;
    metadata: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}
