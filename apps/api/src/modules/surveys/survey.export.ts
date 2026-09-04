import ExcelJS from 'exceljs';
import { SurveyQuestionType } from '@maya/shared';
import type { SurveyResultsDto } from '@maya/shared';

const CABECERA_FONDO = 'FF8E2A22';

/**
 * Resultados de una encuesta en Excel.
 *
 * Dos hojas: el resumen por pregunta y las respuestas abiertas. Van separadas
 * porque se usan de forma distinta —el resumen se grafica, los textos se leen—
 * y porque un comentario largo en la misma tabla que los porcentajes hace
 * ilegibles las dos cosas.
 *
 * En ningún caso se vuelca una fila por persona: aunque no hay autores
 * guardados, la combinación de respuestas de alguien identificaría a esa
 * persona en un grupo pequeño, y eso rompería lo único que la encuesta promete.
 */
export async function buildSurveyWorkbook(results: SurveyResultsDto): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Maya Classroom';
  workbook.created = new Date();

  resumen(workbook, results);
  abiertas(workbook, results);

  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}

function cabecera(sheet: ExcelJS.Worksheet, anchos: number[]): void {
  const fila = sheet.getRow(1);
  fila.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  fila.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CABECERA_FONDO } };
  fila.height = 22;
  anchos.forEach((ancho, index) => {
    sheet.getColumn(index + 1).width = ancho;
  });
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

function resumen(workbook: ExcelJS.Workbook, results: SurveyResultsDto): void {
  const sheet = workbook.addWorksheet('Resumen');
  sheet.addRow(['Pregunta', 'Tipo', 'Respuestas', 'Opción', 'Recuento', '%', 'Media']);
  cabecera(sheet, [44, 16, 12, 28, 11, 9, 9]);

  for (const question of results.questions) {
    if (question.distribution.length) {
      question.distribution.forEach((item, index) => {
        sheet.addRow([
          index === 0 ? question.text : '',
          index === 0 ? tipoLabel(question.type) : '',
          index === 0 ? question.answered : '',
          item.label,
          item.count,
          item.percent,
          index === 0 ? (question.average ?? '') : '',
        ]);
      });
    } else {
      sheet.addRow([
        question.text,
        tipoLabel(question.type),
        question.answered,
        'Respuestas abiertas',
        question.texts.length,
        '',
        '',
      ]);
    }
  }

  sheet.addRow([]);
  const pie = sheet.addRow([
    `${results.responseCount} respuestas de ${results.invited} matriculados (${results.participation} % de participación)`,
  ]);
  pie.font = { italic: true };

  const aviso = sheet.addRow([
    'Encuesta anónima: las respuestas se guardan sin autor y no pueden atribuirse a ninguna persona.',
  ]);
  aviso.font = { italic: true, color: { argb: 'FF7A6A66' } };
}

function abiertas(workbook: ExcelJS.Workbook, results: SurveyResultsDto): void {
  const conTexto = results.questions.filter((question) => question.texts.length);
  if (!conTexto.length) return;

  const sheet = workbook.addWorksheet('Respuestas abiertas');
  sheet.addRow(['Pregunta', 'Respuesta']);
  cabecera(sheet, [40, 90]);

  for (const question of conTexto) {
    // Se barajan dentro de cada pregunta: en el orden de llegada, dos
    // respuestas de la misma fila serían de la misma persona y volvería a
    // poder reconstruirse quién dijo qué.
    for (const texto of barajar(question.texts)) {
      const fila = sheet.addRow([question.text, texto]);
      fila.getCell(2).alignment = { wrapText: true, vertical: 'top' };
    }
  }
}

/** Barajado de Fisher-Yates sobre una copia. */
function barajar(items: string[]): string[] {
  const copia = [...items];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function tipoLabel(type: SurveyQuestionType): string {
  switch (type) {
    case SurveyQuestionType.Scale:
      return 'Escala';
    case SurveyQuestionType.Single:
      return 'Opción única';
    case SurveyQuestionType.Multiple:
      return 'Opción múltiple';
    case SurveyQuestionType.Boolean:
      return 'Sí o no';
    case SurveyQuestionType.Paragraph:
      return 'Texto largo';
    default:
      return 'Texto corto';
  }
}

/** Los mismos resultados en CSV, para quien prefiera abrirlos en otra cosa. */
export function surveyResultsCsv(results: SurveyResultsDto): string {
  const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const lines = [
    ['Pregunta', 'Tipo', 'Respuestas', 'Opción', 'Recuento', '%', 'Media']
      .map(escape)
      .join(','),
  ];

  for (const question of results.questions) {
    if (question.distribution.length) {
      for (const item of question.distribution) {
        lines.push(
          [
            question.text,
            tipoLabel(question.type),
            question.answered,
            item.label,
            item.count,
            item.percent,
            question.average ?? '',
          ]
            .map(escape)
            .join(','),
        );
      }
    } else {
      for (const texto of barajar(question.texts)) {
        lines.push(
          [question.text, tipoLabel(question.type), question.answered, texto, '', '', '']
            .map(escape)
            .join(','),
        );
      }
    }
  }

  return lines.join('\n');
}
