/**
 * Import external libraries
 */
const scheduler = require('node-schedule');
const dateFormat = require('dateformat');

function _addSchedule(date, description, functionToCall, ...rest) {
  try {
    this.logger.trace(`${this._traceStack()} - create schedule object`);
    const schedule = scheduler.scheduleJob(date, () =>
      functionToCall.apply(this, rest),
    );
    this.logger.trace(
      `${this._traceStack()} - Add ${description} schedule to schedules array`,
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
