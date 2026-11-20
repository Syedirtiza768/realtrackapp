import type { ProductAttributes } from './vertical.types.js';
export declare const BUSINESS_INDUSTRIAL_VERTICAL: "business_industrial";
export declare const BUSINESS_INDUSTRIAL_CATEGORY_FAMILIES: readonly [{
    readonly id: "industrial_automation";
    readonly label: "Industrial automation & controls";
    readonly restricted: false;
}, {
    readonly id: "electrical_equipment";
    readonly label: "Electrical equipment & protection";
    readonly restricted: false;
}, {
    readonly id: "machinery_tooling";
    readonly label: "Manufacturing machinery, tooling & spare parts";
    readonly restricted: false;
}, {
    readonly id: "hydraulics_pneumatics";
    readonly label: "Hydraulics, pneumatics, pumps & valves";
    readonly restricted: false;
}, {
    readonly id: "test_measurement";
    readonly label: "Test, measurement & inspection equipment";
    readonly restricted: false;
}, {
    readonly id: "material_handling";
    readonly label: "Material handling & industrial storage";
    readonly restricted: false;
}, {
    readonly id: "commercial_equipment";
    readonly label: "Commercial kitchen, office & retail equipment";
    readonly restricted: false;
}, {
    readonly id: "construction_safety";
    readonly label: "Construction, industrial supplies & safety";
    readonly restricted: false;
}, {
    readonly id: "medical_laboratory";
    readonly label: "Medical and laboratory equipment";
    readonly restricted: true;
}, {
    readonly id: "hazmat_chemical";
    readonly label: "Hazardous materials and chemicals";
    readonly restricted: true;
}];
export type BusinessIndustrialCategoryFamily = (typeof BUSINESS_INDUSTRIAL_CATEGORY_FAMILIES)[number]['id'];
export declare function isRestrictedBusinessIndustrialFamily(value: unknown): boolean;
export declare function validateBusinessIndustrialAttributes(value: unknown): {
    attributes: ProductAttributes;
    errors: string[];
    warnings: string[];
};
export declare function businessIndustrialImportAttributeKeys(): string[];
