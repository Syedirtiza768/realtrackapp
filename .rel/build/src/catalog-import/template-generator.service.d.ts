import { CatalogProduct } from './entities/catalog-product.entity.js';
type TemplateFormat = 'us' | 'au' | 'de';
export declare class TemplateGeneratorService {
    private readonly logger;
    generateTemplatesZip(products: CatalogProduct[], formats: TemplateFormat[]): Promise<Buffer>;
    generateSingleTemplate(products: CatalogProduct[], format: TemplateFormat): Buffer;
    private generateWorkbook;
    private buildUSWorkbook;
    private buildUSRow;
    private buildAUWorkbook;
    private buildAURow;
    private buildDEWorkbook;
    private buildDERow;
    private setImages;
    private buildCompatibilityRows;
    private zipBuffers;
}
export {};
