var inputEvent = require('./input-event');
const { exec } = require("child_process");
var debounce = require('debounce-async');
const { getDayTime, parseTime, delay, getTimeAndDate } = require('./common')
var k = new inputEvent('event6'); // 'event0' is the file corresponding to my keyboard in /dev/input/

let currentDimmer = 400
const maxRange = 500
const minRange = 450
const nightRange = 440

const displayTimeout = 60000 // 60sek

var timer
exec(`gpio -g pwm 18 1024`);
exec(`gpio -g mode 18 pwm`);
exec(`gpio pwmc 1000`);
exec(`gpio -g pwm 18 ${currentDimmer}`)

let obj = []

for (let index = 0; index < 100; index++) {
    obj.push(index)
}

class DisplayDimmer {
    constructor() {
        (async () => {
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
        for (const key of obj) {
            if (currentDimmer < nightRange) {
                currentDimmer++
                await setDimmer(currentDimmer);
            }
        }
    }
    async initDisplayForSunrise() {
        console.log(`initDisplayForSunset at ${getTimeAndDate()}`)
        for (const key of obj) {
            if (currentDimmer < minRange) {
                currentDimmer++
                await setDimmer(currentDimmer);
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
}


const setDimmer = function (dimm) {
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

const touchEvent = async (data) => {
    const diffDate = Date.now() - lastTouchDate
    if (diffDate > displayTimeout) {
        console.log('Light up backlight')
        for (const key of obj) {
            if (currentDimmer < maxRange) {
                currentDimmer++
                currentDimmer++
                currentDimmer++
                currentDimmer++
                currentDimmer++
                await setDimmer(currentDimmer);
            }
        }
    }
    console.log('Light down backlight scheduled')
    if (timer) clearTimeout(timer)
    timer = setTimeout(async function () {
        console.log(`Light down backlight`)
        const value = displayDimmer.isSunset ? nightRange : minRange
        for (const key of obj) {
            if (currentDimmer > value) {
                currentDimmer--
                await setDimmer(currentDimmer);
            } else {
                return
            }
        }
    }, displayTimeout)
    lastTouchDate = Date.now()
}


var debounced = debounce.default(touchEvent, 100);


k.on('rel', debounced);
k.on('abs', debounced);
k.on('syn', debounced);
var lastTouchDate = 0

const displayDimmer = new DisplayDimmer()