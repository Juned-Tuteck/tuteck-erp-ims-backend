require('dotenv').config();
const express = require('express');
const cors = require('cors');
const routes = require('./routes');

const app = express();
const PORT = process.env.APP_PORT;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/', routes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    statusCode: 200,
    data: null,
    clientMessage: 'Server is running successfully',
    devMessage: 'Health check passed'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    statusCode: 404,
    data: null,
    clientMessage: 'Endpoint not found',
    devMessage: `Route ${req.method} ${req.originalUrl} not found`
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  res.status(500).json({
    success: false,
    statusCode: 500,
    data: null,
    clientMessage: 'Something went wrong, please try again later',
    devMessage: error.message
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📚 API Documentation:`);
  console.log(`   Health Check: GET http://localhost:${PORT}/health`);
  console.log(`   Brand API: http://localhost:${PORT}/api/brand`);
  console.log(`   Category API: http://localhost:${PORT}/api/category`);
  console.log(`   UOM API: http://localhost:${PORT}/api/uom`);
  console.log(`   Warehouse API: http://localhost:${PORT}/api/warehouse`);
  console.log(`   Item API: http://localhost:${PORT}/api/item`);
});

module.exports = app;