/**
 * Import external libraries
 */
const Ajv = require('ajv').default;
const debug = require('debug')('Base:API_Response');

/**
 * Send response back to caller
 *
 * @param {Object} response
 * @param {Object} next
 * @param {Integer} status
 * @param {Object} Data
 *
 */
function _sendResponse(res, next, status, dataObj) {
  let httpHeaderCode;
  let rtnData = dataObj;

  switch (status) {
    case 500: // Internal server error
      httpHeaderCode = 500;
      rtnData = { error: dataObj.message };
      break;
    case 400: // Invalid params
      httpHeaderCode = 400;
      rtnData = { error: dataObj.message };
      break;
    case 401: // Not authorised, invalid app_key
      httpHeaderCode = 401;
      rtnData = { error: dataObj };
      break;
    case 404: // Resource not found
      httpHeaderCode = 404;
      rtnData = { error: dataObj.message };
      break;
    default:
      httpHeaderCode = 200;
  }
  debug('Finished api processing, sending data back to caller');
  res.json(httpHeaderCode, rtnData);
  next(false); // End call chain
}

/**
 * JSON Schema error response
 *
 * @param {JSON Object} schemaErrors
 *
 */
function _schemaErrorResponse(schemaErrors) {
  const errors = schemaErrors.map((error) => ({
    path: error.dataPath,
    message: error.message,
  }));
  return {
    message: {
      inputValidation: 'failed',
      params: errors,
    },
  };
}

/**
 * JSON Schema error response
 *
 * @param {JSON Object} request
 * @param {JSON Object} JSON schema
 *
 */
function _validateSchema(req, schema) {
  const ajv = new Ajv({ allErrors: true, strictDefaults: true });
  const validate = ajv.compile(schema);
  const valid = validate(req.params);
  if (!valid) {
    debug(`Invalid params: ${JSON.stringify(req.params)}`);
    return _schemaErrorResponse(validate.errors);
  }
  return true;
}

module.exports = {
  _sendResponse,
  _validateSchema,
};
