import type { SiteSection } from '@maya/shared';
import { paginaCurso } from './demo-content';
import type { LeccionDemo } from './demo-content';
import { FOTOS, foto, retrato } from './demo-media';
import type { Videos } from './demo-media';

/* -------------------------------------------------------------------------- */
/*  Los cursos de la demostración                                              */
/*                                                                            */
/*  Una tabla y no cuatro bloques de código: la siembra recorre esta lista y   */
/*  crea el curso, su temario, sus lecciones y su foro. Añadir un curso a la   */
/*  demostración es añadir una entrada.                                        */
/* -------------------------------------------------------------------------- */

export interface TemaDemo {
  nombre: string;
  resumen: string;
  leccion: LeccionDemo;
}

export interface DebateDemo {
  titulo: string;
  mensaje: string;
  /** Respuestas, en orden. Las escribe el alumnado y las cierra el profesorado. */
  respuestas: string[];
}

export interface CursoDemo {
  shortName: string;
  fullName: string;
  summary: string;
  /** Categoría donde cuelga; se crea si no existe. */
  categoria: string;
  categoriaDescripcion: string;
  imagenId: number;
  catalogo: {
    priceCents: number;
    compareAtPriceCents?: number | null;
    headline: string;
    highlights: string[];
    requirements: string[];
    audience: string[];
    level: string;
    durationHours: number;
    instructorName: string;
    instructorRole: string;
    instructorBio: string;
    instructorAvatarId: number;
    ratingAverage: number;
    ratingCount: number;
  };
  /** Página de venta propia. Sin ella se usa la maqueta que compone la plataforma. */
  landing: SiteSection[] | null;
  temas: TemaDemo[];
  foro: { nombre: string; intro: string; debates: DebateDemo[] };
}

/**
 * Cursos de Dulce Lima.
 *
 * Recibe los vídeos ya resueltos porque la dirección del fichero de Pexels no
 * se puede componer a mano: depende de la resolución con la que se publicó.
 */
