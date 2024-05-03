import { Logger, OnModuleInit, UseGuards } from '@nestjs/common';
import {
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { OhlcService } from '../ohlc/ohlc.service';
import { EmitLatestPrice } from '../core/types/price.type';
import { DataProvider, MarketSymbol } from '../core/enums/base.enum';
import {
  MARKET_CONFIGURATION,
  MAX_PRICE_DIFFERENCE_RATE,
  SOCKET_PUSH_INTERVAL_MS,
  WHITE_LIST_DOMAIN,
} from '../core/constants/config.constant';
import { Ohlc } from 'src/ohlc/entities/ohlc.entity';
import { WsThrottlerGuard } from 'src/core/guards/wss.guard';
import { Throttle } from '@nestjs/throttler';

function isOriginAllowed(origin: string): boolean {
  // Check if origin matches the regexp
  if (/\.vercel\.app$/.test(origin)) {
    return true;
  }

  // Check if the origin is in the white list
  for (const domain of WHITE_LIST_DOMAIN) {
    if (typeof domain === 'string' && origin === domain) {
      return true;
    } else if (domain instanceof RegExp && domain.test(origin)) {
      return true;
    }
  }

  return false;
}

@WebSocketGateway({
  cors: {
    origin: function (origin, callback) {
      if (isOriginAllowed(origin || '')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'), false);
      }
    },
  },
  perMessageDeflate: false,
})
@UseGuards(WsThrottlerGuard)
export class SocketGateway
  implements OnModuleInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;
  latestPrice = {};
  private readonly logger = new Logger(SocketGateway.name);

  constructor(private ohlcService: OhlcService) {}

  async onModuleInit() {
    await this.calculateLatestPrice();
  }

  checkHasNotZeroValue(dataProviderLatestPrice: EmitLatestPrice): boolean {
    let errorCont = 0;
    Object.keys(dataProviderLatestPrice).forEach((symbol: string) => {
      const priceDifferenceRate =
        Math.abs(
          (dataProviderLatestPrice[symbol]?.price -
            this.ohlcService.onChainPrice[symbol]) /
            this.ohlcService.onChainPrice[symbol],
        ) * 100;
      if (
        dataProviderLatestPrice[symbol]?.price === 0 ||
        priceDifferenceRate > MAX_PRICE_DIFFERENCE_RATE
      ) {
        errorCont++;
      }
    });
    return errorCont === 0;
  }

  @Throttle(5, 60) // 5 requests / 1m
  @UseGuards(WsThrottlerGuard)
  handleConnection(_socket: Socket): void {
    this.logger.debug('Websocket-connection: ', _socket.id);
  }

  handleDisconnect(): void {
    this.logger.debug(`Socket disconnected`);
  }

  async calculateLatestPrice() {
    const startTime = new Date().getTime();
    try {
      let hasBinanceError = false;
      Object.values(MarketSymbol).forEach((symbol: string) => {
        const decimals = MARKET_CONFIGURATION[symbol]?.decimals ?? 2;
        let totalVolume = 0;
        let total60Volume = 0;
        let totalPrice = 0;
        Object.keys(this.ohlcService.latestPriceRecord).forEach((provider) => {
          if (
            this.ohlcService.latestPriceRecord[provider][symbol]
              ?.hasBinanceError === true
          ) {
            hasBinanceError = true;
          }
          const volume =
            this.ohlcService.latestPriceRecord[provider][symbol]?.volume || 0;
          const volumeIn60Candles =
            this.ohlcService.latestPriceRecord[provider][symbol]
              ?.volumeInLast60Minutes || 0;

          const price =
            this.ohlcService.latestPriceRecord[provider][symbol]['lastTrade']
              ?.price || 0;

          if (price > 0) {
            totalVolume += volume;
            totalPrice += price * volumeIn60Candles;
            total60Volume += volumeIn60Candles;
          }
        });
        this.latestPrice[symbol] = {
          price:
            total60Volume !== 0
              ? Number((totalPrice / total60Volume).toFixed(decimals))
              : 0,
          volume: totalVolume,
          timestamp: new Date().getTime(),
          total60Volume,
        };

        // Object.keys(this.ohlcService.latestPriceRecord).forEach((provider) => {
        //   this.latestPrice[symbol][`wss_time_${provider}`] =
        //     this.ohlcService.latestPriceRecord[provider][
        //       symbol
        //     ]?.lastTrade?.timestamp;
        //   this.latestPrice[symbol][`createdAt_${provider}`] =
        //     this.ohlcService.latestPriceRecord[provider][
        //       symbol
        //     ]?.lastTrade?.createdAt;
        // });
      });
      if (this.checkHasNotZeroValue(this.latestPrice) || hasBinanceError) {
        this.sendLatestPrice();
      }
    } catch (e) {
      this.logger.warn(`Calculate last price failed, ${e.stack}`);
    } finally {
      setTimeout(
        async () => await this.calculateLatestPrice(),
        SOCKET_PUSH_INTERVAL_MS - (new Date().getTime() - startTime),
      );
    }
  }

  sendLatestPrice() {
    Object.keys(this.latestPrice).forEach((symbol: string) => {
      try {
        this.doSendLatestPrice(symbol, this.latestPrice[symbol]);
        // if (symbol.toLowerCase() === 'btcusd')
        // console.log(this.latestPrice[symbol])
      } catch (e) {
        this.logger.warn(`${symbol} send latest price failed, ${e.stack}`);
      }
    });
  }

  private doSendLatestPrice(symbol: string, price: number) {
    this.server?.sockets?.emit(`latest-price-${symbol.toLowerCase()}`, price);
  }

  sendDefaultOpenPrice(ohlc: Ohlc) {
    try {
      const decimals = MARKET_CONFIGURATION[ohlc.symbol]?.decimals ?? 2;
      const data = {
        ...ohlc,
        open: Number(ohlc?.open.toFixed(decimals)),
        high: Number(ohlc?.high.toFixed(decimals)),
        low: Number(ohlc?.low.toFixed(decimals)),
        close: Number(ohlc?.close.toFixed(decimals)),
      };
      this.logger.log(`Emit OHLC start: `, Date.now());
      this.server?.sockets?.emit(
        `open-price-${data.symbol.toLowerCase()}`,
        data,
      );
      this.logger.log(`Emit OHLC end: `, Date.now());
    } catch (e) {
      this.logger.warn(`${ohlc.symbol} send latest price failed, ${e.stack}`);
    }
  }
}
