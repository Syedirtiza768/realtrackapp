import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class Phase3DeprecateChannelListings1709510400000 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
