import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Enrolment, EnrolmentSchema } from '../enrolments/schemas/enrolment.schema';
import { Course, CourseSchema } from '../courses/schemas/course.schema';
import { CourseModule, CourseModuleSchema } from '../courses/schemas/course-module.schema';
import {
  ModuleCompletion,
  ModuleCompletionSchema,
} from '../completion/schemas/completion.schema';
import { Quiz, QuizSchema } from '../activities/quiz/schemas/quiz.schema';
import {
  QuizAttempt,
  QuizAttemptSchema,
} from '../activities/quiz/schemas/quiz-attempt.schema';
import { LiveAttendance, LiveAttendanceSchema } from '../live/schemas/live-attendance.schema';
import { LiveSession, LiveSessionSchema } from '../live/schemas/live-session.schema';
import { CertificatesModule } from '../certificates/certificates.module';
import { StudentReportService } from './student-report.service';
import { ReportsController } from './reports.controller';

/**
 * El expediente cruza casi todo el sistema, así que registra aquí los modelos
 * que consulta en lugar de importar los módulos que los definen: solo lee, y
 * depender de ellos crearía ciclos con los que ya dependen de las notas.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Enrolment.name, schema: EnrolmentSchema },
      { name: Course.name, schema: CourseSchema },
      { name: CourseModule.name, schema: CourseModuleSchema },
      { name: ModuleCompletion.name, schema: ModuleCompletionSchema },
      { name: Quiz.name, schema: QuizSchema },
      { name: QuizAttempt.name, schema: QuizAttemptSchema },
      { name: LiveAttendance.name, schema: LiveAttendanceSchema },
      { name: LiveSession.name, schema: LiveSessionSchema },
    ]),
    CertificatesModule,
  ],
  controllers: [ReportsController],
  providers: [StudentReportService],
  exports: [StudentReportService],
})
export class ReportsModule {}
