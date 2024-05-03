import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  BALANCEPASS_CONTRACT_ADDRESS,
  OAT_CID,
  OAT_CONTRACT_ADDRESS,
} from 'src/core/constants/config.constant';
import axios from 'axios';
import { BigNumber, Contract, ethers } from 'ethers';
import { OATABI } from 'src/core/abi';
import { loadEnvVariable } from 'src/core/utils/base.util';

export type BoostData = {
  user: string;
  boosts: {
    balance_pass: number;
    oat_og: number;
    oat_category: number;
    oat_rank: number;
  };
};
@Injectable()
export class BoostNFTService {
  private readonly logger = new Logger(BoostNFTService.name);
  private readonly polygon_provider =
    new ethers.providers.StaticJsonRpcProvider(
      'https://polygon-mainnet.public.blastapi.io',
    );
  private readonly OAT_CONTRACT: Contract;
  constructor() {
    axios.defaults.headers.common['X-API-KEY'] =
      loadEnvVariable('SIMPLEHASH_API_KEY');

    this.OAT_CONTRACT = new ethers.Contract(
      OAT_CONTRACT_ADDRESS,
      OATABI,
      this.polygon_provider,
    );
  }

  async getBoosts(_users: string[]) {
    const user_data: BoostData[] = [];

    const users = [..._users];
    let addresses = users.splice(0, 20);
    while (addresses && addresses.length > 0) {
      let cursor = null;
      let errCount = 0;
      do {
        try {
          const url = `https://api.simplehash.com/api/v0/nfts/owners?chains=polygon,ethereum&wallet_addresses=${addresses.join(
            ',',
          )}&contract_addresses=${OAT_CONTRACT_ADDRESS},${BALANCEPASS_CONTRACT_ADDRESS}&count=1&cursor=${cursor}&limit=50`;
          const res = await axios.get(url);
          const { data } = res;

          if (data) {
            const { nfts, next_cursor } = data;
            if (next_cursor && (cursor == next_cursor)) {
              errCount ++;
              break;
            }
            cursor = next_cursor;
            await Promise.all(
              nfts.map(async (nft) => {
                const nft_address = nft.contract_address;
                const owner = nft.owners[0].owner_address;
                const index = user_data.findIndex((item) => item.user == owner);
                let item;
                if (index == -1) {
                  item = {
                    user: owner,
                    boosts: {
                      balance_pass: 0,
                      oat_category: 0,
                      oat_og: 0,
                      oat_rank: 0,
                    },
                  };
                } else {
                  item = user_data[index];
                }
                if (
                  nft_address.toLowerCase() ===
                  BALANCEPASS_CONTRACT_ADDRESS.toLowerCase()
                ) {
                  item.boosts.balance_pass++;
                } else if (
                  nft_address.toLowerCase() ==
                  OAT_CONTRACT_ADDRESS.toLowerCase()
                ) {
                  const attributes = nft.extra_metadata?.attributes || [];

                  if (!attributes || attributes.length == 0) {
                    // simplehash api issue, so check SC manually.
                    try {
                      const cid: BigNumber = await this.OAT_CONTRACT['cid'](
                        nft.token_id,
                      );
                      switch (cid.toNumber()) {
                        case OAT_CID[0]:
                          item.boosts.oat_og++;
                          break;
                        case OAT_CID[1]:
                          item.boosts.oat_category++;
                          break;
                        case OAT_CID[2]:
                          item.boosts.oat_rank++;
                          break;
                      }
                    } catch (e) {
                      this.logger.warn(
                        `Polygon RPC call failed - ${JSON.stringify(e)}`,
                      );
                    }
                  } else {
                    attributes.map((attribute) => {
                      switch (attribute.trait_type?.toLowerCase()) {
                        case 'og':
                          item.boosts.oat_og++;
                          break;
                        case 'category':
                          item.boosts.oat_category++;
                          break;
                        case 'rank':
                          item.boosts.oat_rank++;
                          break;
                      }
                    });
                  }
                }

                if (index > -1) {
                  user_data[index] = item;
                } else {
                  user_data.push(item);
                }
              }),
            );
          }
        } catch (err) {
          this.logger.warn(
            `Something went wrong while fetching simplehash api - ${JSON.stringify(
              err,
            )}`,
          );
          errCount++;
          if (errCount > 5) {
            cursor = null;
            break;
          }
        }
      } while (cursor != null);

      addresses = users?.splice(0, 20);
    }

    return user_data;
  }

  getBoostPoint(boostData: BoostData) {
    if (!boostData) return 1;

    const boost = Object.entries(boostData.boosts).reduce((a, b) => {
      if (b[1] > 0) {
        return a + 1;
      } else {
        return a;
      }
    }, 0);

    switch (boost) {
      case 0:
        return 1;
      case 1:
        return 1.5;
      case 2:
        return 2;
      case 3:
        return 2.5;
      case 4:
        return 3;
      default:
        return 1;
    }
  }
}
