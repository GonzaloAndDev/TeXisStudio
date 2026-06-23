# Plan Maestro de Reconstrucción del Núcleo Documental de TeXisStudio

Estado: arquitectura objetivo y programa de ejecución
Alcance: TeXisStudio, TeXisStudio-Profiles, TeXisStudio-Languages y TeXisStudio-Plugins
Decisión: reconstrucción integral del núcleo documental, no refactor cosmético

## 1. Propósito

TeXisStudio debe convertirse en una plataforma profesional para diseñar, escribir,
validar, compilar y entregar documentos académicos complejos sin exigir que el
usuario conozca LaTeX.

Para lograrlo, los componentes universales de una tesis serán dominios independientes:

1. Portada e identidad institucional
2. Preliminares
3. Índices y listas
4. Cuerpo académico
5. Bibliografía y referencias
6. Anexos
7. Ensamblado, compilación y verificación final

Cada dominio funcionará como una miniaplicación dentro de una plataforma común. Será
responsable de sus datos, reglas, validación, edición, renderizado, pruebas y
diagnósticos. Ningún módulo podrá modificar internamente a otro.

La plataforma general resolverá configuración, coordinará los módulos, ensamblará el
documento y verificará el resultado.

## 2. Decisión Arquitectónica

La arquitectura objetivo es:

> **Monolito modular orientado al dominio, con arquitectura hexagonal en cada
> módulo y una canalización documental dirigida por un modelo intermedio canónico.**

No se usarán microservicios. Los dominios comparten proceso, distribución y versión,
pero mantienen fronteras de código y contratos verificables.

### 2.1 Por qué esta arquitectura

- Una tesis es una unidad transaccional y debe compilarse como un todo.
- Los módulos tienen reglas complejas, pero necesitan coordinación determinista.
- Los perfiles, idiomas y plugins cambian independientemente del núcleo.
- LaTeX es un backend de renderizado, no el modelo del producto.
- React, Tauri, YAML, JSON, MiniJinja, GitHub y los compiladores son mecanismos
  reemplazables; las reglas documentales no lo son.
- Un modelo intermedio permite validar el documento antes de producir LaTeX.
- Las fronteras modulares reducen regresiones sin introducir operaciones distribuidas.

### 2.2 Principio rector

El núcleo no será “un generador de archivos LaTeX”. Será un **compilador documental**:

```text
Proyecto editable
    + Perfil institucional
    + Idioma documental
    + Contribuciones de plugins
    + Preferencias del usuario
                    |
                    v
             Resolución semántica
                    |
                    v
      Modelo Documental Intermedio (MDI)
                    |
                    v
     Validación y planificación por módulos
                    |
                    v
          Plan de Documento Inmutable
                    |
                    v
     Backend LaTeX -> Compilador -> PDF
                    |
                    v
       Verificación estructural y visual
```

LaTeX deja de decidir la estructura. La estructura se decide antes, dentro del
dominio, y LaTeX sólo la representa.

## 3. Diagnóstico De La Arquitectura Actual

Actualmente existen buenas piezas, pero no una autoridad arquitectónica única:

- `project::ProjectModel` gobierna el editor, el generador, validadores, importación,
  exportación, CLI y comandos Tauri.
- `texis_project::TexisProject` gobierna partes del motor de build y plantillas.
- `generator` y `template_engine` pueden producir estructura y `main.tex`.
- `main_tex.rs` mezcla ensamblado, paquetes, idioma, tipografía, metadatos, índices,
  glosario, bibliografía y orden.
- `sections.rs` mezcla portada, capítulos y renderizado de todos los bloques.
- Validadores externos vuelven a interpretar reglas que el generador ya interpretó.
- Los perfiles usan aliases y placements históricos que cambian de significado al
  cargarse.
- Parte del vocabulario del documento está en packs de idioma y parte está
  hardcodeado en Rust.
- Los plugins entregan fragmentos LaTeX y paquetes, pero no existe una frontera
  documental común suficientemente estricta.
- El postflight inspecciona un PDF sin conocer plenamente el contrato que debía
  cumplir.

El problema central es la **autoridad duplicada**. Modularizar el código actual sin
reconstruir esa autoridad únicamente trasladaría las inconsistencias.

