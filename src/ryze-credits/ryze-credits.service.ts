import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { AffiliateService } from 'src/affiliate/affiliate.service';
import {
  MARKET_CONFIGURATION,
  CREDIT_MINTER_ADDRESS,
  FREE_CREDITS_SUPPORTED_TIMEFRAMES,
  PK_CREDITS_SIGNER,
  NETWORKS,
  MAIN_NETWORK,
} from 'src/core/constants/config.constant';
import { BigNumber, Contract, ethers } from 'ethers';
import { SignatureResponse } from './dto';
import { BinaryMarketABI, CreditMinterABI } from 'src/core/abi';
import { MarketSymbol } from 'src/core/enums/base.enum';
import { Cron } from '@nestjs/schedule';
import { Multicall } from 'ethereum-multicall';
import { gql } from '@apollo/client/core';
import { GraphqlService } from 'src/graphql/graphql.service';
import { IS_MAINNET } from 'src/core/constants/base.constant';

@Injectable()
export class RyzeCreditsService {
  private readonly logger = new Logger(RyzeCreditsService.name);
  private staticProvider: ethers.providers.StaticJsonRpcProvider;
  private multicallProvider: Multicall;
  private creditTokenIds: Map<string, number> = new Map();
  private creditMinter: Contract;

  constructor(
    private readonly affiliateService: AffiliateService,
    private readonly graphqlService: GraphqlService,
  ) {
    this.staticProvider = new ethers.providers.StaticJsonRpcProvider(
      NETWORKS[MAIN_NETWORK].rpcList[0],
    );

    this.multicallProvider = new Multicall({
      ethersProvider: ethers.getDefaultProvider(
        NETWORKS[MAIN_NETWORK].rpcList[0],
      ),
      tryAggregate: true,
    });

    this.createContractInstances();

    this.getCreditTokenIds();
  }

  private createContractInstances() {
    this.creditMinter = new ethers.Contract(
      CREDIT_MINTER_ADDRESS,
      CreditMinterABI,
      this.staticProvider,
    );
  }

  async getSignature(userAddress: string): Promise<SignatureResponse> {
    try {
      const user = await this.affiliateService.findByUser(userAddress);
      if (!user) {
        return {
          msg: 'Referral user not found',
          isEligible: false,
        };
      }

      const bets = await this.getBets(userAddress);
      if (!bets || bets.length === 0) {
        return {
          msg: 'No bets',
          isEligible: false,
        };
      }

      if (bets[0].position == bets[0].round.position || bets[0].creditUsed) {
        return {
          msg: 'Winner or credit is used',
          isEligible: false,
        };
      } // we don't pay credits for winners

      const timeframeId = bets[0].timeframeId;
      if (!FREE_CREDITS_SUPPORTED_TIMEFRAMES.includes(Number(timeframeId))) {
        return {
          msg: 'Not supported start timeframe',
          isEligible: false,
        };
      }
      const market = bets[0].market.pairName;
      const betAmount = bets[0].amount;
      const amount = ethers.utils.parseUnits(betAmount, 6).mul(95).div(100);

      // const tokenId = await this.getTokenId(market, timeframeId);
      const tokenId = this.creditTokenIds.get(`${market}-${timeframeId}`);
      if (!tokenId || Number(tokenId) === 0) {
        return {
          msg: `Credit is not enable for this market and timeframe - ${tokenId} - ${market} - ${timeframeId} - ${this.creditTokenIds.get(
            `BTCUSD-0`,
          )}`,
          isEligible: false,
        };
      }
      const totalClaimed = await this.getTotalClaimedAmount(userAddress);

      const generatedAt = Math.floor(Date.now() / 1000);

      const signature = await this.signMessage(
        ethers.utils.getAddress(userAddress),
        tokenId,
        amount,
        totalClaimed,
        generatedAt,
      );

      if (amount.gt(totalClaimed)) {
        return {
          isEligible: true,
          address: ethers.utils.getAddress(userAddress),
          tokenId,
          totalClaimedAmount: totalClaimed.toString(),
          generatedAt,
          amount: amount.sub(totalClaimed).toString(),
          signature,
        };
      } else {
        return {
          msg: `Already claimed`,
          isEligible: false,
        };
      }
    } catch (err) {
      this.logger.warn(
        `Something went wrong in getting signature - ${JSON.stringify(err)}`,
      );
      return {
        msg: `Something went wrong - ${JSON.stringify(err)}`,
        isEligible: false,
      };
    }
  }

