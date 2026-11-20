import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class RedesignImageDriveFolders1789900000000 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
