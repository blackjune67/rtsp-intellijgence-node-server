const http = require('http');
const WebSocket = require('ws');
const app = require('./app');
const config = require('./config/config');
const { processNewVideos } = require('./services/videoService');
const { startFFmpegStream, startRecording } = require('./services/streamService');

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const port = config.PORT;

wss.on('connection', (ws) => {
    console.log('Front-end client 연결됨.');
    ws.on('message', (message) => {
        console.log('Received:', message);
    });
    ws.on('close', () => console.log('Front-end client 연결 끊어짐.'));
});

server.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);

    // Start the video processing in the background
    processNewVideos().catch(error => {
        console.error("Error in video processing:", error);
    });

    startFFmpegStream(wss);
    startRecording();
});