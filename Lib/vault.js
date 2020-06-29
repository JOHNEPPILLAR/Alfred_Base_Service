/**
 * Import libraries
 */
const helper = require('alfred-helper');

/**
 * Get secret from vault
 *
 * @param {String} route
 * @param {String} key
 *
 */
async function _getVaultSecret(route, key) {
  try {
    const options = {
      apiVersion: 'v1',
      endpoint: process.env.VAULT_URL,
      token: process.env.VAULT_TOKEN,
    };

    this.logger.trace(`${this._traceStack()} - Connect to vault`);
    // eslint-disable-next-line global-require
    const vault = require('node-vault')(options);

    // Check if vault is sealed
    this.logger.trace(`${this._traceStack()} - Check vault status`);
    const vaultStatus = await vault.status();
    if (vaultStatus.sealed) this._fatal('Vault sealed', false);
    this.logger.trace(`${this._traceStack()} - Get secret from vault`);
    const vaultData = await vault.read(`secret/alfred/${route}`);
    if (!helper.isEmptyObject(vaultData.data)) {
      this.logger.trace(`${this._traceStack()} - Get key from secret`);
      // eslint-disable-next-line no-prototype-builtins
      if (vaultData.data.hasOwnProperty(key)) {
        this.logger.trace(`${this._traceStack()} - Return key`);
        return vaultData.data[key];
      }
    }
    throw new Error('No key found');
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err}`);
    return err;
  }
}

module.exports = {
  _getVaultSecret,
};
