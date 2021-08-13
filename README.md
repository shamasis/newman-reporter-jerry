# Jerry
`newman-reporter-jerry`

This is a debugging reporter for Newman.

> This reporter is under development and is in beta.

## Installation

```term
npm i newman-reporter-jerry -g;
```

## Usage

```term
newman run examples/sample-collection.json -r jerry
```

```term
newman run examples/sample-collection.json -r cli,jerry
```

## Featurea

- Press CTR+C any time to break run
- Break on next request
- Break on next iteration
- Break on next console log
- Break on run end
- Break on variable change
- Break on setNextRequest
- Inspect all variables
- Show last network activity
- Abort run
- Force abort run

## CLI Options

- `--reporter-jerry-break-on-start`

