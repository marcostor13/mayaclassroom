import { QuestionType } from '@maya/shared';
import { QuestionsService } from './questions.service';
import { QuestionDocument } from './schemas/question.schema';

/** Construye una pregunta mínima con la forma que espera `gradeAnswer`. */
function question(overrides: Partial<QuestionDocument>): QuestionDocument {
  return {
    type: QuestionType.MultiChoice,
    single: true,
    answers: [],
    subquestions: [],
    tolerance: 0,
    ...overrides,
  } as unknown as QuestionDocument;
}

const answer = (id: string, text: string, fraction: number) =>
  ({ _id: id, text, fraction }) as unknown as QuestionDocument['answers'][number];

describe('QuestionsService · corrección automática', () => {
  const service = Object.create(QuestionsService.prototype) as QuestionsService;

  it('opción múltiple de respuesta única', () => {
    const q = question({
      answers: [answer('a', 'Correcta', 1), answer('b', 'Incorrecta', 0)],
    });
    expect(service.gradeAnswer(q, 'a')).toEqual({ fraction: 1, needsManual: false, correct: true });
    expect(service.gradeAnswer(q, 'b')).toEqual({ fraction: 0, needsManual: false, correct: false });
  });

  it('opción múltiple con varias respuestas suma las fracciones', () => {
    const q = question({
      single: false,
      answers: [answer('a', 'A', 0.5), answer('b', 'B', 0.5), answer('c', 'C', -0.5)],
    });
    expect(service.gradeAnswer(q, ['a', 'b']).fraction).toBeCloseTo(1, 5);
    expect(service.gradeAnswer(q, ['a']).fraction).toBeCloseTo(0.5, 5);
    // Las fracciones negativas nunca bajan de cero.
    expect(service.gradeAnswer(q, ['c']).fraction).toBe(0);
  });

  it('verdadero/falso', () => {
    const q = question({
      type: QuestionType.TrueFalse,
      answers: [answer('v', 'Verdadero', 1), answer('f', 'Falso', 0)],
    });
    expect(service.gradeAnswer(q, 'v').correct).toBe(true);
    expect(service.gradeAnswer(q, 'f').correct).toBe(false);
  });

  it('respuesta corta, sin distinguir mayúsculas ni espacios', () => {
    const q = question({
      type: QuestionType.ShortAnswer,
      answers: [answer('a', 'Madrid', 1)],
    });
    expect(service.gradeAnswer(q, '  madrid ').correct).toBe(true);
    expect(service.gradeAnswer(q, 'Barcelona').correct).toBe(false);
  });

  it('numérica respetando la tolerancia', () => {
    const q = question({
      type: QuestionType.Numerical,
      tolerance: 0.5,
      answers: [answer('a', '3.14', 1)],
    });
    expect(service.gradeAnswer(q, 3.2).correct).toBe(true);
    expect(service.gradeAnswer(q, 4).correct).toBe(false);
    expect(service.gradeAnswer(q, 'no es un número').fraction).toBe(0);
  });

  it('emparejamiento califica de forma proporcional', () => {
    const q = question({
      type: QuestionType.Matching,
      subquestions: [
        { text: 'España', answer: 'Madrid' },
        { text: 'Francia', answer: 'París' },
      ] as unknown as QuestionDocument['subquestions'],
    });
    expect(service.gradeAnswer(q, { '0': 'Madrid', '1': 'París' }).fraction).toBe(1);
    expect(service.gradeAnswer(q, { '0': 'Madrid', '1': 'Roma' }).fraction).toBeCloseTo(0.5, 5);
  });

  it('el ensayo requiere corrección manual', () => {
    const q = question({ type: QuestionType.Essay });
    expect(service.gradeAnswer(q, 'Una respuesta larga').needsManual).toBe(true);
  });
});

describe('QuestionsService · importación GIFT', () => {
  const service = Object.create(QuestionsService.prototype) as QuestionsService & {
    parseGift(block: string): { type: QuestionType; name: string; answers?: unknown[] };
  };

  it('reconoce una pregunta de opción múltiple', () => {
    const parsed = service.parseGift(
      '::Capital:: ¿Cuál es la capital de España? {=Madrid ~Barcelona ~Sevilla}',
    );
    expect(parsed.type).toBe(QuestionType.MultiChoice);
    expect(parsed.name).toBe('Capital');
    expect(parsed.answers).toHaveLength(3);
  });

  it('reconoce una pregunta de verdadero/falso', () => {
    const parsed = service.parseGift('::Hecho:: El agua hierve a 100 °C a nivel del mar. {TRUE}');
    expect(parsed.type).toBe(QuestionType.TrueFalse);
    expect(parsed.answers).toHaveLength(2);
  });

  it('reconoce una pregunta de respuesta corta', () => {
    const parsed = service.parseGift('::Río:: Río más largo de España {=Tajo}');
    expect(parsed.type).toBe(QuestionType.ShortAnswer);
  });

  it('rechaza un bloque sin respuestas', () => {
    expect(() => service.parseGift('Una pregunta sin llaves')).toThrow(/GIFT/);
  });
});
