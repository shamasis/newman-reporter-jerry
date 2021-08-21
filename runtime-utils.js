/**
 * @fileOverview
 * Contain no side-effect helpers for Postman runtime specfic logic
 */

const forEachRight = function (arr, callback) {
  return arr.slice().reverse().forEach(callback);
};

module.exports = {
  extractSNR (executions) {
    if (!Array.isArray(executions)) {
      return;
    }

    let snr;

    forEachRight(executions, function (execution) {
      const nextReq = (execution && execution.result &&
                      execution.result.return && execution.result.return.nextRequest);

      if (nextReq) {
        snr = nextReq;
        return false;
      }
    });

    return snr;
  }
};
