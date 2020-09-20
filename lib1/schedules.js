/**
 * Import external libraries
 */
const scheduler = require('node-schedule');
const dateFormat = require('dateformat');

function activateSchedules() {
  try {
    this.logger.info("Setup today's schedules");
    this.schedules.map(async (schedule) => {
      this.addSchedule(
        schedule.hour,
        schedule.minute,
        schedule.description,
        schedule.functionToCall,
        schedule.args,
      );
    });

    this.logger.trace('Set daily reset schedule up for tomorrow');
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    tomorrowDate.setHours(3);
    tomorrowDate.setMinutes(0);

    scheduler.scheduleJob(tomorrowDate, () => this.setupSchedules.call(this));
    this.logger.info(
      `Daily reset schedule will run at ${dateFormat(
        tomorrowDate,
        'dd-mm-yyyy @ HH:MM',
      )}`,
    );
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
  }
}

function addSchedule(hour, minute, description, functionToCall, ...rest) {
  try {
    this.logger.trace(`${this._traceStack()} - Create schedule object`);

    const date = new Date();
    date.setHours(hour);
    date.setMinutes(minute);

    scheduler.scheduleJob(date, () => functionToCall.apply(this, rest));
    this.logger.trace(
      `${this._traceStack()} - Add ${description} schedule to schedules array`,
    );
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
  activateSchedules,
  addSchedule,
};
