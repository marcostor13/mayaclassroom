import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { gzipSync, gunzipSync } from 'node:zlib';
import { CourseBackupDto, CourseFormat, ModuleType, slugify } from '@maya/shared';
import { CourseBackup, CourseBackupDocument } from './schemas/platform.schema';
import { CoursesService } from '../courses/courses.service';
import { ActivityRegistry } from '../activities/activity-registry.service';
import { FilesService } from '../files/files.service';
import { GradesService } from '../grades/grades.service';
import { EnrolmentsService } from '../enrolments/enrolments.service';
import { dayjs, toObjectId } from '../../common/utils';

interface BackupPayload {
  version: string;
  createdAt: string;
  course: Record<string, unknown>;
  sections: Record<string, unknown>[];
  modules: (Record<string, unknown> & { instanceData?: Record<string, unknown> })[];
  users?: string[];
}

/**
 * Copia de seguridad y restauración de cursos. El formato es un JSON comprimido
 * con la estructura del curso, sus secciones y las instancias de cada actividad.
 */
@Injectable()
export class BackupService {
  constructor(
    @InjectModel(CourseBackup.name) private readonly model: Model<CourseBackupDocument>,
    private readonly courses: CoursesService,
    private readonly registry: ActivityRegistry,
    private readonly files: FilesService,
    private readonly grades: GradesService,
    private readonly enrolments: EnrolmentsService,
  ) {}

  async list(tenantId: string | Types.ObjectId, courseId?: string): Promise<CourseBackupDto[]> {
    const filter: Record<string, unknown> = { tenant: toObjectId(tenantId) };
    if (courseId) filter.course = toObjectId(courseId);
    const backups = await this.model
      .find(filter)
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .exec();

    return backups.map((backup) => {
      const author = backup.createdBy as unknown as {
        firstName?: string;
        lastName?: string;
      } | null;
      return {
        id: backup.id,
        courseId: String(backup.course),
        courseName: backup.courseName,
        filename: backup.filename,
        size: backup.size,
        includeUsers: backup.includeUsers,
        createdAt: backup.createdAt.toISOString(),
        createdBy: author?.firstName ? `${author.firstName} ${author.lastName ?? ''}`.trim() : '—',
        downloadUrl: `/api/v1/backups/${backup.id}/download`,
      };
    });
  }

  async create(params: {
    tenantId: string | Types.ObjectId;
    courseId: string | Types.ObjectId;
    userId: string | Types.ObjectId;
    includeUsers?: boolean;
  }): Promise<CourseBackupDto> {
    const payload = await this.buildPayload(params.courseId, params.includeUsers ?? false);
    const compressed = gzipSync(Buffer.from(JSON.stringify(payload), 'utf-8'));
    const course = await this.courses.findById(params.courseId);
    const filename = `${slugify(course.shortName)}-${dayjs().format('YYYYMMDD-HHmm')}.mbz.json.gz`;

    const stored = await this.files.upload({
      tenantId: params.tenantId,
      ownerId: params.userId,
      component: 'backup',
      fileArea: 'course',
      itemId: course._id,
      file: {
        originalname: filename,
        mimetype: 'application/gzip',
        buffer: compressed,
        size: compressed.length,
      },
      makeThumbnail: false,
    });

    const backup = await this.model.create({
      tenant: toObjectId(params.tenantId),
      course: course._id,
      courseName: course.fullName,
      filename,
      size: compressed.length,
      includeUsers: params.includeUsers ?? false,
      file: stored._id,
      createdBy: toObjectId(params.userId),
    });

    const [dto] = await this.list(params.tenantId, course.id);
    return dto ?? {
      id: backup.id,
      courseId: course.id,
      courseName: course.fullName,
      filename,
      size: compressed.length,
      includeUsers: params.includeUsers ?? false,
      createdAt: backup.createdAt.toISOString(),
      createdBy: '—',
      downloadUrl: `/api/v1/backups/${backup.id}/download`,
    };
  }

  async download(id: string | Types.ObjectId): Promise<{ filename: string; data: Buffer }> {
    const backup = await this.model.findById(toObjectId(id)).exec();
    if (!backup) throw new NotFoundException('Copia de seguridad no encontrada.');
    const { data } = await this.files.download(backup.file);
    return { filename: backup.filename, data };
  }

  /** Restaura una copia en un curso nuevo. */
  async restore(params: {
    tenantId: string | Types.ObjectId;
    backupId: string | Types.ObjectId;
    userId: string | Types.ObjectId;
    categoryId: string;
    shortName: string;
    fullName: string;
  }): Promise<{ courseId: string; restoredModules: number }> {
    const backup = await this.model.findById(toObjectId(params.backupId)).exec();
    if (!backup) throw new NotFoundException('Copia de seguridad no encontrada.');

    const { data } = await this.files.download(backup.file);
    const payload = JSON.parse(gunzipSync(data).toString('utf-8')) as BackupPayload;

    return this.applyPayload(payload, params);
  }

