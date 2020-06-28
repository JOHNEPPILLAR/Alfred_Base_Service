/**
 * Import libraries
 */
const { Client } = require('pg');

/**
 * Connect to database
 */
// eslint-disable-next-line no-underscore-dangle
async function _connectToDB(database) {
  this.logger.debug(`${this._traceStack()} - Getting databse login details`);
  const DataStore = await this._getVaultSecret(
    process.env.ENVIRONMENT,
    'DataStore',
  );
  const DataStoreUser = await this._getVaultSecret(
    process.env.ENVIRONMENT,
    'DataStoreUser',
  );
  const DataStoreUserPassword = await this._getVaultSecret(
    process.env.ENVIRONMENT,
    'DataStoreUserPassword',
  );
  this.logger.debug(`${this._traceStack()} - Create databse object`);
  const dataClient = new Client({
    host: DataStore,
    database,
    user: DataStoreUser,
    password: DataStoreUserPassword,
    port: 5432,
  });
  this.logger.debug(`${this._traceStack()} - Connect to databse`);
  await dataClient.connect();
  return dataClient;
}

module.exports = {
  _connectToDB,
};