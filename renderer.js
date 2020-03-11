// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process because
// `nodeIntegration` is turned off. Use `preload.js` to
// selectively enable features needed in the rendering
// process.

const SerialPort = require("serialport");
const robot = require('robotjs');

// const port = new SerialPort("COM14", {
//     baudRate: 9600
// });

var prev, curr;

var zero = 0;
var stable = 0;
var isStable = false, isSent = false;

const THRESHOLD = 0.20;
const STABLE_THRESHOLD = 4;

const signalDebug = false;
const timeDebug = true;

var stop = false;
var port;

/*
    Avg. KB I/O time : 1000ms
*/

$("#start").click(function() {
  var portNum = $("#port").val();
  if(!portNum){
    alert('PORT REQUIRED');
    return false;
  }

  port = new SerialPort(portNum, {
      baudRate: 9600
  });

  $("#current-status").text('시작');

  mainThread();
})

$("#stop").click(function() {
  stop = true;
  $("#current-status").text('중지');
})

async function eventSerializer(){
    return new Promise(async (resolve, reject) =>{
        port
        .on('open', async () =>{
            if(stop) {
              process.exit();
            }
            process.stdout.write('\x07\x07\x07\x07');

            port.on('data', async (data) =>{
                data = data.toString('utf8').replace(/[wkg]/gi, '');
                if(isNaN(data)) return resolve();

                data = Number(data);
                if(signalDebug) console.log(`${prev}   ${curr}   Rate : ${stable}   Stable : ${isStable}   Sent : ${isSent}`);

                curr = data;

                if(data == 0){
                    zero++

                    if(STABLE_THRESHOLD < zero) isSent = false, zero = 0;
                }
                else zero = 0;

                if(data == 0 || Math.abs(data) <= THRESHOLD){
                    return resolve();
                }

                if(stable < STABLE_THRESHOLD) isStable = false;
                else isStable = true;

                if(curr == prev){
                    stable++;

                    if(isStable && !isSent){
                        prev = curr, stable = 0, isStable = false, isSent = true;
                        let buf = `${String(curr)}`;

                        process.stdout.write('\x07');//Beep sound with "please wait"
                        if(timeDebug) console.time('I/O');//Start KB I/O
                        await robot.typeString(buf);
                        if(timeDebug) console.timeLog('I/O');
                        await robot.keyTap('tab')
                        process.stdout.write('\x07');//Beep sound with "good to go"
                        if(timeDebug) console.timeLog('I/O');//End KB I/O
                        if(timeDebug) console.timeEnd('I/O');
                    }
                }
                else prev = curr, curr = 0, stable = 0, isStable = false, isSent = false;

                resolve();
            });
        })
        .on('error', async (error) =>{
            console.log(error);
        })
    })
}

async function mainThread(){
    return new Promise(async (resolve, reject) =>{
        try{
            await eventSerializer();
            resolve();
        }
        catch(e){
            reject();
        }
    })
}
