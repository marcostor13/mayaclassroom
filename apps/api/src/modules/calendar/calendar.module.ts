import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CalendarEvent, CalendarEventSchema } from './schemas/calendar-event.schema';
import { CalendarService } from './calendar.service';
import { CalendarController } from './calendar.controller';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([{ name: CalendarEvent.name, schema: CalendarEventSchema }]),
  ],
  controllers: [CalendarController],
  providers: [CalendarService],
  exports: [CalendarService, MongooseModule],
})
export class CalendarModule {}
