/**
 * Import libraries
 */
const { MongoClient } = require('mongodb');

/**
 * Connect to database
 */
// eslint-disable-next-line no-underscore-dangle
async function _connectToDB() {
  try {
    this.logger.trace(`${this._traceStack()} - Get database login details`);
    const DBUserName = await this._getVaultSecret('DataStoreUser');
    const DBPassword = await this._getVaultSecret('DataStoreUserPassword');

    let DBURL = await this._getVaultSecret('DataBaseURL');
    DBURL = `mongodb://${DBUserName}:${DBPassword}@${DBURL}`;

    this.logger.trace(`${this._traceStack()} - Connect to database instance`);
    const client = new MongoClient(DBURL);
    await client.connect();

    this.logger.trace(`${this._traceStack()} - Make database exists`);
    await client.db(this.namespace).command({ ping: 1 });

    this.logger.trace(`${this._traceStack()} - Database ready`);
    return client;
  } catch (err) {
    this.logger.fatal(err);
    this._fatal(true);
    return err;
  }
}

module.exports = {
  _connectToDB,
};