## 4. Estructura General Del Sistema

```text
┌──────────────────────────────── Experiencia ────────────────────────────────┐
│ React UI | CLI | API Tauri | Automatización | Vista avanzada                │
└───────────────────────────────────┬──────────────────────────────────────────┘
                                    │ comandos / consultas
┌──────────────────────────── Aplicación ─────────────────────────────────────┐
│ ProjectService | ProfileService | DocumentBuildService | ExportService      │
│ casos de uso, transacciones, permisos, progreso, cancelación                 │
└───────────────────────────────────┬──────────────────────────────────────────┘
                                    │
┌──────────────────────────── Dominio documental ─────────────────────────────┐
│ DocumentResolver -> DocumentIR -> ModulePlans -> DocumentPlan               │
│                                                                             │
│ Cover | Preliminaries | Indexes | Body | Bibliography | Appendices          │
│                                                                             │
│ Shared Kernel mínimo: IDs, diagnósticos, idioma, assets, medidas, provenance │
└───────────────────────────────────┬──────────────────────────────────────────┘
                                    │ puertos
┌──────────────────────────── Infraestructura ────────────────────────────────┐
│ YAML/JSON | perfiles | packs | plugins | filesystem | LaTeX | PDF tools     │
│ GitHub catalogs | importadores | exportadores | caché                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Capas

#### Experiencia

Presenta y edita el dominio. No interpreta reglas LaTeX ni perfiles directamente.

#### Aplicación

Implementa casos de uso:

- crear y abrir proyecto;
- resolver configuración;
- editar un módulo;
- validar;
- generar vista previa;
- compilar;
- exportar;
- importar;
- migrar;
- revisar preparación para entrega.

No contiene reglas tipográficas ni académicas.

#### Dominio

Contiene el significado del documento y todas sus invariantes. No depende de React,
Tauri, sistema de archivos, YAML, GitHub ni procesos de compilación.

#### Infraestructura

Implementa puertos del dominio y aplicación. Aquí viven serialización, filesystem,
MiniJinja, herramientas PDF, compiladores y catálogos remotos.

## 5. Modelo Documental Intermedio

El nuevo centro del sistema será `DocumentIR`, una representación semántica,
normalizada, versionada e independiente de LaTeX.

```rust
pub struct DocumentIR {
    pub schema: DocumentSchemaVersion,
    pub identity: DocumentIdentity,
    pub metadata: ResolvedMetadata,
    pub locale: DocumentLocale,
    pub profile: ResolvedProfile,
    pub cover: CoverDocument,
    pub preliminaries: PreliminariesDocument,
    pub indexes: IndexesDocument,
    pub body: BodyDocument,
    pub bibliography: BibliographyDocument,
    pub appendices: AppendicesDocument,
    pub resources: ResourceGraph,
    pub provenance: ResolutionProvenance,
}
```

### 5.1 Propiedades obligatorias

- Es inmutable después de la resolución.
- No contiene aliases.
- No contiene placements como strings libres.
- No contiene rutas absolutas.
- No contiene configuración contradictoria sin diagnosticar.
- Conserva provenance para explicar de dónde salió cada valor.
- Puede serializarse para depuración y CI.
- Puede validarse sin tener LaTeX instalado.

### 5.2 Fases canónicas

```rust
pub enum DocumentPhase {
    Cover,
    Preliminaries,
    Indexes,
    MainMatter,
    Appendices,
    BackMatter,
}
```

El orden global lo define el modelo. Los perfiles pueden configurar elementos dentro
de las fases y ciertas relaciones permitidas, pero no inventar fases arbitrarias.

### 5.3 Precedencia de configuración

La resolución usará una política explícita:

```text
invariantes del núcleo
    > requisitos obligatorios del perfil
    > configuración explícita del proyecto
    > recomendaciones del perfil
    > defaults del tipo documental
    > defaults seguros del núcleo
