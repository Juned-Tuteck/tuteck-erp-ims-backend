const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer(); // Initialize multer for handling file uploads

// Import all controllers
const brandController = require("../modules/brand/brand");
const categoryController = require("../modules/category/category");
const uomController = require("../modules/uom/uom");
const warehouseController = require("../modules/warehouse/warehouse");
const itemController = require("../modules/item/item");
const tInventoryController = require("../modules/inventory/t_inventory");
const tDeliveryChallanRouter = require("../modules/delivery_challan/t_delivery_challan");
const tMaterialIssuesRouter = require("../modules/material_issuance/t_material_issues");
// Source APIs
const tSourceRouter = require("../modules/sources/t_sources");
// Source Detail APIs
const tSourceDetailRouter = require("../modules/sources_details/t_sources_details");
// Source Item Warehouse Details APIs
const tSourceItemWarehouseRouter = require("../modules/source_item_warehouse/t_source_item_warehouse_details");

// Brand routes
router.get("/api/brand", brandController.getAll);
router.get("/api/brand/:id", brandController.getById);
router.post("/api/brand", brandController.create);
router.put("/api/brand/:id", brandController.update);
router.delete("/api/brand/:id", brandController.delete);
router.post("/api/brand/bulk", brandController.bulkInsert);
router.post(
  "/api/brand/import/excel",
  upload.single("excelFile"),
  brandController.processExcelAndBulkInsert
); // Add multer middleware here
router.get("/api/brand/export/excel", brandController.exportToExcel); // Route to export brand data to Excel

// Category routes
router.get("/api/category", categoryController.getAll);
router.get("/api/category/:id", categoryController.getById);
router.post("/api/category", categoryController.create);
router.put("/api/category/:id", categoryController.update);
router.delete("/api/category/:id", categoryController.delete);
router.post("/api/category/bulk", categoryController.bulkInsert);
router.post(
  "/api/category/import/excel",
  upload.single("excelFile"),
  categoryController.processExcelAndBulkInsert
); // Add multer middleware here
router.get("/api/category/export/excel", categoryController.exportToExcel); // Route to export category data to Excel

// UOM routes
router.get("/api/uom", uomController.getAll);
router.get("/api/uom/:id", uomController.getById);
router.post("/api/uom", uomController.create);
router.put("/api/uom/:id", uomController.update);
router.delete("/api/uom/:id", uomController.delete);
router.post("/api/uom/bulk", uomController.bulkInsert);
router.post(
  "/api/uom/import/excel",
  upload.single("excelFile"),
  uomController.processExcelAndBulkInsert
); // Add multer middleware here
router.get("/api/uom/export/excel", uomController.exportToExcel); // Route to export UOM data to Excel

// Warehouse routes
router.get("/api/warehouse", warehouseController.getAll);
router.get("/api/warehouse/:id", warehouseController.getById);
router.post("/api/warehouse", warehouseController.create);
router.put("/api/warehouse/:id", warehouseController.update);
router.delete("/api/warehouse/:id", warehouseController.delete);
router.post("/api/warehouse/bulk", warehouseController.bulkInsert);
router.post(
  "/api/warehouse/import/excel",
  upload.single("excelFile"),
  warehouseController.processExcelAndBulkInsert
); // Add multer middleware here
router.get("/api/warehouse/export/excel", warehouseController.exportToExcel); // Route to export warehouse data to Excel

// Item routes
router.get("/api/item", itemController.getAll);
router.get("/api/item/:id", itemController.getById);
router.post("/api/item", itemController.create);
router.put("/api/item/:id", itemController.update);
router.delete("/api/item/:id", itemController.delete);
router.post("/api/item/bulk", itemController.bulkInsert);
router.post(
  "/api/item/import/excel",
  upload.single("excelFile"),
  itemController.processExcelAndBulkInsert
); // Add multer middleware here
router.get("/api/item/export/excel", itemController.exportToExcel); // Route to export item data to Excel

// Register new routers

router.use("/api/source", tSourceRouter);
router.use("/api/source-detail", tSourceDetailRouter);
router.use("/api/source-item-warehouse-details", tSourceItemWarehouseRouter);
router.use("/api/inventory", tInventoryController);
router.use("/api/delivery-challan", tDeliveryChallanRouter);
router.use("/api/material-issues", tMaterialIssuesRouter);

module.exports = router;
