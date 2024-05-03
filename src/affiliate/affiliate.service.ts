import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BigNumber, Contract, ethers, utils } from 'ethers';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import * as CryptoJS from 'crypto-js';

import { Affiliate } from './entities/affiliate.entity';
import { AffiliateFee } from './entities/affiliate-fee.entity';
import { AffiliateDto } from './dto/affiliate.dto';
import { parseSortQuery } from '../core/utils/query.util';
import {
  HOUR,
  IS_DEV,
  IS_MAINNET,
  MINUTE,
  MONTH,
  WEEK,
} from '../core/constants/base.constant';
import { BinaryConfigABI } from 'src/core/abi';
import {
  CONFIG_ADDRESS,
  DECIMALS,
  MAIN_NETWORK,
  NETWORKS,
  PK_REFERRAL,
  QUALIFIED_REFEREE_AMOUNT_MONTH,
  QUALIFIED_REFEREE_AMOUNT_WEEK,
} from 'src/core/constants/config.constant';
import { TIER } from './utils';
import { AffiliateExplicityFee } from './entities/affiliate-explicity-fee.entity';
import { AffiliateTier } from './entities/affiliate-tier.entity';
import { SetTierDto } from './dto/tier.dto';
import { loadEnvVariable, sleep } from 'src/core/utils/base.util';
import { gql } from '@apollo/client/core';
import { GraphqlService } from 'src/graphql/graphql.service';

type Bet = {
  user: string;
  amount: number;
};

export type FeeRes = {
  fee: AffiliateFee;
  signature: string;
};

@Injectable()
export class AffiliateService {
  private isUpdatingAffiliateFee: boolean;
  private readonly logger = new Logger(AffiliateService.name);
  private feeRate = 0;
  private feeRateForReferrals = 0.2;
  // Fee Rate is 0.05 (5%) of volume.
  // We use 1/5 of fee for referrals, so 1% of volume

  constructor(
    @InjectRepository(Affiliate)
    private readonly affiliateRepository: Repository<Affiliate>,
    @InjectRepository(AffiliateFee)
    private readonly affiliateFeeRepository: Repository<AffiliateFee>,
    @InjectRepository(AffiliateExplicityFee)
    private readonly explicityFeeRepository: Repository<AffiliateExplicityFee>,
    @InjectRepository(AffiliateTier)
    private readonly tierRepository: Repository<AffiliateTier>,
    private readonly graphqlService: GraphqlService,
  ) {
    this.isUpdatingAffiliateFee = false;
    this.initialize();
    this.updateAffiliateFee();
  }

  private async initialize() {
    const count = await this.tierRepository.count();

    if (count > 0) {
      return;
    }

    const tthis = this;
    function constructTiers(tier: TIER) {
      const record = new AffiliateTier();
      record.tier = tier;
      switch (tier) {
        case TIER.Bronze:
          record.percent = '30';
          break;
        case TIER.Silver:
          record.percent = '40';
          record.eligible_referee = 50;
          break;
        case TIER.Gold:
          record.percent = '50';
          record.eligible_referee = 100;
          break;
        case TIER.Platinum:
          record.percent = '70';
          record.eligible_referee = 150;
          break;
        case TIER.Diamond:
          record.percent = '100';
          record.eligible_referee = 250;
          break;
      }

      record.signature = CryptoJS.AES.encrypt(
        record.toSignatureMessage(),
        loadEnvVariable('AFFILIATE_PASSWORD_KEY'),
      ).toString();

      return record;
    }

    const records = [];
    records.push(constructTiers(TIER.Bronze));
    records.push(constructTiers(TIER.Silver));
    records.push(constructTiers(TIER.Gold));
    records.push(constructTiers(TIER.Platinum));
    records.push(constructTiers(TIER.Diamond));

    this.tierRepository.save(records);
  }

