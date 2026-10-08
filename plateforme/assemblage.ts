// Ce que la plateforme sert : les routes et les flux de chaque module, assemblés
// une fois pour les deux portes (`serveur.ts` sous Node, `cloudflare/worker.ts`
// chez Cloudflare). Un module ajouté ici l'est partout.

import type { Route, RouteFlux } from './http.ts';
import { routes as routesControle } from './controle/routes.ts';
import { flux as fluxVoix, routes as routesVoix } from './voix/routes.ts';
import { routes as routesCreate } from './create/routes.ts';
import { routes as routesTarifs } from './tarifs/routes.ts';

export const toutesLesRoutes: Route[] = [...routesControle, ...routesVoix, ...routesCreate, ...routesTarifs];
export const tousLesFlux: RouteFlux[] = [...fluxVoix];
