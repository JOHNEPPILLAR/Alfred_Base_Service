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
  const deviceTokens = [];

  let dbConnection;

  try {
    this.logger.trace(`${this._traceStack()} - Connect to db`);
    dbConnection = await this._connectToDB();
    this.logger.trace(`${this._traceStack()} - Execute query`);
    const query = {};
    const results = await dbConnection
      .db('alfred_push_notification')
      .collection('alfred_push_notification')
      .find(query)
      .toArray();

    if (results.count === 0) {
      // Exit function as no data to process
      this.logger.trace(`${this._traceStack()} - No devices to notify`);
      return;
    }

    // Send iOS notifications what watering has started
    this.logger.trace(
      `${this._traceStack()} - Build list of devices to send push notification to`,
    );
    results.map((device) => deviceTokens.push(device.device_token));

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

function _bonjourScan(deviceName) {
  return new Promise((resolve, reject) => {
    bonjour.find({}, (service) => {
      if (service.host.substring(0, service.host.indexOf('.')) === deviceName)
        resolve(service);
    });

    setTimeout(() => {
      reject(new Error(`Network scan timeout for: ${deviceName}`));
    }, 60 * 1000); // 1 minute timeout
  });
}

module.exports = {
  _sendPushNotification,
  _bonjourScan,
};