  async create(
    payload: AffiliateDto,
    throwError = true,
  ): Promise<Affiliate | null> {
    this.logger.debug(
      `Creating affiliate, user: ${payload?.user}, affiliate: ${payload?.affiliate}`,
    );

    const found = await this.findByUser(payload.user);
    if (found) {
      if (throwError) {
        throw new BadRequestException(`This user has affiliate already.`);
      } else {
        return found;
      }
    }

    const affiliate = new Affiliate();
    affiliate.user = payload.user;
    affiliate.affiliate = payload.affiliate;

    return this.saveAffiliate(affiliate);
  }

  private async saveAffiliate(affiliate: Affiliate): Promise<Affiliate> {
    this.logger.debug(`Saving affiliate ${affiliate}`);
    try {
      affiliate.user = utils
        .getAddress(affiliate.user.toLowerCase())
        .toLowerCase();
    } catch (err) {
      throw new BadRequestException('Invalid user address');
    }
    try {
      affiliate.affiliate = utils
        .getAddress(affiliate.affiliate.toLowerCase())
        .toLowerCase();
    } catch (err) {
      throw new BadRequestException('Invalid affiliate address');
    }
    if (affiliate.user === affiliate.affiliate) {
      throw new BadRequestException('Invalid affiliate address');
    }

    return await this.affiliateRepository.save(affiliate);
  }

  async findByAffiliate(
    affilate: string,
    findRemoved = false,
  ): Promise<Affiliate[]> {
    return this.affiliateRepository.find({
      withDeleted: findRemoved,
      where: { affiliate: affilate.toLowerCase() },
    });
  }

  async findByUser(user: string): Promise<Affiliate> {
    return this.affiliateRepository.findOne({
      where: { user: user.toLowerCase() },
    });
  }

  async findAll(
    skip: number,
    take: number,
    affiliate: string,
    sortQuery: string,
  ): Promise<[Affiliate[], number]> {
    try {
      const builder = await this.affiliateRepository.createQueryBuilder(
        'affiliate',
      );
      if (affiliate) {
        builder.andWhere('LOWER(affiliate.affiliate) = :affiliate', {
          affiliate: affiliate.toLowerCase(),
        });
      }
      return builder
        .orderBy(parseSortQuery(sortQuery, null))
        .skip(skip)
        .take(take)
        .getManyAndCount();
    } catch (e) {
      throw new BadRequestException(e);
    }
  }

  async findFeeByUser(
    affiliate: string,
    needSignature: boolean,
  ): Promise<FeeRes> {
    const fee = await this.affiliateFeeRepository.findOne({
      where: { affiliate: affiliate.toLowerCase() },
    });

    if (!fee) {
      return {
        fee: null,
        signature: '',
      };
    }

    if (!this.isAffiliateFeeValid(fee)) {
      throw new BadRequestException(`Hacking! - ${affiliate}`);
    }

    const res: FeeRes = {
      fee,
      signature: '',
    };

    if (needSignature) {
      try {
        res.signature = await this.signMessage(
          ethers.utils.getAddress(affiliate.toLowerCase()),
          ethers.utils
            .parseUnits(Number(fee.fee).toFixed(DECIMALS), DECIMALS)
            .toString(),
        );
      } catch (error) {
        this.logger.warn(
          `Failed to generate signature - ${affiliate} - ${JSON.stringify(
            fee,
          )} - ${JSON.stringify(error)}`,
        );
      }
    }

    return res;
  }

  // TODO interval might be changed
  private static readonly cronTime = IS_DEV
    ? CronExpression.EVERY_MINUTE
    : CronExpression.EVERY_5_MINUTES;

