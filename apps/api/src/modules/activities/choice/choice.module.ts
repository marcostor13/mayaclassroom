import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Choice,
  ChoiceAnswer,
  ChoiceAnswerSchema,
  ChoiceSchema,
} from './schemas/choice.schema';
import { ChoiceService } from './choice.service';
import { ChoiceController } from './choice.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Choice.name, schema: ChoiceSchema },
      { name: ChoiceAnswer.name, schema: ChoiceAnswerSchema },
    ]),
  ],
  controllers: [ChoiceController],
  providers: [ChoiceService],
  exports: [ChoiceService],
})
export class ChoiceModule {}
