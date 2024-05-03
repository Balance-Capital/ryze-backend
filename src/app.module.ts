import { Logger, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OhlcModule } from './ohlc/ohlc.module';
import { WebsocketProviderModule } from './websocket-provider/websocket-provider.module';
import { DataProviderModule } from './data-provider/data-provider.module';
import { SystemInfoModule } from './system-info/system-info.module';
import { DataProviderService } from './data-provider/data-provider.service';
import { SocketGateway } from './socket/socket.gateway';
import { connectionSource } from './orm.config';
import { AuthGuard } from './core/guards/auth.guard';
import { AffiliateModule } from './affiliate/affiliate.module';
import { UserModule } from './user/user.module';
import { RegisterGuard } from './core/guards/register.guard';
import { WsThrottlerGuard } from './core/guards/wss.guard';
import { AdminGuard } from './core/guards/admin.guard';
import { GraphqlModule } from './graphql/graphql.module';
import { RyzeCreditsModule } from './ryze-credits/ryze-credits.module';
import { PointModule } from './point/point.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(connectionSource.options),
    ScheduleModule.forRoot(),
    OhlcModule,
    WebsocketProviderModule,
    DataProviderModule,
    SystemInfoModule,
    AffiliateModule,
    UserModule,
    GraphqlModule,
    RyzeCreditsModule,
    PointModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    DataProviderService,
    Logger,
    SocketGateway,
    AuthGuard,
    RegisterGuard,
    WsThrottlerGuard,
    AdminGuard,
  ],
})
export class AppModule {
  constructor() {}
}
