export type TemplateType = 'description' | 'title' | 'full';
export declare class ListingTemplate {
    id: string;
    name: string;
    description: string | null;
    channel: string | null;
    category: string | null;
    templateType: TemplateType;
    content: string;
    css: string | null;
    previewImage: string | null;
    variables: Record<string, unknown>[];
    isDefault: boolean;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
}
