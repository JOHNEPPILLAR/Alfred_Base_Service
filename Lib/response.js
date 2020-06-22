/**
 * Send response back to caller
 */
// eslint-disable-next-line no-underscore-dangle
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

module.exports = {
  _sendResponse,
};
