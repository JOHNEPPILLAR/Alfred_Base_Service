/**
 * Import libraries
 */
const { google } = require('googleapis');
const moment = require('moment');

/**
 * Get Google calendar
 *
 * @param {String} filter
 * @param {String} Calendar ID
 *
 */
async function _getGoogleCal(query, callID) {
  try {
    let credentials = await this._getVaultSecret(
      process.env.ENVIRONMENT,
      'GoogleAPIKey',
    );
    credentials = JSON.parse(credentials);

    // Configure a JWT auth client
    const jwtClient = new google.auth.JWT(
      credentials.client_email,
      null,
      credentials.private_key,
      ['https://www.googleapis.com/auth/calendar.events.readonly'],
    );

    // Authenticate request
    this.logger.debug(`${this._traceStack()} - Login to Google API`);
    await jwtClient.authorize();
    this.logger.debug(`${this._traceStack()} - Connected to Google API`);

    const googleAPICalendarID = await this._getVaultSecret(
      process.env.ENVIRONMENT,
      callID,
    );
    this.logger.debug(`${this._traceStack()} - Check if ${query}`);
    const calendar = google.calendar('v3');
    const events = await calendar.events.list({
      auth: jwtClient,
      calendarId: googleAPICalendarID,
      timeMin: moment().clone().startOf('day').toISOString(),
      timeMax: moment().clone().endOf('day').toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      q: query,
    });
    return events.data.items;
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err}`);
    return err;
  }
}

/**
 * Check google calendar to see if kids are staying
 */
async function _kidsAtHomeToday() {
  try {
    const events = await this._getGoogleCal(
      'Girls @ JP',
      'GoogleAPICalendarID',
    );
    if (events instanceof Error) return events;

    // Process calendar events
    if (events.length > 0) {
      this.logger.debug(`${this._traceStack()} - Girls staying @ JP's today`);
      return true;
    }
    this.logger.debug(`${this._traceStack()} - Girls not staying @ JP's today`);
    return false;
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
    return err;
  }
}

module.exports = {
  _getGoogleCal,
  _kidsAtHomeToday,
};