```

Cada valor resuelto registrará:

- valor final;
- fuente;
- regla aplicada;
- si puede ser modificado;
- diagnóstico asociado;
- evidencia institucional cuando corresponda.

## 6. Cápsula Estándar De Un Módulo

Cada módulo tendrá la misma organización conceptual:

```text
document_modules/<module>/
  domain/          entidades, value objects, invariantes
  application/     casos de uso específicos
  ports/           interfaces requeridas
  adapters/        perfil, locale, LaTeX, PDF, persistencia
  diagnostics/     códigos y reglas
  fixtures/        ejemplos mínimos, límites y casos reales
  tests/           unidad, contrato, integración, snapshot, PDF
  ui-contract/     DTOs y capacidades para la aplicación
```

No es obligatorio crear una carpeta por cada palabra desde el primer commit, pero
las dependencias deberán respetar esta frontera.

### 6.1 Contrato común

```rust
pub trait DocumentModule {
    type Input;
    type Model;
    type Plan;

    fn resolve(&self, input: Self::Input) -> Resolution<Self::Model>;
    fn validate(&self, model: &Self::Model) -> Vec<Diagnostic>;
    fn plan(&self, model: &Self::Model) -> Result<Self::Plan, ModuleError>;
    fn render(
        &self,
        plan: &Self::Plan,
        backend: &dyn RenderBackend,
    ) -> Result<ModuleArtifact, ModuleError>;
    fn verify(
        &self,
        plan: &Self::Plan,
        artifact: &CompiledArtifact,
    ) -> Vec<Diagnostic>;
}
```

Un módulo:

- no escribe directamente en disco;
- no inicia compiladores;
- no modifica modelos ajenos;
- no decide el orden global;
- no carga perfiles o idiomas por su cuenta;
- no acepta LaTeX crudo como sustituto silencioso de datos estructurados.

## 7. Módulos Del Dominio

## 7.1 Portada E Identidad Institucional

Responsable de:

- portada principal y portadas secundarias explícitas;
- institución, facultad, programa y grado;
- título, subtítulo, autoría y ORCID;
- asesores, comité, jurado y roles;
- ciudad, fecha, convocatoria y modalidad;
- logotipos, escudos y sellos;
- páginas de firmas y declaraciones institucionales asociadas;
- metadatos PDF de título y autor.

Modelo propio:

- `CoverDocument`
- `CoverPage`
- `CoverBlock`
- `InstitutionIdentity`
- `AcademicAuthority`
- `SignatureRequirement`
- `CoverOverflowPolicy`
- `InstitutionalAsset`

Capacidades profesionales:

- layouts estructurados y previsualizables;
- restricciones de tamaño y alineación;
- zonas reservadas;
- variantes por grado o programa;
- portada de una o varias páginas declaradas;
- reducción tipográfica dentro de límites;
- traslado formal de comité o firmas;
- fallback sin logo que no rompa la composición;
- plantilla avanzada validada para casos extraordinarios.

Prohibido:

- depender únicamente de una cadena MiniJinja sin esquema;
- partir accidentalmente la portada;
- esconder contenido por overflow;
- usar assets sin provenance o licencia;
- prometer reproducción exacta cuando el perfil no aporta evidencia.

## 7.2 Preliminares

Responsable de:

- dedicatoria;
- agradecimientos;
- declaración de originalidad;
- autorizaciones;
- resumen y abstracts multilingües;
- palabras clave;
- epígrafe;
- nomenclatura, símbolos, abreviaturas y glosario editorial;
- numeración romana y páginas sin número visible.

El perfil declara:

- elementos requeridos;
- orden permitido;
- idiomas exigidos;
- límites de palabras;
- visibilidad en el índice;
- política de numeración;
- textos institucionales obligatorios y su fuente.

El módulo diferencia contenido proporcionado por el usuario, contenido institucional
verificado y texto de ejemplo. Nunca presentará un ejemplo como requisito oficial.

## 7.3 Índices Y Listas

Será un módulo separado de preliminares porque tiene comportamiento generado,
dependencias cruzadas y verificación propia.

Responsable de:

- índice general;
- lista de figuras;
- lista de tablas;
- lista de algoritmos;
- lista de código;
- listas personalizadas permitidas;
- profundidad, títulos, entradas y páginas;
- política para listas vacías.

Consumirá un índice semántico producido por cuerpo, bibliografía y anexos. No
inspeccionará texto LaTeX para reconstruir significado.

Verificará:

- entradas y números de página;
- títulos localizados;
- ausencia de listas vacías accidentales;
- profundidad institucional;
- consistencia con figuras, tablas, capítulos y anexos reales.

## 7.4 Cuerpo Académico

Responsable de:

- capítulos, secciones y subsecciones;
- párrafos y estructura narrativa;
- figuras, tablas, ecuaciones, teoremas y código;
- notas, citas, referencias cruzadas y labels;
- contribuciones de plugins;
- assets y requisitos de paquetes derivados del contenido;
- estados editoriales y métricas de progreso.

El cuerpo expondrá nodos semánticos, no fragmentos LaTeX como formato principal:

```rust
pub enum BodyNode {
    Paragraph(Paragraph),
    Heading(Heading),
    Figure(Figure),
    Table(Table),
    Equation(Equation),
    Theorem(Theorem),
    CodeListing(CodeListing),
    Citation(Citation),
    CrossReference(CrossReference),
    PluginContribution(PluginContribution),
    TrustedRawLatex(TrustedRawLatex),
}
```

`TrustedRawLatex` será explícito, auditable y diagnosticable. No será el camino
normal para implementar funciones que la app debería modelar.

## 7.5 Bibliografía Y Referencias

Responsable de extremo a extremo:

- fuentes bibliográficas;
- parseo;
- normalización de nombres, fechas, DOI, URL e identificadores;
- detección de duplicados;
- claves de cita;
- tipos de cita;
- compatibilidad entre estilo, backend y motor;
- ordenamiento;
- notas y bibliografía;
- compilación Biber/BibTeX;
- ubicación y encabezado final;
- calidad del resultado.

Integrará detrás de una API única las capacidades actualmente repartidas entre
manager, registry, parser, formatter, normalizer, validator, backend policy y
exporters.

La validación profesional incluirá fixtures reales para:

- APA 7;
- Vancouver;
- IEEE;
- Chicago 17 notes;
- MHRA;
- ABNT;
- GB/T 7714.

Compilar no será suficiente. Se comprobarán autores, campos obligatorios, enlaces,
orden, citas sin resolver, duplicados y estructura esperada por estilo.

## 7.6 Anexos

Responsable de:

- grupos de anexos;
- títulos y numeración;
- secciones internas;
- figuras, tablas y ecuaciones propias;
- referencias hacia y desde el cuerpo;
- inclusión controlada de PDF u otros documentos externos;
- entradas en índice;
- transición hacia back matter.

Los anexos nunca se representarán como `back_matter`. Serán una fase canónica con
modelo y reglas propias.

Verificará:

- numeración alfabética o institucional;
- ausencia de prefijos duplicados;
- labels y referencias;
- orden de bibliografía;
- seguridad y existencia de archivos externos;
- páginas rotadas, tamaños y legibilidad.

## 8. Ensamblador Y Backends

`DocumentAssembler` será la única autoridad que crea el plan final.

Responsable de:

- ordenar fases y artefactos;
- combinar requisitos de módulos;
- resolver paquetes y conflictos;
- producir un grafo de archivos;
- asignar ownership;
- generar `main.tex`;
- producir manifiesto de build;
- aplicar escritura atómica;
- respetar archivos manuales mediante una política explícita.

No contendrá reglas de portada, bibliografía, anexos, idiomas ni bloques.

### 8.1 Plan inmutable

```rust
pub struct DocumentPlan {
    pub phases: Vec<PhasePlan>,
    pub files: FileGraph,
    pub packages: PackagePlan,
    pub assets: AssetPlan,
    pub toolchain: ToolchainPlan,
    pub expectations: VerificationPlan,
    pub diagnostics: Vec<Diagnostic>,
}
```

### 8.2 Backend LaTeX

El primer backend será LaTeX, pero implementará un puerto:

```rust
pub trait RenderBackend {
    fn capabilities(&self) -> BackendCapabilities;
    fn render_module(&self, artifact: &ModuleArtifact) -> RenderResult;
    fn render_document(&self, plan: &DocumentPlan) -> RenderResult;
}
```

Esto no obliga a crear otro backend ahora. Evita que el dominio se diseñe alrededor
de comandos LaTeX específicos.

### 8.3 Capacidades Y Límites

Cada backend declara capacidades. Si una solicitud no puede resolverse fielmente:

1. se explica el límite;
2. se ofrecen alternativas compatibles;
3. se permite integrar un resultado externo con provenance;
4. no se simula que LaTeX puede hacerlo.

## 9. Contratos Entre Repositorios

## 9.1 TeXisStudio-Profiles

El perfil será una política declarativa versionada, no un paquete de código.

Nuevo esquema:

```text
Profile 2.x
  identity
  evidence
  applicability
  document_policy
  modules
    cover
    preliminaries
    indexes
    body
    bibliography
    appendices
  rendering_constraints
  delivery_requirements
