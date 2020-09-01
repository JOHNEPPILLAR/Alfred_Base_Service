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
  this.logger.trace(`${this._traceStack()} - Ping API called`);
  const ackJSON = { reply: 'pong' };
  this._sendResponse(res, next, 200, ackJSON);
}

/**
 * Call another api service with Get
 *
 * @param {String} URL
 * @param {String} HEADER
 *
 */
async function _callAPIServiceGet(apiURL, headers) {
  const options = {
    method: 'GET',
    uri: apiURL,
    headers,
    json: true,
  };
  try {
    return await rp(options);
  } catch (err) {
    return err;
  }
}

/**
 * Call another api service with Put
 *
 * @param {String} URL
 * @param {String} Body
 *
 */
async function _callAPIServicePut(apiURL, body) {
  const options = {
    method: 'POST',
    uri: apiURL,
    json: true,
    headers: {
      'Content-Type': 'application/json',
    },
    body,
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
  _callAPIServicePut,
  _callAlfredServiceGet,
};
