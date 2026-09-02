import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { GUIDES, GuideId, findGuide } from '@maya/shared';
import type { GuideDefinition, GuideProgressDto } from '@maya/shared';
import { toObjectId } from '../../common/utils';
import { GuideProgress, GuideProgressDocument } from './schemas/guide-progress.schema';
import type { UpdateGuideProgressDto } from './dto/guide.dto';

/**
 * Guías interactivas.
 *
 * El catálogo de pasos vive en `@maya/shared` y es la única fuente de verdad:
 * la API valida contra él antes de dar un paso por cumplido, de modo que un
 * identificador inventado desde el cliente no puede completar una guía ni
 * dejar el progreso apuntando a un paso que no existe.
 */
@Injectable()
export class GuidesService {
  constructor(
    @InjectModel(GuideProgress.name)
    private readonly model: Model<GuideProgressDocument>,
  ) {}

  /** Las guías que puede seguir quien tiene estas capacidades. */
  available(capabilities: string[]): GuideDefinition[] {
    return GUIDES.filter(
      (guide) =>
        !guide.capabilities?.length ||
        guide.capabilities.some((capability) => capabilities.includes(capability)),
    ).map((guide) => ({ ...guide, steps: [...guide.steps] }));
  }

  async progress(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<GuideProgressDto[]> {
    const rows = await this.model
      .find({ tenant: toObjectId(tenantId), user: toObjectId(userId) })
      .exec();
    return rows.map((row) => this.toDto(row));
  }

  async update(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    guideId: string,
    dto: UpdateGuideProgressDto,
  ): Promise<GuideProgressDto> {
    const guide = findGuide(guideId as GuideId);
    if (!guide) throw new NotFoundException('Esa guía no existe.');

    const tenant = toObjectId(tenantId);
    const user = toObjectId(userId);
    const row =
      (await this.model.findOne({ tenant, user, guideId: guide.id }).exec()) ??
      (await this.model.create({ tenant, user, guideId: guide.id }));

    if (dto.restart) {
      row.completedStepIds = [];
      row.currentStep = 0;
      row.dismissed = false;
      row.completedAt = null;
    }

    if (dto.completedStepId) {
      if (!guide.steps.some((step) => step.id === dto.completedStepId)) {
        throw new BadRequestException('Ese paso no pertenece a la guía.');
      }
      if (!row.completedStepIds.includes(dto.completedStepId)) {
        row.completedStepIds = [...row.completedStepIds, dto.completedStepId];
      }
    }

    if (dto.currentStep !== undefined) {
      // Se acota al número de pasos: un índice mayor dejaría la guía abierta
      // en una tarjeta vacía y sin forma de cerrarla.
      row.currentStep = Math.min(dto.currentStep, guide.steps.length);
    }

    if (dto.dismissed !== undefined) row.dismissed = dto.dismissed;

    const done = guide.steps.every((step) => row.completedStepIds.includes(step.id));
    row.completedAt = done ? (row.completedAt ?? new Date()) : null;

    await row.save();
    return this.toDto(row);
  }

  private toDto(row: GuideProgressDocument): GuideProgressDto {
    return {
      guideId: row.guideId,
      completedStepIds: row.completedStepIds,
      currentStep: row.currentStep,
      dismissed: row.dismissed,
      completedAt: row.completedAt?.toISOString() ?? null,
      updatedAt: (row.get('updatedAt') as Date | undefined)?.toISOString() ?? '',
    };
  }
}
