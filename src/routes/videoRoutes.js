const express = require('express');
const videoController = require('../controllers/videoController');

const router = express.Router();

router.get('/merge-complete', videoController.handleMergeComplete);
router.post('/start-processing', videoController.startVideoProcessing);

module.exports = router;