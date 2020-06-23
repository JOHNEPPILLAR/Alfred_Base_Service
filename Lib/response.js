/**
 * Import external libraries
 */
const Ajv = require('ajv');

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
  this.logger.debug(
    `${this._traceStack()} - Finished api processing, sending data back to caller`,
  );
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
  const ajv = Ajv({ allErrors: true, strictDefaults: true });
  const valid = ajv.validate(schema, req.params);
  if (!valid) {
    this.logger.trace(
      `${this.traceStack()} - Invalid params: ${JSON.stringify(req.params)}`,
    );
    return _schemaErrorResponse(ajv.errors);
  }
  return true;
}

module.exports = {
  _sendResponse,
  _validateSchema,
};
