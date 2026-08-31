import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CalendarEventDto, CourseSummary } from '../models';
import { ApiService } from './api.service';

export interface DashboardDeadline {
  id: string;
  moduleId: string | null;
  courseId: string;
  name: string;
  dueDate: string | null;
  submitted: boolean;
  graded: boolean;
}

export interface DashboardOverview {
  user: { id: string; fullName: string; avatarUrl: string | null };
  stats: {
    courses: number;
    completedCourses: number;
    averageProgress: number;
    pendingDeadlines: number;
    unreadNotifications: number;
    unreadMessages: number;
  };
  courses: (CourseSummary & { hidden?: boolean })[];
  upcomingEvents: CalendarEventDto[];
  deadlines: DashboardDeadline[];
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly api = inject(ApiService);

  overview(): Observable<DashboardOverview> {
    return this.api.get<DashboardOverview>('/dashboard');
  }
}
