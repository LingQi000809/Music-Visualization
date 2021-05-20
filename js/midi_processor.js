// midi elements
let name, tracks, ppq;
let maxTicks;

const noteRange = 130; // 130 possible pitches from midi

// canvas variables
let canvas, ctx;
let w, h;
let unitWidth, unitHeight;

function init() {
    // midi = new Midi();
    // midi variables
    tracks = midi.tracks;
    ppq = midi.header.ppq; // the Pulses Per Quarter (quarter beat duration)
    maxTicks = getMaxTicks();
    console.log(maxTicks);

    // canvas variables
    canvas = document.getElementById("canvas");
    ctx = canvas.getContext("2d");
    w = ctx.canvas.width;
    h = ctx.canvas.height;
    nUnits = Math.ceil(maxTicks / ppq);
    unitWidth = Math.max(10, Math.min(100, w / nUnits));
    unitHeight = Math.max(10, h / noteRange); // height of each unit (representing each pitch lasting for a duration of 1 beat)

}

function getMaxTicks() {
    let maxTicks = 0;
    tracks.forEach((track) => {
        maxTicks = Math.max(maxTicks, track.endOfTrackTicks);
    });
    return maxTicks;
}