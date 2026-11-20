export declare class EbayCategory {
    id: string;
    ebayCategoryId: string;
    treeId: string;
    parentCategoryId: string | null;
    categoryName: string;
    categoryPath: string | null;
    depth: number;
    isLeaf: boolean;
    requiredAspects: Record<string, unknown>[];
    recommendedAspects: Record<string, unknown>[];
    supportsCompatibility: boolean;
    treeVersion: string | null;
    createdAt: Date;
    updatedAt: Date;
}
