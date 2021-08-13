# newman-reporter-debug (ALPHA)
This is a debugging reporter for Newman.

## Installation

```term
npm i newman-reporter-debug -g;
```

## Usage

```term
newman run examples/sample-collection.json -r debug
```

```term
newman run examples/sample-collection.json -r cli,debug
```

### --reporter-debug-silent
### --reporter-debug-verbose

### --reporter-debug-force-clear-run-summary
Newman tracks the executions of each and every request so that some reporters can use the same to do
post-run analyses. `--forceClearRunSummary` stops the recording of this data. Note that this may 
have adverse effects on other reporters if they depend on this trace data.

### --reporter-debug-trace-memory

#### --reporter-debug-trace-memory-graph
Do enable `--silent` flag to see the graph! Else other reporters and CLI output will interfere!
![image](https://user-images.githubusercontent.com/232373/127682418-2a1e8930-0e1e-494b-8290-ac45dea154ff.png)
