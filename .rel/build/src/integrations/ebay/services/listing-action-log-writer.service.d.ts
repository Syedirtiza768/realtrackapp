import { Repository } from 'typeorm';
import { ListingActionLog } from '../entities/listing-action-log.entity.js';
export declare class ListingActionLogWriterService {
    private readonly repo;
    constructor(repo: Repository<ListingActionLog>);
    write(entry: Partial<ListingActionLog>): Promise<void>;
}
