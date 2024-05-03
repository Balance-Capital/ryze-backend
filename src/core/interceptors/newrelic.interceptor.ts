import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import * as newrelic from 'newrelic';
import * as util from 'util';

@Injectable()
export class NewrelicInterceptor implements NestInterceptor {
  private readonly logger = new Logger(NewrelicInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const logger = this.logger;
    logger.verbose(
      `Parent Interceptor before: ${util.inspect(context.getHandler().name)}`,
    );
    return newrelic.startWebTransaction(context.getHandler().name, function () {
      const transaction = newrelic.getTransaction();
      return next.handle().pipe(
        tap(() => {
          logger.verbose(
            `Parent Interceptor after: ${util.inspect(
              context.getHandler().name,
            )}`,
          );
          return transaction.end();
        }),
      );
    });
  }
}
