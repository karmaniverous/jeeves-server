# Lazy Diagram Loading Test

This page tests lazy-loaded embedded diagrams. The text below should appear **instantly** while diagrams render in the background.

## Section 1: Introduction

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.

## Diagram 1: Complex Mermaid Flowchart

```mermaid
graph TB
    subgraph Client["🖥️ Client Layer"]
        direction TB
        Browser[Browser SPA]
        AuthCtx[Auth Context]
        Router[React Router]
        LazyLoader[Lazy Diagram Loader]
        Panzoom[Panzoom Controller]
        ThemeEngine[Theme Engine]
        Browser --> AuthCtx
        Browser --> Router
        Router --> LazyLoader
        LazyLoader --> Panzoom
        Browser --> ThemeEngine
    end

    subgraph Server["⚙️ Server Layer"]
        direction TB
        Fastify[Fastify Server]
        AuthMW[Auth Middleware]
        FileAPI[File API]
        DiagramAPI[Diagram API]
        ExportSvc[Export Service]
        MarkdownSvc[Markdown Service]
        DiagramCache[Diagram Cache]
        EmbeddedDiag[Embedded Diagrams]
        Fastify --> AuthMW
        AuthMW --> FileAPI
        AuthMW --> DiagramAPI
        AuthMW --> ExportSvc
        FileAPI --> MarkdownSvc
        MarkdownSvc --> EmbeddedDiag
        DiagramAPI --> DiagramCache
        DiagramAPI --> EmbeddedDiag
        EmbeddedDiag --> DiagramCache
    end

    subgraph Renderers["🎨 Diagram Renderers"]
        direction TB
        MermaidCLI[Mermaid CLI + Puppeteer]
        PlantUMLJar[PlantUML Jar + Java]
        PlantUMLServer[PlantUML Server Fallback]
        MermaidCLI --> |SVG| CacheStore[(Cache Store)]
        PlantUMLJar --> |SVG| CacheStore
        PlantUMLServer --> |SVG| CacheStore
    end

    subgraph Storage["💾 Storage Layer"]
        direction TB
        FSWatcher[File System]
        Config[Config TS + Zod]
        State[State JSON]
        InsiderKeys[Insider Keys]
        Config --> State
        State --> InsiderKeys
    end

    Client -->|HTTP| Server
    DiagramCache -->|read/write| CacheStore
    EmbeddedDiag -->|render| Renderers
    FileAPI -->|read| FSWatcher
    ExportSvc -->|Puppeteer| Browser
```

## Section 2: More Text

Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.

## Diagram 2: Complex PlantUML Sequence

```plantuml
@startuml
!theme cerulean
skinparam responseMessageBelowArrow true
skinparam maxMessageSize 200

actor User
participant "Browser SPA" as SPA
participant "Auth Middleware" as Auth
participant "File API" as FileAPI
participant "Markdown Service" as MD
participant "Embedded Diagrams" as Embed
participant "Diagram API" as DiagAPI
participant "Diagram Cache" as Cache
participant "Mermaid CLI" as Mermaid
participant "PlantUML Jar" as PlantUML

== Page Load ==
User -> SPA: Navigate to /browse/path/doc.md
SPA -> Auth: GET /api/auth/status
Auth --> SPA: { isInsider: true }

SPA -> FileAPI: GET /api/file/path/doc.md
FileAPI -> MD: parseMarkdown(content)
MD -> Embed: registerDiagram("mermaid", source1)
Embed --> MD: <placeholder hash="abc123">
MD -> Embed: registerDiagram("plantuml", source2)
Embed --> MD: <placeholder hash="def456">
MD --> FileAPI: { html (with placeholders), headings }
FileAPI --> SPA: JSON response (instant!)

== Lazy Diagram Loading ==
SPA -> SPA: Render markdown text immediately
SPA -> SPA: initLazyDiagrams()

par Parallel diagram fetches
    SPA -> DiagAPI: GET /api/diagram/mermaid/abc123.svg
    DiagAPI -> Cache: getCachedDiagram("mermaid", source)
    alt Cache Hit
        Cache --> DiagAPI: SVG content
    else Cache Miss
        Cache --> DiagAPI: null
        DiagAPI -> Mermaid: renderMermaidSync(source)
        Mermaid --> DiagAPI: SVG
        DiagAPI -> Cache: cacheDiagram("mermaid", source, svg)
    end
    DiagAPI --> SPA: image/svg+xml (immutable cache headers)
    SPA -> SPA: Replace spinner with SVG + panzoom

    SPA -> DiagAPI: GET /api/diagram/plantuml/def456.svg
    DiagAPI -> Cache: getCachedDiagram("plantuml", source)
    alt Cache Hit
        Cache --> DiagAPI: SVG content
    else Cache Miss
        Cache --> DiagAPI: null
        DiagAPI -> PlantUML: renderPlantUmlSvg(source)
        PlantUML --> DiagAPI: SVG
        DiagAPI -> Cache: cacheDiagram("plantuml", source, svg)
    end
    DiagAPI --> SPA: image/svg+xml
    SPA -> SPA: Replace spinner with SVG + panzoom
end

== Subsequent Visits ==
User -> SPA: Reload page
SPA -> FileAPI: GET /api/file/path/doc.md
FileAPI --> SPA: JSON (instant)
SPA -> DiagAPI: GET /api/diagram/mermaid/abc123.svg
DiagAPI -> Cache: getCachedDiagram() → HIT
Cache --> DiagAPI: SVG
DiagAPI --> SPA: SVG (from cache, ~1ms)
note right: All diagrams load instantly\non repeat visits

@enduml
```

