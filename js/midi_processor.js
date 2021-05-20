// midi elements
let name, tracks, ppq;
let maxTicks;

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
    ppq = midi.header.ppq; // the Pulses Per Quarter (quarter beat duration)
    maxTicks = getMaxTicks();

    // drawing variables
    // nUnits = Math.ceil(maxTicks / ppq);
    // unitWidth = Math.max(10, Math.min(100, w / nUnits));
    unitWidth = w / maxTicks; // width per tick
    unitHeight = h / noteRange; // height of each note

    console.log(unitWidth, unitHeight);


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
            console.log('x: ', note.ticks * unitWidth);
            console.log('y: ', note.midi);
            console.log('w: ', note.durationTicks * unitWidth);
            console.log('h: ', unitHeight);
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