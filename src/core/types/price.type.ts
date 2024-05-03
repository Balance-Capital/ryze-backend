import { Ohlc } from '../../ohlc/entities/ohlc.entity';

export type LatestSymbolPrice = {
  price: number;
  volume?: number;
  timestamp?: number;
  createdAt?: number;
};

export type SymbolLatestPriceRecord = {
  [key: string]: {
    volume: number;
    tradeCountPerMinute: number;
    syncTrade?: LatestSymbolPrice;
    lastTrade?: LatestSymbolPrice;
    hasBinanceError?: boolean;
    volumeInLast60Minutes?: number;
  };
};

export type EmitLatestPrice = {
  [key: string]: LatestSymbolPrice;
};

export type EmitOhlcRecord = {
  [key: string]: Ohlc;
};

export type DataProviderLatestPrice = {
  [key: string]: SymbolLatestPriceRecord;
};