  private async getBets(userAddress: string) {
    const graphqlQuery = IS_MAINNET
      ? gql`
    query fetchFirstBet
    {
      bets(
          first: 1, 
          where:{
            user_: {address: "${userAddress.toLowerCase()}"}
            round_: {lockPrice_not: null, closePrice_not: null}
            isReverted: false
          },
          orderBy:createdAt
          orderDirection: asc
      ) {
          position
          amount
          round {
            position
          }
          timeframeId
          market {
            pairName
          }
          creditUsed
        }
    }`
      : gql`
      query fetchFirstBet
      {
        bets(
            first: 1, 
            where:{
              user_: {address: "${userAddress.toLowerCase()}"}
              round_: {lockPrice_not: null, closePrice_not: null}
              isReverted: false
              market_: {symbol: "USDC"}
            },
            orderBy:createdAt
            orderDirection: asc
        ) {
            position
            amount
            round {
              position
            }
            timeframeId
            market {
              pairName
            }
            creditUsed
          }
      }`;

    const data = await this.graphqlService.fetchQuery(graphqlQuery);

    const bets = data?.bets;

    return bets;
  }

  @Cron('10 */10 * * * *')
  private async getCreditTokenIds() {
    try {
      for (let i = 0; i < Object.values(MarketSymbol).length; i++) {
        const market_symbol = Object.values(MarketSymbol)[i];
        const contractAddress =
          MARKET_CONFIGURATION[market_symbol].binaryMarketContracts[
            MAIN_NETWORK
          ]?.[0];

        if (!contractAddress) continue;

        let callData = [];
        const context = {
          reference: 'BinaryMarket',
          contractAddress,
          abi: BinaryMarketABI,
          calls: [],
        };

        callData = FREE_CREDITS_SUPPORTED_TIMEFRAMES.map((item) => ({
          reference: item,
          methodName: 'creditTokenIds',
          methodParameters: [item, 0],
        }));

        context.calls = callData;
        const res = await this.multicallProvider.call(context);

        const returnData = res.results['BinaryMarket'].callsReturnContext;

        returnData.map((item) => {
          if (item.returnValues && item.returnValues.length > 0) {
            const tokenId: BigNumber = BigNumber.from(
              item.returnValues[0] || 0,
            );
            if (tokenId.toNumber() > 0) {
              this.creditTokenIds.set(
                `${market_symbol}-${item.reference}`,
                tokenId.toNumber(),
              );
            }
          }
        });
      }
    } catch (err) {
      this.logger.warn(
        `Something went wrong in getting credit token ids - ${JSON.stringify(
          err,
        )}`,
      );
    }
  }

  private async getTotalClaimedAmount(address: string): Promise<BigNumber> {
    if (!this.creditMinter) {
      this.creditMinter = new ethers.Contract(
        CREDIT_MINTER_ADDRESS,
        CreditMinterABI,
        this.staticProvider,
      );
    }
    try {
      const claimedAmount: BigNumber = await this.creditMinter.userTotalClaimed(
        address,
      );
      return claimedAmount;
    } catch (err) {
      this.logger.warn(
        `Something went wrong in getting total claimed amount - ${JSON.stringify(
          err,
        )}`,
      );
      throw new BadRequestException(
        'Something wrong in getting total claimed amount',
      );
    }
  }

  private async signMessage(
    address: string,
    tokenId: string | number,
    amount: BigNumber,
    totalClaimed: BigNumber,
    generatedAt: number,
  ): Promise<string> {
    const wallet = new ethers.Wallet(`0x${PK_CREDITS_SIGNER}`);

    let message = ethers.utils.solidityPack(
      ['address', 'uint256', 'uint256', 'uint256', 'uint256'],
      [address, tokenId, amount, totalClaimed, generatedAt],
    );
    message = ethers.utils.solidityKeccak256(['bytes'], [message]);
    const signature = await wallet.signMessage(ethers.utils.arrayify(message));
    return signature;
  }
}
