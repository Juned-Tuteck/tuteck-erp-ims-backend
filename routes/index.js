const express = require('express');
const router = express.Router();

// Import all controllers
const brandController = require('../modules/brand/brand');
const categoryController = require('../modules/category/category');
const uomController = require('../modules/uom/uom');
const warehouseController = require('../modules/warehouse/warehouse');
const itemController = require('../modules/item/item');

// Brand routes
router.get('/api/brand', brandController.getAll);
router.get('/api/brand/:id', brandController.getById);
router.post('/api/brand', brandController.create);
router.put('/api/brand/:id', brandController.update);
router.delete('/api/brand/:id', brandController.delete);
router.post('/api/brand/bulk', brandController.bulkInsert);

// Category routes
router.get('/api/category', categoryController.getAll);
router.get('/api/category/:id', categoryController.getById);
router.post('/api/category', categoryController.create);
router.put('/api/category/:id', categoryController.update);
router.delete('/api/category/:id', categoryController.delete);
router.post('/api/category/bulk', categoryController.bulkInsert);

// UOM routes
router.get('/api/uom', uomController.getAll);
router.get('/api/uom/:id', uomController.getById);
router.post('/api/uom', uomController.create);
router.put('/api/uom/:id', uomController.update);
router.delete('/api/uom/:id', uomController.delete);
router.post('/api/uom/bulk', uomController.bulkInsert);

// Warehouse routes
router.get('/api/warehouse', warehouseController.getAll);
router.get('/api/warehouse/:id', warehouseController.getById);
router.post('/api/warehouse', warehouseController.create);
router.put('/api/warehouse/:id', warehouseController.update);
router.delete('/api/warehouse/:id', warehouseController.delete);
router.post('/api/warehouse/bulk', warehouseController.bulkInsert);

// Item routes
router.get('/api/item', itemController.getAll);
router.get('/api/item/:id', itemController.getById);
router.post('/api/item', itemController.create);
router.put('/api/item/:id', itemController.update);
router.delete('/api/item/:id', itemController.delete);
router.post('/api/item/bulk', itemController.bulkInsert);

module.exports = router;