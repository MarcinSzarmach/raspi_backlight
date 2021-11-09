var inputEvent = require('./input-event');
const { exec } = require("child_process");
var debounce = require('debounce-async');
const { getDayTime, parseTime, delay, getTimeAndDate } = require('./common')
var k = new inputEvent('event6'); // 'event0' is the file corresponding to my keyboard in /dev/input/




exec(`gpio -g pwm 18 1024`);
exec(`gpio -g mode 18 pwm`);
exec(`gpio pwmc 1000`);
exec(`gpio -g pwm 18 ${500}`)



class DisplayDimmer {
    constructor() {
        (async () => {
            this.displayTimeout = 60000 // 60sek
            this.timer
            this.currentDimmer = 400
            this.maxRange = 500
            this.minRange = 450
            this.nightRange = 440
            this.iterator = []
            for (let index = 0; index < 100; index++) this.iterator.push(index)

            const debouncer = debounce.default(this.touchEvent.bind(this), 100)
            k.on('rel', debouncer);
            k.on('abs', debouncer);
            k.on('syn', debouncer);
            this.lastTouchDate = 0

            console.log(`App initialized at ${getTimeAndDate()}`)
            await delay(15000)
            // delay for raspi to download current time from internet - only when first boot
            console.log(`App gets timers at ${getTimeAndDate()}`)
            await this.initTimers()
            var milisToSunrise = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), this.times.sunrise.hour, this.times.sunrise.minute, 0, 0) - new Date();
            if (milisToSunrise < 0) {
                this.isSunset = true
            } else {
                this.isSunset = false
            }
            await this.initDisplayForSunset()
        })();
    }
    async initDisplayForSunset() {
        console.log(`initDisplayForSunset at ${getTimeAndDate()}`)
        for (const key of this.iterator) {
            if (this.currentDimmer < this.nightRange) {
                this.currentDimmer++
                await this.setDimmer(this.currentDimmer);
            }
        }
    }
    async initDisplayForSunrise() {
        console.log(`initDisplayForSunset at ${getTimeAndDate()}`)
        for (const key of this.iterator) {
            if (this.currentDimmer < this.minRange) {
                this.currentDimmer++
                await this.setDimmer(this.currentDimmer);
            }
        }
    }
    async checkTimesAndRefresh() {
        if (this.daySunsetAndSunriseUpdated != new Date().getDay()) {
            await this.refreshTimeSunsetAndSunrise()
        }
    }
    async refreshTimeSunsetAndSunrise() {
        const rawDayTime = await getDayTime()
        this.times = {
            sunrise: parseTime(rawDayTime.sunrise),
            sunset: parseTime(rawDayTime.sunset)
        }
        console.log(`Downloaded new times: ${JSON.stringify(this.times)}`)
        this.daySunsetAndSunriseUpdated = new Date().getDay();
    }
    async initTimersForSunset() {
        var milisToSunset = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), this.times.sunset.hour, this.times.sunset.minute, 0, 0) - new Date();
        if (milisToSunset < 0) {
            milisToSunset += 86400000;
        }
        const self = this;
        setTimeout(async function () {
            console.log(`Now is sunset, start function at ${getTimeAndDate()}`, new Date)
            self.isSunset = true
            if (!self.isLighting) {
                await self.initDisplayForSunset.apply(self)
            }
            await self.checkTimesAndRefresh()
            self.initTimersForSunset()
        }, milisToSunset);

    }
    async initTimersForSunrise() {
        var milisToSunrise = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), this.times.sunrise.hour, this.times.sunrise.minute, 0, 0) - new Date();
        if (milisToSunrise < 0) {
            milisToSunrise += 86400000; // it's after 10am, try 10am tomorrow.
        }
        const self = this;
        setTimeout(async function () {
            console.log(`Now is sunrise, starting function at ${getTimeAndDate()}`, new Date)
            self.isSunset = false
            if (!self.isLighting) {
                await self.initDisplayForSunrise();
            }
            await self.checkTimesAndRefresh()
            self.initTimersForSunrise()
        }, milisToSunrise);
    }
    async initTimers() {
        await this.refreshTimeSunsetAndSunrise();
        await this.initTimersForSunset();
        await this.initTimersForSunrise();
    }
    async touchEvent(data) {
        const diffDate = Date.now() - this.lastTouchDate
        console.log(diffDate, this.displayTimeout)
        if (diffDate > this.displayTimeout) {
            console.log('Light up backlight')
            for (const key of this.iterator) {
                if (this.currentDimmer < this.maxRange) {
                    this.currentDimmer++
                    this.currentDimmer++
                    this.currentDimmer++
                    this.currentDimmer++
                    this.currentDimmer++
                    await this.setDimmer(this.currentDimmer);
                }
            }
        }
        console.log('Light down backlight scheduled')
        if (this.timer) clearTimeout(this.timer)
        this.timer = setTimeout(async function () {
            console.log(`Light down backlight`)
            const value = displayDimmer.isSunset ? this.nightRange : this.minRange
            for (const key of this.iterator) {
                if (this.currentDimmer > value) {
                    this.currentDimmer--
                    await this.setDimmer(this.currentDimmer);
                } else {
                    return
                }
            }
        }.bind(this), this.displayTimeout)
        this.lastTouchDate = Date.now()
    }
    setDimmer(dimm) {
        return new Promise((resolve, reject) => {
            console.log(`Dimmer set dimmer ${dimm}`)
            exec(`gpio -g pwm 18 ${dimm}`, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                }
                if (stderr) {
                    resolve();
                }
                resolve();
            });
        });
    }
}

const displayDimmer = new DisplayDimmer()
