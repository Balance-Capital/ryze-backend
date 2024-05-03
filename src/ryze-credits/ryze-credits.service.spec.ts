import { Test, TestingModule } from '@nestjs/testing';
import { RyzeCreditsService } from './ryze-credits.service';

describe('RyzeCreditsService', () => {
  let service: RyzeCreditsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RyzeCreditsService],
    }).compile();

    service = module.get<RyzeCreditsService>(RyzeCreditsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
