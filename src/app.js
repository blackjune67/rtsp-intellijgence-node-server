const express = require('express');
const cors = require('cors');
const path = require('path');
const videoRoutes = require('./routes/videoRoutes');

const app = express();

app.use(cors({
    origin: '*', // 모든 출처 허용 (보안상 주의 필요)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use(express.json());
app.use('/api/video', videoRoutes);

module.exports = app;