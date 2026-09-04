import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CAP, ContextLevel, slugify } from '@maya/shared';
import { CurrentUser, RequireCapability } from '../../common/decorators';
import type { RequestUser } from '../../common/types/request-context';
import { StudentReportService } from './student-report.service';
import { buildStudentPrintable, buildStudentWorkbook } from './student-report.export';

@ApiTags('Informes')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: StudentReportService) {}

  // `students/me` va antes que `students/:userId`: Nest resuelve por orden de
  // declaración, y al revés «me» entraría como identificador y pediría el
  // permiso de ver expedientes ajenos para ver el propio.
  @Get('students/me')
  @ApiOperation({ summary: 'Expediente propio' })
  mine(@CurrentUser() user: RequestUser) {
    return this.reports.build(user.tenantId, user.id);
  }

  @Get('students/:userId')
  @RequireCapability(CAP.REPORT_VIEW_STUDENT, { contextLevel: ContextLevel.Tenant })
  @ApiOperation({ summary: 'Expediente completo de un alumno' })
  student(@CurrentUser() user: RequestUser, @Param('userId') userId: string) {
    return this.reports.build(user.tenantId, userId);
  }

  @Get('students/:userId/export.xlsx')
  @RequireCapability(CAP.REPORT_VIEW_STUDENT, { contextLevel: ContextLevel.Tenant })
  @ApiOperation({ summary: 'Expediente en Excel' })
  async excel(
    @CurrentUser() user: RequestUser,
    @Param('userId') userId: string,
    @Res() res: Response,
  ) {
    const report = await this.reports.build(user.tenantId, userId);
    const buffer = await buildStudentWorkbook(report);
    const name = `expediente-${slugify(report.student.fullName)}`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${name}.xlsx"`);
    res.send(buffer);
  }

  @Get('students/:userId/print')
  @RequireCapability(CAP.REPORT_VIEW_STUDENT, { contextLevel: ContextLevel.Tenant })
  @ApiOperation({ summary: 'Expediente listo para imprimir o guardar en PDF' })
  async print(
    @CurrentUser() user: RequestUser,
    @Param('userId') userId: string,
    @Res() res: Response,
  ) {
    const report = await this.reports.build(user.tenantId, userId);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(buildStudentPrintable(report));
  }
}
