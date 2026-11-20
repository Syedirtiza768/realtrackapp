import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class ListingSkuUniqueIndex1782000000000 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
