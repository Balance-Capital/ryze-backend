export enum Importance {
  High = 'HIGH',
  Medium = 'MEDIUM',
  Low = 'LOW',
}

export enum Network {
  EthereumMainnet = 1,
  ArbitrumMainnet = 42161,
  ArbitrumGoerli = 421613,
  ArbitrumSepolia = 421614,
  BerachainTestnet = 80085,
  BlastTestnet = 168587773,
  BlastMainnet = 81457,
  InEVMTestnet = 2424,
  InEVMMainnet = 2525,
}

export enum MarketSymbol {
  BTCUSD = 'BTCUSD',
  ETHUSD = 'ETHUSD',
  BNBUSD = 'BNBUSD',
  XRPUSD = 'XRPUSD',
  MATICUSD = 'MATICUSD',
  DOGEUSD = 'DOGEUSD',
  SOLUSD = 'SOLUSD',
  LINKUSD = 'LINKUSD',
}

export enum DataProvider {
  Default = 'DEFAULT',
  Binance = 'BINANCE',
  OKX = 'OKX',
  Kraken = 'KRAKEN',
  ByBit = 'BYBIT',
  Chainlink = 'CHAINLINK',
}

export enum RestApiOhlcResponseType {
  Success = 'SUCCESS',
  InvalidResponse = 'INVALID_RESPONSE',
  EmptyResponse = 'EMPTY',
  RateLimited = 'RATE_LIMITED',
  RequestFailed = 'REQUEST_FAILED',
}

export enum OhlcResponseCase {
  HasNoFirstIndex = 'HAS_NO_FIRST_INDEX',
  FullCase = 'FULL_CASE',
}

export enum OhlcResultType {
  Success = 'SUCCESS',
  MissingBinance = 'MISSING_BINANCE',
  MissingKraken = 'MISSING_KRAKEN',
  MissingByBit = 'MISSING_BYBIT',
  MissingOKX = 'MISSING_OKX',
  OnlyHasBinance = 'ONLY_HAS_BINANCE',
  OnlyHasKraken = 'ONLY_HAS_KRAKEN',
  OnlyHasByBit = 'ONLY_HAS_BYBIT',
  OnlyHasOKX = 'ONLY_HAS_OKX',
  MissingAll = 'MISSING_ALL',
}

export enum ResolutionType {
  Minute_1 = '1m',
  Minute_3 = '3m',
  Minute_5 = '5m',
  Minute_15 = '15m',
  Minute_30 = '30m',
  Hour_1 = '1h',
}
