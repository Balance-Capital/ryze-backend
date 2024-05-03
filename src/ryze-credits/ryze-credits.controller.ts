import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RyzeCreditsService } from './ryze-credits.service';
import { SignatureRequest, SignatureResponse } from './dto';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

@ApiTags('Ryze Credits Management')
@Controller('ryze-credits')
export class RyzeCreditsController {
  constructor(private readonly RyzeCreditsService: RyzeCreditsService) {}

  // @UseGuards(ThrottlerGuard)
  @Get('/signature')
  @ApiOkResponse({ type: () => String })
  async users(@Query() query: SignatureRequest): Promise<SignatureResponse> {
    return await this.RyzeCreditsService.getSignature(query.address);
  }
}
