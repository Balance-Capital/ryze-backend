import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';

import { OhlcService } from '../../ohlc/ohlc.service';
import { BinanceOhlcService } from './binance.ohlc.service';
import { BinanceService } from './binance.service';
import { getCurrentMinute } from '../../core/utils/base.util';
import { DataProvider } from '../../core/enums/base.enum';
import { SYMBOLS } from '../../core/constants/config.constant';
import { MockType } from '../../core/types/mock.type';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Ohlc } from '../../ohlc/entities/ohlc.entity';

describe('Test Binance Service', () => {
  let module: TestingModule;
  let service: BinanceService;
  let binanceOhlcService: BinanceOhlcService;
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
        BinanceService,
        BinanceOhlcService,
      ],
    }).compile();

    service = module.get<BinanceService>(BinanceService);
    binanceOhlcService = module.get<BinanceOhlcService>(BinanceOhlcService);
    await module.init();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should test getOhlcData', async () => {
    jest.spyOn(binanceOhlcService, 'getOhlcPrice').mockReturnValue(null);
    const result = await service.getOhlcData(currentMinute, btcSymbol);
    expect(result).toEqual(null);
  });

  afterEach(async () => await module.close());
});
