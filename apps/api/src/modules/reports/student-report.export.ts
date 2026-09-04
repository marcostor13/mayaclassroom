import ExcelJS from 'exceljs';
import { CompletionState, DEFAULT_LOCALE, MAYA_BRAND, QuizAttemptState } from '@maya/shared';
import type { StudentReportDto } from '@maya/shared';
import { StudentReportService } from './student-report.service';

/* -------------------------------------------------------------------------- */
/*  Excel                                                                      */
/* -------------------------------------------------------------------------- */

/** Ancho de columna que cabe una fecha con hora sin quedarse corto. */
const ANCHO_FECHA = 18;

const CABECERA_FONDO = 'FF8E2A22';

/**
 * Expediente en Excel, una hoja por asunto.
 *
 * Se reparte en hojas y no en una sola tabla ancha porque cada bloque tiene sus
 * propias columnas —un examen no tiene «minutos» y una asistencia no tiene
 * «nota»— y mezclarlos daba una hoja llena de celdas vacías que nadie podía
 * filtrar. Con hojas separadas, cada una se ordena y se filtra sola.
 */
export async function buildStudentWorkbook(report: StudentReportDto): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = report.tenant.name;
  workbook.created = new Date(report.generatedAt);

  resumen(workbook, report);
  cursos(workbook, report);
  actividades(workbook, report);
  examenes(workbook, report);
  asistencia(workbook, report);

  // `as Buffer` porque exceljs declara el genérico de Node como `ArrayBuffer`.
  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}

/** Da formato de cabecera a la primera fila y congela el desplazamiento. */
function encabezar(sheet: ExcelJS.Worksheet, anchos: number[]): void {
  const fila = sheet.getRow(1);
  fila.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  fila.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CABECERA_FONDO } };
  fila.alignment = { vertical: 'middle' };
  fila.height = 22;
  anchos.forEach((ancho, index) => {
    sheet.getColumn(index + 1).width = ancho;
  });
  // Sin esto, al bajar por una lista larga se pierde de vista qué es cada
  // columna, que es justo cuando más falta hace.
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: anchos.length },
  };
}

function fecha(value: string | null): string {
  if (!value) return '';
  return new Date(value).toLocaleString(DEFAULT_LOCALE);
}

function resumen(workbook: ExcelJS.Workbook, report: StudentReportDto): void {
  const sheet = workbook.addWorksheet('Resumen');
  sheet.getColumn(1).width = 34;
  sheet.getColumn(2).width = 46;

  const titulo = sheet.addRow([report.tenant.name]);
  titulo.font = { bold: true, size: 16, color: { argb: CABECERA_FONDO } };
  sheet.addRow(['Expediente del alumno']).font = { bold: true, size: 13 };
  sheet.addRow([]);

  const datos: [string, string][] = [
    ['Alumno', report.student.fullName],
    ['Correo', report.student.email],
    ['Documento de identidad', report.student.idNumber ?? ''],
    ['Teléfono', report.student.phone ?? ''],
    ['Ciudad', report.student.city ?? ''],
    ['País', report.student.country ?? ''],
    ['Área', report.student.department ?? ''],
    ['Institución', report.student.institution ?? ''],
    ['Alta en la plataforma', fecha(report.student.createdAt)],
    ['Último acceso', fecha(report.student.lastAccessAt)],
    ['Firma registrada', report.signature ? `Sí, el ${fecha(report.signature.signedAt)}` : 'No'],
    ['Informe generado', fecha(report.generatedAt)],
  ];
  for (const [etiqueta, valor] of datos) {
    const fila = sheet.addRow([etiqueta, valor]);
    fila.getCell(1).font = { bold: true };
  }

  sheet.addRow([]);
  sheet.addRow(['Indicadores']).font = { bold: true, size: 13 };
  for (const kpi of report.kpis) {
    const valor =
      kpi.unit === 'percent'
        ? `${kpi.value} %`
        : kpi.unit === 'hours'
          ? `${kpi.value} h`
          : String(kpi.value);
    const fila = sheet.addRow([kpi.label, kpi.hint ? `${valor} (${kpi.hint})` : valor]);
    fila.getCell(1).font = { bold: true };
  }
}

