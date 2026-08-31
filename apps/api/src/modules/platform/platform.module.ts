import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Comment,
  CommentSchema,
  CourseBackup,
  CourseBackupSchema,
  CustomField,
  CustomFieldSchema,
  DataRequest,
  DataRequestSchema,
  ScheduledTask,
  ScheduledTaskSchema,
  Tag,
  TagSchema,
  WebServiceToken,
  WebServiceTokenSchema,
  Webhook,
  WebhookSchema,
} from './schemas/platform.schema';
import { CustomFieldsService } from './custom-fields.service';
import { TagsService } from './tags.service';
import { WebServicesService } from './web-services.service';
import { GdprService } from './gdpr.service';
import { BackupService } from './backup.service';
import { AnalyticsService } from './analytics.service';
import { ScheduledTasksService } from './scheduled-tasks.service';
import {
  AnalyticsController,
  BackupController,
  CustomFieldsController,
  GdprController,
  TagsController,
  WebServicesController,
} from './platform.controller';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CustomField.name, schema: CustomFieldSchema },
      { name: Tag.name, schema: TagSchema },
      { name: Comment.name, schema: CommentSchema },
      { name: WebServiceToken.name, schema: WebServiceTokenSchema },
      { name: Webhook.name, schema: WebhookSchema },
      { name: DataRequest.name, schema: DataRequestSchema },
      { name: ScheduledTask.name, schema: ScheduledTaskSchema },
      { name: CourseBackup.name, schema: CourseBackupSchema },
    ]),
  ],
  controllers: [
    CustomFieldsController,
    TagsController,
    WebServicesController,
    GdprController,
    BackupController,
    AnalyticsController,
  ],
  providers: [
    CustomFieldsService,
    TagsService,
    WebServicesService,
    GdprService,
    BackupService,
    AnalyticsService,
    ScheduledTasksService,
  ],
  exports: [
    CustomFieldsService,
    TagsService,
    WebServicesService,
    GdprService,
    BackupService,
    AnalyticsService,
    ScheduledTasksService,
    MongooseModule,
  ],
})
export class PlatformModule {}