  /** Importa el contenido de un curso a otro existente. */
  async importInto(params: {
    tenantId: string | Types.ObjectId;
    sourceCourseId: string | Types.ObjectId;
    targetCourseId: string | Types.ObjectId;
    userId: string | Types.ObjectId;
  }): Promise<{ importedModules: number }> {
    const payload = await this.buildPayload(params.sourceCourseId, false);
    const targetSections = await this.courses.sections(params.targetCourseId);
    let imported = 0;

    for (const module of payload.modules) {
      const sectionNumber = Number(module.sectionNumber ?? 0);
      const section =
        targetSections.find((s) => s.sectionNumber === sectionNumber) ?? targetSections[0];
      if (!section) continue;

      await this.courses.addModule(
        params.targetCourseId,
        {
          moduleType: module.moduleType as ModuleType,
          sectionId: section.id,
          name: String(module.name),
          description: (module.description as string) ?? undefined,
          settings: (module.instanceData ?? {}) as Record<string, unknown>,
          visible: Boolean(module.visible),
        },
        params.userId,
      );
      imported += 1;
    }
    return { importedModules: imported };
  }

  async remove(id: string | Types.ObjectId): Promise<void> {
    const backup = await this.model.findById(toObjectId(id)).exec();
    if (!backup) return;
    await this.files.remove(backup.file).catch(() => undefined);
    await backup.deleteOne();
  }

  /* ------------------------------- Interno ------------------------------- */

  private async buildPayload(
    courseId: string | Types.ObjectId,
    includeUsers: boolean,
  ): Promise<BackupPayload> {
    const course = await this.courses.findById(courseId);
    const sections = await this.courses.sections(courseId);
    const modules = await this.courses.modules(courseId);

    const serializedModules = [];
    for (const module of modules) {
      const section = sections.find((s) => s.id === String(module.section));
      let instanceData: Record<string, unknown> | undefined;
      const handler = this.registry.has(module.moduleType)
        ? this.registry.get(module.moduleType)
        : null;
      if (handler?.exportInstance) {
        instanceData = await handler.exportInstance(module.instance);
      } else if (handler) {
        instanceData = (await handler.get(module.instance)) as Record<string, unknown>;
      }

      serializedModules.push({
        moduleType: module.moduleType,
        name: module.name,
        description: module.description,
        visible: module.visible,
        sortOrder: module.sortOrder,
        sectionNumber: section?.sectionNumber ?? 0,
        completionTracking: module.completionTracking,
        completionRules: module.completionRules,
        availabilityJson: module.availabilityJson,
        instanceData,
      });
    }

    return {
      version: '1.0',
      createdAt: new Date().toISOString(),
      course: {
        shortName: course.shortName,
        fullName: course.fullName,
        summary: course.summary,
        format: course.format,
        numSections: course.numSections,
        groupMode: course.groupMode,
        enableCompletion: course.enableCompletion,
        tags: course.tags,
      },
      sections: sections.map((s) => ({
        sectionNumber: s.sectionNumber,
        name: s.name,
        summary: s.summary,
        visible: s.visible,
        availabilityJson: s.availabilityJson,
      })),
      modules: serializedModules,
      users: includeUsers
        ? (await this.enrolments.activeUserIds(courseId)).map(String)
        : undefined,
    };
  }

  private async applyPayload(
    payload: BackupPayload,
    params: {
      tenantId: string | Types.ObjectId;
      userId: string | Types.ObjectId;
      categoryId: string;
      shortName: string;
      fullName: string;
    },
  ): Promise<{ courseId: string; restoredModules: number }> {
    const course = await this.courses.create(
      params.tenantId,
      {
        shortName: params.shortName,
        fullName: params.fullName,
        categoryId: params.categoryId,
        summary: (payload.course.summary as string) ?? undefined,
        format: (payload.course.format as CourseFormat) ?? CourseFormat.Topics,
        numSections: Number(payload.course.numSections ?? 10),
      },
      params.userId,
    );

    await this.grades.provisionCourse(course._id);
    await this.enrolments.provisionDefaults(course._id);

    const sections = await this.courses.sections(course._id);
    for (const sectionData of payload.sections) {
      const section = sections.find(
        (s) => s.sectionNumber === Number(sectionData.sectionNumber ?? -1),
      );
      if (!section) continue;
      await this.courses.updateSection(section.id, {
        name: (sectionData.name as string) ?? undefined,
        summary: (sectionData.summary as string) ?? undefined,
        visible: Boolean(sectionData.visible ?? true),
        availabilityJson: (sectionData.availabilityJson as string) ?? undefined,
      });
    }

    const refreshedSections = await this.courses.sections(course._id);
    let restored = 0;

    for (const module of payload.modules) {
      const section =
        refreshedSections.find((s) => s.sectionNumber === Number(module.sectionNumber ?? 0)) ??
        refreshedSections[0];
      if (!section) continue;
      await this.courses.addModule(
        course._id,
        {
          moduleType: module.moduleType as ModuleType,
          sectionId: section.id,
          name: String(module.name),
          description: (module.description as string) ?? undefined,
          settings: (module.instanceData ?? {}) as Record<string, unknown>,
          visible: Boolean(module.visible),
        },
        params.userId,
      );
      restored += 1;
    }

    return { courseId: course.id, restoredModules: restored };
  }
}