  @Cron(AffiliateService.cronTime)
  async updateAffiliateFee() {
    this.logger.log('Updating affiliate fee');
    if (this.isUpdatingAffiliateFee) {
      this.logger.log('affiliate fee update skipping....');
      return;
    }
    if (!loadEnvVariable('AFFILIATE_PASSWORD_KEY')) {
      this.logger.log('Affiliate password key not set. Skipping....');
      return;
    }
    try {
      this.isUpdatingAffiliateFee = true;
      await this.doUpdateAffiliateFee();
    } catch (err) {
      this.logger.warn(
        `Error while updateAffiliateFee - ${JSON.stringify(err)}`,
      );
    } finally {
      this.isUpdatingAffiliateFee = false;
    }
  }

  private async getBetsData(lastTimestamp: number) {
    let skip = 0;
    const bets: Bet[] = [];
    let latestTimestamp = lastTimestamp;
    let errorCount = 0;

    while (1) {
      const graphqlQuery = IS_MAINNET
        ? gql`
        query fetchBetSince
        {
          bets (
            first:1000
            skip: ${skip}
            where:{
              isReverted:false,
              round_: {closePrice_not: null, lockPrice_not: null, endAt_gt: ${lastTimestamp}},
            } 
            orderBy:round__endAt
          ) {
            round {
              endAt
            }
            user {
              address
            }
            amount
          }
        }`
        : gql`
        query fetchBetSince
        {
          bets (
            first:1000
            skip: ${skip}
            where:{
              isReverted:false,
              round_: {closePrice_not: null, lockPrice_not: null, endAt_gt: ${lastTimestamp}},
              market_: {symbol: "USDC"}
            } 
            orderBy:round__endAt
          ) {
            round {
              endAt
            }
            user {
              address
            }
            amount
          }
        }`;

      try {
        const data = await this.graphqlService.fetchQuery(graphqlQuery);
        if (data) {
          for (const bet of data.bets) {
            const index = bets.findIndex(
              (item) => item.user === bet.user.address,
            );

            if (index === -1) {
              // new user, add bet
              bets.push({
                user: bet.user.address,
                amount: Number(bet.amount),
              });
            } else {
              // existing user, just update amount
              const amount = bets[index].amount + Number(bet.amount);

              const updatedBet = {
                user: bet.user.address,
                amount,
              };
              bets[index] = updatedBet;
            }
            latestTimestamp = bet.round.endAt;
          }
          if (data.bets.length < 1000) {
            break;
          }
        } else {
          break;
        }
        skip += 1000;
      } catch (err) {
        this.logger.warn(
          `Failed to fetch data from subgraph - ${JSON.stringify(err)}`,
        );
        errorCount++;
        if (errorCount > 10) {
          break;
        }
      } finally {
        await sleep(1000);
      }
    }

    return { bets, latestTimestamp };
  }

  private async updateAffiliate(bets: Bet[], latestTimestamp: number) {
    // Update is_qualified data in affiliate repository
    // If is_qualified is already true, then we don't need to update affiliate record at all.
    let skip = 0;
    const betUsers = bets.map((bet) => bet.user);

    while (true) {
      const affiliates = await this.affiliateRepository
        .createQueryBuilder('affiliate')
        .where('affiliate.is_qualified = :value', { value: false })
        .andWhere('affiliate.user IN (:...addresses)', { addresses: betUsers })
        .take(1000)
        .skip(skip)
        .getMany();

      const updatedAffiliates = [];
      affiliates.map((affiliate) => {
        const bet = bets.find((item) => item.user == affiliate.user);
        const totalVolume = Number(affiliate.volume) + bet.amount;
        affiliate.volume = totalVolume.toFixed(DECIMALS);
        affiliate.updatedAt = new Date(Number(latestTimestamp) * 1000);

        if (
          totalVolume >= QUALIFIED_REFEREE_AMOUNT_WEEK &&
          affiliate.createdAt.getTime() + WEEK >= affiliate.createdAt.getTime()
        ) {
          affiliate.is_qualified = true;
        } else if (
          totalVolume >= QUALIFIED_REFEREE_AMOUNT_MONTH &&
          affiliate.createdAt.getTime() + MONTH >= affiliate.createdAt.getTime()
        ) {
          affiliate.is_qualified = true;
        }

        updatedAffiliates.push(affiliate);
      });

      if (updatedAffiliates.length > 0) {
        try {
          await this.affiliateRepository.save(updatedAffiliates);
        } catch (err) {
          this.logger.warn(
            `Error occurd while saving affilates: ${JSON.stringify(err)}`,
          );
        }
      }

      if (affiliates.length < 1000) {
        break;
      }
      skip += 1000;
    }
  }

