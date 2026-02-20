# Embedded Diagram Test

This page tests inline diagram rendering in markdown.

Foo!

## Mermaid Diagram

```mermaid
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Do something]
    B -->|No| D[Do something else]
    C --> E[End]
    D --> E
```

## PlantUML Diagram

```plantuml
@startuml
actor User
participant "Web App" as App
database "Database" as DB

User -> App: Request
App -> DB: Query
DB --> App: Results
App --> User: Response
@enduml
```

## Regular Code Block

```javascript
// This should still render as syntax-highlighted code
function hello() {
  console.log('Hello, world!');
}
```

## Mixed Content

Some text before a diagram.

```mermaid
sequenceDiagram
    Alice->>Bob: Hello Bob!
    Bob-->>Alice: Hi Alice!
```

And some text after.
