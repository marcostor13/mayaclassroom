import {
  BadRequestException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CAP, ContextLevel } from '@maya/shared';
import { CurrentUser, Public } from '../../common/decorators';
import type { RequestUser } from '../../common/types/request-context';
import { FilesService } from './files.service';
import { StorageService } from './storage.service';
import { AccessService } from '../rbac/access.service';
import { ContextsService } from '../contexts/contexts.service';

/**
 * Para qué se sube una imagen pública y qué capacidad hace falta en cada caso.
 *
 * Una imagen pública queda accesible sin sesión, así que no puede subirla
 * cualquiera: sin este mapa, la capacidad genérica de subir ficheros —que
 * tiene todo usuario autenticado— convertiría el bucket en alojamiento libre.
 */
const IMAGE_PURPOSES: Record<string, readonly string[]> = {
  /** Logo, favicon y fondo del acceso. */
  branding: [CAP.TENANT_MANAGE_BRANDING, CAP.TENANT_UPDATE],
  /** Portada de un curso y material gráfico del catálogo. */
  course: [CAP.COURSE_UPDATE, CAP.COURSE_CREATE],
  /** Imágenes de las secciones de la página pública. */
  storefront: [CAP.SITE_MANAGE],
};

/** Los vectores SVG quedan fuera: admiten scripts y se sirven sin sesión. */
const PUBLIC_IMAGE_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif'];

/**
 * Vídeo y audio para insertar en una lección.
 *
 * Van por la vía pública, como las imágenes, porque quien los reproduce es una
 * etiqueta `<video>` del navegador y esa no envía cabeceras de sesión. El
 * material con permisos sigue subiéndose por `/files/upload`.
 */
const PUBLIC_MEDIA_MIME = ['video/mp4', 'video/webm', 'video/ogg', 'audio/mpeg', 'audio/ogg', 'audio/wav'];

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Un vídeo de lección cabe de sobra; por encima conviene un servicio de vídeo. */
const MAX_MEDIA_BYTES = 200 * 1024 * 1024;

