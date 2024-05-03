import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './entities/task.entity';
import {
  DAY,
  HOUR,
  IS_MAINNET,
  MINUTE,
  WEEK,
} from 'src/core/constants/base.constant';
import { TaskProgress } from './entities/task-progress.entity';
import { TaskTier } from './entities/task-tier.entity';
import { TaskSeason } from './entities/task-season.entity';
import { GraphqlService } from 'src/graphql/graphql.service';
import { gql } from '@apollo/client/core';
import {
  formatDateForDB,
  getContinuousBitsSubarray,
  getContinuousDateSubarrays,
  sleep,
} from 'src/core/utils/base.util';
import { Affiliate } from 'src/affiliate/entities/affiliate.entity';
import { CreateTaskProgressDto } from './dto/create-task-progress.dto';
import { UserService } from 'src/user/user.service';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BoostNFTService } from './boost-nft.service';
import {
  checkTaskProgressSignature,
  checkTaskTierSignature,
  getSignature,
} from './utils';
import { POINT_PASSWORD_KEY } from 'src/core/constants/config.constant';
import { asyncMap } from '@apollo/client/utilities';

export type Bet = {
  market: string;
  round_position: string;
  user: string;
  whole_bet_amount: number;
  whole_payout_amount: number;
  amount: number;
  position: string;
  timeframe: number;
  end_time: number;
};
@Injectable()
export class PointService {
  private readonly logger = new Logger(PointService.name);
  leaderboardData: {
    user: string;
    point: number;
    boost: number;
  }[] = [];

  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(TaskProgress)
    private readonly taskProgressRepository: Repository<TaskProgress>,
    @InjectRepository(TaskTier)
    private readonly taskTierRepository: Repository<TaskTier>,
    @InjectRepository(TaskSeason)
    private readonly taskSeasonRepository: Repository<TaskSeason>,
    @InjectRepository(Affiliate)
    private readonly affiliateRepository: Repository<Affiliate>,
    private readonly userService: UserService,
    private readonly graphqlService: GraphqlService,
    private readonly boostService: BoostNFTService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  private async runProcessor() {
    try {
      const tasks = await this.taskRepository.find({
        where: {
          disabled: false,
        },
      });

      const taskSeason = await this.taskSeasonRepository.findOne({
        where: {
          isActive: true,
        },
      });

      if (!taskSeason) {
        return;
      }

      const task_tiers = await this.taskTierRepository.find();
      const end_time = Math.ceil(taskSeason?.end_time?.getTime() / 1000);
      const start_time =
        Math.ceil(taskSeason?.last_updated_time?.getTime() / 1000) ||
        Math.ceil(taskSeason?.start_time?.getTime() / 1000);

      const { bets, latest_time } = await this.getBetsData(
        start_time,
        end_time,
      );

      // Get unique users, remove duplicates.
      let users = bets.map((bet) => bet.user);
      users = users.filter((user, index) => users.indexOf(user) === index);

      let current_progresses: TaskProgress[] = [];
      if (users && users.length > 0) {
        current_progresses = await this.taskProgressRepository
          .createQueryBuilder('task_progress')
          .where('task_progress.user IN (:...users)', { users })
          .getMany();
      }

      let task_progresses: CreateTaskProgressDto[] = [];
      // Update task progress
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const task_tier = task_tiers.filter((item) => item.task == task.id);
        task_tier.sort((a, b) => b.tier - a.tier);
        const progresses =
          current_progresses?.filter((item) => item.task == task.id) || [];
        let task_progress_changes: CreateTaskProgressDto[] = [];

        if (!checkTaskTierSignature(task_tier)) {
          this.logger.error(
            `Hacking attempt! Found tier record with different signature message, skipping it. Task: ${task.id}`,
          );

          continue;
        }

        switch (task.id) {
          case 0: // playing streaks, need to think
            task_progress_changes = await this.handlePlayingStreaks(
              users,
              bets,
              task_tier,
              progresses,
            );
            break;
          case 1:
            task_progress_changes = await this.handleNoOfReferrals(
              task_tier,
              taskSeason.start_time,
              taskSeason.end_time,
            );
            break;
          case 2:
            task_progress_changes = await this.handleWinStreaks(
              users,
              bets,
              task_tier,
              progresses,
            );
            break;
          case 3:
            task_progress_changes = await this.handleVolumeOnPosition(
              users,
              bets,
              task_tier,
              'Bull',
              progresses,
            );
            break;
          case 4:
            task_progress_changes = await this.handleVolumeOnPosition(
              users,
              bets,
              task_tier,
              'Bear',
              progresses,
            );
            break;
          case 5:
            task_progress_changes = await this.handleTradeOnEachTimeframe(
              users,
              bets,
              task_tier,
              progresses,
            );
            break;
          case 6:
            task_progress_changes = await this.handleVolumeForTimeframe(
              users,
              bets,
              task_tier,
              0,
              progresses,
            );
            break;
          case 7:
            task_progress_changes = await this.handleVolumeForTimeframe(
              users,
              bets,
              task_tier,
              3,
              progresses,
            );
            break;
          case 8:
            task_progress_changes = await this.handleVolumeForTimeframe(
              users,
              bets,
              task_tier,
              1,
              progresses,
            );
            break;
          case 9:
            task_progress_changes = await this.handleTotalTradesOnMarket(
              users,
              bets,
              task_tier,
              'BTCUSD',
              progresses,
            );
            break;
          case 10:
            task_progress_changes = await this.handleTotalTradesOnMarket(
              users,
              bets,
              task_tier,
              'ETHUSD',
              progresses,
            );
            break;
          case 11:
            task_progress_changes = await this.handleTotalVolume(
              users,
              bets,
              task_tier,
              progresses,
            );
            break;
          case 12:
            task_progress_changes = await this.handleWinLongAndShortTrade(
              users,
              bets,
              task_tier,
              progresses,
            );
            break;
          case 13:
            task_progress_changes = await this.handleReferralVolume(
              users,
              bets,
              task_tier,
            );
            break;
          case 14:
            task_progress_changes = await this.handleCompletionist(
              users,
              task_tier,
              taskSeason.start_time,
              taskSeason.end_time,
            );
            break;
        }

        if (task_progress_changes && task_progress_changes.length > 0) {
          task_progresses = task_progresses.concat(task_progress_changes);
        }
      }

      task_progresses = task_progresses.map((item) => {
        const msg = `${item.user}-${item.task}-${item.tier}-${item.current_data}`;
        return {
          ...item,
          signature: getSignature(msg, POINT_PASSWORD_KEY),
        };
      });
      await this.taskProgressRepository.save(task_progresses);
      // update latest time of current task season
      taskSeason.last_updated_time = new Date(latest_time * 1000);
      await this.taskSeasonRepository.save(taskSeason);

      try {
        // prepare leaderboard data
        this.leaderboardData = await this.getLeaderboardData();
      } catch (e) {
        this.logger.warn(
          `Error while calculating leaderboard - ${JSON.stringify(e)}`,
        );
      }

      try {
        // update user points
        const currentTime = Date.now();
        if (currentTime > taskSeason.end_time.getTime()) {
          await this.updateUserPoints();

          taskSeason.isActive = false;
          await this.taskSeasonRepository.save(taskSeason);
        }
      } catch (e) {
        this.logger.warn(
          `Error while storing user points - ${JSON.stringify(e)}`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Error while calculating points - ${JSON.stringify(err)}`,
      );
    }
  }

  private async getBetsData(start_time: number, end_time: number) {
    const bets: Bet[] = [];
    let errorCount = 0;

    let latest_time = start_time;
    while (1) {
      const graphqlQuery = IS_MAINNET
        ? gql`
            query fetchBetsSince {
              bets (
                first:1000 
                where:{
                  isReverted:false, 
                  round_: {closePrice_not: null, lockPrice_not: null, endAt_gt: ${latest_time}, endAt_lte: ${end_time}}
                }
                orderBy:round__endAt
              ) {
                market {
                  pairName
                }
                round {
                  endAt
                  position
                }
                user {
                  address
                  wholeBetAmount
                  wholePayoutAmount
                }
                amount
                position
                timeframeId
              }
            }`
        : gql`
            query fetchBetsSince {
              bets (
                first:1000 
                where:{
                  isReverted:false, 
                  round_: {closePrice_not: null, lockPrice_not: null, endAt_gt: ${latest_time}, endAt_lte: ${end_time}}
                  market_: {symbol: "USDC"}
                }
                orderBy:round__endAt
              ) {
                market {
                  pairName
                }
                round {
                  endAt
                  position
                }
                user {
                  address
                  wholeBetAmount
                  wholePayoutAmount
                }
                amount
                position
                timeframeId
              }
            }`;

      try {
        const data = await this.graphqlService.fetchQuery(graphqlQuery);

        if (data) {
          for (const bet of data.bets) {
            bets.push({
              market: bet.market.pairName,
              user: bet.user.address,
              amount: Number(bet.amount),
              round_position: bet.round.position,
              whole_bet_amount: Number(bet.user.wholeBetAmount),
              whole_payout_amount: Number(bet.user.wholePayoutAmount),
              position: bet.position,
              timeframe: Number(bet.timeframeId),
              end_time: Number(bet.round.endAt),
            });

            if (latest_time < Number(bet.round.endAt)) {
              latest_time = Number(bet.round.endAt);
            }
          }
          if (data.bets.length < 1000) {
            break;
          }
        } else {
          break;
        }
        await sleep(1000);
      } catch (err) {
        this.logger.warn(
          `Failed to fetch data from subgraph - ${JSON.stringify(err)}`,
        );
        errorCount++;
        if (errorCount > 10) {
          break;
        }
      }
    }

    return { bets, latest_time };
  }

  private async handlePlayingStreaks(
    users: string[],
    bets: Bet[],
    task_tier: TaskTier[],
    current_progresses: TaskProgress[],
  ) {
    const task_progresses: CreateTaskProgressDto[] = [];

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const timestamps = bets
        .filter((bet) => bet.user == user)
        // TODO this should be .toDateString in production
        // .map((bet) => new Date(bet.end_time * 1000).toDateString());
        .map((bet) => {
          const x = new Date(bet.end_time * 1000);
          x.setSeconds(0, 0);
          const minute = x.getUTCMinutes();
          x.setMinutes(minute - (minute % 5));
          return x.toISOString();
        });
      if (!timestamps || timestamps.length == 0) continue;

      if (
        !checkTaskProgressSignature(
          current_progresses?.find((item) => item.user == user),
        )
      ) {
        this.logger.error(
          `Hacking attempt! Found task progress record with different signature message, skipping it. Task: ${task_tier[0].task}, User: ${user}`,
        );
        continue;
      }

      const current_data = JSON.parse(
        current_progresses?.find((item) => item.user == user)?.current_data ||
          '{}',
      );
      let { longest_length, current_length, current_date } = current_data;

      const DAY = 5 * MINUTE; // TODO this should be removed on prod. this is just testing purpose.
      const continuousDateSubarrays = getContinuousDateSubarrays(timestamps);
      const lengths = continuousDateSubarrays.map((sub_array) => {
        const timeDifference =
          new Date(sub_array[sub_array.length - 1]).getTime() -
          new Date(sub_array[0]).getTime();
        return timeDifference / DAY + 1;
      });

      const timeDifference =
        new Date(timestamps[0]).getTime() -
        new Date(current_date || 0).getTime();
      if (timeDifference < DAY) {
        lengths[0] += current_length - 1;
      } else if (timeDifference === DAY) {
        lengths[0] += current_length;
      }

      const max_length = Math.max(...lengths);

      if (max_length >= Number(longest_length || 0)) {
        longest_length = max_length;
      }

      current_date = timestamps[timestamps.length - 1];
      current_length = lengths[lengths.length - 1];

      const tier = task_tier.find((a) => a.criteria <= longest_length);
      task_progresses.push({
        id: `${user}-${task_tier[0].task}`,
        task: task_tier[0].task,
        user: user,
        tier: tier ? tier.tier : -1,
        current_data: JSON.stringify({
          longest_length,
          current_date,
          current_length,
        }),
      });
    }

    return task_progresses;
  }

  private async handleNoOfReferrals(
    task_tier: TaskTier[],
    start_time: Date,
    end_time: Date,
  ) {
    const affiliates = await this.affiliateRepository.query(
      `SELECT affiliate, COUNT(user) as user_count
      FROM affiliate
      WHERE "createdAt" > '${formatDateForDB(
        start_time,
      )}' AND "createdAt" < '${formatDateForDB(end_time)}'
      GROUP BY affiliate;`,
    );

    const task_progresses: CreateTaskProgressDto[] = [];
    for (let i = 0; i < affiliates?.length; i++) {
      const record = affiliates?.[i];
      const tier = task_tier.find((a) => a.criteria <= record.user_count);
      task_progresses.push({
        id: `${record.affiliate}-${task_tier[0].task}`,
        task: task_tier[0].task,
        user: record.affiliate,
        tier: tier ? tier.tier : -1,
      });
    }

    return task_progresses;
  }

  private async handleTotalVolume(
    users: string[],
    bets: Bet[],
    task_tier: TaskTier[],
    current_progresses: TaskProgress[],
  ) {
    if (!users || users.length == 0) return;
    const records: CreateTaskProgressDto[] = [];

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const user_bets = bets?.filter((bet) => bet.user == user);

      if (
        !checkTaskProgressSignature(
          current_progresses?.find((item) => item.user == user),
        )
      ) {
        this.logger.error(
          `Hacking attempt! Found task progress record with different signature message, skipping it. Task: ${task_tier[0].task}, User: ${user}`,
        );
        continue;
      }

      const volume = user_bets?.reduce((a, b) => a + Number(b.amount), 0);
      const totalVolume =
        volume +
        Number(
          current_progresses?.find((item) => item.user == user)?.current_data ||
            0,
        );
      const tier = task_tier.find((a) => a.criteria <= totalVolume);

      records.push({
        id: `${user}-${task_tier[0].task}`,
        task: task_tier[0].task,
        user,
        tier: tier ? tier.tier : -1,
        current_data: totalVolume.toString(),
      });
    }

    return records;
  }

  private async handleTradeOnEachTimeframe(
    users: string[],
    bets: Bet[],
    task_tier: TaskTier[],
    current_progresses: TaskProgress[],
  ) {
    if (!users || users.length == 0) return;

    const records: CreateTaskProgressDto[] = [];
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const user_bets = bets.filter((bet) => bet.user == user);
      const progresses = current_progresses?.find((item) => item.user == user);

      if (!checkTaskProgressSignature(progresses)) {
        this.logger.error(
          `Hacking attempt! Found task progress record with different signature message, skipping it. Task: ${task_tier[0].task}, User: ${user}`,
        );
        continue;
      }

      const current_trades = progresses?.current_data?.split(',') || [];

      if (
        user_bets?.find((bet) => bet.timeframe === 0) &&
        !current_trades?.includes('0')
      ) {
        current_trades.push('0');
      } else if (
        user_bets?.find((bet) => bet.timeframe === 1) &&
        !current_trades?.includes('1')
      ) {
        current_trades.push('1');
      } else if (
        user_bets?.find((bet) => bet.timeframe === 3) &&
        !current_trades?.includes('3')
      ) {
        current_trades.push('3');
      }

      const bet_1m = current_trades.includes('0');
      const bet_5m = current_trades.includes('1');
      const bet_3m = current_trades.includes('3');

      let tier: TaskTier;
      if (bet_1m && bet_3m && bet_5m) {
        tier = task_tier[0];
      } else if (bet_1m && bet_3m) {
        tier = task_tier[1];
      } else if (bet_1m) {
        tier = task_tier[2];
      }

      records.push({
        id: `${user}-${task_tier[0].task}`,
        task: task_tier[0].task,
        user,
        tier: tier ? tier.tier : -1,
        current_data: current_trades?.join(','),
      });
    }

    return records;
  }

  private async handleVolumeForTimeframe(
    users: string[],
    bets: Bet[],
    task_tier: TaskTier[],
    timeframeId: number,
    current_progresses: TaskProgress[],
  ) {
    const records: CreateTaskProgressDto[] = [];
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const user_bets = bets?.filter(
        (bet) => bet.user == user && bet.timeframe == timeframeId,
      );

      if (
        !checkTaskProgressSignature(
          current_progresses?.find((item) => item.user == user),
        )
      ) {
        this.logger.error(
          `Hacking attempt! Found task progress record with different signature message, skipping it. Task: ${task_tier[0].task}, User: ${user}`,
        );
        continue;
      }

      const volume = user_bets?.reduce((a, b) => a + Number(b.amount), 0) || 0;
      const current_volume = Number(
        current_progresses.find((item) => item.user == user)?.current_data || 0,
      );
      const tier = task_tier.find((a) => a.criteria <= volume + current_volume);

      records.push({
        id: `${user}-${task_tier[0]?.task}`,
        task: task_tier[0]?.task,
        user,
        tier: tier ? tier.tier : -1,
        current_data: (current_volume + volume).toString(),
      });
    }

    return records;
  }

  private async handleTotalTradesOnMarket(
    users: string[],
    bets: Bet[],
    task_tier: TaskTier[],
    market: string,
    current_progresses: TaskProgress[],
  ) {
    if (!users || users.length == 0) return;

    const records: CreateTaskProgressDto[] = [];
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const user_bets = bets?.filter(
        (bet) => bet.user == user && bet.market == market,
      );

      if (
        !checkTaskProgressSignature(
          current_progresses?.find((item) => item.user == user),
        )
      ) {
        this.logger.error(
          `Hacking attempt! Found task progress record with different signature message, skipping it. Task: ${task_tier[0].task}, User: ${user}`,
        );
        continue;
      }

      const count = user_bets?.length || 0;
      const current_count = Number(
        current_progresses.find((item) => item.user == user)?.current_data || 0,
      );
      const tier = task_tier.find((a) => a.criteria <= count + current_count);

      records.push({
        id: `${user}-${task_tier[0]?.task}`,
        task: task_tier[0]?.task,
        user,
        tier: tier ? tier.tier : -1,
        current_data: (current_count + count).toString(),
      });
    }

    return records;
  }

  private async handleVolumeOnPosition(
    users: string[],
    bets: Bet[],
    task_tier: TaskTier[],
    position: string,
    current_progresses: TaskProgress[],
  ) {
    if (!users || users.length == 0) return;

    const records: CreateTaskProgressDto[] = [];
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const user_bets = bets?.filter(
        (bet) => bet.user == user && bet.position == position,
      );

      if (
        !checkTaskProgressSignature(
          current_progresses?.find((item) => item.user == user),
        )
      ) {
        this.logger.error(
          `Hacking attempt! Found task progress record with different signature message, skipping it. Task: ${task_tier[0].task}, User: ${user}`,
        );
        continue;
      }

      const volume = user_bets?.reduce((a, b) => a + Number(b.amount), 0) || 0;
      const current_volume = Number(
        current_progresses.find((item) => item.user == user)?.current_data || 0,
      );
      const tier = task_tier.find((a) => a.criteria <= volume + current_volume);

      records.push({
        id: `${user}-${task_tier[0]?.task}`,
        task: task_tier[0]?.task,
        user,
        tier: tier ? tier.tier : -1,
        current_data: (current_volume + volume).toString(),
      });
    }

    return records;
  }

  private async handleWinLongAndShortTrade(
    users: string[],
    bets: Bet[],
    task_tier: TaskTier[],
    current_progresses: TaskProgress[],
  ) {
    if (!users || users.length == 0) return;

    const records: CreateTaskProgressDto[] = [];
    for (let i = 0; i < users.length; i++) {
      const user = users[i];

      if (
        !checkTaskProgressSignature(
          current_progresses?.find((item) => item.user == user),
        )
      ) {
        this.logger.error(
          `Hacking attempt! Found task progress record with different signature message, skipping it. Task: ${task_tier[0].task}, User: ${user}`,
        );
        continue;
      }

      // Get win on long
      const win_bets_long = bets?.filter(
        (bet) =>
          bet.user == user &&
          bet.position == 'Bull' &&
          bet.position == bet.round_position,
      );
      // Get win on short
      const win_bets_short = bets?.filter(
        (bet) =>
          bet.user == user &&
          bet.position == 'Bear' &&
          bet.position == bet.round_position,
      );

      const current_data = JSON.parse(
        current_progresses?.find((item) => item.user == user)?.current_data ||
          '{}',
      );

      const long_count =
        Number(current_data?.long || 0) + (win_bets_long?.length || 0);
      const short_count =
        Number(current_data?.short || 0) + (win_bets_short?.length || 0);

      const count = Math.min(long_count, short_count);
      const tier = task_tier.find((a) => a.criteria <= count);

      records.push({
        id: `${user}-${task_tier[0]?.task}`,
        task: task_tier[0]?.task,
        user,
        tier: tier ? tier.tier : -1,
        current_data: JSON.stringify({
          long: long_count,
          short: short_count,
        }),
      });
    }

    return records;
  }

  private async handleReferralVolume(
    users: string[],
    bets: Bet[],
    task_tier: TaskTier[],
  ) {
    const affiliateData =
      users && users.length > 0
        ? await this.affiliateRepository
            .createQueryBuilder('affiliate')
            .where('affiliate.user IN (:...users)', { users })
            .getMany()
        : [];

    let affiliates = affiliateData?.map((item) => item.affiliate);
    if (!affiliates || affiliates.length == 0) return;

    affiliates = affiliates.filter(
      (item, index) => affiliates.indexOf(item) == index,
    );

    const current_progresses: TaskProgress[] = await this.taskProgressRepository
      .createQueryBuilder('task_progress')
      .where('task_progress.user IN (:...users)', { users: affiliates })
      .andWhere('task_progress.task = :task', { task: task_tier[0]?.task })
      .getMany();

    const task_progresses: CreateTaskProgressDto[] = [];
    for (let i = 0; i < affiliates.length; i++) {
      const users_for_affiliate = affiliateData
        ?.filter((item) => item.affiliate == affiliates[i])
        ?.map((item) => item.user);
      const user_bets = bets?.filter((bet) =>
        users_for_affiliate?.includes(bet.user),
      );

      if (
        !checkTaskProgressSignature(
          current_progresses?.find((item) => item.user == affiliates[i]),
        )
      ) {
        this.logger.error(
          `Hacking attempt! Found task progress record with different signature message, skipping it. Task: ${task_tier[0].task}, User: ${affiliates[i]}`,
        );
        continue;
      }

      let volume = user_bets?.reduce((a, b) => a + b.amount, 0);
      const current_volume = Number(
        current_progresses.find((item) => item.user == affiliates[i])
          ?.current_data || 0,
      );
      volume += current_volume;

      const tier = task_tier.find((a) => a.criteria <= volume);
      task_progresses.push({
        id: `${affiliates[i]}-${task_tier[0]?.task}`,
        task: task_tier[0]?.task,
        user: affiliates[i],
        tier: tier ? tier.tier : -1,
        current_data: volume.toString(),
      });
    }

    return task_progresses;
  }

  private async handleCompletionist(
    users: string[],
    task_tier: TaskTier[],
    start_time: Date,
    end_time: Date,
  ) {
    let affiliateData: Affiliate[] = [];

    if (users && users.length > 0) {
      affiliateData = await this.affiliateRepository
        .createQueryBuilder('affiliate')
        .where('affiliate.user IN (:...users)', { users })
        .getMany();
    }

    const new_affiliates = await this.affiliateRepository.query(
      `SELECT affiliate
      FROM affiliate
      WHERE "createdAt" > '${formatDateForDB(
        start_time,
      )}' AND "createdAt" < '${formatDateForDB(end_time)}'
      GROUP BY affiliate;`,
    );

    let affiliates = affiliateData
      ?.map((item) => item.affiliate)
      .concat(new_affiliates?.map((item) => item.affiliate));
    affiliates = affiliates?.filter(
      (item, index) => affiliates?.indexOf(item) == index,
    );

    let whole_users = [...users, ...affiliates];
    whole_users = whole_users.filter(
      (item, index) => whole_users.indexOf(item) == index,
    );

    if (!whole_users || whole_users.length == 0) return;

    const completed_tasks = await this.taskProgressRepository
      .createQueryBuilder('task_progress')
      .where('task_progress.user IN (:...users)', { users: whole_users })
      .andWhere('task_progress.tier = :tier', { tier: 2 })
      .getMany();

    const task_progresses: CreateTaskProgressDto[] = [];
    for (let i = 0; i < whole_users.length; i++) {
      const user = whole_users[i];

      const count =
        completed_tasks.filter((item) => item.user == user)?.length || 0;

      const tier = task_tier.find((a) => a.criteria <= count);

      task_progresses.push({
        id: `${user}-${task_tier[0]?.task}`,
        task: task_tier[0]?.task,
        user: user,
        tier: tier ? tier.tier : -1,
      });
    }

    return task_progresses;
  }

  private _calcPointsForUser(
    user: string,
    tasks: Task[],
    task_progresses: TaskProgress[],
    tiers: TaskTier[],
  ) {
    user = user.toLowerCase();

    let points = 0;
    for (let j = 0; j < tasks.length; j++) {
      const current_tier = task_progresses.find(
        (item) => item.user == user && item.task == tasks[j].id,
      );

      if (current_tier && current_tier.tier != -1) {
        for (let k = 0; k <= current_tier.tier; k++) {
          const point =
            tiers.find((item) => item.task == tasks[j].id && item.tier == k)
              ?.point || 0;
          points += point;
        }
      }
    }

    return points;
  }

  private async updateUserPoints() {
    const task_progresses = await this.taskProgressRepository.find();
    const _users = task_progresses.map((item) => item.user);
    const users = _users.filter(
      (item, index) => _users.indexOf(item) === index,
    );

    if (users.length == 0) return;

    const boosts = await this.boostService.getBoosts(users);

    const db_users = await this.userService.findByAddresses(users);

    const tasks = await this.taskRepository.find({
      where: {
        disabled: false,
      },
    });
    const tiers = await this.taskTierRepository.find();

    const updated_users: CreateUserDto[] = [];
    for (let i = 0; i < db_users?.length; i++) {
      const points = this._calcPointsForUser(
        db_users[i].address,
        tasks,
        task_progresses,
        tiers,
      );
      if (points > 0) {
        const boost = this.boostService.getBoostPoint(
          boosts.find(
            (item) =>
              item.user.toLowerCase() == db_users[i].address.toLowerCase(),
          ),
        );
        updated_users.push({
          ...db_users[i],
          point: (boost * points).toString(),
        });
      }
    }

    if (updated_users.length > 0) {
      await this.userService.saveUsers(updated_users);
    }
  }

  private async handleWinStreaks(
    users: string[],
    bets: Bet[],
    task_tier: TaskTier[],
    current_progresses: TaskProgress[],
  ) {
    const task_progresses: CreateTaskProgressDto[] = [];

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const win_lose_bits = bets
        .filter((bet) => bet.user == user)
        .map((bet) => (bet.position == bet.round_position ? 1 : 0));
      if (!win_lose_bits || win_lose_bits.length == 0) continue;

      if (
        !checkTaskProgressSignature(
          current_progresses?.find((item) => item.user == user),
        )
      ) {
        this.logger.error(
          `Hacking attempt! Found task progress record with different signature message, skipping it. Task: ${task_tier[0].task}, User: ${user}`,
        );
        continue;
      }

      const current_data = JSON.parse(
        current_progresses?.find((item) => item.user == user)?.current_data ||
          '{}',
      );
      let { longest_length, current_length } = current_data;

      const continuousDateSubarrays = getContinuousBitsSubarray(win_lose_bits);
      const lengths = continuousDateSubarrays
        .filter((item) => item[0] === 1)
        ?.map((sub_array) => sub_array.length);

      if (win_lose_bits[0] === 1) {
        lengths[0] += current_length || 0;
      }

      const max_length = Math.max(...lengths);

      if (max_length >= Number(longest_length || 0)) {
        longest_length = max_length;
      }

      current_length =
        win_lose_bits[win_lose_bits.length - 1] === 1
          ? lengths[lengths.length - 1]
          : 0;

      const tier = task_tier.find((a) => a.criteria <= longest_length);
      task_progresses.push({
        id: `${user}-${task_tier[0].task}`,
        task: task_tier[0].task,
        user: user,
        tier: tier ? tier.tier : -1,
        current_data: JSON.stringify({
          longest_length,
          current_length,
        }),
      });
    }

    return task_progresses;
  }

  async getTasks() {
    return await this.taskRepository.find();
  }

  async getTaskProgresses(user: string) {
    if (!user) {
      throw new BadRequestException('Not found user');
    }
    return await this.taskProgressRepository.find({
      where: {
        user: user.toLowerCase(),
      },
    });
  }

  async getTaskTiers() {
    return await this.taskTierRepository.find();
  }

  async getCurrentSeason() {
    return await this.taskSeasonRepository.findOne({
      where: {
        isActive: true,
      },
    });
  }

  async getUserPoint(user_address: string) {
    if (!user_address) {
      return new BadRequestException('User not found');
    }

    const user = await this.userService.findByAddress(user_address);
    if (!user) {
      return new BadRequestException('User not found');
    }

    const claimable_point = Number(user.point?.replace(',', ''));

    const current_point = await this.getCurrentUserPoint(user_address);

    const rank = this.leaderboardData.findIndex(
      (item) => item.point <= current_point,
    );

    const completed_tasks = await this.taskProgressRepository.find({
      where: {
        user: user_address.toLowerCase(),
        tier: 2,
      },
    });

    return {
      claimable_point,
      current_point,
      rank: rank + 1,
      completed_tasks: completed_tasks.map((item) => item.task),
    };
  }

  async setNewSeason(start_time: string, end_time?: string, reset?: boolean) {
    try {
      // Save user points to claim in next round
      if (reset) {
        await this.userService.resetPoint();
        // Emptry task progress
        await this.taskProgressRepository.clear();
      }

      // isActive false for existing seasons
      await this.taskSeasonRepository
        .createQueryBuilder('task_season')
        .update(TaskSeason)
        .set({
          isActive: false,
        })
        .execute();

      const start = new Date(start_time);
      const end = end_time
        ? new Date(end_time)
        : new Date(start.getTime() + 21 * DAY);

      return await this.taskSeasonRepository.save({
        start_time: start,
        end_time: end,
        isActive: true,
      });
    } catch (err) {
      this.logger.warn(
        `Error while setting new season - ${JSON.stringify(err)}`,
      );
      return false;
    }
  }

  private async getCurrentUserPoint(address: string) {
    const tasks = await this.taskRepository.find();
    const task_progresses = await this.taskProgressRepository.find({
      where: {
        user: address.toLowerCase(),
      },
    });
    const tiers = await this.taskTierRepository.find();

    const points = this._calcPointsForUser(
      address,
      tasks,
      task_progresses,
      tiers,
    );

    return points;
  }

  async leaderboard(skip: number, take: number, addresslike?: string) {
    const users =
      (addresslike
        ? this.leaderboardData?.filter((item) =>
            item.user.includes(addresslike.toLowerCase()),
          )
        : this.leaderboardData) || [];
    const data = users?.slice(Number(skip), Number(skip) + Number(take));
    const length = users?.length;

    return {
      data,
      length,
    };
  }

  private async getLeaderboardData() {
    const task_progresses = await this.taskProgressRepository.find();
    const _users = task_progresses.map((item) => item.user);
    const users = _users.filter(
      (item, index) => _users.indexOf(item) === index,
    );

    if (users.length == 0) return;

    const boosts = await this.boostService.getBoosts(users);

    const tasks = await this.taskRepository.find({
      where: {
        disabled: false,
      },
    });
    const tiers = await this.taskTierRepository.find();

    const result: {
      user: string;
      point: number;
      boost: number;
    }[] = [];

    for (let i = 0; i < users?.length; i++) {
      const points = this._calcPointsForUser(
        users[i],
        tasks,
        task_progresses,
        tiers,
      );
      if (points > 0) {
        const boost = this.boostService.getBoostPoint(
          boosts.find(
            (item) => item.user.toLowerCase() == users[i].toLowerCase(),
          ),
        );
        result.push({
          user: users[i],
          point: points,
          boost,
        });
      }
    }

    result.sort((a, b) => b.point - a.point);

    return result.map((item, index) => ({
      ...item,
      rank: index + 1,
    }));
  }

  async clear() {
    await this.taskProgressRepository.clear();
    await this.taskSeasonRepository.clear();
    return await this.setNewSeason(new Date().toUTCString());
  }
}
