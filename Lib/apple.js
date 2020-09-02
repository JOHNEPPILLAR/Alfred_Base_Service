/**
 * Import external libraries
 */
const apn = require('apn');
const bonjour = require('bonjour')();

/**
 * Send IOS push notification
 *
 * @param {String} Notification text
 *
 */
async function _sendPushNotification(notificationText) {
  try {
    const deviceTokens = [];
    const pushSQL =
      'SELECT last(device_token, time) as device_token FROM ios_devices';

    this.logger.trace(
      `${this._traceStack()} - Connect to data store connection pool`,
    );
    const dbConnection = await this._connectToDB('devices');

    this.logger.trace(`${this._traceStack()} - Get IOS devices`);
    const devicesToNotify = await dbConnection.query(pushSQL);

    this.logger.trace(
      `${this._traceStack()} - Release the data store connection back to the pool`,
    );
    await dbConnection.end(); // Close data store connection

    if (devicesToNotify.rowCount === 0) {
      this.logger.trace(`${this._traceStack()} - No devices to notify`);
      return;
    } // Exit function as no devices to process

    // Send iOS notifications what watering has started
    this.logger.trace(
      `${this._traceStack()} - Build list of devices to send push notification to`,
    );
    devicesToNotify.rows.map((device) =>
      deviceTokens.push(device.device_token),
    );

    // Connect to apples push notification service and send notifications
    const IOSNotificationKeyID = await this._getVaultSecret.call(
      this,
      'IOSNotificationKeyID',
    );
    const IOSNotificationTeamID = await this._getVaultSecret.call(
      this,
      'IOSNotificationTeamID',
    );
    const IOSPushKey = await this._getVaultSecret.call(this, 'IOSPushKey');
    if (
      IOSNotificationKeyID instanceof Error ||
      IOSNotificationTeamID instanceof Error ||
      IOSPushKey instanceof Error
    ) {
      this.logger.error(
        `${this._traceStack()} - Not able to get secret (CERTS) from vault`,
      );
      return;
    }

    const apnProvider = new apn.Provider({
      token: {
        key: IOSPushKey,
        keyId: IOSNotificationKeyID,
        teamId: IOSNotificationTeamID,
      },
      production: true,
    });

    this.logger.trace(`${this._traceStack()} - Send push notification(s)`);
    const notification = new apn.Notification();
    notification.topic = 'JP.Alfred';
    notification.expiry = Math.floor(Date.now() / 1000) + 600; // Expires 10 minutes from now.
    notification.alert = notificationText;
    const result = await apnProvider.send(notification, deviceTokens);

    if (result.sent.length > 0) {
      this.logger.info(`Push notification sent: ${notificationText}`);
    } else {
      this.logger.error(
        `${this._traceStack()} - Push notification faild to be sent`,
      );
    }

    this.logger.trace(
      `${this._traceStack()} - Close down connection to push notification service`,
    );
    await apnProvider.shutdown(); // Close the connection with apn
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
  }
}

async function _bonjourScan() {
  const services = [];
  await bonjour.find({}, (service) => {
    services.push(service);
  });
  return services;
}

module.exports = {
  _sendPushNotification,
  _bonjourScan,
};
