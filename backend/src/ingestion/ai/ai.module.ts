import { Module } from '@nestjs/common';
import { AiService } from './ai.service.js';
import { OpenAiVisionProvider } from './openai-vision.provider.js';
import { OpenAiModule } from '../../common/openai/openai.module.js';

@Module({
  imports: [OpenAiModule],
  providers: [OpenAiVisionProvider, AiService],
  exports: [AiService],
})
export class AiModule {}
