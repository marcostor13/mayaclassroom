import { Injectable, Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  AvailabilityCondition,
  AvailabilityConditionType,
  AvailabilityOperator,
  AvailabilityTree,
  CompletionState,
  isAvailabilityTree,
} from '@maya/shared';
import { CompletionService } from '../completion/completion.service';
import { GroupsService } from '../groups/groups.service';
import { GradesService } from '../grades/grades.service';
import { UsersService } from '../users/users.service';
import { dayjs } from '../../common/utils';

export interface AvailabilityContext {
  userId: string | Types.ObjectId;
  courseId: string | Types.ObjectId;
  /** Si es cierto, el usuario ignora todas las restricciones (profesorado). */
  ignoreRestrictions?: boolean;
}

export interface AvailabilityResult {
  available: boolean;
  /** Texto explicativo mostrado al alumno cuando la actividad está bloqueada. */
  info: string | null;
  /** Si es falso, la actividad se oculta por completo. */
  visible: boolean;
}

/**
 * Evaluador del árbol de restricción de acceso, equivalente al subsistema
 * `availability` de Moodle. Soporta operadores `&`, `|`, `!&`, `!|` anidados.
 */
@Injectable()
export class AvailabilityService {
  private readonly logger = new Logger(AvailabilityService.name);

  constructor(
    private readonly completion: CompletionService,
    private readonly groups: GroupsService,
    private readonly grades: GradesService,
    private readonly users: UsersService,
  ) {}

  async evaluate(
    availabilityJson: string | null | undefined,
    context: AvailabilityContext,
  ): Promise<AvailabilityResult> {
    if (!availabilityJson) return { available: true, info: null, visible: true };
    if (context.ignoreRestrictions) return { available: true, info: null, visible: true };

    let tree: AvailabilityTree;
    try {
      tree = JSON.parse(availabilityJson) as AvailabilityTree;
    } catch {
      this.logger.warn('Árbol de restricción de acceso mal formado; se concede el acceso.');
      return { available: true, info: null, visible: true };
    }

    const { available, reasons } = await this.evaluateNode(tree, context);
    const visible = available || tree.show !== false;
    return {
      available,
      info: available ? null : this.describe(reasons),
      visible,
    };
  }

  private async evaluateNode(
    node: AvailabilityTree,
    context: AvailabilityContext,
  ): Promise<{ available: boolean; reasons: string[] }> {
    const results: { available: boolean; reason: string }[] = [];

    for (const child of node.c ?? []) {
      if (isAvailabilityTree(child)) {
        const nested = await this.evaluateNode(child, context);
        results.push({ available: nested.available, reason: nested.reasons.join(' y ') });
      } else {
        results.push(await this.evaluateCondition(child, context));
      }
    }

    const positives = results.map((r) => r.available);
    let available: boolean;

    switch (node.op) {
      case AvailabilityOperator.And:
        available = positives.every(Boolean);
        break;
      case AvailabilityOperator.Or:
        available = positives.some(Boolean);
        break;
      case AvailabilityOperator.NotAnd:
        available = !positives.every(Boolean);
        break;
      case AvailabilityOperator.NotOr:
        available = !positives.some(Boolean);
        break;
      default:
        available = positives.every(Boolean);
    }

    const reasons = results.filter((r) => !r.available).map((r) => r.reason).filter(Boolean);
    return { available, reasons };
  }

  private async evaluateCondition(
    condition: AvailabilityCondition,
    context: AvailabilityContext,
  ): Promise<{ available: boolean; reason: string }> {
    switch (condition.type) {
      case AvailabilityConditionType.Date: {
        const direction = String(condition.d ?? '>=');
        const timestamp = new Date(String(condition.t));
        const now = new Date();
        const ok = direction === '>=' ? now >= timestamp : now < timestamp;
        return {
          available: ok,
          reason:
            direction === '>='
              ? `Disponible a partir del ${dayjs(timestamp).format('D [de] MMMM [de] YYYY, HH:mm')}`
              : `Disponible hasta el ${dayjs(timestamp).format('D [de] MMMM [de] YYYY, HH:mm')}`,
        };
      }

      case AvailabilityConditionType.Completion: {
        const state = await this.completion.stateFor(String(condition.cm), context.userId);
        const expected = Number(condition.e ?? CompletionState.Complete);
        const ok =
          expected === CompletionState.Complete
            ? state === CompletionState.Complete || state === CompletionState.CompletePass
            : state === expected;
        return { available: ok, reason: 'Debe completar antes la actividad requerida' };
      }

      case AvailabilityConditionType.Grade: {
        const grade = await this.grades.userGradeForItem(String(condition.id), context.userId);
        const min = condition.min !== undefined ? Number(condition.min) : null;
        const max = condition.max !== undefined ? Number(condition.max) : null;
        const value = grade?.finalGrade ?? null;
        const ok =
          value !== null &&
          (min === null || value >= min) &&
          (max === null || value < max);
        return {
          available: ok,
          reason: `Debe obtener una calificación${min !== null ? ` de al menos ${min}` : ''} en la actividad indicada`,
        };
      }

      case AvailabilityConditionType.Group: {
        const groups = await this.groups.groupsOfUser(context.courseId, context.userId);
        const ok = condition.id
          ? groups.some((g) => g.id === String(condition.id))
          : groups.length > 0;
        return { available: ok, reason: 'Debe pertenecer al grupo requerido' };
      }

      case AvailabilityConditionType.Grouping: {
        const members = await this.groups.membersOfGrouping(String(condition.id));
        const ok = members.some((m) => String(m) === String(context.userId));
        return { available: ok, reason: 'Debe pertenecer al agrupamiento requerido' };
      }

      case AvailabilityConditionType.Profile: {
        const user = await this.users.findById(context.userId);
        const field = String(condition.sf ?? condition.cf ?? '');
        const operator = String(condition.op ?? 'isequalto');
        const expected = String(condition.v ?? '');
        const actual = String(
          (user as unknown as Record<string, unknown>)[field] ??
            (user.customFields ?? {})[field] ??
            '',
        );
        const ok = this.compareProfile(actual, operator, expected);
        return { available: ok, reason: 'Su perfil no cumple los requisitos de acceso' };
      }

      case AvailabilityConditionType.Role:
        return { available: true, reason: '' };

      default:
        return { available: true, reason: '' };
    }
  }

  private compareProfile(actual: string, operator: string, expected: string): boolean {
    switch (operator) {
      case 'isequalto':
        return actual === expected;
      case 'contains':
        return actual.includes(expected);
      case 'doesnotcontain':
        return !actual.includes(expected);
      case 'startswith':
        return actual.startsWith(expected);
      case 'endswith':
        return actual.endsWith(expected);
      case 'isempty':
        return actual.length === 0;
      case 'isnotempty':
        return actual.length > 0;
      default:
        return true;
    }
  }

  private describe(reasons: string[]): string {
    if (!reasons.length) return 'No disponible.';
    return `No disponible hasta que: ${reasons.join('; ')}.`;
  }
}
