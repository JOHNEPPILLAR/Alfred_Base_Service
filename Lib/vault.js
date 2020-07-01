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

    // Check if conected, if not connect to vault
    if (typeof this.vault === 'undefined' || this.vault === null) {
      this.logger.trace(`${this._traceStack()} - Connect to vault`);
      // eslint-disable-next-line global-require
      this.vault = require('node-vault')(options);
    }

    // If vault connection error, exit app
    if (this.vault instanceof Error)
      this._fatal('Vault connection error', true);

    // Check if vault is sealed
    this.logger.trace(`${this._traceStack()} - Check vault status`);
    const vaultStatus = await this.vault.status();
    if (vaultStatus.sealed) {
      // TODO - uneal vault if sealed
      this._fatal('Vault sealed', true);
    }
    this.logger.trace(`${this._traceStack()} - Vault ready`);
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err}`);
    this._fatal('Vault connection error', true);
  }
}

/**
 * Get secret from vault
 *
 * @param {String} route
 * @param {String} key
 *
 */
async function _getVaultSecret(route, key) {
  try {
    this.logger.trace(`${this._traceStack()} - Check still connected to vault`);
    const vaultStatus = await this.vault.status();

    if (vaultStatus instanceof Error || vaultStatus.sealed) _openVault();

    this.logger.trace(`${this._traceStack()} - Get secret from vault`);
    const vaultData = await this.vault.read(`secret/alfred/${route}`);
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
  _openVault,
  _getVaultSecret,
};
