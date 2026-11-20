import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class CreateImageDriveAssets1789400000000 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
