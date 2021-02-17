/**
 * Import external libraries
 */
const axios = require('axios');
const fs = require('fs');
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
 * Download file
 *
 * @param {String} fileUrl
 * @param {String} outputLocationPath
 *
 */
async function _downloadFile(fileUrl, outputLocationPath) {
  return axios({
    method: 'get',
    url: fileUrl,
    responseType: 'stream',
  }).then((response) => {
    const writer = fs.createWriteStream(`${outputLocationPath}`);
    return new Promise((resolve, reject) => {
      response.data.pipe(writer);
      let error = null;
      writer.on('error', (err) => {
        error = err;
        writer.close();
        reject(err);
      });
      writer.on('close', () => {
        if (!error) {
          resolve(true);
        }
      });
    });
  });
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
async function _callAPIServicePost(url, body, headers) {
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
  _downloadFile,
  _callAPIServiceGet,
  _callAPIServicePost,
  _callAlfredServiceGet,
};
