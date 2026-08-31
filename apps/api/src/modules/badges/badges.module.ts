import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Badge, BadgeSchema, IssuedBadge, IssuedBadgeSchema } from './schemas/badge.schema';
import { BadgesService } from './badges.service';
import { BadgesController } from './badges.controller';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Badge.name, schema: BadgeSchema },
      { name: IssuedBadge.name, schema: IssuedBadgeSchema },
    ]),
  ],
  controllers: [BadgesController],
  providers: [BadgesService],
  exports: [BadgesService, MongooseModule],
})
export class BadgesModule {}