@ApiTags('Ficheros')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(
    private readonly files: FilesService,
    private readonly storage: StorageService,
    private readonly access: AccessService,
    private readonly contexts: ContextsService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        component: { type: 'string', example: 'user' },
        fileArea: { type: 'string', example: 'draft' },
        itemId: { type: 'string' },
      },
    },
  })
  @ApiOperation({ summary: 'Subir un fichero' })
  async upload(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
    @Query('component') component = 'user',
    @Query('fileArea') fileArea = 'draft',
    @Query('itemId') itemId?: string,
  ) {
    const stored = await this.files.upload({
      tenantId: user.tenantId,
      ownerId: user.id,
      component,
      fileArea,
      itemId: itemId ?? null,
      file,
    });
    return this.files.toRef(stored);
  }

  @Post('upload/image')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        purpose: { type: 'string', enum: Object.keys(IMAGE_PURPOSES), example: 'branding' },
      },
    },
  })
  @ApiOperation({
    summary: 'Subir una imagen, vídeo o audio público (marca, curso o página pública)',
    description:
      'Devuelve una URL servible sin sesión, para insertarla en una lección o en la página ' +
      'pública. Cada uso exige su propia capacidad: subir el logo no es lo mismo que subir el ' +
      'vídeo de un curso. El material con permisos va por «/files/upload».',
  })
  async uploadImage(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
    @Query('purpose') purpose = 'branding',
  ) {
    const capabilities = IMAGE_PURPOSES[purpose];
    if (!capabilities) {
      throw new BadRequestException(
        `Uso de imagen desconocido. Admitidos: ${Object.keys(IMAGE_PURPOSES).join(', ')}.`,
      );
    }

    // La capacidad se comprueba a mano y no con `@RequireCapability` porque
    // depende del uso, que llega en la petición: el decorador se evalúa antes
    // de conocerlo.
    const tenantContext = await this.contexts.requireByInstance(
      ContextLevel.Tenant,
      user.tenantId,
    );
    const allowed = await this.access.hasAny(
      { userId: user.id, isPlatformAdmin: user.isPlatformAdmin },
      [...capabilities],
      tenantContext,
    );
    if (!allowed) {
      throw new ForbiddenException('No tiene permiso para subir imágenes para este uso.');
    }

    // El tipo decide los límites: un vídeo de lección pesa mucho más que una
    // portada, y validarlos por igual dejaría fuera lo primero o abriría la
    // mano con lo segundo.
    const esMedia = PUBLIC_MEDIA_MIME.includes(file?.mimetype);
    const stored = await this.files.upload({
      tenantId: user.tenantId,
      ownerId: user.id,
      component: esMedia ? 'media' : 'image',
      fileArea: purpose,
      file,
      isPublic: true,
      allowedMimeTypes: [...PUBLIC_IMAGE_MIME, ...PUBLIC_MEDIA_MIME],
      maxSize: esMedia ? MAX_MEDIA_BYTES : MAX_IMAGE_BYTES,
      // Una miniatura de un vídeo no la genera `sharp`: lo intentaría y
      // fallaría en silencio en cada subida.
      makeThumbnail: !esMedia,
    });
    return this.files.toRef(stored);
  }

  @Post('upload-many')
  @UseInterceptors(FilesInterceptor('files', 20))
  @ApiConsumes('multipart/form-data')
  async uploadMany(
    @CurrentUser() user: RequestUser,
    @UploadedFiles() files: Express.Multer.File[],
    @Query('component') component = 'user',
    @Query('fileArea') fileArea = 'draft',
    @Query('itemId') itemId?: string,
  ) {
    const stored = await Promise.all(
      files.map((file) =>
        this.files.upload({
          tenantId: user.tenantId,
          ownerId: user.id,
          component,
          fileArea,
          itemId: itemId ?? null,
          file,
        }),
      ),
    );
    return this.files.toRefs(stored);
  }

  @Get('mine')
  @ApiOperation({ summary: 'Ficheros privados del usuario' })
  async mine(@CurrentUser() user: RequestUser) {
    const files = await this.files.listByOwner(user.id);
    return this.files.toRefs(files);
  }

  // Antes de «:id», que si no capturaría «public» como si fuera un
  // identificador y esta ruta no se alcanzaría nunca.
  @Public()
  @Get('public/:id')
  @ApiOperation({
    summary: 'Servir un fichero marcado como público',
    description:
      'Sin sesión, a propósito: un logotipo o la portada de un curso los pide una etiqueta ' +
      '<img>, que no envía cabeceras de autenticación. Solo sirve ficheros con `isPublic`; ' +
      'para el resto sigue estando «/:id/download», que sí comprueba permisos.',
  })
  async servePublic(@Param('id') id: string, @Res() res: Response) {
    const file = await this.files.findById(id);
    if (!file.isPublic) {
      throw new ForbiddenException('Este fichero no es público.');
    }
    const { data } = await this.files.download(id);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', String(file.size));
    // Público y con clave irrepetible: se puede cachear en cualquier proxy.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(data);
  }

  @Get(':id')
  async metadata(@Param('id') id: string) {
    const file = await this.files.findById(id);
    return this.files.toRef(file);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Descargar un fichero' })
  async download(@Param('id') id: string, @Res() res: Response) {
    const { file, data } = await this.files.download(id);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', String(file.size));
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(file.filename)}"`,
    );
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(data);
  }

  @Get(':id/thumbnail')
  async thumbnail(@Param('id') id: string, @Res() res: Response) {
    const file = await this.files.findById(id);
    if (!file.thumbnailKey) {
      const { data } = await this.files.download(id);
      res.setHeader('Content-Type', file.mimeType);
      res.send(data);
      return;
    }
    const data = await this.storage.get(file.thumbnailKey);
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.send(data);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.files.remove(id, user.isPlatformAdmin ? undefined : user.id);
    return { deleted: true };
  }
}
