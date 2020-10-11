/**
 * Import libraries
 */
const { google } = require('googleapis');
const moment = require('moment');
const geolib = require('geolib');
const dateFormat = require('dateformat');

/**
 * Login to Google
 *
 */
async function _loginGoogle() {
  try {
    let credentials = await this._getVaultSecret('GoogleAPIKey');
    credentials = JSON.parse(credentials);

    // Configure a JWT auth client
    const jwtClient = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: [
        'https://www.googleapis.com/auth/calendar.events.readonly',
        'https://www.googleapis.com/auth/sdm.service',
      ],
    });

    // Authenticate request
    this.logger.trace(`${this._traceStack()} - Login to Google API`);
    await jwtClient.authorize();
    this.logger.trace(`${this._traceStack()} - Connected to Google API`);

    return jwtClient;
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err}`);
    return err;
  }
}

/**
 * Get Google calendar
 *
 * @param {String} filter
 * @param {String} Calendar ID
 *
 */
async function _getGoogleCal(query, callID) {
  try {
    this.logger.trace(`${this._traceStack()} - Get access token from google`);
    const jwtClient = await _loginGoogle();

    const googleAPICalendarID = await this._getVaultSecret(callID);
    this.logger.trace(`${this._traceStack()} - Check if ${query}`);
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
async function _workingFromHomeToday() {
  try {
    const events = await this._getGoogleCal(
      'JP work from home',
      'JPGoogleAPICalendarID',
    );
    if (events instanceof Error) return events;

    // Process calendar events
    if (events.length > 0) {
      this.logger.trace(`${this._traceStack()} - Working from home today`);
      return true;
    }
    this.logger.trace(`${this._traceStack()} - Not working from home today`);
    return false;
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
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
      'SharedGoogleAPICalendarID',
    );
    if (events instanceof Error) return events;

    // Process calendar events
    if (events.length > 0) {
      this.logger.trace(`${this._traceStack()} - Girls staying @ JP's today`);
      return true;
    }
    this.logger.trace(`${this._traceStack()} - Girls not staying @ JP's today`);
    return false;
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
    return err;
  }
}

/**
 * Check to see if caller is in home geo fence
 *
 * @param {Int} lat
 * @param {Int} Long
 *
 */
async function _inHomeGeoFence(lat, long) {
  const geoHome = await this._getVaultSecret('geoHome');
  const geoFenceHomeData = JSON.parse(geoHome);
  return geolib.isPointInPolygon(
    { latitude: lat, longitude: long },
    geoFenceHomeData,
  );
}

/**
 * Check to see if caller is in home geo fence
 *
 * @param {Int} lat
 * @param {Int} Long
 *
 */
async function _inJPWorkGeoFence(lat, long) {
  const geoJPWork = await this._getVaultSecret('geoJPWork');
  const geoFenceHomeData = JSON.parse(geoJPWork);
  return geolib.isPointInPolygon(
    { latitude: lat, longitude: long },
    geoFenceHomeData,
  );
}

/**
 * Check if it's a weekend or bank holiday
 */
async function _isBankHolidayWeekend() {
  this.logger.trace(
    `${this._traceStack()} - Check for bank holidays and weekends`,
  );
  const url = 'https://www.gov.uk/bank-holidays.json';
  const toDay = new Date();
  const isWeekend = toDay.getDay() === 6 || toDay.getDay() === 0;

  if (isWeekend) {
    this.logger.trace(`${this._traceStack()} - It's the weekend`);
    return true;
  }

  const returnData = await this._callAPIServiceGet(url);
  if (returnData instanceof Error) {
    this.logger.error(`${this._traceStack()} - ${returnData.message}`);
    return returnData;
  }

  let bankHolidays = [];
  try {
    bankHolidays = returnData['england-and-wales'].events;
    if (bankHolidays.length === 0) throw Error('No bank holiday data');
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
    return err;
  }

  bankHolidays = bankHolidays.filter(
    (a) => a.date === dateFormat(toDay, 'yyyy-mm-dd'),
  );
  if (bankHolidays.length === 0) {
    this.logger.trace(`${this._traceStack()} - It's the weekday`);
    return false;
  }
  this.logger.trace(`${this._traceStack()} - It's ${bankHolidays[0].title}`);
  return true;
}

module.exports = {
  _loginGoogle,
  _getGoogleCal,
  _workingFromHomeToday,
  _kidsAtHomeToday,
  _inHomeGeoFence,
  _inJPWorkGeoFence,
  _isBankHolidayWeekend,
};
