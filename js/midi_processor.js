// divide and conquer on notes sorted by ticks:
// both C -> C, not cm


// midi elements
let name, tracks, ppq, timeSigs;
let maxTicks;
let windowUnit = 1; // number of measures in a unit
let timeDivisions; // divisions based on time signatures
let windows; // notes divided into windows
// key-finding algorithm
let profiles, correlations, bestKeys;
// vector-addition
let colorData, windowColors;
let radius = 100; // radius: max magnitude


const noteRange = 130; // 130 possible pitches from midi

// canvas variables
// let canvas, ctx;
// let w, h;
let unitWidth, unitHeight;


function main(midi) {
    timeDivisions = []; // divisions based on time signatures
    windows = [] // notes divided into windows

    // canvas variables
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
    console.log('windows: ', windows);

    // drawing variables
    // nUnits = Math.ceil(maxTicks / ppq);
    // unitWidth = Math.max(10, Math.min(100, w / nUnits));
    unitWidth = w / maxTicks; // width per tick
    unitHeight = h / noteRange; // height of each note

    if (mode == 'kf') {
        keyFinding();
    } else if (mode == 'va') {
        vectorAddition();
    } else if (mode == 'kfva') {
        kfva();
    }


}

function kfva() {
    profiles = findPitchProfiles(); // key for each window
    correlations = profiles.map((profile) => {
        return findR(profile);
    }); // 24 tonal hierarchy vectors (correlations) for each window

    console.log('correlations: ', correlations);

    let windowVectors = [];
    let validRs = [];
    // only consider correlations > 0.6
    correlations.forEach(window => {
        let validR = [];

        let magUnit = 0;
        let highConfidence = false;
        for (let i = 0; i < window.length; i++) {
            let curR = window[i];
            let curMode = 'major';
            if (i >= 12) curMode = 'minor';

            // if confident level is high, add doubled weight to it
            if (curR > 0.8) {
                highConfidence = true;
                magUnit += curR * 2;
                validR.push({
                    mode: curMode,
                    pitch: i % 12,
                    r: curR * 2
                });
            }

            // if confident level is over threshold, add to consideration
            else if (!highConfidence && curR > 0.6) {
                magUnit += curR;
                validR.push({
                    mode: curMode,
                    pitch: i % 12,
                    r: curR
                });
            }

        }
        console.log(validR);
        if (highConfidence) {
            validR = validR.filter(cr => cr.r > 1);
        }
        console.log(validR);
        validRs.push(validR);

        let resultVector = [0, 0];
        validR.forEach((correl) => {
            let mag = radius / magUnit * correl.r;
            let correlVector = getNoteVector(correl.mode, correl.pitch, mag);
            resultVector[0] += correlVector[0];
            resultVector[1] += correlVector[1];
        });
        windowVectors.push(resultVector);
    });

    // get color for each vector
    let windowColors = [];
    windowVectors.forEach(windowVector => {
        // x y coordinates (get rid of decimal points overflow)
        let x = Math.floor(windowVector[0] + radius); // x-coordinate
        x = Math.min(radius * 2 - 1, x);
        x = Math.max(1, x);
        let y = Math.floor(windowVector[1] + radius); // y-coordinate
        y = Math.min(radius * 2 - 1, y);
        y = Math.max(1, y);

        // get RGBA values at the pixel in the color wheel
        let pixel = imgCtx.getImageData(x, y, 1, 1).data;
        let dataR = pixel[0],
            dataG = pixel[1],
            dataB = pixel[2],
            dataA = pixel[3];
        let curColor = 'rgba(' + dataR + ', ' + dataG + ', ' + dataB + ', ' + dataA / 255 + ')';
        if (curColor == 'rgba(0, 0, 0, 0)') {
            console.log(windowVector);
            console.log(x, y);
            console.log(i, curColor);
        }
        windowColors.push(curColor);
    })

    // fill cells
    tracks.forEach((track) => {
        let notes = track.notes;
        notes.forEach((note) => {
            let windowID = findWindowID(note);
            ctx.fillStyle = windowColors[windowID];
            ctx.fillRect(note.ticks * unitWidth,
                (noteRange - note.midi) * unitHeight,
                note.durationTicks * unitWidth,
                unitHeight);
        })
    });
}