```

Reglas:

- IDs y fases canónicas;
- sin aliases en perfiles 2.x;
- requisitos separados de recomendaciones;
- evidencia oficial por regla;
- vigencia y fecha de revisión;
- capacidades requeridas declaradas;
- assets con rol, hash, fuente y licencia;
- templates avanzados aislados y validados;
- `verified` exige fixture, compilación, postflight y evidencia CI.

El creador de perfiles editará estos conceptos mediante formularios profesionales,
vista previa, recomendaciones y validación. YAML será una vista avanzada, no la UX
principal.

## 9.2 TeXisStudio-Languages

Separar tres responsabilidades:

```text
ui.json          interfaz de la aplicación
document.json    vocabulario generado dentro del documento
latex.json       configuración técnica del backend LaTeX
```

`document.json` incluirá:

- títulos de índices;
- nombres de figuras y tablas;
- capítulos, anexos y bibliografía;
- glosario, acrónimos y nomenclatura;
- etiquetas académicas;
- formatos de fecha;
- reglas de pluralización necesarias.

Las lenguas nativas mexicanas pueden declarar fallback documental al español cuando
no exista terminología verificada. El fallback será explícito y visible, nunca una
mezcla silenciosa.

## 9.3 TeXisStudio-Plugins

Los plugins aportarán contribuciones semánticas mediante un contrato versionado:

```typescript
interface DocumentContribution {
  contractVersion: string;
  contributionId: string;
  semanticKind: string;
  editableSource: EditableSource;
  artifact: OutputArtifact;
  caption?: LocalizedText;
  label?: string;
  requiredPackages: PackageRequirement[];
  assets: AssetRequirement[];
  capabilities: string[];
  warnings: Diagnostic[];
  provenance: ContributionProvenance;
}
```

El núcleo:

- valida el contrato;
- sanitiza rutas y labels;
- resuelve paquetes;
- comprueba artefactos;
- conserva fuente editable;
- impide escritura fuera del directorio asignado;
- ofrece integración externa cuando LaTeX no es suficiente.

El plugin no modifica el preámbulo ni `main.tex`.

## 10. Modelo De Errores Y Diagnósticos

Todos los módulos usarán diagnósticos estructurados:

```rust
pub struct Diagnostic {
    pub code: DiagnosticCode,
    pub module: ModuleId,
    pub severity: Severity,
    pub stage: DiagnosticStage,
    pub message_key: String,
    pub location: Option<DocumentLocation>,
    pub evidence: Vec<Evidence>,
    pub remediation: Vec<Remediation>,
    pub blocking: bool,
}
```

Los mensajes se localizan en la experiencia; el dominio emite códigos y parámetros.

Etapas:

- importación;
- resolución;
- edición;
- validación;
- planificación;
- render;
- compilación;
- postflight;
- entrega.

Un error puede rastrearse hasta módulo, elemento, perfil, fuente y acción correctiva.

## 11. Persistencia Y Compatibilidad

El nuevo formato de proyecto será semántico y modular:

```text
project.texis/
  project.yaml
  modules/
    cover.yaml
    preliminaries.yaml
    indexes.yaml
    body/
    bibliography.yaml
    appendices/
  assets/
  plugins/
  .texisstudio/
    state/
    cache/
    migrations/