## Section 3: Analysis

The architecture above demonstrates a clean separation between the document rendering pipeline and the diagram rendering pipeline. By decoupling these concerns, we achieve:

1. **Fast time-to-first-byte** — markdown text renders without waiting for diagrams
2. **Parallel rendering** — multiple diagrams render concurrently
3. **Content-addressed caching** — identical diagram source always produces the same cache key
4. **Progressive enhancement** — diagrams appear as they become available

## Diagram 3: PlantUML Component Diagram

```plantuml
@startuml
!theme cerulean
skinparam componentStyle rectangle
skinparam linetype ortho

package "Client (React SPA)" {
    [FileBrowser] as FB
    [Header] as HD
    [LazyDiagram] as LD
    [EmbeddedDiagramPanzoom] as EDP
    [InlineSvgPanzoom] as ISP
    [DownloadDropdown] as DD
    [LinkDropdown] as LiD
    [CodeEditor] as CE
    [AuthContext] as AC

    FB --> HD
    FB --> LD
    FB --> EDP
    FB --> ISP
    FB --> DD
    FB --> LiD
    FB --> CE
    FB --> AC
}

package "Server (Fastify)" {
    [Auth Middleware] as AM
    [File Routes] as FR
    [Diagram Routes] as DR
    [Export Routes] as ER
    [Event Gateway] as EG

    package "Services" {
        [Markdown Parser] as MP
        [Embedded Diagrams] as ED
        [Diagram Cache] as DC
        [Deep Share Links] as DSL
        [Export Service] as ES
        [Event Queue] as EQ
    }

    package "Renderers" {
        [Mermaid CLI] as MC
        [PlantUML Jar] as PJ
        [PlantUML Server] as PS
    }

    package "Auth" {
        [Google OAuth] as GO
        [Key Auth] as KA
        [Session Manager] as SM
    }

    package "Config" {
        [Zod Schema] as ZS
        [Config Loader] as CL
        [State Manager] as StM
    }

    AM --> GO
    AM --> KA
    AM --> SM
    FR --> MP
    FR --> DSL
    MP --> ED
    DR --> DC
    DR --> ED
    ED --> MC
    ED --> PJ
    ED --> PS
    DC -[hidden]-> MC
    ER --> ES
    EG --> EQ
    CL --> ZS
    CL --> StM
}

package "Storage" {
    database "File System" as FS
    database ".diagram-cache/" as DCC
    database "state.json" as SJ
    database "jeeves.config.ts" as JC
}

FR --> FS
DC --> DCC
StM --> SJ
CL --> JC
ES -[hidden]-> FS

FB ..> FR : HTTP
FB ..> DR : HTTP
FB ..> ER : HTTP
AC ..> AM : HTTP

@enduml
```

## Diagram 4: Mermaid State Diagram

```mermaid
stateDiagram-v2
    [*] --> PageLoad

    state PageLoad {
        [*] --> FetchingFile
        FetchingFile --> ParsingMarkdown: API response
        ParsingMarkdown --> RegisteringDiagrams: code block found
        RegisteringDiagrams --> ParsingMarkdown: placeholder inserted
        ParsingMarkdown --> TextReady: parsing complete
    }

    state TextReady {
        [*] --> RenderingText
        RenderingText --> InitLazyDiagrams
        InitLazyDiagrams --> FetchingDiagrams
    }

    state FetchingDiagrams {
        [*] --> CheckCache
        CheckCache --> CacheHit: found
        CheckCache --> CacheMiss: not found

        state CacheMiss {
            [*] --> Rendering
            Rendering --> MermaidCLI: type=mermaid
            Rendering --> PlantUMLJar: type=plantuml
            MermaidCLI --> WritingCache
            PlantUMLJar --> WritingCache
            WritingCache --> [*]
        }

        CacheHit --> ServingSVG
        CacheMiss --> ServingSVG
        ServingSVG --> [*]
    }

    state DiagramReady {
        [*] --> InsertingSVG
        InsertingSVG --> InitPanzoom
        InitPanzoom --> Interactive
    }

    TextReady --> FetchingDiagrams: for each diagram
    FetchingDiagrams --> DiagramReady: SVG received
    DiagramReady --> [*]

    state Interactive {
        [*] --> Idle
        Idle --> Zooming: scroll wheel
        Zooming --> Idle: release
        Idle --> Panning: drag
        Panning --> Idle: release
        Idle --> Fullscreen: click button
        Fullscreen --> Idle: Esc / click button
    }
```

## Section 4: Conclusion

If you're reading this text while diagrams above still show spinners, the lazy loading is working as designed. The text content was delivered without waiting for any diagram rendering. Each diagram loads independently and appears as soon as its SVG is ready.

On subsequent page loads, all diagrams should appear nearly instantly thanks to the content-addressed cache.
