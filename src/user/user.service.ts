import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import ShortUniqueId from 'short-unique-id';

import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { getFromDto } from '../core/utils/repository';
import { SuccessResponse } from '../core/models/response.model';
import { AffiliateService } from '../affiliate/affiliate.service';
import { AffiliateDto } from '../affiliate/dto/affiliate.dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  private dictionary = [
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '0',
    'a',
    'b',
    'c',
    'd',
    'e',
    'f',
    'g',
    'h',
    'i',
    'j',
    'k',
    'l',
    'm',
    'n',
    'o',
    'p',
    'q',
    'r',
    's',
    't',
    'u',
    'v',
    'w',
    'x',
    'y',
    'z',
  ];

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly affiliateService: AffiliateService,
  ) {}

  async create(payload: CreateUserDto): Promise<User> {
    this.logger.debug(
      `Creating user: ${payload.address} with referralCode: ${payload.referralCode}`,
    );

    let user = await this.findByAddress(payload.address);
    if (user) return user;

    user = getFromDto<User>(payload, new User());
    user.address = payload.address.toLowerCase();

    // user = await this.createReferralIdIfNotExistsAndSave(user);
    user = await this.userRepository.save(user);

    if (payload.referralCode) {
      const referee = await this.findByReferralId(payload.referralCode);
      if (!referee) {
        this.logger.warn(
          `Referee not found for referralId: ${payload.referralCode}`,
        );
      } else {
        const dto = new AffiliateDto();
        dto.user = payload.address;
        dto.affiliate = referee.address;

        if (payload.address.toLowerCase() != referee.address.toLowerCase()) {
          await this.affiliateService.create(dto, false);
        }
      }
    }

    return user;
  }

  async createReferralIdIfNotExistsAndSave(user: User): Promise<User> {
    let times = 0;
    let lastError = null;

    if (user.referralId) {
      return user;
    }

    while (times < 3) {
      try {
        user.referralId = this.createReferralId();
        // referralId should be unique, if it's not, save is throwing an exception
        return await this.userRepository.save(user);
      } catch (e) {
        lastError = e;
        times++;
      }
    }
    throw lastError;
  }

  async findByAddress(address: string): Promise<User> {
    if (!address) {
      throw new BadRequestException('Not found user');
    }
    return await this.userRepository.findOne({
      where: {
        address: address.toLowerCase(),
      },
    });
  }

  async findByAddresses(addresses: string[]): Promise<User[]> {
    return await this.userRepository
      .createQueryBuilder('user')
      .orderBy('user.createdAt', 'DESC')
      .where('user.address IN (:...addresses)', {
        addresses,
      })
      .getMany();
  }

  async findById(id: string, findRemoved = false): Promise<User> {
    if (!id) {
      return null;
    }
    return this.userRepository.findOne({
      withDeleted: findRemoved,
      where: { id },
    });
  }
  async findByReferralId(referralId: string): Promise<User> {
    if (!referralId) {
      return null;
    }
    return this.userRepository
      .createQueryBuilder('user')
      .where('LOWER(user.referralId) = :referralId', {
        referralId: referralId.toLowerCase(),
      })
      .getOne();
  }

  async findAll(skip: number, take: number): Promise<User[]> {
    return await this.userRepository.find({
      take,
      skip,
    });
  }

  private async findAllWithoutReferralId(
    skip: number,
    take: number,
  ): Promise<[User[], number]> {
    return await this.userRepository
      .createQueryBuilder('user')
      .orderBy('user.createdAt', 'DESC')
      .where('user.referralId IS NULL')
      .skip(skip)
      .take(take)
      .getManyAndCount();
  }

  async remove(id: string): Promise<SuccessResponse> {
    const user = await this.findById(id);
    if (!user) {
      throw new BadRequestException('The requested user does not exist.');
    }
    await this.userRepository.softDelete({ id });
    return new SuccessResponse(true);
  }

  private createReferralId(): string {
    return new ShortUniqueId({ length: 10, dictionary: this.dictionary })();
  }

  async findAllUsers() {
    return await this.userRepository.find();
  }

  async clear() {
    return await this.userRepository.clear();
  }

  async saveUsers(users: CreateUserDto[]) {
    return await this.userRepository.save(users);
  }

  async countData() {
    return await this.userRepository.count();
  }

  async updatePoint(address: string, point: number) {
    try {
      const user = await this.findByAddress(address);
      if (!user) {
        return false;
      }

      user.point = point.toString();

      return await this.userRepository.save(user);
    } catch (err) {
      this.logger.warn(
        `Something went wrong while adding completed task - ${JSON.stringify(
          err,
        )}`,
      );
      return false;
    }
  }

  async resetPoint() {
    await this.userRepository
      .createQueryBuilder('user')
      .update(User)
      .set({
        point: '0',
      })
      .where('point != :value', { value: '0' })
      .execute();
  }
}
