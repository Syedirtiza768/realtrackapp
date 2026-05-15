import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ListingActionLog } from '../entities/listing-action-log.entity.js';

@Injectable()
export class ListingActionLogWriterService {
  constructor(
    @InjectRepository(ListingActionLog)
    private readonly repo: Repository<ListingActionLog>,
  ) {}

  async write(entry: Partial<ListingActionLog>): Promise<void> {
    const row = this.repo.create(entry as ListingActionLog);
    await this.repo.save(row);
  }
}
