import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { CategoryNode, ContextLevel } from '@maya/shared';
import { Category, CategoryDocument } from './schemas/category.schema';
import { ContextsService } from '../contexts/contexts.service';
import { notDeleted, searchRegex, toObjectId } from '../../common/utils';
import { CreateCategoryDto, MoveCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name) private readonly model: Model<CategoryDocument>,
    private readonly contexts: ContextsService,
  ) {}

  async findById(id: string | Types.ObjectId): Promise<CategoryDocument> {
    const category = await this.model.findById(toObjectId(id)).exec();
    if (!category || category.deletedAt) throw new NotFoundException('Categoría no encontrada.');
    return category;
  }

  async list(
    tenantId: string | Types.ObjectId,
    options: { search?: string; includeHidden?: boolean; parentId?: string | null } = {},
  ): Promise<CategoryDocument[]> {
    const filter: FilterQuery<CategoryDocument> = { tenant: toObjectId(tenantId), ...notDeleted };
    if (!options.includeHidden) filter.visible = true;
    if (options.search) filter.name = searchRegex(options.search);
    if (options.parentId !== undefined) {
      filter.parent = options.parentId ? toObjectId(options.parentId) : null;
    }
    return this.model.find(filter).sort({ depth: 1, sortOrder: 1, name: 1 }).exec();
  }

  /** Árbol completo listo para pintar en el cliente. */
  async tree(
    tenantId: string | Types.ObjectId,
    includeHidden = false,
  ): Promise<CategoryNode[]> {
    const categories = await this.list(tenantId, { includeHidden });
    const nodes = new Map<string, CategoryNode>();

    for (const category of categories) {
      nodes.set(category.id, {
        id: category.id,
        name: category.name,
        idNumber: category.idNumber,
        description: category.description,
        parentId: category.parent ? category.parent.toString() : null,
        path: category.path,
        depth: category.depth,
        visible: category.visible,
        sortOrder: category.sortOrder,
        courseCount: category.courseCount,
        children: [],
      });
    }

    const roots: CategoryNode[] = [];
    for (const node of nodes.values()) {
      if (node.parentId && nodes.has(node.parentId)) {
        nodes.get(node.parentId)!.children!.push(node);
      } else {
        roots.push(node);
      }
    }
    const sort = (list: CategoryNode[]) => {
      list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
      list.forEach((n) => sort(n.children ?? []));
    };
    sort(roots);
    return roots;
  }

  async create(
    tenantId: string | Types.ObjectId,
    dto: CreateCategoryDto,
  ): Promise<CategoryDocument> {
    const parent = dto.parentId ? await this.findById(dto.parentId) : null;
    if (parent && String(parent.tenant) !== String(tenantId)) {
      throw new BadRequestException('La categoría padre pertenece a otra empresa.');
    }

    const siblings = await this.model
      .countDocuments({ tenant: toObjectId(tenantId), parent: parent?._id ?? null })
      .exec();

    const category = await this.model.create({
      tenant: toObjectId(tenantId),
      name: dto.name,
      idNumber: dto.idNumber ?? null,
      description: dto.description ?? null,
      parent: parent?._id ?? null,
      depth: parent ? parent.depth + 1 : 0,
      path: '/',
      visible: dto.visible ?? true,
      sortOrder: dto.sortOrder ?? siblings,
      imageUrl: dto.imageUrl ?? null,
    });

    category.path = `${parent ? parent.path : '/'}${category._id.toString()}/`;
    await category.save();

    const parentContext = parent
      ? await this.contexts.requireByInstance(ContextLevel.Category, parent._id)
      : await this.contexts.requireByInstance(ContextLevel.Tenant, tenantId);

    await this.contexts.ensureContext({
      level: ContextLevel.Category,
      instanceId: category._id,
      parentId: parentContext._id,
      tenantId,
      label: category.name,
    });

    return category;
  }

  async update(id: string | Types.ObjectId, dto: UpdateCategoryDto): Promise<CategoryDocument> {
    const category = await this.findById(id);
    const { parentId, ...rest } = dto;
    Object.assign(category, rest);
    await category.save();

    if (parentId !== undefined) {
      await this.move(category._id, { parentId: parentId ?? null });
    }
    if (dto.visible !== undefined) {
      await this.cascadeVisibility(category);
    }

    await this.contexts.ensureContext({
      level: ContextLevel.Category,
      instanceId: category._id,
      tenantId: category.tenant,
      label: category.name,
    });
    return category;
  }

  /** Mueve una categoría (y su subárbol) a un nuevo padre. */
  async move(id: string | Types.ObjectId, dto: MoveCategoryDto): Promise<CategoryDocument> {
    const category = await this.findById(id);
    const parent = dto.parentId ? await this.findById(dto.parentId) : null;

    if (parent && parent.path.startsWith(category.path)) {
      throw new BadRequestException('No se puede mover una categoría dentro de sí misma.');
    }

    const oldPath = category.path;
    const newPath = `${parent ? parent.path : '/'}${category._id.toString()}/`;
    const depthShift = (parent ? parent.depth + 1 : 0) - category.depth;

    category.parent = parent?._id ?? null;
    category.path = newPath;
    category.depth = parent ? parent.depth + 1 : 0;
    if (dto.sortOrder !== undefined) category.sortOrder = dto.sortOrder;
    await category.save();

    const descendants = await this.model
      .find({ path: { $regex: `^${this.escape(oldPath)}` }, _id: { $ne: category._id } })
      .exec();
    for (const child of descendants) {
      child.path = child.path.replace(oldPath, newPath);
      child.depth += depthShift;
      await child.save();
    }

    const parentContext = parent
      ? await this.contexts.requireByInstance(ContextLevel.Category, parent._id)
      : await this.contexts.requireByInstance(ContextLevel.Tenant, category.tenant);
    const ownContext = await this.contexts.requireByInstance(ContextLevel.Category, category._id);
    await this.contexts.moveSubtree(ownContext, parentContext);

    return category;
  }

  async reorder(tenantId: string | Types.ObjectId, orderedIds: string[]): Promise<void> {
    await Promise.all(
      orderedIds.map((id, index) =>
        this.model
          .updateOne({ _id: toObjectId(id), tenant: toObjectId(tenantId) }, { $set: { sortOrder: index } })
          .exec(),
      ),
    );
  }

  async remove(id: string | Types.ObjectId, moveContentTo?: string): Promise<void> {
    const category = await this.findById(id);
    const children = await this.model.countDocuments({ parent: category._id, ...notDeleted }).exec();
    if (children > 0 && !moveContentTo) {
      throw new ConflictException(
        'La categoría contiene subcategorías. Indique una categoría destino o elimínelas antes.',
      );
    }
    if (moveContentTo) {
      const target = await this.findById(moveContentTo);
      const subcategories = await this.model.find({ parent: category._id, ...notDeleted }).exec();
      for (const sub of subcategories) {
        await this.move(sub._id, { parentId: target.id });
      }
    }
    category.deletedAt = new Date();
    await category.save();
    await this.contexts.deleteForInstance(ContextLevel.Category, category._id);
  }

  async adjustCourseCount(id: string | Types.ObjectId, delta: number): Promise<void> {
    await this.model.updateOne({ _id: toObjectId(id) }, { $inc: { courseCount: delta } }).exec();
  }

  /** Identificadores de la categoría y todas sus descendientes. */
  async subtreeIds(id: string | Types.ObjectId): Promise<Types.ObjectId[]> {
    const category = await this.findById(id);
    const descendants = await this.model
      .find({ path: { $regex: `^${this.escape(category.path)}` }, ...notDeleted })
      .select('_id')
      .lean()
      .exec();
    return descendants.map((d) => d._id);
  }

  private async cascadeVisibility(category: CategoryDocument): Promise<void> {
    await this.model
      .updateMany(
        { path: { $regex: `^${this.escape(category.path)}` } },
        { $set: { visibleOld: category.visible } },
      )
      .exec();
  }

  private escape(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
