import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AppService } from './app.service';

@ApiTags('App')
@Controller('')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('status')
  @Header('Cache-Control', 'max-age=60')
  getHello(): string {
    return this.appService.getHello();
  }
}
