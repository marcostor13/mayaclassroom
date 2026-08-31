import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  CAP,
  CompletionState,
  CourseModuleDto,
  RESOURCE_MODULES,
  SectionDto,
} from '@maya/shared';
import { CoursesService } from './courses.service';
import { AvailabilityService } from '../availability/availability.service';
import { CompletionService } from '../completion/completion.service';
import { RequestUser } from '../../common/types/request-context';
import { AccessService } from '../rbac/access.service';
import { ContextsService } from '../contexts/contexts.service';
import { ContextLevel } from '@maya/shared';

/**
 * Construye la vista del curso aplicando visibilidad, restricciones de acceso y
 * estado de finalización para el usuario que consulta.
 */
@Injectable()
export class CourseViewService {
  constructor(
    private readonly courses: CoursesService,
    private readonly availability: AvailabilityService,
    private readonly completion: CompletionService,
    private readonly access: AccessService,
    private readonly contexts: ContextsService,
  ) {}

  async build(courseId: string | Types.ObjectId, user: RequestUser): Promise<SectionDto[]> {
    const courseContext = await this.contexts.requireByInstance(ContextLevel.Course, courseId);
    const input = { userId: user.id, isPlatformAdmin: user.isPlatformAdmin };

    const [canSeeHiddenSections, canSeeHiddenActivities, ignoreRestrictions] = await Promise.all([
      this.access.hasCapability(input, CAP.COURSE_VIEW_HIDDEN_SECTIONS, courseContext),
      this.access.hasCapability(input, CAP.COURSE_VIEW_HIDDEN_ACTIVITIES, courseContext),
      this.access.hasCapability(input, CAP.COURSE_IGNORE_AVAILABILITY, courseContext),
    ]);

    const [sections, modules, completionStates] = await Promise.all([
      this.courses.sections(courseId),
      this.courses.modules(courseId),
      this.completion.statesForCourse(courseId, user.id),
    ]);

    const modulesBySection = new Map<string, typeof modules>();
    for (const module of modules) {
      const key = String(module.section);
      if (!modulesBySection.has(key)) modulesBySection.set(key, []);
      modulesBySection.get(key)!.push(module);
    }

    const result: SectionDto[] = [];

    for (const section of sections) {
      if (!section.visible && !canSeeHiddenSections) continue;

      const sectionAvailability = await this.availability.evaluate(section.availabilityJson, {
        userId: user.id,
        courseId,
        ignoreRestrictions,
      });
      if (!sectionAvailability.visible && !canSeeHiddenSections) continue;

      const order = section.moduleOrder.map(String);
      const sectionModules = (modulesBySection.get(section.id) ?? []).sort(
        (a, b) => order.indexOf(a.id) - order.indexOf(b.id),
      );

      const items: CourseModuleDto[] = [];
      for (const module of sectionModules) {
        if (!module.visible && !canSeeHiddenActivities) continue;

        const moduleAvailability = await this.availability.evaluate(module.availabilityJson, {
          userId: user.id,
          courseId,
          ignoreRestrictions,
        });
        if (!moduleAvailability.visible && !canSeeHiddenActivities) continue;

        items.push({
          id: module.id,
          courseId: String(module.course),
          sectionId: String(module.section),
          moduleType: module.moduleType,
          instanceId: String(module.instance),
          name: module.name,
          description: module.description,
          visible: module.visible,
          stealth: module.stealth,
          sortOrder: module.sortOrder,
          indent: module.indent,
          groupMode: module.groupMode,
          groupingId: module.grouping ? String(module.grouping) : null,
          completionTracking: module.completionTracking,
          completionExpected: module.completionExpected?.toISOString() ?? null,
          availabilityJson: module.availabilityJson,
          gradeMax: module.gradeMax,
          completionState: completionStates.get(module.id) ?? CompletionState.Incomplete,
          available: moduleAvailability.available,
          availabilityInfo: moduleAvailability.info,
          url: this.moduleUrl(module.moduleType, module.id),
        });
      }

      result.push({
        id: section.id,
        courseId: String(section.course),
        sectionNumber: section.sectionNumber,
        name: section.name,
        summary: section.summary,
        visible: section.visible,
        availabilityJson: section.availabilityJson,
        modules: items,
      });
    }

    return result;
  }

  private moduleUrl(type: string, moduleId: string): string {
    const isResource = RESOURCE_MODULES.includes(type as never);
    return isResource ? `/mod/${type}/${moduleId}` : `/mod/${type}/${moduleId}`;
  }
}
