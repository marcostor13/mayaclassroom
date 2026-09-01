import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import {
  CourseVisibility,
  ModuleType,
  RESOURCE_MODULES,
  fullName,
  type SearchResult,
  type SearchResultKind,
  type SearchResults,
} from '@maya/shared';
import { Course, CourseDocument } from '../courses/schemas/course.schema';
import { CourseModule, CourseModuleDocument } from '../courses/schemas/course-module.schema';
import { Category, CategoryDocument } from '../categories/schemas/category.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { EnrolmentsService } from '../enrolments/enrolments.service';
import { notDeleted, searchRegex, toObjectId } from '../../common/utils';
import type { RequestUser } from '../../common/types/request-context';

/** Ruta del cliente para cada tipo de actividad. */
const MODULE_ROUTE: Record<string, string> = {
  [ModuleType.Assign]: 'assign',
  [ModuleType.Quiz]: 'quiz',
  [ModuleType.Forum]: 'forum',
  [ModuleType.Choice]: 'choice',
  [ModuleType.Feedback]: 'feedback',
};

const MODULE_ICON: Record<string, string> = {
  [ModuleType.Assign]: 'clipboard-list',
  [ModuleType.Quiz]: 'help-circle',
  [ModuleType.Forum]: 'message-square',
  [ModuleType.Choice]: 'circle-check',
  [ModuleType.Feedback]: 'star',
};

const RECURSOS = new Set<string>(RESOURCE_MODULES);

const GROUP_LABEL: Record<SearchResultKind, string> = {
  course: 'Cursos',
  activity: 'Actividades',
  user: 'Personas',
  category: 'Categorías',
};

const ORDER: SearchResultKind[] = ['course', 'activity', 'user', 'category'];

/**
 * Búsqueda global del topbar. Cruza cursos, actividades, personas y categorías
 * de la empresa activa, limitando siempre a lo que la persona puede ver: los
 * cursos ocultos y las actividades de cursos en los que no está matriculada
 * quedan fuera salvo que tenga permiso para verlos.
 */
@Injectable()
export class SearchService {
  constructor(
    @InjectModel(Course.name) private readonly courseModel: Model<CourseDocument>,
    @InjectModel(CourseModule.name) private readonly moduleModel: Model<CourseModuleDocument>,
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly enrolments: EnrolmentsService,
  ) {}

  async search(
    user: RequestUser,
    term: string,
    options: { limit?: number; canSeeHidden?: boolean; canSeeUsers?: boolean } = {},
  ): Promise<SearchResults> {
    const clean = term.trim();
    if (clean.length < 2) return { term: clean, total: 0, groups: [] };

    const limit = Math.min(options.limit ?? 5, 20);
    const tenant = toObjectId(user._tenantId);
    const regex = searchRegex(clean);

    // Cursos visibles para esta persona: los públicos de la empresa más
    // aquellos en los que está matriculada aunque estén ocultos.
    const enrolledIds = await this.enrolments.courseIdsOfUser(user._id);
    const courseFilter: FilterQuery<CourseDocument> = {
      tenant,
      ...notDeleted,
      $and: [
        { $or: [{ fullName: regex }, { shortName: regex }, { idNumber: regex }] },
        options.canSeeHidden
          ? {}
          : { $or: [{ visibility: CourseVisibility.Visible }, { _id: { $in: enrolledIds } }] },
      ],
    };

    const [courses, categories] = await Promise.all([
      this.courseModel
        .find(courseFilter)
        .populate('category', 'name')
        .select('fullName shortName summary category')
        .limit(limit)
        .lean()
        .exec(),
      this.categoryModel
        .find({ tenant, ...notDeleted, name: regex })
        .select('name description')
        .limit(limit)
        .lean()
        .exec(),
    ]);

    // Las actividades sólo se buscan dentro de los cursos accesibles, para no
    // filtrar contenido de cursos ajenos.
    const reachableCourseIds = options.canSeeHidden
      ? (
          await this.courseModel
            .find({ tenant, ...notDeleted })
            .select('_id fullName')
            .lean()
            .exec()
        ).map((course) => course._id)
      : enrolledIds;

    const modules = reachableCourseIds.length
      ? await this.moduleModel
          .find({
            course: { $in: reachableCourseIds },
            visible: true,
            ...notDeleted,
            $or: [{ name: regex }, { description: regex }],
          })
          .populate('course', 'fullName')
          .select('name description moduleType course')
          .limit(limit)
          .lean()
          .exec()
      : [];

    const users = options.canSeeUsers
      ? await this.userModel
          .find({
            tenant,
            ...notDeleted,
            $or: [{ firstName: regex }, { lastName: regex }, { email: regex }, { username: regex }],
          })
          .select('firstName lastName email avatarUrl')
          .limit(limit)
          .lean()
          .exec()
      : [];

    const results: SearchResult[] = [
      ...courses.map((course): SearchResult => {
        const category = course.category as unknown as { name?: string } | null;
        return {
          kind: 'course',
          id: String(course._id),
          title: course.fullName,
          subtitle: category?.name ?? course.shortName,
          excerpt: excerpt(course.summary),
          route: `/courses/${String(course._id)}`,
          icon: 'book',
        };
      }),
      ...modules.map((module): SearchResult => {
        const course = module.course as unknown as { _id: Types.ObjectId; fullName?: string };
        return {
          kind: 'activity',
          id: String(module._id),
          title: module.name,
          subtitle: course?.fullName ?? undefined,
          excerpt: excerpt(module.description),
          route: routeForModule(module.moduleType, String(module._id)),
          icon: MODULE_ICON[module.moduleType] ?? 'file',
        };
      }),
      ...users.map(
        (person): SearchResult => ({
          kind: 'user',
          id: String(person._id),
          title: fullName(person.firstName, person.lastName),
          subtitle: person.email,
          route: `/admin/users?user=${String(person._id)}`,
          icon: 'user',
        }),
      ),
      ...categories.map(
        (category): SearchResult => ({
          kind: 'category',
          id: String(category._id),
          title: category.name,
          excerpt: excerpt(category.description),
          route: `/catalogue?category=${String(category._id)}`,
          icon: 'grid',
        }),
      ),
    ];

    const groups = ORDER.map((kind) => ({
      kind,
      label: GROUP_LABEL[kind],
      items: results.filter((item) => item.kind === kind),
    })).filter((group) => group.items.length > 0);

    return { term: clean, total: results.length, groups };
  }
}

/** Ruta del cliente para un módulo, según su tipo. */
function routeForModule(moduleType: string, moduleId: string): string {
  if (MODULE_ROUTE[moduleType]) return `/mod/${MODULE_ROUTE[moduleType]}/${moduleId}`;
  if (RECURSOS.has(moduleType)) return `/mod/resource/${moduleId}`;
  return `/mod/advanced/${moduleId}`;
}

/** Texto plano recortado a 140 caracteres para la vista previa. */
function excerpt(html: string | null | undefined): string | undefined {
  if (!html) return undefined;
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return undefined;
  return text.length > 140 ? `${text.slice(0, 139)}…` : text;
}
