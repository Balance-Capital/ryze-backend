import * as postgresConnectionStringParser from 'pg-connection-string';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';
import { loadEnvVariable } from './core/utils/base.util';

dotenv.config();

const connectionOptions = postgresConnectionStringParser.parse(
  loadEnvVariable('DATABASE_URL'),
);

// Check typeORM documentation for more information.
export const connectionSource = new DataSource({
  migrationsTableName: 'migrations',
  type: 'postgres',
  host: connectionOptions.host,
  port: Number(connectionOptions.port),
  username: connectionOptions.user,
  password: connectionOptions.password,
  database: connectionOptions.database,
  entities: [__dirname + '/**/*.entity{.ts,.js}'],

  // We are using migrations, synchronize should be set to false.
  synchronize: false,
  ssl: {
    require: true,
    rejectUnauthorized: false,
  },
  // Run migrations automatically,
  // you can disable this if you prefer running migration manually.
  migrationsRun: true,
  logging: false,
  logger: 'file',
  migrations: ['dist/migrations/*.js'],
} as DataSourceOptions);
