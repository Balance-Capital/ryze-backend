import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as expressBasicAuth from 'express-basic-auth';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { DataProviderService } from './data-provider/data-provider.service';
import { SocketGateway } from './socket/socket.gateway';
import { NewrelicInterceptor } from './core/interceptors/newrelic.interceptor';
import {
  DOC_USER_NAME,
  DOC_USER_PASSWORD,
  WHITE_LIST_DOMAIN,
} from './core/constants/config.constant';
import { setFlagsFromString } from 'v8';
import { loadEnvVariable } from './core/utils/base.util';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });
  app.useGlobalInterceptors(new NewrelicInterceptor());
  const users = {
    [DOC_USER_NAME]: DOC_USER_PASSWORD,
  };

  app.use(
    '/docs',
    expressBasicAuth({
      challenge: true,
      users,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Binary Options Backend API')
    .setDescription('The Binary Options Backend API Documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  app.use(helmet());
  app.enableCors({
    origin: WHITE_LIST_DOMAIN,
    methods: ['GET', 'POST', 'HEAD', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });
  app.setGlobalPrefix('api', { exclude: [''] });
  app.useGlobalPipes(new ValidationPipe());

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const socketGateway = app.get(SocketGateway);

  const dataProviderService = new DataProviderService(socketGateway);
  dataProviderService.startWorkerThread();
  await app.listen(loadEnvVariable('PORT', true, '3000'));
}

bootstrap().then();
