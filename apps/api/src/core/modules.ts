import { Module, Global } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { CacheService } from '../cache/cache.service.js';
import { QueueService } from '../queue/queue.service.js';
import { AuthService } from '../auth/auth.service.js';
import { AuthController } from '../auth/auth.controller.js';
import { HealthController } from '../health/health.controller.js';
import { CommunitiesController } from '../communities/communities.controller.js';
@Global()
@Module({ providers: [DatabaseService], exports: [DatabaseService] })
export class DatabaseModule {}
@Global()
@Module({ providers: [CacheService], exports: [CacheService] })
export class CacheModule {}
@Global()
@Module({ providers: [QueueService], exports: [QueueService] })
export class QueueModule {}
@Module({ providers: [AuthService], controllers: [AuthController] })
export class AuthenticationModule {}
@Module({ controllers: [HealthController] })
export class HealthModule {}
@Module({ controllers: [CommunitiesController] })
export class CommunitiesModule {}
