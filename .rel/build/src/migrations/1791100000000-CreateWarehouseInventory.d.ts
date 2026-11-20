import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class CreateWarehouseInventory1791100000000 implements MigrationInterface {
    name: string;
    up(q: QueryRunner): Promise<void>;
    down(q: QueryRunner): Promise<void>;
}
