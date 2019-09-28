let asmWorker = new Worker('asm-worker.js');
let wasmWorker = new Worker('wasm-worker.js');
let jsWorker = new Worker('js-worker.js');

let video = document.querySelector("#videoElement");
let objType = 'faceDetect';


let canvases = {};
canvases.running = false;
canvases.ready = false;
canvases.wasm = {};
canvases.js = {};

canvases.wasm.fps = 0;
canvases.js.fps = 0;

canvases.wasm.lastTime = +new Date;
canvases.js.lastTime = +new Date;

canvases.wasm.fpsArr = [];
canvases.js.fpsArr = [];

canvases.wasm.color = 'rgba(255, 0, 0, 1)';
canvases.js.color = 'rgba(0, 255, 0, 1)';
canvases.width = 320;
canvases.height = 240;
canvases.scale = 2;

canvases.wasm.canvas = document.getElementById('wasm');
canvases.wasm.context = canvases.wasm.canvas.getContext('2d');

canvases.js.canvas = document.getElementById('js');
canvases.js.context = canvases.js.canvas.getContext('2d');

canvases.dummy = {};
canvases.dummy.canvas = document.getElementById('dummy');
canvases.dummy.context = canvases.dummy.canvas.getContext('2d');

function resizeCanvas() {
    canvases.wasm.canvas.width = canvases.width;
    canvases.wasm.canvas.height = canvases.height;
    canvases.js.canvas.width = canvases.width;
    canvases.js.canvas.height = canvases.height;
    canvases.dummy.canvas.width = canvases.width;
    canvases.dummy.canvas.height = canvases.height;
}

// check for getUserMedia support
if (navigator.mediaDevices.getUserMedia) {
    // get webcam feed if available
    //navigator.getUserMedia({ video: true }, handleVideo, () => console.log('error with webcam'));
    navigator.mediaDevices.getUserMedia({
        video: {
            width: {
                min: 1280,
                max: 3840,
                ideal: 3840
            },
        }
    }).then((stream) => {
        handleVideo(stream);
        const track = stream.getVideoTracks()[0];
        const actualSettings = track.getSettings();
        const { width, height } = actualSettings;

        canvases.width = width / 11;
        canvases.height = height / 11;
        resizeCanvas();

    }).catch(e => console.log(e));
}

document.addEventListener('DOMContentLoaded', function () {
    console.log('dom loaded')
}, false);

function handleVideo(stream) {
    video.srcObject = stream;
    video.play();
}

function detect(type) {
    if (!canvases.running) {
        canvases.running = true;
        startWorker(canvases.wasm.context.getImageData(0, 0, canvases.wasm.canvas.width, canvases.wasm.canvas.height), objType, 'wasm');
        startWorker(canvases.js.context.getImageData(0, 0, canvases.js.canvas.width, canvases.js.canvas.height), objType, 'js');
    }
}

function startWorker(imageData, command, type) {
    if (type == 'wasm')
        canvases.dummy.context.drawImage(wasm, 0, 0, imageData.width, imageData.height, 0, 0, Math.round(imageData.width/ canvases.scale), Math.round(imageData.height/canvases.scale));
    let message = {
        cmd: command,
        img: canvases.dummy.context.getImageData(0, 0, Math.round(imageData.width/ canvases.scale), Math.round(imageData.height/canvases.scale))
    };
    if (type == 'wasm') wasmWorker.postMessage(message);
    else if (type == 'js') jsWorker.postMessage(message);
}

function selectObj(type) {
    if (type == 'face') {
        objType = 'faceDetect';
        document.getElementById('radio-face').checked = true;
        document.getElementById('radio-eyes').checked = false;
    }
    else {
        objType = 'eyesDetect';
        document.getElementById('radio-eyes').checked = true;
        document.getElementById('radio-face').checked = false;
    }
    return;
}

function updateCanvas(e, targetCanvas, plot) {
    targetCanvas.context.drawImage(video, 0, 0, targetCanvas.canvas.width, targetCanvas.canvas.height);
    targetCanvas.context.strokeStyle = targetCanvas.color;
    targetCanvas.context.lineWidth = 2;
    let fps = 1000 / (targetCanvas.startTime - targetCanvas.lastTime)
    if (fps) {
        targetCanvas.fpsArr.push(fps);
    }
    if (canvases.js.fpsArr.length === 1 || canvases.wasm.fpsArr.length === 1 ) {
        targetCanvas.context.fps = Math.round((targetCanvas.fpsArr.reduce((a, b) => a + b) / targetCanvas.fpsArr.length) * 100) / 100;
        targetCanvas.fpsArr = [];
    }
    targetCanvas.context.fillStyle = 'rgba(255,255,255,.5)';
    targetCanvas.context.fillRect(0, 0, 90, 30)
    targetCanvas.context.font = "normal 14pt Arial";
    targetCanvas.context.fillStyle = targetCanvas.color;
    targetCanvas.context.fillText(targetCanvas.context.fps + " fps", 5, 20);
    targetCanvas.lastTime = targetCanvas.startTime;
    for (let i = 0; i < e.data.features.length; i++) {
        let rect = e.data.features[i];
        targetCanvas.context.strokeRect(rect.x * canvases.scale, rect.y * canvases.scale, rect.width * canvases.scale, rect.height * canvases.scale);
    }
}

wasmWorker.onmessage = function (e) {
    if (e.data.msg == 'wasm') {
        if (canvases.ready) {
            detect();
        }
        else {
            canvases.ready = true
        }
    }
    else {
        updateCanvas(e, canvases.wasm, wasmGraph);
        requestAnimationFrame((wasmTime) => {
            canvases.wasm.startTime = wasmTime;
            startWorker(canvases.wasm.context.getImageData(0, 0, canvases.wasm.canvas.width, canvases.wasm.canvas.height), objType, 'wasm')
        })
    }
}

asmWorker.onmessage = function (e) {
    if (e.data.msg == 'asm') {
        if (canvases.ready) {
            detect();
        }
        else {
            canvases.ready = true
        }
    }
    
}

jsWorker.onmessage = function (e) {
    updateCanvas(e, canvases.js, jsGraph);
    requestAnimationFrame((jsTime) => {
        canvases.js.startTime = jsTime;
        startWorker(canvases.js.context.getImageData(0, 0, canvases.js.canvas.width, canvases.js.canvas.height), objType, 'js')
    });
}

window.onerror = function (event) {
    console.log(event)
};



let wasmGraph = {  };
let asmGraph = { };
let jsGraph = { };