import { Module } from '@nestjs/common';
import {
  DatabaseModule,
  CacheModule,
  QueueModule,
  AuthenticationModule,
  HealthModule,
  CommunitiesModule,
} from './core/modules.js';
@Module({
  imports: [
    DatabaseModule,
    CacheModule,
    QueueModule,
    AuthenticationModule,
    HealthModule,
    CommunitiesModule,
  ],
})
export class AppModule {}