function cursos(workbook: ExcelJS.Workbook, report: StudentReportDto): void {
  const sheet = workbook.addWorksheet('Cursos');
  sheet.addRow([
    'Curso',
    'Código',
    'Matriculado',
    'Último acceso',
    'Avance %',
    'Actividades',
    'Nota final',
    'Nota mínima',
    'Resultado',
    'Vídeo %',
    'Horas de vídeo',
    'Certificado',
  ]);
  encabezar(sheet, [38, 14, ANCHO_FECHA, ANCHO_FECHA, 10, 14, 11, 12, 13, 10, 15, 22]);

  for (const row of report.courses) {
    sheet.addRow([
      row.fullName,
      row.shortName,
      fecha(row.enrolledAt),
      fecha(row.lastAccessAt),
      row.progress,
      `${row.completedModules} / ${row.totalModules}`,
      row.finalGrade ?? '',
      row.passingGrade ?? '',
      row.passed === null ? 'En curso' : row.passed ? 'Aprobado' : 'No superado',
      row.videoPercent ?? '',
      row.videoHours,
      row.certificateCode ?? '',
    ]);
  }
}

function actividades(workbook: ExcelJS.Workbook, report: StudentReportDto): void {
  const sheet = workbook.addWorksheet('Actividades');
  sheet.addRow(['Curso', 'Actividad', 'Tipo', 'Estado', 'Completada el', 'Nota', 'Sobre']);
  encabezar(sheet, [30, 34, 14, 16, ANCHO_FECHA, 10, 10]);

  for (const row of report.activities) {
    sheet.addRow([
      row.courseName,
      row.moduleName,
      StudentReportService.moduleLabel(row.moduleType),
      estadoLabel(row.completionState),
      fecha(row.completedAt),
      row.grade ?? '',
      row.gradeMax ?? '',
    ]);
  }
}

function examenes(workbook: ExcelJS.Workbook, report: StudentReportDto): void {
  const sheet = workbook.addWorksheet('Exámenes');
  sheet.addRow([
    'Curso',
    'Examen',
    'Intento',
    'Estado',
    'Comenzado',
    'Entregado',
    'Nota',
    'Sobre',
    'Nota mínima',
    'Resultado',
  ]);
  encabezar(sheet, [28, 30, 9, 14, ANCHO_FECHA, ANCHO_FECHA, 9, 9, 12, 20]);

  for (const row of report.exams) {
    sheet.addRow([
      row.courseName,
      row.quizName,
      row.attempt,
      row.state === QuizAttemptState.Finished ? 'Finalizado' : 'En curso',
      fecha(row.startedAt),
      fecha(row.finishedAt),
      row.grade ?? '',
      row.maxGrade,
      row.passingGrade ?? '',
      row.pendingManualGrading
        ? 'Pendiente de corrección'
        : row.passed === null
          ? '—'
          : row.passed
            ? 'Aprobado'
            : 'Suspenso',
    ]);
  }
}

function asistencia(workbook: ExcelJS.Workbook, report: StudentReportDto): void {
  const sheet = workbook.addWorksheet('Asistencia');
  sheet.addRow(['Sesión', 'Curso', 'Fecha', 'Minutos', 'Firmada', 'Firmada el']);
  encabezar(sheet, [34, 28, ANCHO_FECHA, 10, 10, ANCHO_FECHA]);

  for (const row of report.attendance) {
    sheet.addRow([
      row.sessionTitle,
      row.courseName ?? '',
      fecha(row.startedAt),
      row.minutes,
      row.signed ? 'Sí' : 'No',
      fecha(row.signedAt),
    ]);
  }
}

function estadoLabel(state: CompletionState): string {
  switch (state) {
    case CompletionState.Complete:
      return 'Completada';
    case CompletionState.CompletePass:
      return 'Completada y aprobada';
    case CompletionState.CompleteFail:
      return 'Completada sin aprobar';
    default:
      return 'Pendiente';
  }
}