  private async updateAffiliateFeeWithBets(
    bets: Bet[],
    latestTimestamp: number,
  ) {
    const betUsers = bets.map((bet) => bet.user);
    const affiliateUsers: string[] = [];

    let skip = 0;
    while (true) {
      const affiliates = await this.affiliateRepository
        .createQueryBuilder('affiliate')
        .andWhere('affiliate.user IN (:...addresses)', { addresses: betUsers })
        .take(1000)
        .skip(skip)
        .getMany();

      affiliates.map((affiliate) => {
        if (
          !affiliateUsers.find((user) => affiliate.affiliate == user) &&
          affiliate.affiliate
        ) {
          affiliateUsers.push(affiliate.affiliate);
        }
      });

      if (affiliates.length < 1000) {
        break;
      }
      skip += 1000;
    }
    const updatedAffiliateFees: AffiliateFee[] = [];

    let affiliatesData: Affiliate[] = [];
    let affiliatesFeeData: AffiliateFee[] = [];

    if (affiliateUsers && affiliateUsers.length > 0) {
      try {
        affiliatesData = await this.affiliateRepository
          .createQueryBuilder('affiliate')
          .andWhere('affiliate.affiliate IN (:...addresses)', {
            addresses: affiliateUsers,
          })
          .getMany();
      } catch (err) {
        this.logger.error(
          `Error while get affiliates from db - ${JSON.stringify(err)}`,
        );
        return;
      }

      try {
        affiliatesFeeData = await this.affiliateFeeRepository
          .createQueryBuilder('affiliate_fee')
          .andWhere('affiliate_fee.affiliate IN (:...addresses)', {
            addresses: affiliateUsers,
          })
          .getMany();
      } catch (err) {
        this.logger.error(
          `Error while get affiliate fees from db - ${JSON.stringify(err)}`,
        );
        return;
      }
    }

    let tiersData: AffiliateTier[] = [];
    try {
      tiersData = await this.tierRepository.find();
    } catch (err) {
      this.logger.error(
        `Error while get affiliate tiers from db - ${JSON.stringify(err)}`,
      );
      return;
    }

    let explicityFeeData: AffiliateExplicityFee[] = [];
    try {
      explicityFeeData = await this.explicityFeeRepository.find();
    } catch (err) {
      this.logger.error(
        `Error while get affiliate explicity fee from db - ${JSON.stringify(
          err,
        )}`,
      );
      return;
    }

    await Promise.all(
      affiliateUsers.map(async (affiliate) => {
        try {
          // const referees = await this.affiliateRepository.find({
          //   where: {
          //     affiliate
          //   }
          // });
          const referees = affiliatesData.filter(
            (item) => item.affiliate == affiliate,
          );

          const betsForAffiliate = bets.filter((bet) =>
            referees.find((referee) => referee.user == bet.user),
          );
          const volume = betsForAffiliate.reduce((a, b) => a + b.amount, 0);

          // let affiliateFee = await this.affiliateFeeRepository.findOne({
          //   where: {
          //     affiliate: affiliate
          //   }
          // });
          let affiliateFee = affiliatesFeeData.find(
            (item) => item.affiliate == affiliate,
          );
          if (this.isAffiliateFeeValid(affiliateFee)) {
            const qualifiedUserCount = referees.filter(
              (referee) => referee.is_qualified,
            ).length;

            if (!affiliateFee) {
              affiliateFee = new AffiliateFee();
              affiliateFee.affiliate = affiliate;
              affiliateFee.last_tier_updated_at = new Date();
              affiliateFee.current_tier = TIER.Bronze;
            }

            // const tierRecord = await this.tierRepository.findOne({
            //   where: {
            //     tier: affiliateFee.current_tier
            //   }
            // });
            const tierRecord = tiersData.find(
              (item) => item.tier == affiliateFee.current_tier,
            );

            affiliateFee.total_referred_volume = (
              Number(affiliateFee.total_referred_volume || '0') + volume
            ).toFixed(DECIMALS);

            // const explicityFeeRecord = await this.explicityFeeRepository.findOne({
            //   where: {
            //     affiliate: affiliate
            //   }
            // });
            const explicityFeeRecord = explicityFeeData.find(
              (item) => item.affiliate == affiliate,
            );

            let rewardPercent: number = parseFloat(tierRecord.percent);
            // TODO it should be a month in prod
            if (
              affiliateFee.last_tier_updated_at &&
              affiliateFee.current_tier > TIER.Bronze &&
              affiliateFee.last_tier_updated_at.getTime() + MONTH >= Date.now()
            ) {
              // he should get paid 100% after upgrading tier for a month
              rewardPercent = 100;
            }

            if (explicityFeeRecord) {
              let decrypted = null;
              try {
                decrypted = CryptoJS.AES.decrypt(
                  explicityFeeRecord.signature,
                  loadEnvVariable('AFFILIATE_PASSWORD_KEY'),
                ).toString(CryptoJS.enc.Utf8);
              } catch (e) {
                // no code
              }

              if (decrypted == explicityFeeRecord.toSignatureMessage()) {
                rewardPercent = Number(explicityFeeRecord.percent);
              } else {
                this.logger.error(
                  `Hacking attempt! Found affiliate record with different signature message, skipping it. Affiliate: ${
                    affiliateFee.affiliate
                  }, fee: ${explicityFeeRecord.percent},  found signature: [${
                    explicityFeeRecord.signature
                  }], which should be: ${decrypted}, but it's ${explicityFeeRecord.toSignatureMessage()}`,
                );
              }
            }

            const fee =
              (rewardPercent *
                volume *
                this.feeRate *
                this.feeRateForReferrals) /
              100;

            affiliateFee.fee = (Number(affiliateFee.fee || '0') + fee).toFixed(
              DECIMALS,
            );
            affiliateFee.updatedAt = new Date(Number(latestTimestamp) * 1000);
            const newTier = this.getTierByReferee(
              qualifiedUserCount,
              tiersData,
            );

            if (affiliateFee.current_tier < newTier.tier) {
              affiliateFee.current_tier = newTier.tier;
              affiliateFee.last_tier_updated_at = new Date(
                Number(latestTimestamp) * 1000,
              );
            }

            // this is one single place where anyone can create affiliate records
            affiliateFee.signature = CryptoJS.AES.encrypt(
              affiliateFee.toSignatureMessage(),
              loadEnvVariable('AFFILIATE_PASSWORD_KEY'),
            ).toString();

            updatedAffiliateFees.push(affiliateFee);
          }
        } catch (err) {
          console.error('error: ', err);
          this.logger.warn(
            `Something went wrong while calculating fee for referre - ${JSON.stringify(
              err,
            )}`,
          );
        }
      }),
    );

    await this.affiliateFeeRepository.save(updatedAffiliateFees);
  }

