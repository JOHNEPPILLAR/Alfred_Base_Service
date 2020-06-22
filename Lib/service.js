/**
 * Import libraries
 */
const pino = require('pino');
const restify = require('restify');
const { Client } = require('pg');

const helper = require('alfred-helper');

// Config from package.json
const baseServiceDescription = require('../package.json').description;
const baseServiceVersion = require('../package.json').version;

// Default options
const defaultOptions = {
  serviceName: '',
  namespace: '',
  serviceVersion: '1.0',
  requestTimeout: 0 * 1000,
  retryPolicy: {
    enabled: false,
    retries: 5,
    delay: 100,
    maxDelay: 1000,
  },
};

/**
 * Service class
 *
 * @class Service
 */
class Service {
  /**
   * Creates an instance of Service.
   *
   * @param {Object} options
   * @memberof Service
   */
  constructor(options) {
    try {
      if (!options) this.options = defaultOptions;
      else this.options = options;

      // Started flag
      this.started = false;

      // Base servie version
      this.baseServiceVersion = baseServiceVersion;

      // Service Name
      this.serviceName = this.options.serviceName || '';

      // Namespace
      this.namespace = this.options.namespace || '';

      // Service version
      this.serviceVersion = options.serviceVersion || '1.0';

      // Logger
      this._setupLogger();

      // Schedules
      this.schedules = [];

      // Finished init
      this.logger.info(
        `${baseServiceDescription} v${this.baseServiceVersion} is starting...`,
      );
      this.logger.info(
        `Assigning: ${this.namespace || '<not defined>'} v${
          this.serviceVersion || '<not defined>'
        }`,
      );

      // Safe close app on exit
      this._closeFn = () => {
        this._fatal(true);
      };

      process.on('exit', this._closeFn);
      process.on('SIGINT', this._closeFn);
      process.on('SIGTERM', this._closeFn);
      process.on('SIGUSR2', this._closeFn);
      process.on('uncaughtException', (err) => {
        this.logger.error(`Uncaught exception: ${err}`);
      });
      process.on('unhandledRejection', (reason, p) => {
        this.logger.error(`Unhandled rejection at promise:: ${p} - ${reason}`);
      });
    } catch (err) {
      if (this.logger) {
        this.logger.fatal(err);
      } else {
        // eslint-disable-next-line no-console
        console.error(`Constructor: Unable to create Service - ${err}`);
      }
      this._fatal(true);
    }
  }

  /** *************************
   * Private functions
   ************************* */

  /**
   * Fatal error. Print the message to console and exit the process (if need)
   *
   * @param {boolean} [needExit=true]
   * @param {Error?} err
   *
   */
  _fatal(needExit = true) {
    if (this.started) {
      try {
        this.restifyServer.close(() => {
          this.logger.info('Stoped accepting API requests');
        });
      } catch (err) {
        this.logger.error(
          `${this.traceStack(true)} - Unable to shutdown restify server`,
        );
      }
    }
    this.started = false;

    if (needExit) {
      this.logger.fatal('Stopping service due to fatal error');
      process.exit(1);
    }
  }

  /**
   * Setup logger
   */
  // eslint-disable-next-line class-methods-use-this
  _setupLogger() {
    if (process.env.ENVIRONMENT === 'development') {
      this.logger = pino({
        level: 'trace',
        prettyPrint: {
          levelFirst: true,
        },
      });
    } else {
      this.logger = pino();
    }
  }

  /**
   * Ping
   */
  _ping(req, res, next) {
    this.logger.debug(`${this.traceStack()} - Ping API called`);
    const ackJSON = { reply: 'pong' };
    this.sendResponse(res, next, 200, ackJSON);
  }

  /** *************************
   * Public functions
   ************************* */

  /**
   * Trace stack. Print the current function and line number
   */
  traceStack(previousFunction) {
    const originalStack = Error.prepareStackTrace;
    Error.prepareStackTrace = function prepStack(_, stackTrace) {
      return stackTrace;
    };
    const err = new Error();
    const { stack } = err;
    Error.prepareStackTrace = originalStack;

    let stackID = 1;
    if (previousFunction) stackID = 2;

    try {
      const functionName = stack[stackID].getFunctionName();
      const lineNumber = stack[stackID].getLineNumber();
      this.returnStr = `${
        functionName !== null ? ` ${functionName}` : ' '
      }:${lineNumber}`;
    } catch (e) {
      this.returnStr = '[No trace data]';
    }
    return this.returnStr;
  }

  /**
   * Get secret from vault
   *
   * @param {String} route
   * @param {String} key
   *
   */
  async getVaultSecret(route, key) {
    try {
      const options = {
        apiVersion: 'v1',
        endpoint: process.env.VAULT_URL,
        token: process.env.VAULT_TOKEN,
      };

      this.logger.debug(`${this.traceStack()} - Connect to vault`);
      // eslint-disable-next-line global-require
      const vault = require('node-vault')(options);

      // Check if vault is sealed
      this.logger.debug(`${this.traceStack()} - Check vault status`);
      const vaultStatus = await vault.status();
      if (vaultStatus.sealed) this._fatal('Vault sealed', true);

      this.logger.debug(`${this.traceStack()} - Get secret from vault`);
      const vaultData = await vault.read(`secret/alfred/${route}`);
      if (!helper.isEmptyObject(vaultData.data)) {
        this.logger.debug(`${this.traceStack()} - Get key from secret`);
        // eslint-disable-next-line no-prototype-builtins
        if (vaultData.data.hasOwnProperty(key)) {
          this.logger.debug(`${this.traceStack()} - Return key`);
          return vaultData.data[key];
        }
      }
      throw new Error('No key found');
    } catch (err) {
      this.logger.error(`${this.traceStack()} - ${err}`);
      return err;
    }
  }

