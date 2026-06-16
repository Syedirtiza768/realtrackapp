import { Module } from '@nestjs/common';
import { RuntimeHealthService } from './runtime-health.service.js';

@Module({
  providers: [RuntimeHealthService],
  exports: [RuntimeHealthService],
})
export class ObservabilityModule {}
