/**
 * Import libraries
 */
const { MongoClient, ObjectID } = require('mongodb');
const debug = require('debug')('Base:Database');

/**
 * Connect to database
 */
// eslint-disable-next-line no-underscore-dangle
async function _connectToDB() {
  try {
    debug('Get database login details');
    const DBUserName = await this._getVaultSecret('DataStoreUser');
    const DBPassword = await this._getVaultSecret('DataStoreUserPassword');

    let DBURL = await this._getVaultSecret('DataBaseURL');
    DBURL = `mongodb://${DBUserName}:${DBPassword}@${DBURL}`;

    debug('Connect to database instance');
    const client = new MongoClient(DBURL);
    await client.connect();

    debug('Check if database exists');
    await client.db(this.namespace).command({ ping: 1 });

    debug('Database is ready');
    return client;
  } catch (err) {
    this.logger.error(err);
    this._fatal(true);
    return err;
  }
}

function _getMongoObjectID(id) {
  try {
    return ObjectID(id);
  } catch (err) {
    debug(err);
    return err;
  }
}

module.exports = {
  _connectToDB,
  _saveStreamToDB,
  _getMongoObjectID,
};
