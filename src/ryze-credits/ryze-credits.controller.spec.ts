import { Test, TestingModule } from '@nestjs/testing';
import { RyzeCreditsController } from './ryze-credits.controller';
import { RyzeCreditsService } from './ryze-credits.service';

describe('RyzeCreditsController', () => {
  let controller: RyzeCreditsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RyzeCreditsController],
      providers: [RyzeCreditsService],
    }).compile();

    controller = module.get<RyzeCreditsController>(RyzeCreditsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
