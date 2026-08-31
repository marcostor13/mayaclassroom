/** Catálogo de eventos notificables, análogo a los *message providers* de Moodle. */
export interface NotificationProvider {
  component: string;
  eventName: string;
  label: string;
  defaultWeb: boolean;
  defaultEmail: boolean;
}

export const NOTIFICATION_PROVIDERS: readonly NotificationProvider[] = [
  { component: 'enrol', eventName: 'course_enrolled', label: 'Matriculación en un curso', defaultWeb: true, defaultEmail: true },
  { component: 'mod/assign', eventName: 'assign_due_soon', label: 'Tarea próxima a vencer', defaultWeb: true, defaultEmail: true },
  { component: 'mod/assign', eventName: 'assign_submitted', label: 'Nueva entrega de tarea', defaultWeb: true, defaultEmail: true },
  { component: 'mod/assign', eventName: 'assign_graded', label: 'Tarea calificada', defaultWeb: true, defaultEmail: true },
  { component: 'mod/quiz', eventName: 'quiz_graded', label: 'Cuestionario calificado', defaultWeb: true, defaultEmail: false },
  { component: 'mod/quiz', eventName: 'quiz_closing', label: 'Cuestionario a punto de cerrar', defaultWeb: true, defaultEmail: true },
  { component: 'mod/forum', eventName: 'forum_post', label: 'Nuevo mensaje en un foro suscrito', defaultWeb: true, defaultEmail: true },
  { component: 'message', eventName: 'message_received', label: 'Mensaje personal recibido', defaultWeb: true, defaultEmail: false },
  { component: 'core', eventName: 'course_completed', label: 'Curso completado', defaultWeb: true, defaultEmail: true },
  { component: 'core', eventName: 'calendar_reminder', label: 'Recordatorio de evento del calendario', defaultWeb: true, defaultEmail: true },
  { component: 'badges', eventName: 'badge_awarded', label: 'Insignia obtenida', defaultWeb: true, defaultEmail: true },
  { component: 'competency', eventName: 'competency_rated', label: 'Competencia evaluada', defaultWeb: true, defaultEmail: false },
];
