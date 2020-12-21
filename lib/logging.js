/**
 * Import libraries
 */
const pino = require('pino');
const debug = require('debug')('Base:Logging');

/**
 * Trace stack. Print the current function and line number
 *
 * @param {boolean} previousFunction
 *
 */
// eslint-disable-next-line no-underscore-dangle
function _traceStack(previousFunction) {
  const originalStack = Error.prepareStackTrace;
  Error.prepareStackTrace = function prepStack(_, stackTrace) {
    return stackTrace;
  };
  const err = new Error();
  const { stack } = err;
  Error.prepareStackTrace = originalStack;

  let returnStr;
  let stackID = 1;
  if (previousFunction) stackID = 2;

  try {
    const functionName = stack[stackID].getFunctionName();
    const lineNumber = stack[stackID].getLineNumber();
    returnStr = `${
      functionName !== null ? ` ${functionName}` : ' '
    }:${lineNumber}`;
  } catch (e) {
    returnStr = '[No trace data]';
  }
  return returnStr;
}

/**
 * Fatal error. Print the message to console and exit the process (if need)
 *
 * @param {boolean} [needExit=true]
 *
 */
// eslint-disable-next-line no-underscore-dangle
function _fatal(needExit = true) {
  if (this.started) {
    try {
      this.restifyServer.close(() => {
        this.logger.info('Stoped accepting API requests');
      });
    } catch (err) {
      this.logger.error(
        `${this._traceStack(true)} - Unable to shutdown restify server`,
      );
    }
  }
  this.started = false;

  if (needExit) {
    this.logger.fatal('Stopping service due to fatal error');
    process.exit(1);
  }
}

/**
 * Setup logger
 */
// eslint-disable-next-line no-underscore-dangle
function _setupLogger() {
  if (process.env.ENVIRONMENT === 'development') {
    this.logger = pino({
      level: 'trace',
      prettyPrint: {
        levelFirst: true,
      },
    });
  } else {
    this.logger = pino({
      level: process.env.TRACE_LEVEL || 'debug',
    });
  }
}

module.exports = {
  _traceStack,
  _fatal,
  _setupLogger,
};
