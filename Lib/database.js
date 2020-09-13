/**
 * Import libraries
 */
const Influx = require('influx');

/**
 * Connect to database
 */
// eslint-disable-next-line no-underscore-dangle
async function _connectToDB() {
  this.logger.trace(`${this._traceStack()} - Getting database login details`);

  const DBServer = process.env.INFLUXDB_SERVER;
  const DBUserName = process.env.INFLUXDB_USER;
  const DBUserPassword = process.env.INFLUXDB_PASSWORD;

  if (
    (typeof DBServer !== 'undefined' && DBServer !== null) ||
    (typeof DBUserName !== 'undefined' && DBUserName !== null) ||
    (typeof DBUserPassword !== 'undefined' && DBUserPassword !== null)
  ) {
    const err = new Error('DB login details empty');
    this.logger.fatal(err);
    this._fatal(true);
  }

  this.logger.trace(`${this._traceStack()} - Create database object`);
  const dataClient = new Influx.InfluxDB({
    host: DBServer,
    database: this.namespace,
  });

  this.logger.trace(`${this._traceStack()} - Check if DB exists`);
  const dbNames = await dataClient.getDatabaseNames();
  if (!dbNames.includes(this.namespace)) {
    const err = new Error('DB does not exist');
    this.logger.fatal(err);
    this._fatal(true);
  }

  this.logger.trace(`${this._traceStack()} - Connected to DB`);
  return dataClient;
}

module.exports = {
  _connectToDB,
};
