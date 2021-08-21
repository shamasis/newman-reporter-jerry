# Jerry
`newman-reporter-jerry`

This is a debugging reporter for Newman.


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

## Features

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

- `--reporter-jerry-continue-on-start`
This command prevents jerry from starting the run in a paused state. If specified, you can still break the run at any moment by pressing `CTRL+C`.

![jerry-1](https://user-images.githubusercontent.com/232373/130334038-d592ec12-8424-4f3e-a60a-2909ef5fe2fc.gif)



