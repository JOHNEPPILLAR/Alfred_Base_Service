/**
 * Import external libraries
 */
const axios = require('axios');
const debug = require('debug')('Base:CallAPI');

/**
 * Ping api
 *
 * @param {Object} Request
 * @param {Object} Response
 * @param {Object} Next
 *
 */
function _ping(req, res, next) {
  debug('Ping API called');
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
  debug(options);
  try {
    const apiResponse = await axios(options);
    const { data } = apiResponse;
    debug(data);
    return data;
  } catch (err) {
    debug(err);
    return err;
  }
}

/**
 * Call another api service with Put
 *
 * @param {String} URL
 * @param {String} Body
 * @param {String} Headers
 *
 */
async function _callAPIServicePut(url, body, headers) {
  const options = {
    method: 'POST',
    url,
    headers,
    data: body,
  };
  debug(options);
  try {
    const apiResponse = await axios(options);
    const { data } = apiResponse;
    debug(data);
    return data;
  } catch (err) {
    debug(err);
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
  debug(options);
  try {
    const apiResponse = await axios(options);
    const { data } = apiResponse;
    debug(data);
    return data;
  } catch (err) {
    debug(err);
    return err;
  }
}

module.exports = {
  _ping,
  _callAPIServiceGet,
  _callAPIServicePut,
  _callAlfredServiceGet,
};