  private async doUpdateAffiliateFee() {
    try {
      this.feeRate = await this.getFeeRate();

      let lastAffiliateFees = await this.affiliateFeeRepository.find({
        order: {
          updatedAt: 'DESC',
        },
        take: 10,
      });

      lastAffiliateFees = lastAffiliateFees.filter((fee) =>
        this.isAffiliateFeeValid(fee),
      );

      const lastAffiliates = await this.affiliateRepository.find({
        order: {
          updatedAt: 'DESC',
        },
        take: 10,
      });

      const count = await this.affiliateRepository.count();
      if (count == 0) {
        return; // we don't need to calculate referrals if there is no affiliates.
      }

      let lastTimestamp =
        lastAffiliateFees.length !== 0
          ? Math.floor(lastAffiliateFees[0].updatedAt.getTime() / 1000)
          : Number(loadEnvVariable('AFFILIATE_START_TIME', true, '0'));

      if (lastAffiliates.length > 0) {
        const last_time_affiliate = Math.floor(
          (lastAffiliates[0]?.updatedAt?.getTime() || 0) / 1000,
        );
        if (last_time_affiliate > lastTimestamp) {
          lastTimestamp = last_time_affiliate;
        }
      }

      // const lastTimestamp = 1696289074;
      const currentTime = Date.now();

      const { bets, latestTimestamp } = await this.getBetsData(lastTimestamp);
      console.log(
        'bet_lengths: ',
        bets.length,
        currentTime,
        Date.now(),
        lastTimestamp,
      );

      if (bets && bets.length > 0) {
        await this.updateAffiliate(bets, latestTimestamp);
        await this.updateAffiliateFeeWithBets(bets, latestTimestamp);
      }
    } catch (err) {
      console.log('Error: ', err);
      this.logger.warn(
        `Failed to update affiliate fees - ${JSON.stringify(err)}`,
      );
    }
  }

