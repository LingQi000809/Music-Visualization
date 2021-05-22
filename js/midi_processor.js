// midi elements
let name, tracks, ppq, timeSigs;
let maxTicks;
let windowUnit = 1; // number of measures in a unit
let timeDivisions; // divisions based on time signatures
let windows; // notes divided into windows
let profiles, correlations, bestKeys; // key for each window

const noteRange = 130; // 130 possible pitches from midi

// canvas variables
let canvas, ctx;
let w, h;
let unitWidth, unitHeight;


function main(midi) {
    timeDivisions = []; // divisions based on time signatures
    windows = [] // notes divided into windows

    // canvas variables
    canvas = document.getElementById("canvas");
    ctx = canvas.getContext("2d");
    w = ctx.canvas.width;
    h = ctx.canvas.height;
    ctx.clearRect(0, 0, w, h);

    // midi variables
    tracks = midi.tracks;
    ppq = midi.header.ppq; // the Pulses Per Quarter Note (quarter beat ticks duration)
    maxTicks = getMaxTicks();
    timeSigs = midi.header.timeSignatures;
    // time divisions
    timeSigs.forEach(timeSig => {
        let t = timeSig.timeSignature;
        let startTick = timeSig.ticks;
        let tpm = 4 / t[1] * t[0] * ppq; // ticks per measure
        timeDivisions.push({
            width: tpm * windowUnit, // window width - unit: ticks
            startTick: startTick,
            endTick: 0,
            startWin: 0,
            endWin: 0,
            nWindows: 0
        });
    });
    // parameters for time divisions
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
        curDivision.nWindows = nWindows;
        curDivision.endWin = startWin + nWindows;

        for (let j = 0; j < timeDivisions[i].nWindows; j++) {
            windows.push([]); // each window has an array of notes
        }
    }
    // allocate notes into windows
    tracks.forEach((track) => {
        let notes = track.notes;
        notes.forEach((note) => {
            let curDuration = note.durationTicks;
            let curTicks = note.ticks;
            // find div
            let divIndex = timeDivisions.findIndex(div => div.startTick <= curTicks);
            let curDiv = timeDivisions[divIndex];
            let curWidth = curDiv.width;
            // find window
            let windowId = Math.floor(curTicks / curWidth) + curDiv.startWin;

            // calculate duration for each node
            let windStartTick = (curDiv.startTick + (windowId - curDiv.startWin)) * curWidth;
            let ticksOverflow = Math.max(0, curDuration - (curWidth - (curTicks - windStartTick)));
            let addedDuration = curDuration - ticksOverflow;

            let curNote = note;
            if (ticksOverflow != 0 && windowId != windows.length - 1) {
                // note into current window
                curNote = {...note };
                curNote.durationTicks = addedDuration;
                // note overflow - into next window
                noteSplit = {...note };
                noteSplit.durationTicks = ticksOverflow;
                noteSplit.ticks = windStartTick + curWidth;
                windows[windowId + 1].push(noteSplit);
            }
            // console.log(windowId)
            windows[windowId].push(curNote);
        })
    });
    console.log(windows);

    // drawing variables
    // nUnits = Math.ceil(maxTicks / ppq);
    // unitWidth = Math.max(10, Math.min(100, w / nUnits));
    unitWidth = w / maxTicks; // width per tick
    unitHeight = h / noteRange; // height of each note

    keyFinding();

    // fill cells
    tracks.forEach((track) => {
        let notes = track.notes;
        notes.forEach((note) => {
            let windowID = findWindowID(note);
            let keyID = bestKeys[windowID];
            ctx.fillStyle = keyIDToColor(keyID);
            ctx.fillRect(note.ticks * unitWidth,
                (noteRange - note.midi) * unitHeight,
                note.durationTicks * unitWidth,
                unitHeight);
        })
    });
}

function keyFinding() {
    profiles = findPitchProfiles(); // key for each window
    console.log(profiles);
    correlations = profiles.map((profile) => {
        return findR(profile);
    }); // 24 tonal hierarchy vectors (correlations) for each window
    console.log(correlations);
    bestKeys = correlations.map((correlation) => {
        return findBestKey(correlation);
    }); //  the best possible key for each window
    console.log(bestKeys.map(key => keyIDToKey(key)));
}

