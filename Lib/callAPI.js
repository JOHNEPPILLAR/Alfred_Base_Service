/**
 * Import external libraries
 */
const rp = require('request-promise');

/**
 * Ping api
 *
 * @param {Object} Request
 * @param {Object} Response
 * @param {Object} Next
 *
 */
function _ping(req, res, next) {
  this.logger.debug(`${this._traceStack()} - Ping API called`);
  const ackJSON = { reply: 'pong' };
  this._sendResponse(res, next, 200, ackJSON);
}

/**
 * Call another api service
 *
 * @param {String} URL
 *
 */
async function _callAPIServiceGet(apiURL) {
  const options = {
    method: 'GET',
    uri: apiURL,
    json: true,
  };
  try {
    return await rp(options);
  } catch (err) {
    return err;
  }
}

/**
 * Call another Alfred api
 *
 * @param {String} URL
 *
 */
async function _callAlfredServiceGet(apiURL) {
  const options = {
    method: 'GET',
    uri: apiURL,
    json: true,
    agentOptions: {
      rejectUnauthorized: false,
    },
    headers: {
      'client-access-key': this.apiAccessKey,
    },
  };
  try {
    return await rp(options);
  } catch (err) {
    return new Error(`Error response - ${err.error.error}`);
  }
}

module.exports = {
  _ping,
  _callAPIServiceGet,
  _callAlfredServiceGet,
};
