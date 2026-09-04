import { SurveyQuestionType, SurveyStatus, SurveyTrigger } from '../enums';

/* -------------------------------------------------------------------------- */
/*  Encuestas de fin de curso                                                  */
/* -------------------------------------------------------------------------- */

export interface SurveyQuestionDto {
  id: string;
  type: SurveyQuestionType;
  text: string;
  help?: string | null;
  required: boolean;
  /** Opciones de `single` y `multiple`. */
  options: string[];
  /** Tope de la escala; 5 y 10 son los habituales. */
  scaleMax?: number | null;
  /** Etiquetas de los extremos de la escala. */
  scaleMinLabel?: string | null;
  scaleMaxLabel?: string | null;
}

export interface SurveyDto {
  id: string;
  courseId: string;
  courseName?: string;
  title: string;
  description?: string | null;
  status: SurveyStatus;
  trigger: SurveyTrigger;
  /**
   * Siempre cierto en la práctica: la encuesta es la única vía por la que el
   * alumnado opina sin que quede rastro. Se conserva como campo porque un
   * cuestionario de satisfacción interno puede querer lo contrario, y porque
   * el cliente necesita poder avisarlo antes de que alguien escriba.
   */
  anonymous: boolean;
  questions: SurveyQuestionDto[];
  opensAt?: string | null;
  closesAt?: string | null;
  responseCount: number;
  /** Solo llega a quien responde: si ya lo hizo. */
  answered?: boolean;
  /** Solo llega a quien responde: si le corresponde responderla ya. */
  available?: boolean;
  availabilityInfo?: string | null;
}

/** Respuesta que envía el alumno. Nunca vuelve identificada. */
export interface SurveyAnswerInput {
  questionId: string;
  value: string | string[] | number | boolean | null;
}

/** Agregado de una pregunta para el informe. */
export interface SurveyQuestionResult {
  questionId: string;
  text: string;
  type: SurveyQuestionType;
  answered: number;
  /** `single`, `multiple` y `boolean`: recuento por opción. */
  distribution: { label: string; count: number; percent: number }[];
  /** `scale`: media y desglose. */
  average: number | null;
  /** `text` y `paragraph`: las respuestas literales, sin autor. */
  texts: string[];
}

export interface SurveyResultsDto {
  survey: SurveyDto;
  responseCount: number;
  /** Cuánta gente podía responder, para calcular la participación. */
  invited: number;
  participation: number;
  questions: SurveyQuestionResult[];
}