function keyFinding() {

    profiles = findPitchProfiles(); // key for each window
    console.log('profiles: ', profiles);
    correlations = profiles.map((profile) => {
        return findR(profile);
    }); // 24 tonal hierarchy vectors (correlations) for each window
    console.log('correlations:', correlations);
    bestKeys = correlations.map((correlation) => {
        return findBestKey(correlation);
    }); //  the best possible key for each window
    console.log(bestKeys.map(key => keyIDToKey(key)));

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


function vectorAddition() {
    windowColors = [];


    // vector addition for each window
    for (let i = 0; i < windows.length; i++) {
        let window = windows[i];
        // window.sort((note1, note2) => {
        //     return note1.ticks - note2.ticks;
        // });
        // console.log(window);

        // find magnitude unit for this window
        let totalDuration = 0;
        window.forEach(note => {
            totalDuration += note.durationTicks;
        });
        let magUnit = radius / totalDuration;
        // console.log(magUnit);

        // console.log('window: ' + i);
        let windowVector = getFinalVector(window, magUnit);

        // x y coordinates (get rid of decimal points overflow)
        let x = Math.floor(windowVector[0] + radius); // x-coordinate
        x = Math.min(radius * 2 - 1, x);
        x = Math.max(1, x);
        let y = Math.floor(windowVector[1] + radius); // y-coordinate
        y = Math.min(radius * 2 - 1, y);
        y = Math.max(1, y);

        // get RGBA values at the pixel in the color wheel
        let pixel = imgCtx.getImageData(x, y, 1, 1).data
            // let dataR = colorData[dataStart],
            //     dataG = colorData[dataStart + 1],
            //     dataB = colorData[dataStart + 2],
            //     dataA = colorData[dataStart + 3];
        let dataR = pixel[0],
            dataG = pixel[1],
            dataB = pixel[2],
            dataA = pixel[3];
        let curColor = 'rgba(' + dataR + ', ' + dataG + ', ' + dataB + ', ' + dataA / 255 + ')';
        if (curColor == 'rgba(0, 0, 0, 0)') {
            console.log(windowVector);
            console.log(x, y);
            console.log(i, curColor);
        }
        windowColors.push(curColor);
    };

    // fill cells
    tracks.forEach((track) => {
        let notes = track.notes;
        notes.forEach((note) => {
            let windowID = findWindowID(note);
            ctx.fillStyle = windowColors[windowID];
            ctx.fillRect(note.ticks * unitWidth,
                (noteRange - note.midi) * unitHeight,
                note.durationTicks * unitWidth,
                unitHeight);
        })
    });
}

function getFinalVector(notes, magUnit) {
    // base cases
    if (notes.length == 0) {
        return [0, 0];
    } else if (notes.length == 1) {
        let note = notes[0];
        let pitch = Math.floor(note.midi % 12);
        let mag = note.durationTicks * magUnit;
        let v = getNoteVector('major', pitch, mag);
        return v;
    } else if (notes.length == 2) {
        let note1 = notes[0];
        let note2 = notes[1];
        let pitch1 = Math.floor(note1.midi % 12);
        let pitch2 = Math.floor(note2.midi % 12);
        let mag1 = note1.durationTicks * magUnit;
        let mag2 = note2.durationTicks * magUnit;

        let mode1 = 'major',
            mode2 = 'major';

        // major / minor thirds: use inner circle for one note
        if (pitch1 - pitch2 == 3 || pitch2 - pitch1 == 4) {
            // pitch1 is on top of pitch2 by minor third 
            // (E.G. 1-Eb; 2-c)
            // pitch2 is on top of pitch1 by major third
            // (E.G. 1-C; 2-e)
            mode2 = 'minor';
        } else if (pitch2 - pitch1 == 3 || pitch1 - pitch2 == 4) {
            // pitch2 is on top of pitch1 by minor third 
            // (E.G. 1-c; 2-Eb)
            // pitch1 is on top of pitch2 by major third
            // (E.G. 1-e; 2-C)
            mode1 = 'minor';
        }

        let v1 = getNoteVector(mode1, pitch1, mag1);
        let v2 = getNoteVector(mode2, pitch2, mag2);
        let v = [v1[0] + v2[0], v1[1] + v2[1]]
        return v;
    } else if (notes.length == 3) {
        let note1 = notes[0];
        let note2 = notes[1];
        let note3 = notes[2];
        let pitch1 = Math.floor(note1.midi % 12);
        let pitch2 = Math.floor(note2.midi % 12);
        let pitch3 = Math.floor(note3.midi % 12);
        let mode1 = 'major',
            mode2 = 'major',
            mode3 = 'major';
        let mag1 = note1.durationTicks * magUnit;
        let mag2 = note2.durationTicks * magUnit;
        let mag3 = note3.durationTicks * magUnit;


        // major / minor thirds between pitch2 and pitch3?
        if (pitch2 - pitch3 == 3 || pitch3 - pitch2 == 4) {
            mode3 = 'minor';
        } else if (pitch3 - pitch2 == 3 || pitch2 - pitch3 == 4) {
            mode2 = 'minor';
        }
        // major / minor thirds between pitch1 and pitch3?
        if (pitch1 - pitch3 == 3 || pitch3 - pitch1 == 4) {
            mode3 = 'minor';
        } else if (pitch3 - pitch1 == 3 || pitch1 - pitch3 == 4) {
            mode1 = 'minor';
        }
        // major / minor thirds between pitch1 and pitch2?
        if (pitch1 - pitch2 == 3 || pitch2 - pitch1 == 4) {
            mode2 = 'minor';
        } else if (pitch2 - pitch1 == 3 || pitch1 - pitch2 == 4) {
            mode1 = 'minor';
        }

        let v1 = getNoteVector(mode1, pitch1, mag1);
        let v2 = getNoteVector(mode2, pitch2, mag2);
        let v3 = getNoteVector(mode3, pitch3, mag3);
        let v = [v1[0] + v2[0] + v3[0], v1[1] + v2[1] + v3[1]]
        return v;
    }

    // divide
    let mid = Math.ceil(notes.length / 2);
    // conquer
    let leftVector = getFinalVector(notes.slice(0, mid), magUnit);
    let rightVector = getFinalVector(notes.slice(-mid), magUnit);
    // combine
    let result = [leftVector[0] + rightVector[0], leftVector[1] + rightVector[1]];
    // console.log(leftVector, rightVector, result);
    return result;
}

function getNoteVector(mode, pitch, mag) {
    let a = (Math.sin(30 * Math.PI / 180)); // 30 degree opposite side
    let b = (Math.cos(30 * Math.PI / 180)); // 30 degree adjacent side
    let c = (Math.sin(15 * Math.PI / 180)); // 15 degree opposite side
    let d = (Math.cos(15 * Math.PI / 180)); // 15 degree adjacent side
    let e = (Math.sin(45 * Math.PI / 180)); // 45 degree opposite/adjacent side
    let majorVectors = [
        [0, -1], // C
        [-a, b], // C#
        [b, -a], // D
        [-1, 0], // D#
        [b, a], // E
        [-a, -b], // F
        [0, 1], // F#
        [a, -b], // G
        [-b, a], // G#
        [1, 0], // A
        [-b, -a], // A#
        [a, b] // B
    ];
    let minorVectors = [
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
    if (mode == 'major') {
        return majorVectors[pitch].map(v => v * mag);
    }
    if (mode == 'minor') {
        return minorVectors[pitch].map(v => v * mag);
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
    if (index == 0) return '#FC6969'; // C
    if (index == 1) return '#74FFE5'; // C#
    if (index == 2) return '#FDC163'; // D
    if (index == 3) return '#6B77FF'; // D#
    if (index == 4) return '#FFFD58'; // E
    if (index == 5) return '#FC6AFF'; // F
    if (index == 6) return '#73FF8C'; // F#
    if (index == 7) return '#FC9567'; // G
    if (index == 8) return '#6FC6FF'; // G#
    if (index == 9) return '#FEDF5D'; // A
    if (index == 10) return '#AC69FF'; // A#
    if (index == 11) return '#A1FF56'; // B
    if (index == 12) return '#6EA0FF'; // c
    if (index == 13) return '#FEEE5B'; // c#
    if (index == 14) return '#D46AFF'; // d
    if (index == 15) return '#73FF57'; // d#
    if (index == 16) return '#FC8068'; // e
    if (index == 17) return '#72EDFF'; // f
    if (index == 18) return '#FDD060'; // f#
    if (index == 19) return '#836AFF'; // g
    if (index == 20) return '#D2FF57'; // g#
    if (index == 21) return '#FC6AB5'; // a
    if (index == 22) return '#74FFBA'; // a#
    if (index == 23) return '#FDAB66'; // b
}