function vectorAddition() {
    let r = 100; // radius: max magnitude
    let a = (Math.sin(30 * Math.PI / 180)) * r; // 30 degree opposite side
    let b = (Math.cos(30 * Math.PI / 180)) * r; // 30 degree adjacent side
    let c = (Math.sin(15 * Math.PI / 180)) * r; // 15 degree opposite side
    let d = (Math.cos(15 * Math.PI / 180)) * r; // 15 degree adjacent side
    let e = (Math.sin(45 * Math.PI / 180)) * r; // 45 degree opposite/adjacent side

    // max [x,y]
    let major = [
        [0, -r], // C
        [-a, b], // C#
        [b, -a], // D
        [-r, 0], // D#
        [b, a], // E
        [-a, -b], // F
        [0, r], // F#
        [a, -b], // G
        [-b, a], // G#
        [r, 0], // A
        [-b, -a], // A#
        [a, b] // B
    ];
    let minor = [
        [-d, c], // c
        [d, c], // c#
        [-e, -e], // d
        [c, d], // d#
        [c, -d], // e
        [-e, e], // f
        [d, -c], // f#
        [-d, -c], // g
        [e, e], // g#
        [-c, -d], // a
        [-c, d], // a#
        [e, -e] // b
    ];

    // total magnitude available for each window: r
    let windowMagUnits = []; // the magnitude for one tick, calculated for each window
    for (let i = 0; i < timeDivisions.length; i++) {
        let curDiv = timeDivisions[i];
        for (let j = 0; j < curDiv.nWindows; j++) {
            windowMagUnits.push(r / curDiv.width); // magnitude per tick for each window
        }
    }

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
    // find pitch profile for each window
    for (let i = 0; i < windows.length; i++) {
        let window = windows[i];
        let pitchProfile = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        window.forEach((note) => {
            let curPitchId = Math.floor(note.midi % 12);
            pitchProfile[curPitchId] += note.durationTicks / ppq;
        })
        windowsPP.push(pitchProfile);
    }
    console.log(windowsPP);
    return windowsPP;
}

function findWindowID(note) {
    let curTicks = note.ticks;

    let divIndex = timeDivisions.findIndex(div => div.startTick <= curTicks);
    let curDiv = timeDivisions[divIndex];
    let curWidth = curDiv.width;

    let windowId = Math.floor(curTicks / curWidth) + curDiv.startWin;

    return windowId;
}

function findPPAmong(notes) {

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

function findBestKey(window) {
    let max = window.reduce(function(a, b) {
        return Math.max(a, b);
    });
    let index = window.findIndex((r) => r == max);
    return index;
}

function keyIDToKey(index) {
    if (index == 0) return 'C';
    if (index == 1) return 'C#';
    if (index == 2) return 'D';
    if (index == 3) return 'D#';
    if (index == 4) return 'E';
    if (index == 5) return 'F';
    if (index == 6) return 'F#';
    if (index == 7) return 'G';
    if (index == 8) return 'G#';
    if (index == 9) return 'A';
    if (index == 10) return 'A#';
    if (index == 11) return 'B';
    if (index == 12) return 'c';
    if (index == 13) return 'c#';
    if (index == 14) return 'd';
    if (index == 15) return 'd#';
    if (index == 16) return 'e';
    if (index == 17) return 'f';
    if (index == 18) return 'f#';
    if (index == 19) return 'g';
    if (index == 20) return 'g#';
    if (index == 21) return 'a';
    if (index == 22) return 'a#';
    if (index == 23) return 'b';
}

function keyIDToColor(index) {
    if (index == 0) return '#F50659';
    if (index == 1) return '#33FAA8';
    if (index == 2) return '#F69500';
    if (index == 3) return '#3A01FD';
    if (index == 4) return '#FAF600';
    if (index == 5) return '#E403FD';
    if (index == 6) return '#52FB00';
    if (index == 7) return '#F54400';
    if (index == 8) return '#186FFD';
    if (index == 9) return '#F8D200';
    if (index == 10) return '#9A02FD';
    if (index == 11) return '#DDF900';
    if (index == 12) return '#1023FC';
    if (index == 13) return '#F9E400';
    if (index == 14) return '#BD03FC';
    if (index == 15) return '#93F900';
    if (index == 16) return '#F40910';
    if (index == 17) return '#2EDFFC';
    if (index == 18) return '#F7B300';
    if (index == 19) return '#6901FD';
    if (index == 20) return '#EEFA00';
    if (index == 21) return '#F306B5';
    if (index == 22) return '#32F901';
    if (index == 23) return '#F66D00';
}