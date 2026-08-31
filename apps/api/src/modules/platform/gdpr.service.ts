import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DataRequest, DataRequestDocument } from './schemas/platform.schema';
import { UsersService } from '../users/users.service';
import { EnrolmentsService } from '../enrolments/enrolments.service';
import { GradesService } from '../grades/grades.service';
import { LogsService } from '../logs/logs.service';
import { toObjectId } from '../../common/utils';

/**
 * Cumplimiento del RGPD: solicitudes de exportación y eliminación de datos
 * personales, con flujo de aprobación por parte del responsable de la empresa.
 */
@Injectable()
export class GdprService {
  constructor(
    @InjectModel(DataRequest.name) private readonly model: Model<DataRequestDocument>,
    private readonly users: UsersService,
    private readonly enrolments: EnrolmentsService,
    private readonly grades: GradesService,
    private readonly logs: LogsService,
  ) {}

  async request(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    requestType: 'export' | 'delete',
    comment?: string,
  ): Promise<DataRequestDocument> {
    return this.model.create({
      tenant: toObjectId(tenantId),
      user: toObjectId(userId),
      requestType,
      comment: comment ?? null,
    });
  }

  async list(tenantId: string | Types.ObjectId): Promise<DataRequestDocument[]> {
    return this.model
      .find({ tenant: toObjectId(tenantId) })
      .populate('user', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .exec();
  }

  async myRequests(userId: string | Types.ObjectId): Promise<DataRequestDocument[]> {
    return this.model.find({ user: toObjectId(userId) }).sort({ createdAt: -1 }).exec();
  }

  async resolve(
    id: string | Types.ObjectId,
    status: 'approved' | 'rejected',
    handlerId: string | Types.ObjectId,
  ): Promise<DataRequestDocument> {
    const request = await this.model.findById(toObjectId(id)).exec();
    if (!request) throw new NotFoundException('Solicitud no encontrada.');
    request.status = status;
    request.handledBy = toObjectId(handlerId);

    if (status === 'approved' && request.requestType === 'delete') {
      await this.users.softDelete(request.user);
      request.status = 'completed';
      request.completedAt = new Date();
    }
    await request.save();
    return request;
  }

  /** Exporta todos los datos personales del usuario en formato JSON. */
  async exportData(userId: string | Types.ObjectId): Promise<Record<string, unknown>> {
    const user = await this.users.findById(userId);
    const courseIds = await this.enrolments.courseIdsOfUser(userId);
    const logs = await this.logs.paginate(user.tenant, {
      page: 1,
      limit: 500,
      order: 'desc',
      userId: String(userId),
    } as never);

    const grades = [];
    for (const courseId of courseIds) {
      const total = await this.grades.courseTotalItem(courseId).catch(() => null);
      if (!total) continue;
      const grade = await this.grades.userGradeForItem(total._id, userId);
      grades.push({ courseId: String(courseId), finalGrade: grade?.finalGrade ?? null });
    }

    return {
      exportedAt: new Date().toISOString(),
      profile: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        city: user.city,
        country: user.country,
        timezone: user.timezone,
        language: user.language,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        customFields: user.customFields,
      },
      enrolments: courseIds.map(String),
      grades,
      activityLog: logs.items.map((log) => ({
        component: log.component,
        target: log.target,
        action: log.action,
        createdAt: log.createdAt,
      })),
    };
  }
}