export function cursosDemo(videos: Videos): CursoDemo[] {
  return [
    /* ---------------------------------------------------------------------- */
    {
      shortName: 'PAST-101',
      fullName: 'Pastelería peruana: alfajores, suspiro limeño y King Kong',
      summary:
        '<p>Las tres joyas de la repostería peruana, con las proporciones exactas, el punto ' +
        'de cada crema y la hoja de costos para venderlas sin regalar el trabajo.</p>',
      categoria: 'Pastelería peruana',
      categoriaDescripcion: 'Los dulces de la casa, con receta escalada y costo por porción.',
      imagenId: FOTOS.surtido,
      catalogo: {
        priceCents: 14900,
        compareAtPriceCents: 24900,
        headline:
          'El manjarblanco que no se corta, el alfajor que se deshace y el suspiro que aguanta ' +
          'la humedad de Lima. Doce horas de obrador y el recetario para vender.',
        highlights: [
          'Cocer manjarblanco al punto firme, sin que se corte ni se cristalice',
          'Masa de alfajor que se deshace en la boca y aguanta el traslado',
          'Merengue italiano estable con la humedad de la costa',
          'Armar y conservar el King Kong con corte limpio',
          'Costear cada porción y poner precio con margen real',
        ],
        requirements: [
          'Ninguno: se empieza desde cero',
          'Horno doméstico, batidora de mano y una balanza de gramo',
        ],
        audience: [
          'Quien vende dulces por encargo y quiere estandarizar sus recetas',
          'Cocineros que quieren sumar la carta de postres peruanos',
          'Aficionados que se cansaron de que la receta salga distinta cada vez',
        ],
        level: 'Iniciación',
        durationHours: 12,
        instructorName: 'Elena Chávez',
        instructorRole: 'Chef pastelera · 15 años entre Lima y Arequipa',
        instructorBio:
          'Se formó en el obrador de su madre y estuvo diez años en la pastelería de un hotel ' +
          'de Miraflores. Enseña lo que produce cada semana, incluidos los fallos que todavía ' +
          'le pasan cuando cambia el clima.',
        instructorAvatarId: FOTOS.amasando,
        ratingAverage: 4.9,
        ratingCount: 214,
      },
      landing: paginaCurso({
        titulo: 'Pastelería peruana clásica',
        gancho:
          'Alfajores, suspiro limeño y King Kong con receta al gramo, vídeo en obrador y la ' +
          'hoja de costos para venderlos desde el primer mes.',
        videoUrl: videos.vitrina,
        imagenId: FOTOS.surtido,
        ventajas: [
          {
            title: 'El punto del manjarblanco',
            body: 'Temperatura, tiempo y cómo saber que ya está sin termómetro de pastelería.',
            icon: 'target',
          },
          {
            title: 'Masa que no se rompe',
            body: 'Proporción de maicena, reposo en frío y grosor exacto del alfajor.',
            icon: 'layers',
          },
          {
            title: 'Merengue que aguanta',
            body: 'Almíbar a 118 °C y montado en caliente: el suspiro deja de bajarse.',
            icon: 'zap',
          },
          {
            title: 'Precio con margen',
            body: 'Plantilla de costos por porción, mermas incluidas, lista para su cuaderno.',
            icon: 'clipboard-check',
          },
        ],
        preguntas: [
          {
            title: '¿Sirve si nunca he horneado?',
            body: 'Sí. El primer módulo empieza por la balanza y las masas base.',
          },
          {
            title: '¿Puedo venderlo con lo del curso?',
            body:
              'De eso se trata. El último módulo es el de costos, conservación y presentación ' +
              'para vitrina o encargo.',
          },
          {
            title: '¿Consigo los ingredientes fuera de Lima?',
            body: 'Todos son de mercado. Se indican marcas y alternativas en cada receta.',
          },
        ],
        galeria: [
          { title: 'Alfajores recién armados', imagenId: FOTOS.surtido },
          { title: 'Suspiro limeño en copa', imagenId: FOTOS.bandeja },
          { title: 'Vitrina de la escuela', imagenId: FOTOS.vitrina },
        ],
      }),
      temas: [
        {
          nombre: 'Módulo 1 · La balanza manda',
          resumen:
            '<p>Por qué la misma receta sale distinta cada vez y cómo dejar de improvisar: ' +
            'peso, temperatura de los ingredientes y orden de trabajo.</p>',
          leccion: {
            prefijo: 'p1',
            intro:
              '<h2>Nada de tazas</h2><p>Una taza de harina pesa entre 110 y 150 gramos según ' +
              'cómo se llene. Esa diferencia es la que hace que un día el alfajor salga ' +
              'quebradizo y al siguiente correoso. Todo el curso trabaja al gramo.</p>',
            videoUrl: videos.vitrina,
            imagenId: FOTOS.mostrador,
            imagenPie: 'El mostrador de la mañana: todo lo que se hace en el curso.',
            desarrollo:
              '<h3>Las tres reglas de la casa</h3><ul>' +
              '<li><strong>Todo pesado</strong>, líquidos incluidos.</li>' +
              '<li><strong>Mantequilla a 18 °C</strong>: si se hunde el dedo sin esfuerzo, ya ' +
              'está demasiado blanda.</li>' +
              '<li><strong>Horno precalentado 20 minutos</strong>, no los 5 que marca el piloto.</li>' +
              '</ul><p>Con esto solo, la mitad de los problemas de la vitrina desaparecen.</p>',
            avisoTitulo: 'Ejercicio del módulo',
            avisoTexto:
              'Pese una taza de harina tal como la llena siempre y anote el resultado. Lo ' +
              'usaremos en el módulo 2 para ajustar su receta.',
          },
        },
        {
          nombre: 'Módulo 2 · Manjarblanco y alfajores',
          resumen:
            '<p>El manjarblanco de punto firme y la masa que se deshace en la boca pero ' +
            'aguanta el traslado hasta el cliente.</p>',
          leccion: {
            prefijo: 'p2',
            intro:
              '<h2>El punto es una temperatura, no un color</h2><p>El manjarblanco está listo ' +
              'a los 104-106 °C. Antes queda corriendo y escurre el alfajor; después se ' +
              'cristaliza y se vuelve arenoso al segundo día.</p>',
            videoUrl: null,
            imagenId: FOTOS.surtido,
            imagenPie: 'Alfajores armados y listos para el azúcar impalpable.',
            desarrollo:
              '<h3>La masa</h3><p>Proporción de la casa: 60 % maicena y 40 % harina. La ' +
              'maicena da el desmoronado; la harina, la estructura que aguanta el armado.</p>' +
              '<p>Reposo obligatorio de 40 minutos en frío. Sin él la masa se encoge en el ' +
              'horno y los discos dejan de casar entre sí.</p>',
            avisoTitulo: 'Fallo típico',
            avisoTexto:
              'Si el alfajor «llora» a las horas, el manjarblanco se quedó corto de cocción. ' +
              'No se arregla en el armado: se arregla en la olla.',
          },
        },
        {
          nombre: 'Módulo 3 · Suspiro limeño',
          resumen:
            '<p>Crema de manjar con yemas y merengue italiano al oporto. El postre que más ' +
            'se pide y el que más se estropea con la humedad.</p>',
          leccion: {
            prefijo: 'p3',
            intro:
              '<h2>Dos preparaciones, un postre</h2><p>Abajo, manjarblanco con yemas cocido a ' +
              'baño maría. Arriba, merengue italiano. Si el merengue se baja, el problema casi ' +
              'siempre está en el almíbar.</p>',
            videoUrl: null,
            imagenId: FOTOS.bandeja,
            imagenPie: 'Copas montadas y espolvoreadas con canela.',
            desarrollo:
              '<h3>Almíbar a 118 °C</h3><p>Ni 115 ni 121. A 118 °C el hilo entra en las claras ' +
              'sin cocerlas de golpe y el merengue queda firme y brillante durante horas, que ' +
              'es lo que hace falta en vitrina.</p>' +
              '<p>Con más de 70 % de humedad, montar en un cuenco frío y guardar el postre sin ' +
              'tapar hasta que enfríe del todo.</p>',
            avisoTitulo: 'Truco de vitrina',
            avisoTexto:
              'Espolvoree la canela justo antes de servir. Si va con horas, absorbe humedad y ' +
              'deja manchas oscuras sobre el merengue.',
          },
        },
        {
          nombre: 'Módulo 4 · King Kong, costos y vitrina',
          resumen:
            '<p>Armado por capas, conservación, presentación y la hoja de costos que decide ' +
            'si el negocio deja algo.</p>',
          leccion: {
            prefijo: 'p4',
            intro:
              '<h2>De la receta al precio</h2><p>Un King Kong bien armado corta limpio y no se ' +
              'desmonta. Y un King Kong bien costeado deja margen aunque suba el precio de la ' +
              'leche.</p>',
            videoUrl: null,
            imagenId: FOTOS.vitrina,
            imagenPie: 'Presentación en vitrina: altura, separación y etiqueta.',
            desarrollo:
              '<h3>La hoja de costos</h3><p>Ingredientes, merma del 8 %, gas, envase y su ' +
              'hora de trabajo. Sobre ese total, el margen. La mayoría de los emprendimientos ' +
              'que cierran no vendían poco: vendían por debajo del costo sin saberlo.</p>',
            avisoTitulo: 'Entregable del curso',
            avisoTexto:
              'Sale del curso con su hoja de costos rellena y el precio de venta de sus tres ' +
              'productos calculado.',
          },
        },
      ],
      foro: {
        nombre: 'Foro del curso',
        intro:
          '<p>Suba la foto de su tanda y cuente qué le salió y qué no. Se responde en el día.</p>',
        debates: [
          {
            titulo: 'Mi manjarblanco se cortó en la segunda tanda',
            mensaje:
              '<p>Seguí los tiempos del módulo 2 pero al llegar a los 104 °C se me cortó y ' +
              'quedó con grumos. Usé leche fresca de bolsa. ¿Puede ser la leche?</p>',
            respuestas: [
              '<p>Casi seguro que sí: la leche muy fría entrando de golpe en la olla caliente ' +
              'corta la emulsión. Atempérela y baje el fuego los primeros diez minutos.</p>',
              '<p>Repetí con la leche a temperatura ambiente y salió perfecto. ¡Gracias!</p>',
            ],
          },
          {
            titulo: '¿Cuánto cobran ustedes por docena de alfajores?',
            mensaje:
              '<p>Estoy con la hoja de costos del módulo 4 y me sale S/ 22 la docena de costo. ' +
              '¿Qué margen es razonable para venta por encargo en Lima?</p>',
            respuestas: [
              '<p>Para encargo, entre 2,5 y 3 veces el costo. Por debajo de 2,5 no queda para ' +
              'reponer equipo. Y cobre el envase aparte si es de regalo.</p>',
            ],
          },
        ],
      },
    },

    /* ---------------------------------------------------------------------- */
    {
      shortName: 'CHOC-201',
      fullName: 'Chocolatería fina: templado, bombones y trufas con cacao peruano',
      summary:
        '<p>Templar cacao peruano sin equipo de laboratorio y sacar bombones con brillo de ' +
        'vitrina, contracción limpia y tres semanas de vida útil.</p>',
      categoria: 'Chocolatería',
      categoriaDescripcion: 'Cacao peruano, templado y bombonería de vitrina.',
      imagenId: FOTOS.chocolate,
      catalogo: {
        priceCents: 24900,
        headline:
          'La curva de templado por sembrado, el molde que desmolda solo y la ganache que ' +
          'aguanta tres semanas. Con cacao de Quillabamba y San Martín.',
        highlights: [
          'Templar por sembrado con termómetro de cocina, sin máquina',
          'Sacar el molde con brillo, sin vetas ni manchas blancas',
          'Formular ganaches con la actividad de agua controlada',
          'Rellenos con fruta amazónica: aguaymanto, camu camu y lúcuma',
          'Envasar y etiquetar para vender con vida útil real',
        ],
        requirements: [
          'Haber trabajado en cocina o pastelería, aunque sea en casa',
          'Termómetro de cocina y una superficie fría (mármol o granito)',
        ],
        audience: [
          'Pastelerías que quieren subir el ticket con bombonería',
          'Emprendimientos de cacao que ya tienen la barra y quieren el bombón',
        ],
        level: 'Intermedio',
        durationHours: 16,
        instructorName: 'Marco Ttito',
        instructorRole: 'Maestro chocolatero · cacao de Quillabamba',
        instructorBio:
          'Trabaja con cooperativas de cacao del Cusco y de San Martín desde 2014. Su obsesión ' +
          'es que el bombón sepa al origen y no al azúcar, y que se pueda replicar en una ' +
          'cocina sin aire acondicionado.',
        instructorAvatarId: FOTOS.cocina,
        ratingAverage: 4.8,
        ratingCount: 96,
      },
      landing: paginaCurso({
        titulo: 'Chocolatería fina con cacao peruano',
        gancho:
          'Del grano al bombón: templado por sembrado, moldeado con brillo y ganaches que ' +
          'duran. Dieciséis horas, con cacao de origen.',
        videoUrl: videos.chocolate,
        imagenId: FOTOS.chocolate,
        ventajas: [
          {
            title: 'Templado sin máquina',
            body: 'La curva por sembrado, paso a paso, con termómetro de cocina.',
            icon: 'target',
          },
          {
            title: 'Brillo de vitrina',
            body: 'Por qué aparece el veteado blanco y cómo evitarlo en clima cálido.',
            icon: 'zap',
          },
          {
            title: 'Ganache que dura',
            body: 'Proporciones, azúcares invertidos y conservación sin conservantes raros.',
            icon: 'shield-check',
          },
          {
            title: 'Sabor de origen',
            body: 'Cómo cambia el bombón según el porcentaje y la procedencia del cacao.',
            icon: 'layers',
          },
        ],
        preguntas: [
          {
            title: '¿Necesito una templadora?',
            body: 'No. Todo el curso se hace por sembrado, sobre mármol o en bol.',
          },
          {
            title: '¿Funciona en la selva o en la sierra?',
            body:
              'Sí, y hay un apartado para cada clima: temperatura ambiente, humedad y tiempos ' +
              'de cristalización cambian, y se indican.',
          },
        ],
        galeria: [
          { title: 'Bombones acabados', imagenId: FOTOS.chocolate },
          { title: 'Torta de chocolate y fresas', imagenId: FOTOS.tortaChocolate },
          { title: 'Macarons de la casa', imagenId: FOTOS.macaronsTrio },
        ],
      }),
      temas: [
        {
          nombre: 'Módulo 1 · El cacao peruano',
          resumen:
            '<p>Orígenes, porcentajes y qué significan de verdad en la boca y en el molde.</p>',
          leccion: {
            prefijo: 'c1',
            intro:
              '<h2>El porcentaje no es la calidad</h2><p>Un 70 % dice cuánta pasta y manteca ' +
              'de cacao hay, no si está bien fermentado. Un cacao mal fermentado al 80 % sabe ' +
              'peor que uno bueno al 55 %.</p>',
            videoUrl: videos.chocolate,
            imagenId: FOTOS.chocolate,
            imagenPie: 'Chocolate atemperado, listo para moldear.',
            desarrollo:
              '<h3>Qué mirar al comprar</h3><ul><li><strong>Fluidez:</strong> más manteca, ' +
              'mejor para moldes finos.</li><li><strong>Fermentación:</strong> el amargor ' +
              'astringente es defecto, no carácter.</li><li><strong>Origen:</strong> ' +
              'Quillabamba tira a frutal; San Martín, a nuez.</li></ul>',
            avisoTitulo: 'Ejercicio',
            avisoTexto:
              'Compre dos chocolates de distinto origen y catelos en frío y a 20 °C. Anote las ' +
              'diferencias: se notan más de lo que parece.',
          },
        },
        {
          nombre: 'Módulo 2 · Templado por sembrado',
          resumen: '<p>La curva completa, con termómetro de cocina y sin equipo especial.</p>',
          leccion: {
            prefijo: 'c2',
            intro:
              '<h2>Tres temperaturas</h2><p>Fundir a 45-50 °C, bajar a 27-28 °C sembrando y ' +
              'subir a 31-32 °C para trabajar. Esa es toda la curva del chocolate negro.</p>',
            videoUrl: null,
            imagenId: FOTOS.chocolate,
            imagenPie: 'Sembrado: se añade chocolate sólido para bajar la temperatura.',
            desarrollo:
              '<h3>La prueba de la espátula</h3><p>Moje la punta y déjela cinco minutos a 20 °C. ' +
              'Si endurece mate o con vetas, el templado no está. Repetir es barato; moldear ' +
              'cien bombones que se blanquean, no.</p>',
            avisoTitulo: 'Aviso',
            avisoTexto:
              'Una gota de agua en el chocolate fundido lo espesa y lo arruina. Seque bien el ' +
              'bol y no tape con nada que condense.',
          },
        },
        {
          nombre: 'Módulo 3 · Moldes, rellenos y acabado',
          resumen: '<p>Capa fina, relleno a 28 °C, cierre y desmoldado limpio.</p>',
          leccion: {
            prefijo: 'c3',
            intro:
              '<h2>El molde no perdona</h2><p>Frío, seco y pulido con algodón. Cualquier resto ' +
              'de grasa o humedad se ve en el bombón acabado como una mancha mate.</p>',
            videoUrl: null,
            imagenId: FOTOS.tortaChocolate,
            imagenPie: 'Acabado brillante: señal de que el templado entró bien.',
            desarrollo:
              '<h3>Ganache de aguaymanto</h3><p>Pulpa reducida, nata, chocolate al 55 % y un ' +
              'punto de glucosa. La glucosa no es para endulzar: baja la actividad de agua y ' +
              'alarga la vida útil de diez días a tres semanas.</p>',
            avisoTitulo: 'Entregable',
            avisoTexto:
              'Al terminar el módulo tendrá una caja de doce bombones de tres rellenos, con su ' +
              'etiqueta y su fecha de consumo preferente.',
          },
        },
      ],
      foro: {
        nombre: 'Foro del curso',
        intro: '<p>Fotos de sus moldes y dudas de templado. Aquí se resuelven.</p>',
        debates: [
          {
            titulo: 'Vetas blancas al día siguiente',
            mensaje:
              '<p>Los bombones salieron brillantes pero amanecieron con vetas blancas. Los dejé ' +
              'en la cocina, unos 26 °C. ¿Es el templado o la temperatura?</p>',
            respuestas: [
              '<p>Es la temperatura. A 26 °C la manteca migra y aflora. Guárdelos entre 16 y ' +
              '18 °C, en caja cerrada y lejos del refrigerador.</p>',
            ],
          },
        ],
      },
    },

    /* ---------------------------------------------------------------------- */
    {
      shortName: 'PAN-150',
      fullName: 'Panadería artesanal: masa madre, pan de yema y panetón',
      summary:
        '<p>De la masa madre viva al panetón de diciembre, con los tiempos ajustados a la ' +
        'humedad de la costa peruana.</p>',
      categoria: 'Panadería artesanal',
      categoriaDescripcion: 'Fermentaciones largas, masa madre y el panetón de la casa.',
      imagenId: FOTOS.masaMadre,
      catalogo: {
        priceCents: 18900,
        headline:
          'Una masa madre estable en siete días y las fermentaciones calculadas para el clima ' +
          'de Lima. Incluye el panetón, que es el examen de diciembre.',
        highlights: [
          'Levantar y mantener una masa madre que no huele a acetona',
          'Calcular la fermentación por temperatura ambiente, no por reloj',
          'Formar, greñar y hornear con vapor en horno doméstico',
          'Pan de yema y panetón con esponja de tres fases',
        ],
        requirements: [
          'Ganas de estar pendiente de una masa durante una semana',
          'Horno con termostato y una olla o piedra para el vapor',
        ],
        audience: [
          'Panaderías pequeñas que quieren pasar de la levadura industrial',
          'Quien hornea en casa y quiere vender los fines de semana',
        ],
        level: 'Intermedio',
        durationHours: 14,
        instructorName: 'Julio Ramírez',
        instructorRole: 'Panadero · tercera generación, Callao',
        instructorBio:
          'Su abuelo abrió la panadería del barrio en 1961 y él sigue amasando ahí. Se pasó a ' +
          'la masa madre en 2016 y cuenta el proceso con los errores incluidos.',
        instructorAvatarId: FOTOS.panes,
        ratingAverage: 4.7,
        ratingCount: 132,
      },
      /* Sin página propia a propósito: en la demostración enseña cómo queda la
         ficha que la plataforma compone sola, al lado de las diseñadas. */
      landing: null,
      temas: [
        {
          nombre: 'Módulo 1 · La masa madre',
          resumen: '<p>Siete días desde la harina y el agua hasta un cultivo que sube solo.</p>',
          leccion: {
            prefijo: 'n1',
            intro:
              '<h2>Ni misterio ni religión</h2><p>Harina, agua y tiempo. Lo único que hace ' +
              'falta es refrescar a horas parecidas y no tirarla el día tres, que es cuando ' +
              'huele raro y todo el mundo se rinde.</p>',
            videoUrl: videos.obrador,
            imagenId: FOTOS.masaMadre,
            imagenPie: 'Pan de masa madre con la corteza bien tostada.',
            desarrollo:
              '<h3>Calendario de la primera semana</h3><ul><li><strong>Días 1-3:</strong> ' +
              'olor agrio y poca actividad. Normal.</li><li><strong>Días 4-5:</strong> empieza ' +
              'a doblar. Pase a dos refrescos diarios.</li><li><strong>Días 6-7:</strong> ' +
              'dobla en 4-6 horas a 24 °C. Ya se puede panificar.</li></ul>',
            avisoTitulo: 'Señal de alarma',
            avisoTexto:
              'Olor a acetona o a esmalte de uñas quiere decir hambre: refresque más seguido o ' +
              'baje la hidratación.',
          },
        },
        {
          nombre: 'Módulo 2 · Fermentar con el clima de la costa',
          resumen: '<p>El reloj miente; la temperatura, no. Cómo ajustar los tiempos.</p>',
          leccion: {
            prefijo: 'n2',
            intro:
              '<h2>Grados por hora</h2><p>La misma masa fermenta en tres horas a 28 °C y en ' +
              'seis a 20 °C. En Lima eso cambia entre enero y julio, y por eso una receta con ' +
              'tiempos fijos falla medio año.</p>',
            videoUrl: null,
            imagenId: FOTOS.panReciente,
            imagenPie: 'Miga abierta: fermentación en su punto.',
            desarrollo:
              '<h3>La prueba del dedo</h3><p>Presione la masa: si vuelve despacio y deja una ' +
              'marca leve, está lista. Si vuelve de golpe, le falta; si no vuelve, se pasó y ' +
              'el pan saldrá plano.</p>',
            avisoTitulo: 'Ajuste rápido',
            avisoTexto:
              'Por cada grado por encima de 24 °C, reste unos diez minutos de bloque. Anótelo ' +
              'en su cuaderno con la temperatura del día.',
          },
        },
        {
          nombre: 'Módulo 3 · Pan de yema y panetón',
          resumen: '<p>Masas enriquecidas: esponja, incorporación de grasa y horneado.</p>',
          leccion: {
            prefijo: 'n3',
            intro:
              '<h2>El azúcar y la grasa frenan</h2><p>Una masa con huevo, mantequilla y azúcar ' +
              'fermenta mucho más despacio. Por eso el panetón se hace por esponja, en tres ' +
              'fases, y no de una vez.</p>',
            videoUrl: null,
            imagenId: FOTOS.panes,
            imagenPie: 'Horneado del día en el obrador.',
            desarrollo:
              '<h3>Colgar el panetón</h3><p>Al salir del horno se atraviesa con dos brochetas ' +
              'y se cuelga boca abajo dos horas. Sin eso, la miga caliente se vence por su ' +
              'propio peso y el panetón queda hundido.</p>',
            avisoTitulo: 'Examen de diciembre',
            avisoTexto:
              'El entregable del curso es un panetón de 900 g con miga filamentosa y alveolado ' +
              'vertical. Suba la foto del corte al foro.',
          },
        },
      ],
      foro: {
        nombre: 'Foro del curso',
        intro: '<p>Fotos del corte, dudas de fermentación y rescates de masa madre.</p>',
        debates: [
          {
            titulo: 'Mi pan sale plano aunque la masa madre dobla',
            mensaje:
              '<p>La masa madre dobla en cinco horas, pero el pan me sale plano y con la miga ' +
              'apretada. Formo como en el vídeo. ¿Qué reviso primero?</p>',
            respuestas: [
              '<p>Suena a sobrefermentado en bloque. Con 27 °C de ambiente, corte el bloque ' +
              'una hora antes de lo que dice la receta y haga la prueba del dedo.</p>',
              '<p>Efectivamente era eso. Bajé el bloque a 3 horas y subió como nunca.</p>',
            ],
          },
        ],
      },
    },

    /* ---------------------------------------------------------------------- */
    {
      shortName: 'INTRO-10',
      fullName: 'Primeros pasos en pastelería: cinco preparaciones base',
      summary:
        '<p>Las cinco preparaciones que sostienen media pastelería: bizcocho, crema pastelera, ' +
        'merengue, ganache y almíbar. Gratis, para conocer la escuela por dentro.</p>',
      categoria: 'Pastelería peruana',
      categoriaDescripcion: 'Los dulces de la casa, con receta escalada y costo por porción.',
      imagenId: FOTOS.tortaGlaseada,
      catalogo: {
        // Gratuito a propósito: deja probar la matrícula de punta a punta sin
        // pasarela ni tarjeta, que es lo primero que se quiere ver en una demo.
        priceCents: 0,
        headline:
          'Cinco preparaciones que aparecen en casi todo lo que se hornea. Cuatro horas, ' +
          'gratis, y con el recetario descargable.',
        highlights: [
          'Bizcocho genovés que no se baja al sacarlo del horno',
          'Crema pastelera sin grumos y sin sabor a harina cruda',
          'Merengue francés, italiano y suizo: cuándo usar cada uno',
          'Ganache en la proporción correcta según para qué se usa',
        ],
        requirements: ['Ninguno. Horno, batidora y balanza.'],
        audience: [
          'Quien empieza y no sabe por dónde',
          'Quien quiere ver cómo damos las clases antes de pagar un curso',
        ],
        level: 'Iniciación',
        durationHours: 4,
        instructorName: 'Elena Chávez',
        instructorRole: 'Chef pastelera · 15 años entre Lima y Arequipa',
        instructorBio:
          'Da este curso gratuito porque prefiere que la gente pruebe cómo enseña antes de ' +
          'pagar nada. Las cinco recetas son las mismas que usa en el obrador.',
        instructorAvatarId: FOTOS.amasando,
        ratingAverage: 4.9,
        ratingCount: 431,
      },
      landing: paginaCurso({
        titulo: 'Primeros pasos en pastelería',
        gancho:
          'Cinco preparaciones base, cuatro horas y el recetario para llevar. Gratis: es ' +
          'nuestra carta de presentación.',
        videoUrl: videos.decorando,
        imagenId: FOTOS.tortaGlaseada,
        ventajas: [
          {
            title: 'Bizcocho que sube y se queda',
            body: 'Montado de huevos, incorporación de la harina y horno estable.',
            icon: 'zap',
          },
          {
            title: 'Crema pastelera fina',
            body: 'Temperatura de cocción y el colado que quita los grumos de una vez.',
            icon: 'target',
          },
          {
            title: 'Los tres merengues',
            body: 'Cuál aguanta el calor, cuál se hornea y cuál se come tal cual.',
            icon: 'layers',
          },
          {
            title: 'Ganache según el uso',
            body: 'Proporción para relleno, para cobertura y para trufa.',
            icon: 'clipboard-check',
          },
        ],
        preguntas: [
          {
            title: '¿De verdad es gratis?',
            body: 'Sí. Se matricula, entra y lo hace. Sin tarjeta y sin caducidad.',
          },
          {
            title: '¿Y después qué curso hago?',
            body:
              'Depende de lo que quiera vender: pastelería peruana si son dulces de la casa, ' +
              'chocolatería si busca margen, panadería si le tira el pan.',
          },
        ],
        galeria: [
          { title: 'Torta glaseada del taller', imagenId: FOTOS.tortaGlaseada },
          { title: 'Capas y relleno', imagenId: FOTOS.tortaCapas },
          { title: 'Macarons de práctica', imagenId: FOTOS.macarons },
        ],
      }),
      temas: [
        {
          nombre: 'Módulo 1 · Bizcocho y almíbar',
          resumen: '<p>El genovés, el punto de cinta y el almíbar que lo mantiene jugoso.</p>',
          leccion: {
            prefijo: 'i1',
            intro:
              '<h2>Punto de cinta</h2><p>Los huevos con azúcar están montados cuando al ' +
              'levantar la varilla la masa cae formando una cinta que tarda tres segundos en ' +
              'desaparecer. Antes de eso, el bizcocho no sube.</p>',
            videoUrl: videos.decorando,
            imagenId: FOTOS.tortaGlaseada,
            imagenPie: 'Bizcocho montado y glaseado.',
            desarrollo:
              '<h3>La harina, con espátula</h3><p>En tres veces y con movimientos envolventes. ' +
              'Con la batidora se pierde el aire que costó diez minutos meter.</p>',
            avisoTitulo: 'No abra el horno',
            avisoTexto:
              'Los primeros 20 minutos, la puerta cerrada. La corriente de aire frío baja el ' +
              'bizcocho y ya no se recupera.',
          },
        },
        {
          nombre: 'Módulo 2 · Crema pastelera y merengues',
          resumen: '<p>Las dos preparaciones que más se repiten y sus fallos típicos.</p>',
          leccion: {
            prefijo: 'i2',
            intro:
              '<h2>La crema hierve</h2><p>Mucha gente la retira antes por miedo a cortarla. Si ' +
              'no rompe a hervir un minuto, el almidón no gelatiniza y queda con sabor a ' +
              'harina cruda.</p>',
            videoUrl: null,
            imagenId: FOTOS.macarons,
            imagenPie: 'Merengue montado en su punto, firme y brillante.',
            desarrollo:
              '<h3>Tres merengues</h3><ul><li><strong>Francés:</strong> claras y azúcar en ' +
              'crudo; para hornear.</li><li><strong>Italiano:</strong> con almíbar a 118 °C; ' +
              'el más estable.</li><li><strong>Suizo:</strong> al baño maría; denso y sedoso.</li></ul>',
            avisoTitulo: 'Ejercicio',
            avisoTexto:
              'Haga los tres merengues el mismo día y déjelos una hora sobre la mesa. La ' +
              'diferencia se ve sola.',
          },
        },
        {
          nombre: 'Módulo 3 · Ganache y montaje',
          resumen: '<p>Proporciones de ganache y cómo montar una torta sencilla.</p>',
          leccion: {
            prefijo: 'i3',
            intro:
              '<h2>Una proporción por uso</h2><p>2:1 de chocolate y nata para trufa, 1:1 para ' +
              'relleno y 1:2 para glaseado. Es toda la teoría.</p>',
            videoUrl: null,
            imagenId: FOTOS.tortaCapas,
            imagenPie: 'Montaje por capas con relleno y fruta.',
            desarrollo:
              '<h3>Montar sin que se salga</h3><p>Bordee cada capa con un cordón de ganache ' +
              'firme y rellene dentro. Es lo que evita que el relleno escape por los lados al ' +
              'apoyar la capa siguiente.</p>',
            avisoTitulo: 'Ya tiene una torta',
            avisoTexto:
              'Con estos tres módulos puede montar una torta entera de principio a fin. Suba ' +
              'la foto al foro: la comentamos.',
          },
        },
      ],
      foro: {
        nombre: 'Foro del curso',
        intro: '<p>Primer curso, primeras dudas. Pregunte sin miedo, aquí empezamos todos.</p>',
        debates: [
          {
            titulo: '¿Puedo hacer el bizcocho sin batidora eléctrica?',
            mensaje:
              '<p>Solo tengo varillas de mano. ¿Llego al punto de cinta o mejor espero a tener ' +
              'batidora?</p>',
            respuestas: [
              '<p>Se llega, pero son unos 15 minutos de brazo. Truco: monte los huevos sobre ' +
              'un baño maría tibio (40 °C) y el aire entra en la mitad de tiempo.</p>',
            ],
          },
        ],
      },
    },
  ];
}

/** Avatar del profesorado, cuadrado, para la ficha de venta. */
export function avatar(id: number): string {
  return retrato(id, 400);
}

/** Imagen de portada del curso. */
export function portada(id: number): string {
  return foto(id, 1200, 800);
}
