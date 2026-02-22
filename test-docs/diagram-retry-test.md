# Diagram Retry Test

## Valid Diagram

```mermaid
graph LR
    A[Start] --> B[Process]
    B --> C[End]
```

## Invalid Diagram (should fail)

```mermaid
graph LR
    A[Start] --> B[Process]
    B --> C[Success!]
    C --> D[End]
```
