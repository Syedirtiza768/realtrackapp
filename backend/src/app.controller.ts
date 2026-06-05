import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/decorators/public.decorator.js';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getHealth() {
    return this.appService.getHealth();
  }
}
