import { OhlcDto } from '../../ohlc/dto/ohlc.dto';
import { enumToOptions } from './enum.util';
import { DataProvider, ResolutionType } from '../enums/base.enum';
import { Option } from '../models/option.model';
import {
  DATA_PROVIDERS,
  MARKET_CONFIGURATION,
} from '../constants/config.constant';

export function makeOhlcSignatureMessage(ohlc: OhlcDto): string {
  return `${ohlc.symbol}_${ohlc.time}_${ohlc.source}_${ohlc.close.toFixed(
    MARKET_CONFIGURATION[ohlc.symbol]?.decimals ?? 2,
  )}`;
}

export function makeProviderSymbolArray(): string[] {
  const result = [];
  const providers = enumToOptions<string>(DataProvider).filter(
    (provider) =>
      provider.value !== DataProvider.Default &&
      provider.value !== DataProvider.Chainlink,
  );
  providers.forEach((provider: Option<string>) => {
    DATA_PROVIDERS[provider.value].markets.forEach(({ tick }) => {
      result.push(`${provider.value}_${tick}`);
    });
  });
  return result;
}

export function getResolutionForKraken(binanceResolution: string): string {
  switch (binanceResolution) {
    case ResolutionType.Minute_1:
      return '1';
    case ResolutionType.Minute_5:
      return '5';
    case ResolutionType.Minute_15:
      return '15';
    case ResolutionType.Minute_30:
      return '30';
    case ResolutionType.Hour_1:
      return '60';
  }
}

export function convertSymbolToBinance(symbol: string): string {
  const item = DATA_PROVIDERS.BINANCE.markets.find(
    (item) => item.symbol === symbol,
  );
  return item?.tick || symbol;
}

export function convertSymbolToKraken(symbol: string): string {
  const item = DATA_PROVIDERS.KRAKEN.markets.find(
    (item) => item.symbol === symbol,
  );
  return item?.tick || symbol;
}

export function convertSymbolToOKX(symbol: string): string {
  const item = DATA_PROVIDERS.OKX.markets.find(
    (item) => item.symbol === symbol,
  );
  return item?.tick || symbol;
}
