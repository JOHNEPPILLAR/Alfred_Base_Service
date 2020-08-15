/**
 * Import libraries
 */
const restify = require('restify');
const helper = require('alfred-helper');
const path = require('path');

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
        this.logger.error(`Uncaught exception: ${err}`);
      });
      process.on('unhandledRejection', (reason, p) => {
        this.logger.error(
          `Unhandled rejection at promise:: ${this._traceStack()} - ${p} - ${reason}`,
        );
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

      this.logger.trace(`${this._traceStack()} - Get key`);
      const key = await this._getVaultSecret(`${this.namespace}_key`);
      if (key instanceof Error) {
        this._fatal('Unable to get key', true);
      }

      this.logger.trace(`${this._traceStack()} - Get certificate`);
      const certificate = await this._getVaultSecret(`${this.namespace}_cert`);
      if (certificate instanceof Error) {
        this._fatal('Unable to get certificate', true);
      }

      this.logger.trace(`${this._traceStack()} - Get client access key`);
      this.apiAccessKey = await this._getVaultSecret('ClientAccessKey');
      if (this.apiAccessKey instanceof Error) {
        this._fatal('Unable to get api access key', true);
      }

      // Restify server Init
      this.logger.trace(`${this._traceStack()} - Create restify server`);
      this.restifyServer = restify.createServer({
        name: this.serviceName,
        version: this.serviceVersion,
        key,
        certificate,
      });

      // Set response headers
      this.logger.trace(`${this._traceStack()} - Set response headers`);
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
        this._sendResponse(res, next, 404, err);
      });

      // Setup middleware
      this.logger.trace(`${this._traceStack()} - Setup middleware`);
      this.restifyServer.use(
        restify.plugins.jsonBodyParser({ mapParams: true }),
      );
      this.restifyServer.use(
        restify.plugins.acceptParser(this.restifyServer.acceptable),
      );
      this.restifyServer.use(restify.plugins.queryParser({ mapParams: true }));
      this.restifyServer.use(restify.plugins.fullResponse());

      // Setup API requiest logging
      this.logger.trace(`${this._traceStack()} - Setup API requiest logging`);
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
        const fileExt = path.extname(req.url).toLowerCase();
        if (
          req.headers['client-access-key'] !== this.apiAccessKey &&
          req.query.clientaccesskey !== this.apiAccessKey &&
          fileExt !== '.ts'
        ) {
          if (req.url !== '/ping') {
            // No key and not a ping test
            this.logger.trace(
              'No or invaid client access key received in request',
            );
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
      this.logger.trace(`${this._traceStack()} - Setup base API's`);
      this.restifyServer.get('/ping', (req, res, next) =>
        this._ping(req, res, next),
      );

      this.logger.trace(`${this._traceStack()} - Finished base restify setup`);
    } catch (err) {
      this._fatal(err.message, true);
    }
  }

  /**
   * Start restify server
   */
  listen() {
    if (this.started) {
      this.logger.trace(`${this._traceStack()} - Already started`);
      return;
    }

    // Start service and listen to requests
    try {
      this.logger.trace(
        `${this._traceStack()} - Set server to listen for requests`,
      );
      this.restifyServer.listen(process.env.PORT || 3978, () => {
        this.logger.info(`${this.restifyServer.name} - has started`);
      });
      this.started = true;
    } catch (err) {
      this._fatal(err.message, true);
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
