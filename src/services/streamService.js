const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Storage } = require('@google-cloud/storage');
const config = require('../config/config');

const storage = new Storage({ keyFilename: config.GOOGLE_APPLICATION_CREDENTIALS });

let isRecording = false;
let recordingProcess;

const formattedDate = getFormattedDate();
const fileName = `temp_${formattedDate}.mp4`;

function startFFmpegStream(wss) {
    const ffmpegProcess = spawn('ffmpeg', [
        '-rtsp_transport', 'tcp',
        '-i', config.RTSP_URL,
        '-analyzeduration', '15000000',
        '-probesize', '15000000',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-f', 'mpegts',
        '-codec:v', 'mpeg1video',
        '-s', '640x360',
        '-b:v', '800k',
        '-vf', `drawtext=text='%{localtime}':fontcolor=white:fontsize=24:box=1:boxcolor=black@0.5:boxborderw=5:x=10:y=10`,
        '-r', '30',
        '-'
    ]);
    ffmpegProcess.stdout.on('data', (data) => {
        wss.clients.forEach((client) => {
            if (client.readyState === 1) {
                client.send(data);
            }
        });
    });

    ffmpegProcess.on('close', (code) => {
        console.log('FFmpeg exited with code', code);
    });
}

function startRecording() {
    if (isRecording) return;

    const outputPath = path.join(__dirname, `../../uploads/videos/temp_${getFormattedDate()}.mp4`);
    const outputPathFinal = path.join(__dirname, '../../uploads/videos/finalVideo/final_output.mp4');


    recordingProcess = spawn('ffmpeg', [
        '-rtsp_transport', 'tcp',
        '-i', config.RTSP_URL,
        '-t', '15',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-movflags', '+faststart',
        '-vf', `drawtext=text='%{localtime}':fontcolor=white:fontsize=24:box=1:boxcolor=black@0.5:boxborderw=5:x=10:y=10,drawtext=text='Filename: ${fileName}':fontcolor=white:fontsize=24:box=1:boxcolor=black@0.5:boxborderw=5:x=10:y=40`,
        '-y',
        outputPath
    ]);

    recordingProcess.stderr.on('data', (data) => {
        console.error('Recording FFmpeg stderr:', data.toString());
    });

    recordingProcess.on('close', (code) => {
        isRecording = false;
        if (code === 0) {
            console.log('== Recording completed ==');
            uploadToGCS(outputPath, `${config.INPUT_PREFIX}temp_${getFormattedDate()}.mp4`);

            fs.copyFile(outputPath, outputPathFinal, (err) => {
                if (err) {
                    console.error('Error copying file:', err);
                } else {
                    console.log('Temp file copied to final_output.mp4');
                }
            });
        } else {
            console.error(`Recording process exited with code ${code}`);
        }
    });

    isRecording = true;
}

function stopRecording() {
    console.log('==> 녹화 중지');
    if (recordingProcess) {
        recordingProcess.kill('SIGINT');
        recordingProcess = null;
        isRecording = false;
    }
}

async function uploadToGCS(filePath, destination) {
    try {
        await storage.bucket(config.GCS_BUCKET).upload(filePath, {
            destination: destination,
        });
        console.log(`==> 업로드 완료, ${path.basename(filePath)} to ${config.GCS_BUCKET}!`);
    } catch (error) {
        console.error('==> Error uploading to GCS:', error);
    }
}

function getFormattedDate() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

module.exports = {
    startFFmpegStream,
    startRecording,
    stopRecording,
    uploadToGCS
};