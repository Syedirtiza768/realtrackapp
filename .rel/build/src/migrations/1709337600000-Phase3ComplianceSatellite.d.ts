import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class Phase3ComplianceSatellite1709337600000 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
