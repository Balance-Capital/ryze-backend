import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Affiliate } from './entities/affiliate.entity';
import { parse } from 'papaparse';
import { UserService } from 'src/user/user.service';
import { AffiliateDto } from './dto/affiliate.dto';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { User } from 'src/user/entities/user.entity';
import { sleep, sleepUntilNextMinute } from 'src/core/utils/base.util';

@Injectable()
export class AffiliateCSVService {
  private readonly logger = new Logger(AffiliateCSVService.name);

  constructor(
    @InjectRepository(Affiliate)
    private readonly affiliateRepository: Repository<Affiliate>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly userService: UserService,
  ) {}

  parseCSV(file: Express.Multer.File) {
    const data = file.buffer.toString('utf-8');
    const that = this;

    return new Promise((resolve, reject) => {
      try {
        parse(data, {
          header: true,
          worker: true,
          async complete(results, file) {
            const csvData: string[] = results.data as string[];
            resolve(true);
            await that.handleCSVData(csvData);
          },
        });
      } catch (err) {
        this.logger.warn(`Failed to parse excel file - ${JSON.stringify(err)}`);
        reject(false);
      }
    });
  }

  async handleCSV(file: Express.Multer.File) {
    const result = await this.parseCSV(file).then((value: boolean) => value);
    return result;
  }

  private async handleCSVData(csvData: string[]) {
    // Date, Wallet address, Email address, Ref Code, Ref ID
    // 1. Save users
    try {
      await this.handleCSVForUsers(csvData);
    } catch (err) {
      console.log('error: ', err, this);
      this.logger.error(
        `Error occured while saving user data - ${JSON.stringify(err)}`,
      );
    }
    // 2. Save affiliates
    try {
      await this.handleCSVForAffiliates(csvData);
    } catch (err) {
      this.logger.error(
        `Error occured while saving user data - ${JSON.stringify(err)}`,
      );
    }

    return 'Done';
  }

  private isReferralIdValid(referralid: string): boolean {
    if (!referralid) return false;
    if (referralid.trim().includes(' ')) return false;

    const REGEX = /^[a-zA-Z0-9_\-!?!@#$%^&*~\x20-\x7E]+$/;
    return REGEX.test(referralid.trim());
  }

  private async handleCSVForUsers(csvData: string[]) {
    let users: CreateUserDto[] = [];
    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      let address: string;
      let referralId: string;

      await Promise.all(
        Object.entries(row).map(async ([key, value], index: number) => {
          try {
            if (index === 1) {
              // wallet address
              let _address = value.replace(/"/g, '').trim();
              _address = _address.toLowerCase(); // Convert to lowercase
              if (_address.startsWith('0x') && _address.length === 42) {
                address = _address;
              }
            } else if (index === 4) {
              // Ref id.
              if (
                value &&
                value.trim() &&
                this.isReferralIdValid(value.trim())
              ) {
                const refId = value.replace(/"/g, '');
                referralId = refId.trim();
              }
            }
          } catch (err) {
            this.logger.error(
              `Something went wrong in processing file - ${JSON.stringify(
                err,
              )}`,
            );
          }
        }),
      );

      if (address) {
        const entity = new CreateUserDto();
        entity.address = address;
        if (this.isReferralIdValid(referralId)) {
          entity.referralId = referralId;
        }

        const index = users.findIndex((user) => user.address == address);
        if (index != -1) {
          // already exist
          if (this.isReferralIdValid(referralId)) {
            users[index] = {
              address,
              referralId,
            };
          }
        } else {
          users.push(entity);
        }
      }

      if (users.length >= 1000) {
        try {
          await this.saveUsers(users);
        } catch (err) {
          this.logger.error(
            `Error in saving addresses - ${JSON.stringify(err)}`,
          );
        }
        users = [];
      }
    }

    if (users.length > 0) {
      try {
        await this.saveUsers(users);
      } catch (err) {
        this.logger.error(`Error in saving address - ${JSON.stringify(err)}`);
      }
    }
  }

  private async saveUsers(users: CreateUserDto[]) {
    const records = await this.userRepository
      .createQueryBuilder('user')
      .where('user.address IN (:...addresses)', {
        addresses: users.map((user) => user.address),
      })
      .getMany();

    if (records && records.length > 0) {
      users = users.filter(
        (user) => !records.find((record) => record.address == user.address),
      );
    }

    if (users && users.length > 0) {
      return await this.userService.saveUsers(users);
    } else {
      return false;
    }
  }

  private async handleCSVForAffiliates(csvData: string[]) {
    let affiliates: AffiliateDto[] = [];
    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      let address: string;
      let affiliate: string;

      await Promise.all(
        Object.entries(row).map(async ([key, value], index: number) => {
          try {
            if (index === 1) {
              // wallet address
              let _address = value.replace(/"/g, '').trim();
              _address = _address.toLowerCase(); // Convert to lowercase
              if (_address.startsWith('0x') && _address.length === 42) {
                address = _address;
              }
            } else if (index === 3) {
              // Ref code. we will get affiliate address from this code and user table.
              if (value && value.trim()) {
                let refCode = value.replace(/"/g, '');
                refCode = refCode.trim();
                const user = await this.userService.findByReferralId(refCode);
                if (user) {
                  affiliate = user.address;
                }
              }
            }
          } catch (err) {
            this.logger.error(
              `Something went wrong in processing file - ${JSON.stringify(
                err,
              )}`,
            );
          }
        }),
      );

      if (address && affiliate) {
        if (!affiliates.map((item) => item.user).includes(address)) {
          affiliates.push({
            user: address,
            affiliate,
          });
        }
      }
      if (affiliates.length >= 1000) {
        try {
          await this.saveAffiliates(affiliates);
        } catch (err) {
          this.logger.error(
            `Error in saving affiliates - ${JSON.stringify(err)}`,
          );
        }
        affiliates = [];
      }
    }

    if (affiliates.length > 0) {
      try {
        await this.saveAffiliates(affiliates);
      } catch (err) {
        this.logger.error(
          `Error in saving affiliates - ${JSON.stringify(err)}`,
        );
      }
    }
  }

  private async saveAffiliates(affiliates: AffiliateDto[]) {
    const records = await this.affiliateRepository
      .createQueryBuilder('affiliate')
      .where('affiliate.user IN (:...addresses)', {
        addresses: affiliates.map((user) => user.user),
      })
      .getMany();

    if (records && records.length > 0) {
      affiliates = affiliates.filter(
        (user) => !records.find((record) => record.user == user.user),
      );
    }

    if (affiliates && affiliates.length > 0) {
      return await this.affiliateRepository.save(affiliates);
    } else {
      return false;
    }
  }
}
