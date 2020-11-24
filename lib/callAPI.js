/**
 * Import external libraries
 */
const axios = require('axios');

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
    url: apiURL,
    headers,
  };
  try {
    const apiResponse = await axios(options);
    const { data } = apiResponse;
    return data;
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
    url: apiURL,
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
  };
  try {
    const apiResponse = await axios(options);
    const { data } = apiResponse;
    return data;
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
    url: apiURL,
    headers: {
      'client-access-key': this.apiAccessKey,
    },
  };
  try {
    const apiResponse = await axios(options);
    const { data } = apiResponse;
    return data;
  } catch (err) {
    return new Error(err.response.data.error);
  }
}

module.exports = {
  _ping,
  _callAPIServiceGet,
  _callAPIServicePut,
  _callAlfredServiceGet,
};
