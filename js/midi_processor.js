// midi elements
let name, tracks, ppq, timeSigs;
let maxTicks;
let windowWidth;
let profiles, correlations; // key for each window

const noteRange = 130; // 130 possible pitches from midi

// canvas variables
let canvas, ctx;
let w, h;
let unitWidth, unitHeight;


function draw(midi) {

    // canvas variables
    canvas = document.getElementById("canvas");
    ctx = canvas.getContext("2d");
    w = ctx.canvas.width;
    h = ctx.canvas.height;
    ctx.clearRect(0, 0, w, h);

    // midi variables
    tracks = midi.tracks;
    ppq = midi.header.ppq; // the Pulses Per Quarter Note (quarter beat duration)
    maxTicks = getMaxTicks();
    timeSigs = midi.header.timeSignatures;

    // drawing variables
    // nUnits = Math.ceil(maxTicks / ppq);
    // unitWidth = Math.max(10, Math.min(100, w / nUnits));
    unitWidth = w / maxTicks; // width per tick
    unitHeight = h / noteRange; // height of each note



    profiles = findPitchProfiles(); // key for each window
    console.log(profiles);
    correlations = profiles.map((profile) => {
        return findR(profile);
    }); // 24 tonal hierarchy vectors (correlations) for each window
    console.log(correlations);

    // fill cells
    tracks.forEach((track) => {
        let notes = track.notes;
        notes.forEach((note) => {
            let r = Math.floor(Math.random() * (255 - 150) + 150);
            let g = Math.floor(Math.random() * (255 - 150) + 150);
            let b = Math.floor(Math.random() * (255 - 150) + 150);
            ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
            ctx.fillRect(note.ticks * unitWidth,
                (noteRange - note.midi) * unitHeight,
                note.durationTicks * unitWidth,
                unitHeight);
        })
    });
}

function getMaxTicks() {
    let maxTicks = 0;
    tracks.forEach((track) => {
        maxTicks = Math.max(maxTicks, track.endOfTrackTicks);
    });
    return maxTicks;
}

// key for every measure
function findPitchProfiles() {
    let windowsPP = []; // pitch profiles [each pitch's unit: number of quarter notes]
    let windowsKeyR = []; // correlation efficient for each key

    // time divisions
    let timeDivisions = []; // divisions by time signatures
    timeSigs.forEach(timeSig => {
        let t = timeSig.timeSignature;
        let startTick = timeSig.ticks;
        let tpm = 4 / t[1] * t[0] * ppq; // ticks per measure
        timeDivisions.push({
            width: tpm, // unit for window: ticks
            startTick: startTick,
            endTick: 0,
            startWin: 0,
            endWin: 0,
        });
    });

    // assign window slots
    for (let i = 0; i < timeDivisions.length; i++) {
        let curDivision = timeDivisions[i];
        let curDivStart = curDivision.startTick;
        let endTick = maxTicks;
        if (i != timeDivisions.length - 1) {
            endTick = timeDivisions[i + 1].startTick - 1;
        }
        curDivision.endTick = endTick;

        let startWin = 0;
        if (i != 0) {
            startWin = timeDivisions[i - 1].endWin + 1;
        }
        curDivision.startWin = startWin;
        let nWindows = Math.ceil((endTick - curDivStart) / curDivision.width); // number of windows in this division
        curDivision.endWin = startWin + nWindows;

        for (let j = 0; j < nWindows; j++) {
            windowsPP.push([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]); // 12-vector pitch profile
        }
    }

    // assign each note to each window's pitch profile
    tracks.forEach((track) => {
        let notes = track.notes;
        notes.forEach((note) => {
            let curTicks = note.ticks;

            let curDuration = note.durationTicks;
            let divIndex = timeDivisions.findIndex(div => div.startTick <= curTicks);
            let curDiv = timeDivisions[divIndex];
            let curWidth = curDiv.width;

            let windowId = Math.floor(curTicks / curWidth) + curDiv.startWin;

            let curPitchId = Math.floor(note.midi % 12);
            let windStartTick = (curDiv.startTick + (windowId - curDiv.startWin)) * curWidth;
            let ticksOverflow = Math.max(0, curDuration - (curWidth - (curTicks - windStartTick)));

            let addedDuration = curDuration - ticksOverflow;
            windowsPP[windowId][curPitchId] += addedDuration / ppq;
            windowsPP[windowId + 1][curPitchId] += ticksOverflow / ppq;
        })
    });

    return windowsPP;
}

function findR(window) {
    let correlations = []; // 24 tonal hierarchy vectors
    // What is the likelihood that the window is in X key?

    let major = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
    let minor = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
    let major_mean = 3.4825;
    let minor_mean = 3.709167;

    let totalDuration = window.reduce((accumulator, currentValue) => accumulator + currentValue);
    let window_mean = totalDuration / 12;

    for (let z = 0; z < 2; z++) {
        // calculate correlation for each key in major and minor pitch profiles
        let mode, mean;
        if (z == 0) {
            mode = major;
            mean = major_mean;
        } else if (z == 1) {
            mode = minor;
            mean = minor_mean;
        }

        for (let w = 0; w < 12; w++) {
            // calculate correlation with current key (w for key index)
            let numerator = 0;
            for (let i = 0; i < 12; i++) {
                numerator += (window[i] - window_mean) * (mode[i] - mean);
            }
            let demominatorX = 0,
                demominatorY = 0;
            for (let i = 0; i < 12; i++) {
                demominatorX += (window[i] - window_mean) * (window[i] - window_mean);
                demominatorY += (mode[i] - mean) * (mode[i] - mean);
            }
            let r = numerator / Math.sqrt(demominatorX * demominatorY);
            correlations.push(r);

            // rotate (shift) by 1
            let firstEle = window.splice(0, 1);
            window.push(firstEle);
        }
    }

    return correlations;
}