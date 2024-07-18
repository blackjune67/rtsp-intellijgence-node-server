const videoService = require('../services/videoService');

async function handleMergeComplete(req, res) {
    console.log("Merge completion notification received");
    res.sendStatus(200);
}

async function startVideoProcessing(req, res) {
    try {
        videoService.processNewVideos();
        res.status(200).json({ message: "Video processing started" });
    } catch (error) {
        console.error("Error starting video processing:", error);
        res.status(500).json({ error: "Failed to start video processing" });
    }
}

module.exports = {
    handleMergeComplete,
    startVideoProcessing
};