import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class WidenImageAssetsBlurhashToText1789600000000 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
