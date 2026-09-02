import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AssignDto,
  AssignSubmissionDto,
  ChoiceDto,
  CourseModuleDto,
  DiscussionDto,
  FeedbackDto,
  ForumDto,
  LessonBlock,
  PostDto,
  QuestionDto,
  QuizAttemptDto,
  QuizDto,
} from '../models';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class ActivitiesService {
  private readonly api = inject(ApiService);

  /* --------------------------------- Tarea ------------------------------- */

  assign(moduleId: string): Observable<{
    module: CourseModuleDto;
    assign: AssignDto;
    submission: AssignSubmissionDto | null;
  }> {
    return this.api.get(`/mod/assign/${moduleId}`);
  }

  submitAssign(
    moduleId: string,
    payload: { onlineText?: string; fileIds?: string[]; draft?: boolean; acceptStatement?: boolean },
  ): Observable<AssignSubmissionDto> {
    return this.api.post<AssignSubmissionDto>(`/mod/assign/${moduleId}/submit`, payload);
  }

  assignSubmissions(moduleId: string): Observable<AssignSubmissionDto[]> {
    return this.api.get<AssignSubmissionDto[]>(`/mod/assign/${moduleId}/submissions`);
  }

  assignSummary(moduleId: string) {
    return this.api.get<{
      participants: number;
      submitted: number;
      graded: number;
      drafts: number;
      pending: number;
      needsGrading: number;
    }>(`/mod/assign/${moduleId}/summary`);
  }

  gradeSubmission(
    moduleId: string,
    submissionId: string,
    payload: { grade: number; feedbackText?: string },
  ): Observable<AssignSubmissionDto> {
    return this.api.post<AssignSubmissionDto>(
      `/mod/assign/${moduleId}/submissions/${submissionId}/grade`,
      payload,
    );
  }

  /* ----------------------------- Cuestionario ---------------------------- */

  quiz(moduleId: string): Observable<{
    module: CourseModuleDto;
    quiz: QuizDto;
    attempts: QuizAttemptDto[];
  }> {
    return this.api.get(`/mod/quiz/${moduleId}`);
  }

  quizForEdit(moduleId: string): Observable<QuizDto> {
    return this.api.get<QuizDto>(`/mod/quiz/${moduleId}/edit`);
  }

  startAttempt(moduleId: string, password?: string): Observable<QuizAttemptDto> {
    return this.api.post<QuizAttemptDto>(`/mod/quiz/${moduleId}/attempts`, { password });
  }

  attemptQuestions(attemptId: string): Observable<QuestionDto[]> {
    return this.api.get<QuestionDto[]>(`/mod/quiz/attempts/${attemptId}/questions`);
  }

  saveResponse(attemptId: string, questionId: string, answer: unknown) {
    return this.api.post<{ saved: boolean }>(`/mod/quiz/attempts/${attemptId}/responses`, {
      questionId,
      answer,
    });
  }

  finishAttempt(attemptId: string): Observable<QuizAttemptDto> {
    return this.api.post<QuizAttemptDto>(`/mod/quiz/attempts/${attemptId}/finish`);
  }

  addQuizQuestions(moduleId: string, questionIds: string[]): Observable<QuizDto> {
    return this.api.post<QuizDto>(`/mod/quiz/${moduleId}/questions`, { questionIds });
  }

  quizStatistics(moduleId: string) {
    return this.api.get(`/mod/quiz/${moduleId}/statistics`);
  }

  /* --------------------------------- Foro -------------------------------- */

  forum(moduleId: string): Observable<{
    module: CourseModuleDto;
    forum: ForumDto;
    discussions: DiscussionDto[];
  }> {
    return this.api.get(`/mod/forum/${moduleId}`);
  }

  createDiscussion(moduleId: string, payload: { name: string; message: string }) {
    return this.api.post<DiscussionDto>(`/mod/forum/${moduleId}/discussions`, payload);
  }

  discussion(discussionId: string): Observable<{ discussion: DiscussionDto; posts: PostDto[] }> {
    return this.api.get(`/mod/forum/discussions/${discussionId}`);
  }

  reply(discussionId: string, payload: { message: string; parentId?: string }) {
    return this.api.post<PostDto>(`/mod/forum/discussions/${discussionId}/posts`, payload);
  }

  toggleForumSubscription(moduleId: string) {
    return this.api.post<{ subscribed: boolean }>(`/mod/forum/${moduleId}/subscription`);
  }

  /* ------------------------ Consulta, encuesta y recursos ---------------- */

  choice(moduleId: string): Observable<{
    module: CourseModuleDto;
    choice: ChoiceDto;
    myAnswer: string[];
  }> {
    return this.api.get(`/mod/choice/${moduleId}`);
  }

  answerChoice(moduleId: string, optionIds: string[]): Observable<ChoiceDto> {
    return this.api.post<ChoiceDto>(`/mod/choice/${moduleId}/answer`, { optionIds });
  }

  feedback(moduleId: string): Observable<{
    module: CourseModuleDto;
    feedback: FeedbackDto;
    responded: boolean;
  }> {
    return this.api.get(`/mod/feedback/${moduleId}`);
  }

  submitFeedback(moduleId: string, answers: Record<string, unknown>) {
    return this.api.post<{ submitted: boolean }>(`/mod/feedback/${moduleId}/submit`, { answers });
  }

  resource(moduleId: string): Observable<{ module: CourseModuleDto; resource: Record<string, unknown> }> {
    return this.api.get(`/mod/resource/${moduleId}`);
  }

  /** Guarda el contenido de un recurso y devuelve cómo queda. */
  updateResource(
    moduleId: string,
    payload: {
      name?: string;
      intro?: string;
      content?: string;
      blocks?: LessonBlock[];
      externalUrl?: string;
      display?: string;
      fileIds?: string[];
    },
  ): Observable<Record<string, unknown>> {
    return this.api.patch(`/mod/resource/${moduleId}`, payload);
  }

  advanced(moduleId: string): Observable<{ module: CourseModuleDto; activity: Record<string, unknown> }> {
    return this.api.get(`/mod/advanced/${moduleId}`);
  }

  advancedEntries(moduleId: string, entryType: string, mine = false) {
    return this.api.get<Record<string, unknown>[]>(`/mod/advanced/${moduleId}/entries`, {
      entryType,
      mine,
    });
  }

  addAdvancedEntry(moduleId: string, payload: Record<string, unknown>) {
    return this.api.post<Record<string, unknown>>(`/mod/advanced/${moduleId}/entries`, payload);
  }

  /* ------------------------------ Finalización --------------------------- */

  toggleCompletion(moduleId: string, completed: boolean) {
    return this.api.post(`/completion/modules/${moduleId}/toggle`, { completed });
  }

  courseProgress(courseId: string) {
    return this.api.get<{ progress: number; completedModules: number; totalModules: number }>(
      `/completion/courses/${courseId}/me`,
    );
  }
}
