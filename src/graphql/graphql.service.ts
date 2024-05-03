import {
  ApolloClient,
  NormalizedCacheObject,
  InMemoryCache,
  HttpLink,
  DefaultOptions,
} from '@apollo/client/core';
import { Injectable, Logger } from '@nestjs/common';
import { SUBGRAPH_URL } from 'src/core/constants/config.constant';
import fetch from 'cross-fetch';
import { retryAsync } from 'ts-retry';
import { generateRetryRandomPeriod } from 'src/core/utils/base.util';
import { RETRY_COUNT } from 'src/core/constants/base.constant';

@Injectable()
export class GraphqlService {
  private client: ApolloClient<NormalizedCacheObject>;
  private readonly logger = new Logger(GraphqlService.name);

  constructor() {
    const defaultOptions: DefaultOptions = {
      watchQuery: {
        fetchPolicy: 'no-cache',
        errorPolicy: 'ignore',
      },
      query: {
        fetchPolicy: 'no-cache',
        errorPolicy: 'all',
      },
    };
    this.client = new ApolloClient({
      link: new HttpLink({ uri: SUBGRAPH_URL, fetch }),
      cache: new InMemoryCache(),
      defaultOptions,
    });
  }

  async fetchQuery(query: any) {
    const res = await retryAsync(
      async () => {
        return await this.client.query({
          query,
        });
      },
      {
        delay: generateRetryRandomPeriod(true),
        maxTry: RETRY_COUNT,
      },
    );

    return res.data;
  }
}
