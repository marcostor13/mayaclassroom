import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MAYA_BRAND } from '@maya/shared';
import { Public } from '../../common/decorators';

@ApiTags('Estado')
@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Estado del servicio' })
  health() {
    const states = ['desconectado', 'conectado', 'conectando', 'desconectando'];
    return {
      service: `${MAYA_BRAND.name} API`,
      status: this.connection.readyState === 1 ? 'ok' : 'degraded',
      database: states[this.connection.readyState] ?? 'desconocido',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('ready')
  ready() {
    return { ready: this.connection.readyState === 1 };
  }
}
