/**
 * Import libraries
 */
const { google } = require('googleapis');
const moment = require('moment');
const geolib = require('geolib');
const dateFormat = require('dateformat');
const debug = require('debug')('Base:Google');

/**
 * Login to Google
 *
 */
async function _loginGoogle() {
  try {
    debug('Login to Google');
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
    debug('Login to Google API');
    await jwtClient.authorize();

    debug('Connected to Google API');
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
    debug('Get google calendar data');
    const jwtClient = await _loginGoogle.call(this);

    const googleAPICalendarID = await this._getVaultSecret(callID);

    debug(`Check if ${query}`);
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
    debug(events.data.items);
    return events.data.items;
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err}`);
    return err;
  }
}

/**
 * Check google calendar to see if working from home
 */
async function _workingFromHomeToday() {
  debug('Check if working from home');
  try {
    const events = await this._getGoogleCal('WFH', 'JPGoogleAPICalendarID');
    if (events instanceof Error) return events;

    // Process calendar events
    if (events.length > 0) {
      debug('Working from home today');
      return true;
    }
    debug('Not working from home today');
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
  debug('Check if girls stayng');
  try {
    const events = await this._getGoogleCal(
      'Girls @ JP',
      'SharedGoogleAPICalendarID',
    );
    if (events instanceof Error) return events;

    // Process calendar events
    if (events.length > 0) {
      debug("Girls staying @ JP's today");
      return true;
    }
    debug("Girls not staying @ JP's today");
    return false;
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
    return err;
  }
}

/**
 * Check to see if location is in home geo fence
 *
 * @param {Int} lat
 * @param {Int} Long
 *
 */
async function _inHomeGeoFence(lat, long) {
  debug('Check in JP home Geo Fence');
  const geoHome = await this._getVaultSecret('geoHome');
  const geoFenceHomeData = JSON.parse(geoHome);
  return geolib.isPointInPolygon(
    { latitude: lat, longitude: long },
    geoFenceHomeData,
  );
}

/**
 * Check to see if location is in home geo fence
 *
 * @param {Int} lat
 * @param {Int} Long
 *
 */
async function _inJPWorkGeoFence(lat, long) {
  debug('Check in JP Work Geo Fence');
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
  debug('Check if today is a bank holidays or weekend');
  const url = 'https://www.gov.uk/bank-holidays.json';
  const toDay = new Date();
  const isWeekend = toDay.getDay() === 6 || toDay.getDay() === 0;

  if (isWeekend) {
    debug('Today is on the weekend');
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
    debug('Today is a weekday');
    return false;
  }
  debug(`It's ${bankHolidays[0].title}`);
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
