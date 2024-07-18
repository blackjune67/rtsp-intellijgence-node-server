const streamService = require('../services/streamService');
const path = require('path');
const config = require('../config/config');

async function handleMergeComplete(req, res) {
    console.log('==> Merge complete signal received');
    streamService.stopRecording();

    const finalOutputPath = path.join(__dirname, '../../uploads/videos/finalVideo/final_output.mp4');
    await streamService.uploadToGCS(finalOutputPath, `${config.VIEW_FINAL_OUTPUT_PREFIX}final_output.mp4`);
    streamService.startRecording();

    res.sendStatus(200);
}

module.exports = {
    handleMergeComplete
};