```

### 11.1 Política de legado

El legado no define la arquitectura nueva.

Se construirán:

- importador `ProjectModel 1.x -> DocumentIR`;
- importador de perfiles 1.x;
- adaptador de packs actuales;
- adaptador de plugins actuales;
- exportador de emergencia cuando sea técnicamente posible;
- reporte de migración con cambios, pérdidas y acciones manuales.

Después de migrar, el proyecto se guarda en el modelo nuevo. La compatibilidad vive
en adaptadores de entrada y puede retirarse sin tocar los módulos.

### 11.2 Corte arquitectónico

No se considerará completa la reconstrucción mientras existan dos autoridades
productivas para:

- modelo de proyecto;
- orden documental;
- generación de `main.tex`;
- resolución de perfiles;
- planificación de compilación.

## 12. Programa De Ejecución

La reconstrucción será grande, pero se implementará mediante cortes verticales que
siempre convergen en la arquitectura final. No se crearán soluciones temporales que
se conviertan en una tercera arquitectura.

### Etapa A: Cimientos Del Nuevo Núcleo

Entregables:

- ADR de arquitectura;
- crates/módulos para dominio, aplicación e infraestructura;
- Shared Kernel mínimo;
- `DocumentIR`;
- `DocumentResolver`;
- `DocumentPlan`;
- diagnósticos estructurados;
- serialización de depuración;
- pruebas de arquitectura;
- importador del proyecto actual.

Criterio de salida:

- una tesis actual puede importarse y producir un `DocumentIR` válido;
- ningún renderer interpreta aliases o perfiles crudos.

### Etapa B: Plataforma De Módulos Y Ensamblador

Entregables:

- contrato `DocumentModule`;
- registro estático de módulos oficiales;
- `DocumentAssembler`;
- `FileGraph`;
- `PackagePlan`;
- `AssetPlan`;
- `VerificationPlan`;
- backend LaTeX;
- manifiesto reproducible de build;
- servicio único de generación.

Criterio de salida:

- sólo el ensamblador nuevo produce `main.tex`;
- app y CLI llaman al mismo caso de uso;
- builds deterministas con inputs idénticos.

### Etapa C: Portada Completa

Entregables:

- dominio y editor de portada;
- `cover_spec` de perfiles 2.x;
- assets y firmas;
- overflow;
- metadatos PDF;
- preview rápida;
- verificación visual.

Criterio de salida:

- fixtures con títulos largos, múltiples asesores, comité, logos y portadas
  multipágina explícitas sin cortes accidentales.

### Etapa D: Preliminares E Índices

Entregables:

- ambos módulos separados;
- vocabulario `document.json`;
- abstracts multilingües;
- numeración y ToC;
- listas generadas desde el índice semántico;
- políticas para listas vacías.

Criterio de salida:

- textos generados en el idioma documental;
- numeración y entradas verificadas contra el PDF.

### Etapa E: Cuerpo Y Contrato De Plugins

Entregables:

- árbol semántico del cuerpo;
- renderers por nodo;
- labels y referencias centralizados;
- assets;
- contribuciones de plugins;
- escape hatch de LaTeX confiable;
- edición, persistencia y round trip.

Criterio de salida:

- todos los plugins `official-core` pasan creación, edición, guardado, reapertura,
  compilación y exportación mediante el contrato nuevo.

### Etapa F: Bibliografía Profesional

Entregables:

- dominio bibliográfico unificado;
- fuentes y normalización;
- estilos y backends;
- planificación de herramientas;
- validación profesional;
- fixtures reales;
- integración con índices y cuerpo.

Criterio de salida:

- siete estilos objetivo compilan y pasan validaciones específicas;
- ninguna cita o entrada queda sin resolver en fixtures de entrega.

### Etapa G: Anexos

Entregables:

- dominio de anexos;
- numeración;
- referencias cruzadas;
- documentos externos;
- entradas de índice;
- orden configurable dentro de límites seguros;
- postflight.

Criterio de salida:

- no existen numeraciones rotas, prefijos duplicados ni bibliografías dentro del
  contexto de anexos.

### Etapa H: Perfiles 2.x Y Creador Profesional

Entregables:

- schema y validación;
- migrador 1.x;
- editor guiado por módulos;
- evidencia y confianza;
- preview;
- import/export;
- recomendaciones por país, institución y tipo documental;
- CI de perfiles.

Criterio de salida:

- un usuario puede diseñar un perfil completo sin editar YAML;
- el sistema distingue claramente requisito oficial, recomendación y ejemplo.

### Etapa I: Sustitución Del Legado

Entregables:

- migración de consumidores restantes;
- eliminación de generación duplicada;
- eliminación o redefinición de `TexisProject`;
- retirada de aliases internos;
- retirada de `template_engine` como generador paralelo;
- actualización de importadores, exportadores y build engine.

Criterio de salida:

- una autoridad por cada decisión arquitectónica;
- ningún flujo productivo utiliza el generador anterior.

### Etapa J: Certificación De Producción

Entregables:

- 10 tesis largas externas al repo;
- matriz de perfiles, idiomas, estilos y plugins;
- compilación en entornos limpios;
- regresión visual;
- PDF/A cuando aplique;
- accesibilidad y metadatos;
- rendimiento y límites de memoria;
- fuzzing de schemas, importadores y labels;
- seguridad de rutas, templates y plugins;
- rollback y migración documentados.

Criterio de salida:

- todos los gates de producción aprobados;
- cero defectos críticos conocidos en la matriz de entrega.

## 13. Estrategia De Pruebas

Cada módulo debe incluir:

1. Pruebas unitarias del dominio.
2. Pruebas de propiedades e invariantes.
3. Pruebas de contrato.
4. Snapshots del modelo y LaTeX.
5. Pruebas de serialización y migración.
6. Pruebas de compilación.
7. Pruebas de texto PDF.
8. Regresión visual PDF.
9. Round trip de importación/exportación.
10. Fixtures reales y casos límite.

### 13.1 Matriz profesional

Como mínimo:

- XeLaTeX como backend principal;
- LuaLaTeX para fixtures seleccionados;
- PdfLaTeX sólo donde las capacidades lo permitan;
- español, inglés, portugués, francés, alemán, chino y japonés;
- fallback declarado para lenguas nativas mexicanas;
- APA, Vancouver, IEEE, Chicago, MHRA, ABNT y GB/T 7714;
- perfiles genéricos e institucionales;
- plugins core, extended y bridges externos;
- tesis de 50, 100 y 250 páginas.

### 13.2 Bloqueadores de release

- fallo de compilación;
- estructura o numeración incorrecta;
- portada partida fuera de política;
- referencias sin resolver;
- bibliografía duplicada o incompleta;
- texto generado en idioma incorrecto;
- fuentes requeridas no incrustadas;
- asset perdido o sin autorización;
- perfil `verified` sin evidencia;
- plugin con rutas o paquetes no declarados;
- pérdida de datos en migración;
- diferencias no explicadas entre app y CLI;
- build no determinista sin causa documentada.

## 14. Rendimiento Y Observabilidad

El pipeline medirá por etapa:

- tiempo de resolución;
- validación;
- planificación;
- render por módulo;
- compilación;
- postflight;
- tamaño y cantidad de artefactos;
- cache hits;
- diagnósticos por módulo.

Se establecerán presupuestos:

- edición y validación incremental sin recompilar todo;
- preview de módulo independiente;
- recompilación por grafo de dependencias;
- carga diferida de UI y plugins;
- cancelación segura;
- ausencia de trabajo duplicado entre app y core.

La observabilidad será local y respetuosa de privacidad. La telemetría remota será
opt-in y no incluirá contenido académico.

## 15. Seguridad

Superficies de riesgo:

- LaTeX crudo;
- shell escape;
- templates de perfiles;
- plugins;
- assets externos;
- rutas;
- archivos importados;
- compiladores;
- PDFs incluidos.

Reglas:

- `shell_escape` desactivado por defecto y sujeto a consentimiento;
- rutas normalizadas dentro de raíces permitidas;
- templates con funciones limitadas;
- plugins sin escritura arbitraria;
- hashes de assets;
- límites de tamaño y tiempo;
- análisis de paquetes peligrosos;
- provenance en contenido externo;
- compilación aislada cuando la plataforma lo permita.

## 16. Gobierno Del Código

### 16.1 Reglas de dependencia

Permitido:

```text
experience -> application
application -> domain
infrastructure -> application/domain ports
module -> shared kernel
assembler -> module public contracts
```

Prohibido:

```text
domain -> React/Tauri/filesystem/YAML/LaTeX process
cover -> bibliography internals
body -> appendix internals
plugin -> assembler internals
profile -> renderer internals
module -> main.tex
module -> filesystem writer
```

Las reglas se comprobarán automáticamente.

### 16.2 Shared Kernel

Sólo contendrá conceptos realmente universales:

- IDs;
- diagnósticos;
- idioma;
- provenance;
- assets;
- medidas;
- capacidades;
- versiones de contrato.

No se usarán utilidades compartidas como lugar para esconder lógica de módulos.

### 16.3 Versionado

Versionar independientemente:

- schema de proyecto;
- Profile Contract;
- Language Pack Contract;
- Plugin Contribution Contract;
- DocumentIR;
- build manifest.

Los cambios incompatibles requieren migrador y fixture de compatibilidad.

## 17. Organización De PRs Y Commits

El programa es arquitectónicamente grande, pero los commits seguirán siendo
revisables.

Orden recomendado:

1. ADR, pruebas de arquitectura y fixtures de referencia.
2. Shared Kernel, diagnósticos y `DocumentIR`.
3. Resolver e importadores legacy.
4. Plataforma de módulos y ensamblador.
5. Backend LaTeX y servicio único de build.
6. Portada.
7. Preliminares.
8. Índices.
9. Cuerpo y contrato de plugins.
10. Bibliografía.
11. Anexos.
12. Perfiles 2.x.
13. Packs documentales.
14. UI profesional por módulos.
15. Retirada del legado.
16. Certificación de producción.

Cada PR debe declarar:

- frontera arquitectónica afectada;
- contratos añadidos o cambiados;
- migración;
- compatibilidad;
- fixtures;
- pruebas;
- rendimiento;
- riesgos;
- rollback.

Los artefactos generados, tesis de estrés, builds y PDFs no se guardan en los repos.

## 18. Reglas Para El Agente Ejecutor

1. Construir siempre hacia esta arquitectura, nunca hacia una solución intermedia
   incompatible.
2. Añadir pruebas de comportamiento antes de sustituir código existente.
3. Implementar cortes verticales completos: dominio, aplicación, backend, UI mínima,
   pruebas y migración.
4. No mantener dos autoridades productivas al terminar una etapa.
5. No mover código defectuoso sin redefinir su contrato.
6. No introducir frameworks de DI o buses de eventos si interfaces y composición
   explícita son suficientes.
7. No generalizar antes de tener al menos dos usos reales.
8. Mantener el dominio libre de infraestructura.
9. Emitir códigos de diagnóstico estables.
10. Conservar provenance y explicar toda degradación o fallback.
11. Ejecutar pruebas completas al cerrar cada etapa.
12. Entregar commits intencionales y worktrees limpios en todos los repos.

## 19. Definición Final De Terminado

La reconstrucción estará completa cuando:

- exista un único modelo documental canónico;
- cada componente universal sea un módulo vertical independiente;
- cada módulo controle su dominio, validación, planificación, render y verificación;
- exista un único ensamblador y un único servicio productivo de build;
- LaTeX sea un backend y no el modelo de negocio;
- perfiles, idiomas y plugins usen contratos versionados;
- el creador de perfiles permita diseños profesionales sin exigir YAML o LaTeX;
- los límites de LaTeX sean claros y existan bridges externos trazables;
- los proyectos anteriores migren sin pérdida silenciosa;
- app y CLI produzcan resultados equivalentes;
- las tesis largas superen validación estructural, bibliográfica, lingüística,
  visual y PDF;
- modificar portada, bibliografía o anexos no requiera alterar módulos no
  relacionados;
- el código legado de generación haya sido retirado.

## 20. Resultado Esperado

Al terminar, TeXisStudio no será una colección de formularios que producen LaTeX.
Será una plataforma documental académica con:

- dominio explícito;
- configuración institucional verificable;
- edición visual profesional;
- extensibilidad controlada;
- resultados reproducibles;
- diagnósticos comprensibles;
- compilación robusta;
- validación antes y después del PDF;
- mantenimiento independiente por módulo.

Ésta es la base sobre la que deben construirse todas las siguientes funciones del
producto.
