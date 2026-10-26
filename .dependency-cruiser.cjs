// Kierunek zależności: docs/architecture/CODING_STANDARDS.md (sekcja 1).
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "domain-without-frameworks",
      comment: "Domena modułu nie zależy od Fastify, Drizzle, ws, Better Auth ani od http/infra.",
      severity: "error",
      from: { path: "^apps/api/src/modules/[^/]+/domain/" },
      to: {
        path: [
          "node_modules/(fastify|@fastify|drizzle-orm|pg|ws|better-auth)/",
          "^apps/api/src/modules/[^/]+/(http|infra)/",
        ],
      },
    },
    {
      name: "modules-only-through-index",
      comment: "Moduł korzysta z innego modułu tylko przez jego index.ts.",
      severity: "error",
      from: { path: "^apps/api/src/modules/([^/]+)/" },
      to: {
        path: "^apps/api/src/modules/([^/]+)/.+",
        pathNot: ["^apps/api/src/modules/$1/", "^apps/api/src/modules/[^/]+/index\\.ts$"],
      },
    },
    {
      name: "shared-without-apps",
      comment: "packages/* nie importują aplikacji.",
      severity: "error",
      from: { path: "^packages/" },
      to: { path: "^apps/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^|/)(dist|generated|test-results)/" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.base.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
    },
  },
};