  private isAffiliateFeeValid(affiliateFee: AffiliateFee): boolean {
    if (!affiliateFee) return false;

    // record loaded without signature, it's straight fraud, do not add any increments, do not start from 0. this needs to be investigated manually
    if (!affiliateFee.signature) {
      this.logger.error(
        `Hacking attempt! Found affiliate record without signature, skipping it. Affiliate: ${affiliateFee.affiliate}, fee: ${affiliateFee.fee}`,
      );
      return false;
    }

    // record with different signature, so it's changed from sql injection or database modification. do not start from 0, this needs to be investigated manually
    let decrypted = null;
    try {
      decrypted = CryptoJS.AES.decrypt(
        affiliateFee.signature,
        loadEnvVariable('AFFILIATE_PASSWORD_KEY'),
      ).toString(CryptoJS.enc.Utf8);
    } catch (e) {
      // no code
    }

    if (decrypted !== affiliateFee.toSignatureMessage()) {
      this.logger.error(
        `Hacking attempt! Found affiliate record with different signature message, skipping it. Affiliate: ${
          affiliateFee.affiliate
        }, fee: ${affiliateFee.fee},  found signature: [${
          affiliateFee.signature
        }], which should be: ${decrypted}, but it's ${affiliateFee.toSignatureMessage()}`,
      );
      return false;
    }

    return true;
  }

  private async getFeeRate() {
    try {
      // Get fee rate from smart contract
      const provider = new ethers.providers.JsonRpcProvider(
        NETWORKS[MAIN_NETWORK].rpcList[0],
      );

      const configContract = new Contract(
        CONFIG_ADDRESS,
        BinaryConfigABI,
        provider,
      );

      const feeRate: BigNumber = await configContract.tradingFee();
      return feeRate.toNumber() / 10000;
    } catch (err) {
      return 0.05;
    }
  }

  private async signMessage(address: string, fee: string): Promise<string> {
    const wallet = new ethers.Wallet(`0x${PK_REFERRAL}`);

    let message = ethers.utils.solidityPack(
      ['address', 'uint256'],
      [address, fee],
    );
    message = ethers.utils.solidityKeccak256(['bytes'], [message]);
    const signature = await wallet.signMessage(ethers.utils.arrayify(message));
    return signature;
  }

