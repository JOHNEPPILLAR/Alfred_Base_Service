/**
 * Import external libraries
 */
const apn = require('@parse/node-apn');
const bonjour = require('bonjour')();
const debug = require('debug')('Base:Apple');

/**
 * Get unread notifications
 */
async function _getUnreadNotification() {
  let dbConnection;

  try {
    debug('Connect to DB');
    dbConnection = await this._connectToDB();
    debug('Query DB');
    const results = await dbConnection
      .db('alfred_push_notification')
      .collection('notificatons')
      .aggregate([{ $match: { unRead: true } }, { $sort: { _id: -1 } }])
      .toArray();
    return results;
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
  } finally {
    debug('Close DB connection');
    await dbConnection.close();
  }
  return true;
}

/**
 * Send IOS push notification
 *
 * @param {String} Notification text
 *
 */
async function _sendPushNotification(notificationText) {
  const deviceTokens = [];

  let dbConnection;
  let results;
  let badgeCount = 0;

  try {
    // Save notification to view in app
    const notificationJSON = {
      time: new Date(),
      notification: notificationText,
      unRead: true,
    };
    debug('Connect to DB');
    dbConnection = await this._connectToDB();
    debug('Insert data');
    results = await dbConnection
      .db('alfred_push_notification')
      .collection('notificatons')
      .insertOne(notificationJSON);

    if (results.insertedCount === 1) {
      debug('Saved notification');
    } else {
      debug('Not able to save notification');
    }

    debug('Query DB');
    results = await dbConnection
      .db('alfred_push_notification')
      .collection('alfred_push_notification')
      .find({})
      .toArray();

    if (results.length === 0) {
      // Exit function as no data to process
      debug('No devices to notify');
      return;
    }

    debug('Get number of outstading notifications');
    const tmpResults = await _getUnreadNotification.call(this);
    badgeCount = tmpResults.length;
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
    return;
  } finally {
    debug('Close DB connection');
    await dbConnection.close();
  }

  try {
    // Send iOS notifications
    debug('Build list of devices to send push notification to');
    results.map((device) => deviceTokens.push(device.token));

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

    debug('Send push notification(s)');
    const notification = new apn.Notification();
    notification.topic = 'JP.Alfred';
    notification.expiry = Math.floor(Date.now() / 1000) + 600; // Expires 10 minutes from now.
    notification.badge = badgeCount;
    notification.alert = notificationText;
    const result = await apnProvider.send(notification, deviceTokens);

    if (result.sent.length > 0) {
      this.logger.info(`Push notification sent: ${notificationText}`);
    } else {
      this.logger.error(
        `${this._traceStack()} - Push notification faild to be sent`,
      );
    }

    debug('Close down connection to push notification service');
    await apnProvider.shutdown(); // Close the connection with apn
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
  }
}

/**
 * Scan for bonjour compatiable devices
 */
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
  _getUnreadNotification,
  _sendPushNotification,
  _bonjourScan,
};
