const express = require("express");
const router = express.Router();
const db = require("../../config/database");

// GET all source details
router.get("/", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM ims.t_source_detail WHERE is_deleted = false"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET source detail by ID
router.get("/:source_id", async (req, res) => {
  try {
    const { source_id } = req.params;
    // Fetch all source details for a given source_id, including item details
    const sourceDetailsResult = await db.query(
      `SELECT sd.*, i.item_code, i.item_name, i.hsn_code, i.description, i.safety_stock, i.reorder_quantity, i.latest_lowest_basic_supply_rate, i.latest_lowest_basic_installation_rate, i.latest_lowest_net_rate, i.dimensions, i.parent_item_id, i.material_type, i.category_id, i.brand_id, i.uom_id, i.installation_rate, i.unit_price, i.uom_value, i.is_capital_item, i.is_scrap_item, i.insurance_number, i.insurance_provider, i.insurance_type, i.insurance_renewal_frequency, i.insurance_start_date, i.insurance_end_date, i.insurance_premium_amount, i.insurance_claim_amount, i.insurance_status
       FROM ims.t_source_detail sd
       LEFT JOIN ims.t_item i ON sd.item_id = i.id
       WHERE sd.source_id = $1 AND sd.is_deleted = false`,
      [source_id]
    );

    // For each item in source_details, get its warehouse details
    const itemIds = sourceDetailsResult.rows.map((row) => row.item_id);
    let itemWarehouseMap = {};
    if (itemIds.length > 0) {
      // Get warehouse details for each item_id in this source
      const itemWarehouseResult = await db.query(
        `SELECT siwd.item_id, siwd.warehouse_id, w.*
         FROM ims.t_source_item_warehouse_details siwd
         LEFT JOIN ims.t_warehouse w ON siwd.warehouse_id = w.id
         WHERE siwd.source_id = $1 AND siwd.is_deleted = false AND w.is_deleted = false`,
        [source_id]
      );
      // Group warehouses by item_id
      itemWarehouseResult.rows.forEach((row) => {
        if (!itemWarehouseMap[row.item_id]) itemWarehouseMap[row.item_id] = [];
        itemWarehouseMap[row.item_id].push(row);
      });
    }

    if (sourceDetailsResult.rows.length === 0)
      return res.status(404).json({ error: "Not found" });

    // Attach warehouses to each item in source_details
    const sourceDetailsWithWarehouses = sourceDetailsResult.rows.map(
      (item) => ({
        ...item,
        warehouses: itemWarehouseMap[item.item_id] || [],
      })
    );

    res.json({
      source_details: sourceDetailsWithWarehouses,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create source detail
router.post("/", async (req, res) => {
  try {
    const body = req.body;
    // Validate required fields
    if (!body.source_id || !body.item_id) {
      return res
        .status(400)
        .json({ error: "source_id and item_id are required." });
    }
    const result = await db.query(
      `INSERT INTO ims.t_source_detail (
        source_id, item_id, expected_quantity, remaining_quantity, accepted_quantity, rejected_quantity, lost_quantity, rate, comment, created_by, updated_by, is_deleted, is_active
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
      ) RETURNING *`,
      [
        body.source_id,
        body.item_id,
        body.expected_quantity || null,
        body.remaining_quantity || null,
        body.accepted_quantity || null,
        body.rejected_quantity || null,
        body.lost_quantity || null,
        body.rate || null,
        body.comment || null,
        body.created_by || null,
        body.updated_by || null,
        body.is_deleted === undefined ? false : body.is_deleted,
        body.is_active === undefined ? true : body.is_active,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update source detail
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;
    const result = await db.query(
      `UPDATE ims.t_source_detail SET 
        expected_quantity=$1,
        remaining_quantity=$2,
        accepted_quantity=$3,
        rejected_quantity=$4,
        lost_quantity=$5,
        rate=$6,
        comment=$7,
        updated_by=$8,
        updated_at=now(),
        is_deleted=$9,
        is_active=$10
      WHERE id=$11 RETURNING *`,
      [
        body.expected_quantity || null,
        body.remaining_quantity || null,
        body.accepted_quantity || null,
        body.rejected_quantity || null,
        body.lost_quantity || null,
        body.rate || null,
        body.comment || null,
        body.updated_by || null,
        body.is_deleted === undefined ? false : body.is_deleted,
        body.is_active === undefined ? true : body.is_active,
        id,
      ]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH approve source detail
router.patch("/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `UPDATE ims.t_source_detail SET is_active=true, updated_at=now() WHERE id=$1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE source detail (soft delete)
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `UPDATE ims.t_source_detail SET is_deleted=true, updated_at=now() WHERE id=$1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Not found" });
    res.json({ message: "Deleted", id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
