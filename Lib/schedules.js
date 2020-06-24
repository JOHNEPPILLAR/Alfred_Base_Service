/**
 * Import external libraries
 */
const scheduler = require('node-schedule');
const dateFormat = require('dateformat');

function _addSchedule(date, description, functionToCall, ...rest) {
  try {
    const schedule = scheduler.scheduleJob(date, () =>
      functionToCall.apply(this, rest),
    );
    this.schedules.push(schedule);
    this.logger.info(
      `${description} schedule will run at ${dateFormat(
        date,
        'dd-mm-yyyy @ HH:MM',
      )}`,
    );
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
  }
}

module.exports = {
  _addSchedule,
};
