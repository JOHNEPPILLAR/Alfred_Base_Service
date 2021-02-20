/**
 * Import libraries
 */
const restify = require('restify');
const helper = require('alfred-helper');
const path = require('path');
const debug = require('debug')('Base:Service');

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

      // Vault
      this.vault = [];

      // Logger
      this._setupLogger();

      // Start configuration
      this.logger.info(
        `${baseServiceDescription} v${this.baseServiceVersion} is starting...`,
      );

      // Schedules
      this.schedules = [];

      // Finished init
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
        this.logger.error('Uncaught exception');
        this.logger.error(err);
      });
      process.on('unhandledRejection', (reason) => {
        this.logger.error(`Unhandled rejection at: ${reason.stack || reason}`);
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
   * Public functions
   ************************* */

  /**
   * Create restify server
   */
  async createRestifyServer() {
    try {
      if (this.started) return;

      // Get data from Vault
      await this._openVault();

      debug(`Get key`);
      let sslKey = 'ssl_key';
      let sslCert = 'ssl_cert';
      if (process.env.ENVIRONMENT === 'development') {
        sslKey = 'dev_ssl_key';
        sslCert = 'dev_ssl_cert';
      }

      const key = await this._getVaultSecret(sslKey);
      if (key instanceof Error) {
        this.logger.error(`${this._traceStack()} - Unable to get key`);
        this._fatal(true);
      }

      debug(`Get certificate`);
      const certificate = await this._getVaultSecret(sslCert);
      if (certificate instanceof Error) {
        this.logger.error(`${this._traceStack()} - Unable to get certificate`);
        this._fatal(true);
      }

      debug(`Get client access key`);
      this.apiAccessKey = await this._getVaultSecret('ClientAccessKey');
      if (this.apiAccessKey instanceof Error) {
        this.logger.error(
          `${this._traceStack()} - Unable to get api access key`,
        );
        this._fatal(true);
      }

      // Restify server Init
      debug(`Create restify server`);
      this.restifyServer = restify.createServer({
        name: this.serviceName,
        version: this.serviceVersion,
        key,
        certificate,
      });

      // Set response headers
      debug(`Set response headers`);
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
        this.logger.error(`NotFound - ${err.message}`);
        this._sendResponse(res, next, 404, err);
      });

      // Setup middleware
      debug(`Setup middleware`);
      this.restifyServer.use(
        restify.plugins.jsonBodyParser({ mapParams: true }),
      );
      this.restifyServer.use(
        restify.plugins.acceptParser(this.restifyServer.acceptable),
      );
      this.restifyServer.use(restify.plugins.queryParser({ mapParams: true }));
      this.restifyServer.use(restify.plugins.fullResponse());

      // Rate limiter
      this.restifyServer.use(
        restify.plugins.throttle({ burst: 10, rate: 5, ip: true }),
      );

      // Setup API requiest logging
      debug(`Setup API requiest logging`);
      this.restifyServer.use((req, res, next) => {
        debug(`URL: ${req.url}`);
        if (!helper.isEmptyObject(req.params)) {
          debug(`Params: ${JSON.stringify(req.params)}`);
        }
        if (!helper.isEmptyObject(req.query)) {
          debug(`Query: ${JSON.stringify(req.query)}`);
        }
        if (!helper.isEmptyObject(req.body)) {
          debug(`Body: ${JSON.stringify(req.body)}`);
        }
        next();
      });

      this.restifyServer.use(async (req, res, next) => {
        // Check for valid auth key
        const fileExt = path.extname(req.url).toLowerCase();
        if (
          req.headers['client-access-key'] !== this.apiAccessKey &&
          req.query.clientaccesskey !== this.apiAccessKey &&
          fileExt !== '.ts'
        ) {
          if (req.url !== '/ping') {
            // No key and not a ping test
            debug('No or invaid client access key received in request');
          }
          this._sendResponse(
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
      debug(`Setup base API's`);
      this.restifyServer.get('/ping', (req, res, next) =>
        this._ping(req, res, next),
      );

      debug(`Finished base restify setup`);
    } catch (err) {
      this.logger.error(`${this._traceStack()} - ${err.message}`);
      this._fatal(true);
    }
  }

  /**
   * Start restify server
   */
  listen() {
    if (this.started) {
      debug(`Already started`);
      return;
    }

    // Start service and listen to requests
    try {
      debug(`- Set server to listen for requests`);
      this.restifyServer.listen(process.env.PORT || 3978, () => {
        this.logger.info(`${this.restifyServer.name} - has started`);
      });
      this.started = true;
    } catch (err) {
      this.logger.error(`${this._traceStack()} - ${err.message}`);
      this._fatal(true);
    }
  }
}

/**
 * Bind extention functions to base class
 */
Object.assign(Service.prototype, require('./logging'));
Object.assign(Service.prototype, require('./response'));
Object.assign(Service.prototype, require('./vault'));
Object.assign(Service.prototype, require('./database'));
Object.assign(Service.prototype, require('./callAPI'));
Object.assign(Service.prototype, require('./schedules'));
Object.assign(Service.prototype, require('./google'));
Object.assign(Service.prototype, require('./apple'));

/**
 * Default configuration
 */
Service.defaultOptions = defaultOptions;

module.exports = Service;