  /**
   * Create restify server
   */
  async createRestifyServer() {
    try {
      if (this.started) return;

      this.logger.debug(`${this.traceStack()} - Get key`);
      const key = await this.getVaultSecret(
        process.env.ENVIRONMENT,
        `${this.namespace}_key`,
      );
      if (key instanceof Error) {
        this._fatal('Unable to get key', true);
      }

      this.logger.debug(`${this.traceStack()} - Get certificate`);
      const certificate = await this.getVaultSecret(
        process.env.ENVIRONMENT,
        `${this.namespace}_cert`,
      );
      if (certificate instanceof Error) {
        this._fatal('Unable to get certificate', true);
      }

      this.logger.debug(`${this.traceStack()} - Get client access key`);
      this.apiAccessKey = await this.getVaultSecret(
        process.env.ENVIRONMENT,
        'ClientAccessKey',
      );
      if (this.apiAccessKey instanceof Error) {
        this._fatal('Unable to get api access key', true);
      }

      // Restify server Init
      this.logger.debug(`${this.traceStack()} - Create restify server`);
      this.restifyServer = restify.createServer({
        name: this.serviceName,
        version: this.serviceVersion,
        key,
        certificate,
      });

      // Set response headers
      this.logger.debug(`${this.traceStack()} - Set response headers`);
      this.restifyServer.use((req, res, next) => {
        res.setHeader(
          'Content-Security-Policy',
          `default-src 'self' ${this.namespace}`,
        );
        res.setHeader(
          'Strict-Transport-Security',
          'max-age=31536000; includeSubDomains',
        );
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'no-referrer');
        next();
      });

      // Log any 404's
      this.restifyServer.on('NotFound', (req, res, err, next) => {
        this.logger.error(` notFound - ${err.message}`);
        this.sendResponse(res, next, 404, err);
      });

      // Setup middleware
      this.logger.debug(`${this.traceStack()} - Setup middleware`);
      this.restifyServer.use(
        restify.plugins.jsonBodyParser({ mapParams: true }),
      );
      this.restifyServer.use(
        restify.plugins.acceptParser(this.restifyServer.acceptable),
      );
      this.restifyServer.use(restify.plugins.queryParser({ mapParams: true }));
      this.restifyServer.use(restify.plugins.fullResponse());

      // Setup API requiest logging
      this.logger.debug(`${this.traceStack()} - Setup API requiest logging`);
      this.restifyServer.use((req, res, next) => {
        this.logger.trace(`URL: ${req.url}`);
        if (!helper.isEmptyObject(req.params)) {
          this.logger.trace(`Params: ${JSON.stringify(req.params)}`);
        }
        if (!helper.isEmptyObject(req.query)) {
          this.logger.trace(`Query: ${JSON.stringify(req.query)}`);
        }
        if (!helper.isEmptyObject(req.body)) {
          this.logger.trace(`Body: ${JSON.stringify(req.body)}`);
        }
        next();
      });

      this.restifyServer.use(async (req, res, next) => {
        // Check for valid auth key
        if (
          req.headers['client-access-key'] !== this.apiAccessKey &&
          req.query.clientaccesskey !== this.apiAccessKey
        ) {
          // No key, send error back to caller
          this.logger.trace(
            'No or invaid client access key received in request',
          );
          this.sendResponse(
            res,
            next,
            401,
            'There was a problem authenticating you',
          );
          return;
        }
        next();
      });

      // Setup base API's
      this.logger.debug(`${this.traceStack()} - Setup base API's`);
      this.restifyServer.get('/ping', (req, res, next) =>
        this._ping(req, res, next),
      );

      this.logger.debug(`${this.traceStack()} - Finished base restify setup`);
    } catch (err) {
      this._fatal(err.message, true);
    }
  }

  /**
   * Start restify server
   */
  listen() {
    if (this.started) {
      this.logger.debug(`${this.traceStack()} - Already started`);
      return;
    }

    // Start service and listen to requests
    try {
      this.logger.debug(
        `${this.traceStack()} - Set server to listen for requests`,
      );
      this.restifyServer.listen(process.env.PORT || 3978, () => {
        this.logger.info(`${this.restifyServer.name} - has started`);
      });
      this.started = true;
    } catch (err) {
      this._fatal(err.message, true);
    }
  }

  /**
   * Send response back to caller
   */
  sendResponse(res, next, status, dataObj) {
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
      `${this.traceStack()} - Finished api processing, sending data back to caller`,
    );
    res.json(httpHeaderCode, rtnData);
    next(false); // End call chain
  }

  /**
   * Connect to database
   */
  async connectToDB(database) {
    this.logger.debug(`${this.traceStack()} - Getting databse login details`);
    const DataStore = await this.getVaultSecret(
      process.env.ENVIRONMENT,
      'DataStore',
    );
    const DataStoreUser = await this.getVaultSecret(
      process.env.ENVIRONMENT,
      'DataStoreUser',
    );
    const DataStoreUserPassword = await this.getVaultSecret(
      process.env.ENVIRONMENT,
      'DataStoreUserPassword',
    );
    this.logger.debug(`${this.traceStack()} - Create databse object`);
    const dataClient = new Client({
      host: DataStore,
      database,
      user: DataStoreUser,
      password: DataStoreUserPassword,
      port: 5432,
    });
    this.logger.debug(`${this.traceStack()} - Connect to databse`);
    await dataClient.connect();
    return dataClient;
  }
}
/**
 * Default configuration
 */
Service.defaultOptions = defaultOptions;

module.exports = Service;
