const db = require("../../config/database");
const express = require("express");
const router = express.Router();

// Get all inventory records
router.get("/", async (req, res) => {
  try {
    // Join with item table to get item details
    const result = await db.query(
      `SELECT inv.*, i.item_code, i.item_name, i.hsn_code, i.description, i.insurance_status
       FROM ims.t_inventory inv
       LEFT JOIN ims.t_item i ON inv.item_id = i.id
       WHERE inv.is_deleted = false`
    );
    // Group by item_id, include item details once per group
    const grouped = {};
    for (const row of result.rows) {
      if (!grouped[row.item_id]) {
        grouped[row.item_id] = {
          item_id: row.item_id,
          item_code: row.item_code,
          item_name: row.item_name,
          hsn_code: row.hsn_code,
          description: row.description,
          insurance_status: row.insurance_status,
          inventories: [],
        };
      }
      // Remove duplicate item fields from inventory record
      const {
        item_code,
        item_name,
        hsn_code,
        description,
        insurance_status,
        ...inventory
      } = row;
      grouped[row.item_id].inventories.push(inventory);
    }
    res.json(Object.values(grouped));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get inventory by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    // Get all inventory records for this item_id, join warehouse and source details
    const result = await db.query(
      `SELECT inv.*, w.warehouse_code, w.warehouse_name, w.address, s.source_number
       FROM ims.t_inventory inv
       LEFT JOIN ims.t_warehouse w ON inv.store_id = w.id
       LEFT JOIN ims.t_source s ON inv.source_id = s.id
       WHERE inv.item_id = $1 AND inv.is_deleted = false`,
      [id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Not found" });

    // Group by warehouse_id, include warehouse and source details once per group
    const grouped = {};
    for (const row of result.rows) {
      if (!grouped[row.store_id]) {
        grouped[row.store_id] = {
          warehouse_id: row.store_id,
          warehouse_code: row.warehouse_code,
          warehouse_name: row.warehouse_name,
          address: row.address,
          inventories: [],
        };
      }
      // Remove duplicate warehouse and source fields from inventory record
      const {
        warehouse_code,
        warehouse_name,
        address,
        source_number,
        ...inventory
      } = row;
      grouped[row.store_id].inventories.push({ ...inventory, source_number });
    }
    res.json(Object.values(grouped));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create inventory record
router.post("/", async (req, res) => {
  try {
    const {
      item_id,
      store_id,
      store_type,
      source_id,
      quantity,
      rate,
      status,
      created_by,
      updated_by,
      is_active,
    } = req.body;
    const result = await db.query(
      `INSERT INTO ims.t_inventory (item_id, store_id, store_type, source_id, quantity, rate, status, created_by, updated_by, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        item_id,
        store_id,
        store_type,
        source_id,
        quantity,
        rate,
        status,
        created_by,
        updated_by,
        is_active,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk insert inventory records
router.post("/bulk", async (req, res) => {
  try {
    const records = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res
        .status(400)
        .json({ error: "Request body must be a non-empty array" });
    }
    const values = [];
    const params = [];
    let paramIndex = 1;
    for (const rec of records) {
      values.push(
        `($${paramIndex},$${paramIndex + 1},$${paramIndex + 2},$${
          paramIndex + 3
        },$${paramIndex + 4},$${paramIndex + 5},$${paramIndex + 6},$${
          paramIndex + 7
        },$${paramIndex + 8},$${paramIndex + 9},$${paramIndex + 10})`
      );
      params.push(
        rec.item_id,
        rec.store_id,
        rec.store_type,
        rec.source_id,
        rec.quantity,
        rec.rate,
        rec.status,
        rec.created_by,
        rec.updated_by,
        rec.is_active,
        rec.source_type
      );
      paramIndex += 11;
    }
    const query = `INSERT INTO ims.t_inventory (item_id, store_id, store_type, source_id, quantity, rate, status, created_by, updated_by, is_active, source_type) VALUES ${values.join(
      ","
    )} RETURNING *`;
    const result = await db.query(query, params);
    res.status(201).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update inventory by ID
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      item_id,
      store_id,
      store_type,
      source_id,
      quantity,
      rate,
      status,
      updated_by,
      is_active,
    } = req.body;
    const result = await db.query(
      `UPDATE ims.t_inventory SET item_id=$1, store_id=$2, store_type=$3, source_id=$4, quantity=$5, rate=$6, status=$7, updated_at=now(), updated_by=$8, is_active=$9 WHERE id=$10 AND is_deleted=false RETURNING *`,
      [
        item_id,
        store_id,
        store_type,
        source_id,
        quantity,
        rate,
        status,
        updated_by,
        is_active,
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

// Delete inventory by ID (soft delete)
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      "UPDATE ims.t_inventory SET is_deleted=true WHERE id=$1 RETURNING *",
      [id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Not found" });
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a new route to get inventory details by warehouse_id and item_id
router.get("/warehouse/:warehouse_id/item/:item_id", async (req, res) => {
  try {
    const { warehouse_id, item_id } = req.params;

    // Query to fetch inventory details and source_number
    const result = await db.query(
      `SELECT inv.*, s.source_number
       FROM ims.t_inventory inv
       LEFT JOIN ims.t_source s ON inv.source_id = s.id
       WHERE inv.store_id = $1 AND inv.item_id = $2 AND inv.is_deleted = false`,
      [warehouse_id, item_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No inventory found for the given warehouse_id and item_id" });
    }

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
