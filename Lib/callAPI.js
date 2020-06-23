/**
 * Import external libraries
 */
const rp = require('request-promise');

/**
 * Call another api service
 *
 * @param {String} URL
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
  _callAPIServiceGet,
  _callAlfredServiceGet,
};
