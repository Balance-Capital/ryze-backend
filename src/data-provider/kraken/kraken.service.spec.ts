import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { getRepositoryToken } from '@nestjs/typeorm';
import { of } from 'rxjs';
import { Repository } from 'typeorm';

import { Ohlc } from '../../ohlc/entities/ohlc.entity';
import { OhlcService } from '../../ohlc/ohlc.service';
import { KrakenService } from './kraken.service';
import { KrakenOhlcService } from './kraken.ohlc.service';
import { getCurrentMinute } from '../../core/utils/base.util';
import { DataProvider } from '../../core/enums/base.enum';
import { MockType } from '../../core/types/mock.type';
import { SYMBOLS } from '../../core/constants/config.constant';

describe('Test Kraken Service', () => {
  let module: TestingModule;
  let service: KrakenService;
  let krakenOhlcService: KrakenOhlcService;
  const httpService = {
    get: jest.fn(),
    post: jest.fn().mockImplementation(() => of({ data: {} })),
  };

  const repositoryMockFactory: () => MockType<Repository<any>> = jest.fn(
    () => ({
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
      save: jest.fn((ohlc) => ohlc),
    }),
  );

  const currentMinute = getCurrentMinute();
  const btcSymbol = SYMBOLS[DataProvider.Binance][0];

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        {
          provide: getRepositoryToken(Ohlc),
          useFactory: repositoryMockFactory,
        },
        { provide: HttpService, useValue: httpService },
        OhlcService,
        KrakenOhlcService,
        KrakenService,
      ],
    }).compile();

    service = module.get<KrakenService>(KrakenService);
    krakenOhlcService = module.get<KrakenOhlcService>(KrakenOhlcService);
    await module.init();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should test getOhlcData', async () => {
    jest.spyOn(krakenOhlcService, 'getOhlcPrice').mockReturnValue(null);
    const result = await service.getOhlcData(currentMinute, btcSymbol);
    expect(result).toEqual(null);
  });

  afterEach(async () => await module.close());
});
