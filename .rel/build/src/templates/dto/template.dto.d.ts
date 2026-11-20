export declare class CreateTemplateDto {
    name: string;
    description?: string;
    channel?: string;
    category?: string;
    templateType?: 'description' | 'title' | 'full';
    content: string;
    css?: string;
    variables?: Record<string, unknown>[];
    isDefault?: boolean;
}
export declare class UpdateTemplateDto {
    name?: string;
    description?: string;
    channel?: string;
    category?: string;
    templateType?: string;
    content?: string;
    css?: string;
    variables?: Record<string, unknown>[];
    isDefault?: boolean;
    active?: boolean;
}
export declare class TemplateQueryDto {
    channel?: string;
    templateType?: string;
    active?: string;
}
export declare class RenderPreviewDto {
    variables: Record<string, unknown>;
}
