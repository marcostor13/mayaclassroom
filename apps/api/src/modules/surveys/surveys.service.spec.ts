import { SurveyQuestionType, SurveyStatus, SurveyTrigger } from '@maya/shared';
import { SurveysService } from './surveys.service';
import type { SurveyDocument } from './schemas/survey.schema';

/** Encuesta mínima con la forma que esperan `sanitize` y `results`. */
function encuesta(questions: unknown[]): SurveyDocument {
  return {
    id: 'enc1',
    course: 'c1',
    title: 'Satisfacción',
    description: null,
    status: SurveyStatus.Published,
    trigger: SurveyTrigger.OnCompletion,
    anonymous: true,
    questions,
    opensAt: null,
    closesAt: null,
    responseCount: 0,
  } as unknown as SurveyDocument;
}

const pregunta = (id: string, type: SurveyQuestionType, extra: Record<string, unknown> = {}) =>
  ({
    _id: id,
    type,
    text: `Pregunta ${id}`,
    help: null,
    required: false,
    position: 0,
    options: [],
    scaleMax: null,
    scaleMinLabel: null,
    scaleMaxLabel: null,
    ...extra,
  }) as unknown;

describe('SurveysService · limpieza de respuestas', () => {
  const service = Object.create(SurveysService.prototype) as SurveysService;
  // `sanitize` es privado a propósito: se prueba a través del prototipo porque
  // es donde vive la regla que impide que un cliente manipulado meta datos
  // fuera de escala o campos que no existen.
  const sanitize = (survey: SurveyDocument, answers: Record<string, unknown>) =>
    (service as unknown as {
      sanitize(s: SurveyDocument, a: Record<string, unknown>): Record<string, unknown>;
    }).sanitize(survey, answers);

  it('descarta lo que no corresponde a ninguna pregunta', () => {
    const survey = encuesta([pregunta('q1', SurveyQuestionType.Text)]);
    expect(sanitize(survey, { q1: 'bien', inventada: 'x' })).toEqual({ q1: 'bien' });
  });

  it('acepta una escala dentro de su tope y rechaza fuera', () => {
    const survey = encuesta([pregunta('q1', SurveyQuestionType.Scale, { scaleMax: 5 })]);
    expect(sanitize(survey, { q1: '4' })).toEqual({ q1: 4 });
    expect(() => sanitize(survey, { q1: 9 })).toThrow();
    expect(() => sanitize(survey, { q1: 0 })).toThrow();
  });

  it('rechaza una opción que no está entre las ofrecidas', () => {
    const survey = encuesta([
      pregunta('q1', SurveyQuestionType.Single, { options: ['Sí', 'No'] }),
    ]);
    expect(sanitize(survey, { q1: 'Sí' })).toEqual({ q1: 'Sí' });
    expect(() => sanitize(survey, { q1: 'Quizá' })).toThrow();
  });

  it('filtra las opciones desconocidas de una respuesta múltiple', () => {
    const survey = encuesta([
      pregunta('q1', SurveyQuestionType.Multiple, { options: ['A', 'B'] }),
    ]);
    expect(sanitize(survey, { q1: ['A', 'Z'] })).toEqual({ q1: ['A'] });
  });

  it('exige las preguntas obligatorias y deja pasar las opcionales vacías', () => {
    const survey = encuesta([
      pregunta('q1', SurveyQuestionType.Text, { required: true }),
      pregunta('q2', SurveyQuestionType.Text),
    ]);
    expect(() => sanitize(survey, { q2: 'algo' })).toThrow();
    expect(sanitize(survey, { q1: 'algo' })).toEqual({ q1: 'algo' });
  });

  it('recorta un texto desmesurado en lugar de guardarlo entero', () => {
    const survey = encuesta([pregunta('q1', SurveyQuestionType.Paragraph)]);
    const largo = 'a'.repeat(9000);
    expect((sanitize(survey, { q1: largo }).q1 as string).length).toBe(4000);
  });

  it('normaliza el sí o no que llega como texto desde el formulario', () => {
    const survey = encuesta([pregunta('q1', SurveyQuestionType.Boolean)]);
    expect(sanitize(survey, { q1: 'true' })).toEqual({ q1: true });
    expect(sanitize(survey, { q1: false })).toEqual({ q1: false });
  });
});
