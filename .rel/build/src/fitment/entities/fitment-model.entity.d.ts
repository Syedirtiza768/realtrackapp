import { FitmentMake } from './fitment-make.entity.js';
export declare class FitmentModel {
    id: number;
    makeId: number;
    make?: FitmentMake;
    name: string;
    slug: string;
    acesId: number | null;
    createdAt: Date;
}
