import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CustomFieldDto, CustomFieldScope, CustomFieldType } from '@maya/shared';
import { CustomField, CustomFieldDocument } from './schemas/platform.schema';
import { toObjectId } from '../../common/utils';

@Injectable()
export class CustomFieldsService {
  constructor(
    @InjectModel(CustomField.name) private readonly model: Model<CustomFieldDocument>,
  ) {}

  async list(
    tenantId: string | Types.ObjectId,
    scope?: CustomFieldScope,
  ): Promise<CustomFieldDto[]> {
    const filter: Record<string, unknown> = { tenant: toObjectId(tenantId) };
    if (scope) filter.scope = scope;
    const fields = await this.model.find(filter).sort({ sortOrder: 1 }).exec();
    return fields.map((f) => this.toDto(f));
  }

  async create(
    tenantId: string | Types.ObjectId,
    dto: {
      scope: CustomFieldScope;
      shortName: string;
      name: string;
      type: CustomFieldType;
      categoryName?: string;
      description?: string;
      required?: boolean;
      uniqueValues?: boolean;
      visibility?: 'all' | 'teachers' | 'none';
      defaultValue?: string;
      options?: string[];
    },
  ): Promise<CustomFieldDto> {
    const count = await this.model
      .countDocuments({ tenant: toObjectId(tenantId), scope: dto.scope })
      .exec();
    const field = await this.model.create({
      ...dto,
      tenant: toObjectId(tenantId),
      categoryName: dto.categoryName ?? 'General',
      sortOrder: count,
    });
    return this.toDto(field);
  }

  async update(id: string | Types.ObjectId, dto: Partial<CustomFieldDto>): Promise<CustomFieldDto> {
    const field = await this.model.findById(toObjectId(id)).exec();
    if (!field) throw new NotFoundException('Campo personalizado no encontrado.');
    Object.assign(field, dto);
    await field.save();
    return this.toDto(field);
  }

  async remove(id: string | Types.ObjectId): Promise<void> {
    await this.model.deleteOne({ _id: toObjectId(id) }).exec();
  }

  /** Valida los valores enviados contra la definición de los campos. */
  async validate(
    tenantId: string | Types.ObjectId,
    scope: CustomFieldScope,
    values: Record<string, unknown>,
  ): Promise<string[]> {
    const fields = await this.model
      .find({ tenant: toObjectId(tenantId), scope })
      .lean()
      .exec();
    const errors: string[] = [];

    for (const field of fields) {
      const value = values[field.shortName];
      if (field.required && (value === undefined || value === null || value === '')) {
        errors.push(`El campo «${field.name}» es obligatorio.`);
        continue;
      }
      if (value === undefined || value === null || value === '') continue;

      if (field.type === CustomFieldType.Number && Number.isNaN(Number(value))) {
        errors.push(`El campo «${field.name}» debe ser numérico.`);
      }
      if (field.type === CustomFieldType.Select && !field.options.includes(String(value))) {
        errors.push(`El valor de «${field.name}» no es una opción válida.`);
      }
      if (field.type === CustomFieldType.Url && !/^https?:\/\//i.test(String(value))) {
        errors.push(`El campo «${field.name}» debe ser una URL válida.`);
      }
    }
    return errors;
  }

  private toDto(field: CustomFieldDocument): CustomFieldDto {
    return {
      id: field.id,
      scope: field.scope,
      categoryName: field.categoryName,
      shortName: field.shortName,
      name: field.name,
      type: field.type,
      description: field.description,
      required: field.required,
      uniqueValues: field.uniqueValues,
      visibility: field.visibility,
      defaultValue: field.defaultValue,
      options: field.options,
      sortOrder: field.sortOrder,
    };
  }
}
