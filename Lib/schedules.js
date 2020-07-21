/**
 * Import external libraries
 */
const scheduler = require('node-schedule');
const dateFormat = require('dateformat');

function activateSchedules() {
  try {
    this.logger.info("Setup today's schedules");
    this.schedules.map(async (schedule) => {
      const date = new Date();
      date.setHours(schedule.date.getHours());
      date.setMinutes(schedule.date.getMinutes());
      this.addSchedule(
        date,
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

    scheduler.scheduleJob(tomorrowDate, () => activateSchedules.call(this));
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

function addSchedule(date, description, functionToCall, ...rest) {
  try {
    this.logger.trace(`${this._traceStack()} - Create schedule object`);
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
