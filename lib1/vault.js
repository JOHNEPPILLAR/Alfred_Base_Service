/**
 * Create client and open vault
 */
async function _openVault() {
  try {
    const options = {
      apiVersion: 'v1',
      endpoint: process.env.VAULT_URL,
    };

    this.logger.trace(`${this._traceStack()} - Connect to vault`);
    // eslint-disable-next-line global-require
    let vault = require('node-vault')(options);

    // Check if vault is sealed
    this.logger.trace(`${this._traceStack()} - Check vault status`);
    const vaultStatus = await vault.status();
    if (vaultStatus.sealed) {
      this.logger.error(`${this._traceStack()} - Vault sealed`);
      this._fatal(true);
    }

    // Login via app role
    const vaultSession = await vault.approleLogin({
      role_id: process.env.APP_ROLE_ID,
      secret_id: process.env.APP_TOKEN,
    });

    // Login via app role client token
    options.token = vaultSession.auth.client_token;
    // eslint-disable-next-line global-require
    vault = require('node-vault')(options);

    // If vault connection error, exit app
    if (vault instanceof Error) {
      this.logger.error(`${this._traceStack()} - Vault connection error`);
      this._fatal(true);
    }

    // Get data from vault
    this.logger.trace(`${this._traceStack()} - Get secrets from vault`);
    const alfredCommonSecrets = await vault.list(`secret/alfred_common`);
    const secrets = await vault.list(`secret/${this.namespace}`);

    this.logger.trace(`${this._traceStack()} - Store secrets in memory`);
    let secret;
    // eslint-disable-next-line no-restricted-syntax
    for await (const item of alfredCommonSecrets.data.keys) {
      secret = await vault.read(`secret/alfred_common/${item}`);
      this.vault[item] = secret.data.data;
    }
    // eslint-disable-next-line no-restricted-syntax
    for await (const item of secrets.data.keys) {
      secret = await vault.read(`secret/${this.namespace}/${item}`);
      this.vault[item] = secret.data.data;
    }

    if (process.env.ENVIRONMENT === 'development') {
      const key = await vault.read(`secret/localhost/ssl_key`);
      this.vault.ssl_key = key.data.data;
      const cert = await vault.read(`secret/localhost/ssl_cert`);
      this.vault.ssl_cert = cert.data.data;
      const dataBaseURL = await vault.read(`secret/localhost/DataBaseURL`);
      this.vault.DataBaseURL = dataBaseURL.data.data;
    }

    this.logger.trace(`${this._traceStack()} - Vault ready`);
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err}`);
    this.logger.error(`${this._traceStack()} - Vault connection error`);
    this._fatal(true);
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
    if (this.vault[key]) {
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
