/**
 * Import libraries
 */
const helper = require('alfred-helper');

/**
 * Create client and open vault
 */
async function _openVault() {
  try {
    const options = {
      apiVersion: 'v1',
      endpoint: process.env.VAULT_URL,
      token: process.env.VAULT_TOKEN,
    };

    this.logger.trace(`${this._traceStack()} - Connect to vault`);
    // eslint-disable-next-line global-require
    const vault = require('node-vault')(options);

    // If vault connection error, exit app
    if (vault instanceof Error) this._fatal('Vault connection error', true);

    // Check if vault is sealed
    this.logger.trace(`${this._traceStack()} - Check vault status`);
    const vaultStatus = await vault.status();
    if (vaultStatus.sealed) {
      this._fatal('Vault sealed', true);
    }

    // Get data from vault
    this.logger.trace(`${this._traceStack()} - Get secret from vault`);
    const vaultData = await vault.read(
      `secret/alfred/${process.env.ENVIRONMENT}`,
    );
    if (!helper.isEmptyObject(vaultData.data)) {
      this.logger.trace(`${this._traceStack()} - Store data in memory`);
      this.vault = vaultData.data;
    }
    this.logger.trace(`${this._traceStack()} - Vault ready`);
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err}`);
    this._fatal('Vault connection error', true);
  }
}

/**
 * Get secret
 *
 * @param {String} key
 *
 */
async function _getVaultSecret(key) {
  try {
    // eslint-disable-next-line no-prototype-builtins
    if (this.vault.hasOwnProperty(key)) {
      this.logger.trace(`${this._traceStack()} - Key found`);
      return this.vault[key];
    }
    throw new Error('No key found');
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err}`);
    return err;
  }
}

module.exports = {
  _openVault,
  _getVaultSecret,
};
