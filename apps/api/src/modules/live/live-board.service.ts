import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { WhiteboardOp, WhiteboardPageDto, WhiteboardStateDto } from '@maya/shared';
import { LiveBoard, LiveBoardDocument } from './schemas/live-board.schema';
import { toObjectId } from '../../common/utils';

/**
 * Tope de trazos por página.
 *
 * Un documento de Mongo son 16 MB y una pizarra larga los alcanza: cada trazo a
 * mano alzada trae decenas de coordenadas. Al llegar al tope se descartan los
 * más antiguos, que es preferible a que la pizarra deje de guardarse entera sin
 * avisar.
 */
const MAX_ITEMS_PER_PAGE = 4000;

/** Páginas por pizarra. */
const MAX_PAGES = 20;

const nuevaPagina = (indice: number): WhiteboardPageDto => ({
  id: `p${Date.now().toString(36)}${indice}`,
  name: `Página ${indice + 1}`,
  items: [],
});

/**
 * Estado persistente de la pizarra colaborativa.
 *
 * La difusión en tiempo real la hace la señalización; esto es la copia que ve
 * quien llega tarde y la que sigue ahí cuando la clase termina. Se guarda por
 * operación y no por instantánea porque las operaciones son pequeñas y una
 * instantánea de una pizarra llena serían megabytes en cada trazo.
 */
@Injectable()
export class LiveBoardService {
  constructor(@InjectModel(LiveBoard.name) private readonly model: Model<LiveBoardDocument>) {}

  /** Pizarra de la sesión, creándola con una página en blanco la primera vez. */
  async ensure(
    sessionId: string | Types.ObjectId,
    tenantId: string | Types.ObjectId,
  ): Promise<LiveBoardDocument> {
    const existing = await this.model.findOne({ session: toObjectId(sessionId) }).exec();
    if (existing) return existing;

    const primera = nuevaPagina(0);
    return this.model.create({
      tenant: toObjectId(tenantId),
      session: toObjectId(sessionId),
      pages: [primera],
      activePageId: primera.id,
    });
  }

  async state(
    sessionId: string | Types.ObjectId,
    tenantId: string | Types.ObjectId,
  ): Promise<WhiteboardStateDto> {
    const board = await this.ensure(sessionId, tenantId);
    return { pages: board.pages, activePageId: board.activePageId };
  }

  /**
   * Aplica una operación. Devuelve la operación tal y como debe difundirse
   * —puede diferir de la recibida, por ejemplo cuando se rechaza una página de
   * más— o `null` si no procede difundir nada.
   */
  async apply(
    sessionId: string | Types.ObjectId,
    tenantId: string | Types.ObjectId,
    op: WhiteboardOp,
  ): Promise<WhiteboardOp | null> {
    const board = await this.ensure(sessionId, tenantId);

    switch (op.kind) {
      case 'add': {
        const page = board.pages.find((p) => p.id === op.pageId);
        if (!page) return null;
        page.items.push(op.item);
        if (page.items.length > MAX_ITEMS_PER_PAGE) {
          page.items.splice(0, page.items.length - MAX_ITEMS_PER_PAGE);
        }
        break;
      }
      case 'remove': {
        const page = board.pages.find((p) => p.id === op.pageId);
        if (!page) return null;
        const fuera = new Set(op.itemIds);
        page.items = page.items.filter((item) => !fuera.has(item.id));
        break;
      }
      case 'clear': {
        const page = board.pages.find((p) => p.id === op.pageId);
        if (!page) return null;
        page.items = [];
        break;
      }
      case 'page-add': {
        if (board.pages.length >= MAX_PAGES) return null;
        const page: WhiteboardPageDto = {
          id: op.page.id,
          name: op.page.name || `Página ${board.pages.length + 1}`,
          items: [],
        };
        board.pages.push(page);
        board.activePageId = page.id;
        board.markModified('pages');
        await board.save();
        return { kind: 'page-add', page };
      }
      case 'page-remove': {
        // Nunca se queda sin páginas: una pizarra sin lienzo no es un estado
        // que la interfaz sepa pintar.
        if (board.pages.length <= 1) return null;
        board.pages = board.pages.filter((p) => p.id !== op.pageId);
        if (board.activePageId === op.pageId) board.activePageId = board.pages[0].id;
        break;
      }
      case 'page-select': {
        if (!board.pages.some((p) => p.id === op.pageId)) return null;
        board.activePageId = op.pageId;
        break;
      }
      default:
        return null;
    }

    board.markModified('pages');
    await board.save();
    return op;
  }

  /** Vacía la pizarra entera. Solo lo usa quien modera. */
  async reset(
    sessionId: string | Types.ObjectId,
    tenantId: string | Types.ObjectId,
  ): Promise<WhiteboardStateDto> {
    const board = await this.ensure(sessionId, tenantId);
    const primera = nuevaPagina(0);
    board.pages = [primera];
    board.activePageId = primera.id;
    board.markModified('pages');
    await board.save();
    return { pages: board.pages, activePageId: board.activePageId };
  }
}
