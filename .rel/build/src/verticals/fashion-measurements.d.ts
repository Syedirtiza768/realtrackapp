import type { FashionCategoryFamily } from './fashion.config.js';
export type FashionMeasurementUnit = 'cm' | 'in';
export type FashionMeasurementPoint = {
    letter: string;
    key: string;
    label: string;
    line: [number, number, number, number];
    labelAt: [number, number];
};
export type FashionMeasurementTemplate = {
    id: string;
    label: string;
    chartTitle: string;
    family: FashionCategoryFamily;
    keywords: string[];
    diagram: FashionDiagramId;
    points: FashionMeasurementPoint[];
};
type FashionDiagramId = 'top' | 'longsleeve' | 'dress' | 'pants' | 'shorts' | 'skirt' | 'bag' | 'cap' | 'shoe';
export declare const FASHION_MEASUREMENT_TEMPLATES: FashionMeasurementTemplate[];
export declare const FASHION_MEASUREMENT_UNITS: FashionMeasurementUnit[];
export declare const FASHION_MEASUREMENT_VALUE_KEYS: string[];
export declare function fashionMeasurementTemplate(id: unknown): FashionMeasurementTemplate | undefined;
export declare function fashionMeasurementKeyFamilies(key: string): FashionCategoryFamily[];
export declare function suggestFashionMeasurementTemplate(itemType: string | null | undefined, family?: FashionCategoryFamily): FashionMeasurementTemplate | undefined;
export declare function normalizeFashionMeasurementUnit(value: unknown): FashionMeasurementUnit | null;
export declare function parseFashionMeasurement(value: unknown): number | null;
export type FashionMeasurementRow = {
    letter: string;
    key: string;
    label: string;
    value: string;
};
export declare function fashionMeasurementRows(template: FashionMeasurementTemplate, attributes: Record<string, unknown>): FashionMeasurementRow[];
export declare function escapeSvgText(value: string): string;
export declare function fashionDiagramSvg(template: FashionMeasurementTemplate): string;
export declare function publicFashionMeasurementTemplates(): {
    id: string;
    label: string;
    chartTitle: string;
    family: "accessories" | "clothing" | "footwear";
    keywords: string[];
    points: {
        letter: string;
        key: string;
        label: string;
    }[];
    diagramSvg: string;
}[];
export {};
