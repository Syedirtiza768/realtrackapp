import { Module } from '@nestjs/common';
import { AiService } from './ai.service.js';
import { OpenAiVisionProvider } from './openai-vision.provider.js';

@Module({
  providers: [OpenAiVisionProvider, AiService],
  exports: [AiService],
})
export class AiModule {}
