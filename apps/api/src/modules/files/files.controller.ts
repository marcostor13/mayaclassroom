import {
  Controller,
  Delete,
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
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators';
import { RequestUser } from '../../common/types/request-context';
import { FilesService } from './files.service';
import { StorageService } from './storage.service';

@ApiTags('Ficheros')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(
    private readonly files: FilesService,
    private readonly storage: StorageService,
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
