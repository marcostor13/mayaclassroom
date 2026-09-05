/* -------------------------------------------------------------------------- */
/*  Límites de cada plan comercial                                             */
/*                                                                            */
/*  Un solo sitio para lo que un plan permite, porque el mismo número tiene    */
/*  que decirlo la página de venta, aplicarlo la API y enseñarlo la            */
/*  administración. Mientras vivieron en tres sitios, el esquema de Mongo      */
/*  daba 10 GiB a todo el mundo, la página prometía otra cosa y nadie          */
/*  comprobaba ninguna de las dos.                                            */
/*                                                                            */
/*  De dónde salen los números: `docs/COSTES.md`. El almacenamiento es el      */
/*  82 % del coste variable de la plataforma, así que es el límite que de      */
/*  verdad protege el margen; los topes se fijaron para que el almacén quede   */
/*  entre el 20 % y el 40 % de la mensualidad. Cambiarlos es una decisión de   */
/*  negocio: 100 GB de más son unos S/ 5,60 al mes por empresa, para siempre.  */
/* -------------------------------------------------------------------------- */

import { TenantPlan } from '../enums';

const GB = 1024 * 1024 * 1024;

/**
 * Lo que se escribe en un límite que no limita.
 *
 * No es cero ni `null` a propósito: los sitios que comparan (`usuarios <
 * maxUsers`) siguen siendo una comparación normal, sin un caso especial que
 * alguien olvide poner. Se lee `SIN_LIMITE` en la administración.
 */
export const SIN_LIMITE = Number.MAX_SAFE_INTEGER;

export interface PlanLimits {
  maxUsers: number;
  maxCourses: number;
  maxStorageBytes: number;
}

/**
 * Los cursos no llevan tope en ningún plan de pago: la página promete
 * «cursos, lecciones y materiales ilimitados» desde el primero, y un curso
 * vacío no cuesta nada. Lo que cuesta son los gigas que lleva dentro, y eso
 * ya lo mide `maxStorageBytes`.
 */
export const PLAN_LIMITS: Readonly<Record<TenantPlan, PlanLimits>> = {
  // Prueba: suficiente para montar un curso de verdad y enseñarlo, no para
  // operar. Quien pasa de aquí es que la plataforma le sirve.
  [TenantPlan.Free]: { maxUsers: 25, maxCourses: 10, maxStorageBytes: 20 * GB },

  // Inicia · S/ 47. Sin clases en vivo, así que sin grabaciones: 300 GB son
  // muchísimo material de curso y ninguna academia de este tamaño los gasta.
  [TenantPlan.Starter]: { maxUsers: 300, maxCourses: SIN_LIMITE, maxStorageBytes: 300 * GB },

  // Crece · S/ 99. Aquí sí hay grabación de clases, que es lo que llena el
  // disco: 700 GB son unas 800 horas de clase al caudal actual.
  [TenantPlan.Business]: { maxUsers: 2000, maxCourses: SIN_LIMITE, maxStorageBytes: 700 * GB },

  // Escala · a cotizar. El número de aquí es solo el punto de partida: el
  // alcance se pacta por contrato y se ajusta con `limits` en el alta.
  [TenantPlan.Enterprise]: {
    maxUsers: SIN_LIMITE,
    maxCourses: SIN_LIMITE,
    maxStorageBytes: 2048 * GB,
  },
};

/** Límites del plan, con el de prueba como red por si llega uno desconocido. */
export function limitsForPlan(plan?: TenantPlan | null): PlanLimits {
  return PLAN_LIMITS[plan as TenantPlan] ?? PLAN_LIMITS[TenantPlan.Free];
}

/** Almacenamiento del plan en gigabytes enteros, para enseñarlo. */
export function planStorageGb(plan?: TenantPlan | null): number {
  return Math.round(limitsForPlan(plan).maxStorageBytes / GB);
}
