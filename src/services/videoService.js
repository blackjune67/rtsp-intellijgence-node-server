const { Storage } = require('@google-cloud/storage');
const { VideoIntelligenceServiceClient } = require('@google-cloud/video-intelligence');
const axios = require('axios');
const path = require('path');
const config = require('../config/config');
const { startRecording, stopRecording, uploadToGCS} = require('./streamService');

const storage = new Storage();
const videoIntelligence = new VideoIntelligenceServiceClient();

async function processVideo(videoName, timeout = 1800000) {
    const gcsUri = `gs://${config.GCS_BUCKET}/${config.INPUT_PREFIX}${videoName}`;
    // const outputFilename = `${path.parse(videoName).name}-${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}.json`;
    const outputFilename = `${path.parse(videoName).name}-${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15).replace('T', '_')}.json`;
    const tempOutputUri = `gs://${config.GCS_BUCKET}/${config.TEMP_OUTPUT_PREFIX}${outputFilename}`;

    try {
        console.log("\nStarting processing. This may take a while depending on the video size.\n");

        const request = {
            inputUri: gcsUri,
            outputUri: tempOutputUri,
            features: ['FACE_DETECTION', 'OBJECT_TRACKING', 'EXPLICIT_CONTENT_DETECTION'],
            videoContext: {
                speechTranscriptionConfig: {
                    languageCode: 'en-US',
                    enableAutomaticPunctuation: true
                },
                personDetectionConfig: {
                    includeBoundingBoxes: true,
                    includeAttributes: false,
                    includePoseLandmarks: true
                },
                faceDetectionConfig: {
                    includeBoundingBoxes: true,
                    includeAttributes: true
                }
            }
        };

        const [operation] = await videoIntelligence.annotateVideo(request);
        console.log(`\nProcessing video '${videoName}'...`);
        const [result] = await operation.promise();
        console.log("\nProcessing complete.");
        console.log(`Results saved to: ${tempOutputUri}`);

        await mergeJsonFiles(outputFilename);
        return result;
    } catch (error) {
        console.error("Error processing video:", error);
    }
}

async function getFilesWithTimestamps(prefix) {
    const [files] = await storage.bucket(config.GCS_BUCKET).getFiles({ prefix });
    const filesWithTimestamps = {};

    files.forEach(file => {
        const match = file.name.match(/(\d{8}_\d{6})/);
        if (match) {
            filesWithTimestamps[match[1]] = file.name;
        }
    });

    return filesWithTimestamps;
}

async function mergeJsonFiles(tempFilename) {
    const awsFiles = await getFilesWithTimestamps(config.AWS_OUTPUT_PREFIX);
    const match = tempFilename.match(/(\d{8}_\d{6})/);

    if (!match) {
        console.log(`No timestamp found in: ${tempFilename}`);
        return;
    }

    const timestamp = match[1];
    const awsFile = awsFiles[timestamp];

    if (!awsFile) {
        console.log(`==> 매칭된 AWS JSON 파일을 찾을 수 없습니다. : ${timestamp}`);
        return;
    }

    console.log(`매칭된 JSON 파일을 찾음.\n=> AWS: ${awsFile}\n=> Temp: ${tempFilename}`);

    const bucket = storage.bucket(config.GCS_BUCKET);
    const mergedFilename = `merged_${timestamp}.json`;
    const mergedFile = bucket.file(`${config.FINAL_OUTPUT_PREFIX}${mergedFilename}`);

    const [exists] = await mergedFile.exists();
    if (exists) {
        console.log(`==> 병합된 JSON 파일이 이미 있습니다. : ${mergedFilename}`);
        return;
    }

    const [awsContent] = await bucket.file(awsFile).download();
    const [tempContent] = await bucket.file(`${config.TEMP_OUTPUT_PREFIX}${tempFilename}`).download();

    const awsData = JSON.parse(awsContent.toString());
    const tempData = JSON.parse(tempContent.toString());

    if (tempData.annotation_results && tempData.annotation_results.length > 0) {
        tempData.annotation_results[0].explicit_annotation = awsData.explicit_annotation || {};
    } else {
        tempData.annotation_results = [{
            face_detection_annotations: [],
            explicit_annotation: awsData.explicit_annotation || {},
            object_annotations: []
        }];
    }

    await mergedFile.save(JSON.stringify(tempData), {
        metadata: { cacheControl: 'no-cache' }
    });

    const finalFilename = "final_output.json";
    const finalOutputFile = bucket.file(`${config.VIEW_FINAL_OUTPUT_PREFIX}${finalFilename}`);
    await finalOutputFile.save(JSON.stringify(tempData), {
        metadata: { cacheControl: 'no-cache' }
    });

    console.log(`==> 병합된 JSON 파일 저장 : gs://${config.GCS_BUCKET}/${config.FINAL_OUTPUT_PREFIX}${mergedFilename}`);
    console.log(`==> Final JSON 파일 복사 : gs://${config.GCS_BUCKET}/${config.VIEW_FINAL_OUTPUT_PREFIX}${finalFilename}`);

    await handleMergeComplete();
}

async function handleMergeComplete() {
    console.log("Merge complete, restarting recording and uploading");

    // 녹화 중지
    stopRecording();

    // final_output.mp4 업로드
    const finalOutputPath = path.join(__dirname, '../../uploads/videos/finalVideo/final_output.mp4');
    await uploadToGCS(finalOutputPath, `${config.VIEW_FINAL_OUTPUT_PREFIX}final_output.mp4`);

    // 녹화 재시작
    startRecording();
}

async function getLatestVideo() {
    const [files] = await storage.bucket(config.GCS_BUCKET).getFiles({ prefix: config.INPUT_PREFIX });
    const videoFiles = files.filter(file => file.name.toLowerCase().endsWith('.mp4'));

    if (videoFiles.length === 0) return null;

    const latestFile = videoFiles.reduce((latest, current) =>
        latest.metadata.timeCreated > current.metadata.timeCreated ? latest : current
    );

    return path.basename(latestFile.name);
}

async function processNewVideos() {
    const processedVideos = new Set();

    while (true) {
        const latestVideo = await getLatestVideo();
        console.log(`==> 최신 영상: ${latestVideo}`);

        if (latestVideo && !processedVideos.has(latestVideo)) {
            console.log(`==> 새로운 영상 파일 찾음: ${latestVideo}`);

            try {
                await axios.post(config.API_URL, {
                    bucketName: config.GCS_BUCKET,
                    objectKey: latestVideo
                });
                console.log("혜민 API call successful");
            } catch (error) {
                console.error("혜민 API call failed:", error.message);
            }

            const outputFilename = await processVideo(latestVideo);
            if (outputFilename) {
                processedVideos.add(latestVideo);
            }
        }

        await new Promise(resolve => setTimeout(resolve, 5000));
    }
}

module.exports = {
    processVideo,
    processNewVideos,
};