/* -------------------------------------------------------------------------- */
/*  Versión imprimible                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Expediente listo para imprimir o guardar como PDF.
 *
 * Se entrega como HTML con estilos de impresión en lugar de generar el PDF en
 * el servidor: un motor de PDF obligaría a llevar un navegador completo en la
 * imagen de despliegue, y lo que se gana —que el archivo salga hecho— no
 * compensa. El navegador ya sabe imprimir, respeta la tipografía y hace saltos
 * de página razonables si se le dice dónde no partir.
 */
export function buildStudentPrintable(report: StudentReportDto): string {
  const kpis = report.kpis
    .map(
      (kpi) => `<div class="kpi">
        <span class="kpi__valor">${kpi.value}${kpi.unit === 'percent' ? ' %' : kpi.unit === 'hours' ? ' h' : ''}</span>
        <span class="kpi__etiqueta">${escape(kpi.label)}</span>
        ${kpi.hint ? `<span class="kpi__pista">${escape(kpi.hint)}</span>` : ''}
      </div>`,
    )
    .join('');

  const cursosHtml = report.courses.length
    ? tabla(
        ['Curso', 'Avance', 'Actividades', 'Nota final', 'Resultado', 'Vídeo', 'Certificado'],
        report.courses.map((row) => [
          escape(row.fullName),
          `${row.progress} %`,
          `${row.completedModules} / ${row.totalModules}`,
          row.finalGrade === null
            ? '—'
            : `${row.finalGrade}${row.passingGrade !== null ? ` / ${row.passingGrade} mín.` : ''}`,
          row.passed === null ? 'En curso' : row.passed ? 'Aprobado' : 'No superado',
          row.videoPercent === null ? '—' : `${row.videoPercent} %`,
          row.certificateCode ?? '—',
        ]),
      )
    : '<p class="vacio">Sin cursos matriculados.</p>';

  const examenesHtml = report.exams.length
    ? tabla(
        ['Curso', 'Examen', 'Intento', 'Entregado', 'Nota', 'Resultado'],
        report.exams.map((row) => [
          escape(row.courseName),
          escape(row.quizName),
          String(row.attempt),
          fechaCorta(row.finishedAt),
          row.grade === null ? '—' : `${row.grade} / ${row.maxGrade}`,
          row.pendingManualGrading
            ? 'Pendiente de corrección'
            : row.passed === null
              ? '—'
              : row.passed
                ? 'Aprobado'
                : 'Suspenso',
        ]),
      )
    : '<p class="vacio">Sin exámenes realizados.</p>';

  const asistenciaHtml = report.attendance.length
    ? tabla(
        ['Sesión', 'Curso', 'Fecha', 'Duración', 'Firmada'],
        report.attendance.map((row) => [
          escape(row.sessionTitle),
          escape(row.courseName ?? '—'),
          fechaCorta(row.startedAt),
          `${row.minutes} min`,
          row.signed ? `Sí · ${fechaCorta(row.signedAt)}` : 'No',
        ]),
      )
    : '<p class="vacio">Sin asistencia a clases en vivo.</p>';

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Expediente de ${escape(report.student.fullName)}</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { margin:0; font-family:'Segoe UI',system-ui,sans-serif; color:${MAYA_BRAND.colors.ink};
         font-size:12px; line-height:1.5; background:#fff; }
  .hoja { max-width: 900px; margin: 0 auto; padding: 24px; }
  header.marca { display:flex; align-items:center; gap:16px; padding-bottom:16px;
                 border-bottom:3px solid ${MAYA_BRAND.colors.primary}; margin-bottom:24px; }
  header.marca img { max-height:56px; max-width:180px; }
  header.marca .empresa { font-size:18px; font-weight:800; color:${MAYA_BRAND.colors.primaryDeep}; }
  header.marca .doc { font-size:12px; color:#7a6a66; }
  h1 { font-size:22px; margin:0 0 4px; }
  h2 { font-size:14px; margin:26px 0 10px; color:${MAYA_BRAND.colors.primaryDeep};
       border-bottom:1px solid #eadfdc; padding-bottom:5px; }
  .ficha { display:grid; grid-template-columns:repeat(3,1fr); gap:8px 20px; margin-bottom:8px; }
  .ficha div { break-inside:avoid; }
  .ficha dt { font-size:10px; text-transform:uppercase; letter-spacing:.04em; color:#948a86; }
  .ficha dd { margin:0; font-weight:600; }
  .kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:8px; }
  .kpi { border:1px solid #eadfdc; border-radius:8px; padding:10px 12px; break-inside:avoid; }
  .kpi__valor { display:block; font-size:20px; font-weight:800; color:${MAYA_BRAND.colors.primaryDeep}; }
  .kpi__etiqueta { display:block; font-size:11px; }
  .kpi__pista { display:block; font-size:10px; color:#948a86; }
  table { width:100%; border-collapse:collapse; margin-bottom:8px; }
  th, td { text-align:left; padding:6px 8px; border-bottom:1px solid #f0e8e6; vertical-align:top; }
  th { font-size:10px; text-transform:uppercase; letter-spacing:.04em; color:#948a86;
       background:#faf6f5; }
  tr { break-inside:avoid; }
  .vacio { color:#948a86; font-style:italic; }
  .firma { margin-top:32px; display:flex; justify-content:flex-end; break-inside:avoid; }
  .firma__caja { text-align:center; min-width:240px; }
  .firma__caja img { display:block; height:70px; margin:0 auto 4px; }
  .firma__caja span { display:block; border-top:1px solid #cfc4c1; padding-top:4px;
                      font-size:11px; color:#7a6a66; }
  footer { margin-top:28px; padding-top:10px; border-top:1px solid #eadfdc;
           font-size:10px; color:#948a86; display:flex; justify-content:space-between; }
  .imprimir { position:fixed; top:16px; right:16px; padding:10px 18px; border:0;
              border-radius:999px; background:${MAYA_BRAND.colors.primary}; color:#fff;
              font-size:13px; font-weight:600; cursor:pointer; }
  @media print { .imprimir { display:none } .hoja { padding:0 } }
</style></head><body>
<button class="imprimir" onclick="window.print()">Guardar como PDF</button>
<div class="hoja">
  <header class="marca">
    ${report.tenant.logoUrl ? `<img src="${report.tenant.logoUrl}" alt="${escape(report.tenant.name)}">` : ''}
    <div>
      <div class="empresa">${escape(report.tenant.name)}</div>
      <div class="doc">Expediente académico del alumno</div>
    </div>
  </header>

  <h1>${escape(report.student.fullName)}</h1>
  <dl class="ficha">
    <div><dt>Correo</dt><dd>${escape(report.student.email)}</dd></div>
    <div><dt>Documento</dt><dd>${escape(report.student.idNumber ?? '—')}</dd></div>
    <div><dt>Teléfono</dt><dd>${escape(report.student.phone ?? '—')}</dd></div>
    <div><dt>Ciudad</dt><dd>${escape(report.student.city ?? '—')}</dd></div>
    <div><dt>Institución</dt><dd>${escape(report.student.institution ?? '—')}</dd></div>
    <div><dt>Último acceso</dt><dd>${fechaCorta(report.student.lastAccessAt)}</dd></div>
  </dl>

  <h2>Indicadores</h2>
  <div class="kpis">${kpis}</div>

  <h2>Cursos</h2>
  ${cursosHtml}

  <h2>Exámenes</h2>
  ${examenesHtml}

  <h2>Asistencia a clases en vivo</h2>
  ${asistenciaHtml}

  ${
    report.signature
      ? `<div class="firma"><div class="firma__caja">
           <img src="${report.signature.imageDataUrl}" alt="Firma de ${escape(report.student.fullName)}">
           <span>${escape(report.student.fullName)}</span>
         </div></div>`
      : ''
  }

  <footer>
    <span>${escape(report.tenant.name)} · expediente de ${escape(report.student.fullName)}</span>
    <span>Generado el ${fechaCorta(report.generatedAt)}</span>
  </footer>
</div>
</body></html>`;
}

function tabla(cabeceras: string[], filas: string[][]): string {
  return `<table><thead><tr>${cabeceras.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
<tbody>${filas
    .map((fila) => `<tr>${fila.map((celda) => `<td>${celda}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`;
}

function fechaCorta(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(DEFAULT_LOCALE, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