  private async getRewardPercentForTier(tier: TIER) {
    const tierRecord = await this.tierRepository.findOne({
      where: {
        tier: tier,
      },
    });

    if (tierRecord) {
      let decrypted = null;

      try {
        decrypted = CryptoJS.AES.decrypt(
          tierRecord.signature,
          loadEnvVariable('AFFILIATE_PASSWORD_KEY'),
        ).toString(CryptoJS.enc.Utf8);
      } catch (e) {
        // no code
      }

      if (decrypted !== tierRecord.toSignatureMessage()) {
        this.logger.error(
          `Hacking attempt! Found affiliate tier record with different signature message, skipping it. tier: ${
            tierRecord.tier
          }, fee: ${tierRecord.percent},  found signature: [${
            tierRecord.signature
          }], which should be: ${decrypted}, but it's ${tierRecord.toSignatureMessage()}`,
        );
        return 0;
      }

      return Number(tierRecord.percent || '0');
    } else {
      return 0;
    }
  }

  async clear() {
    await this.affiliateFeeRepository.clear();
    await this.affiliateRepository.clear();
    return true;
  }

  async setExplicityFeeForAffiliate(affiliate: string, percent: number) {
    try {
      let explicityFeeRecord = await this.explicityFeeRepository.findOne({
        where: {
          affiliate: affiliate,
        },
      });

      if (!explicityFeeRecord) {
        explicityFeeRecord = new AffiliateExplicityFee();
        explicityFeeRecord.affiliate = affiliate;
      }
      explicityFeeRecord.percent = percent.toString();

      explicityFeeRecord.signature = CryptoJS.AES.encrypt(
        explicityFeeRecord.toSignatureMessage(),
        loadEnvVariable('AFFILIATE_PASSWORD_KEY'),
      ).toString();

      return await this.explicityFeeRepository.save(explicityFeeRecord);
    } catch (err) {
      throw new BadRequestException('Something went wrong');
    }
  }

  async findAllExplicityFeeData() {
    return await this.explicityFeeRepository.find();
  }

  async setTierPercent(data: SetTierDto) {
    let record = await this.tierRepository.findOne({
      where: {
        tier: data.tier,
      },
    });

    if (!record) {
      record = new AffiliateTier();
    }
    const { tier, eligible_referee, eligible_volume, percent } = data;
    record.tier = tier;
    if (eligible_referee) {
      record.eligible_referee = eligible_referee;
    }
    if (eligible_volume) {
      record.eligible_volume = eligible_volume;
    }
    if (percent) {
      record.percent = percent;
    }

    record.signature = CryptoJS.AES.encrypt(
      record.toSignatureMessage(),
      loadEnvVariable('AFFILIATE_PASSWORD_KEY'),
    ).toString();

    return await this.tierRepository.save(record);
  }

  private getTierByReferee(refereeCount: number, tiersData: AffiliateTier[]) {
    tiersData.sort((a, b) => b.tier - a.tier);
    // const tierRecord = await this.tierRepository
    // .createQueryBuilder('affiliate_tier')
    // .where("affiliate_tier.eligible_referee <= :value", { value: refereeCount })
    // .orderBy('affiliate_tier.tier', "DESC")
    // .getOne();
    let tierRecord: AffiliateTier = new AffiliateTier();
    tierRecord.tier = TIER.Bronze;

    for (let i = 0; i < tiersData.length; i++) {
      if (tiersData[i].eligible_referee <= refereeCount) {
        tierRecord = tiersData[i];
        break;
      }
    }
    return tierRecord;
  }

  async countData() {
    const count_affiliates = await this.affiliateRepository.count();
    const count_affiliateFees = await this.affiliateFeeRepository.count();
    return {
      count_affiliates,
      count_affiliateFees,
    };
  }

  async getTotalPayouts() {
    try {
      const { sum } = await this.affiliateFeeRepository
        .createQueryBuilder('affiliate_fee')
        .select('SUM(CAST(affiliate_fee.fee AS DECIMAL(10,6)))', 'sum')
        .getRawOne();

      return sum || 0;
    } catch (err) {
      return 0;
    }
  }
}
