require('dotenv').config();

module.exports = {
    GCS_BUCKET: process.env.GCS_BUCKET,
    INPUT_PREFIX: "visualize-input/",
    TEMP_OUTPUT_PREFIX: "temp-output-json-files/",
    AWS_OUTPUT_PREFIX: "visualize-aws-output-files/",
    FINAL_OUTPUT_PREFIX: "visualize-final-output-files/",
    VIEW_FINAL_OUTPUT_PREFIX: "visualize-view-final-output-files/",
    LOCAL_FINAL_OUTPUT_PREFIX: "../../uploads/videos/finalVideo/",
    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    API_URL: process.env.API_URL,
    PORT: process.env.PORT,
    RTSP_URL: process.env.RTSP_URL || 'rtsp://210.99.70.120:1935/live/cctv005.stream'
};