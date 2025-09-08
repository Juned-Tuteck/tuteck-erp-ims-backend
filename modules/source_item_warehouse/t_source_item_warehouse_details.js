const express = require("express");
const router = express.Router();
const db = require("../../config/database");

// GET all item warehouse details
router.get("/", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM ims.t_source_item_warehouse_details WHERE is_deleted = false"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET item warehouse detail by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    // Fetch all warehouse details for a given source_detail_id
    const result = await db.query(
      `SELECT iw.*, w.*
       FROM ims.t_source_item_warehouse_details iw
       LEFT JOIN ims.t_warehouse w ON iw.warehouse_id = w.id
       WHERE iw.source_detail_id = $1 AND iw.is_deleted = false`,
      [id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Not found" });
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create item warehouse detail
router.post("/", async (req, res) => {
  try {
    const body = req.body;
    const result = await db.query(
      `INSERT INTO ims.t_source_item_warehouse_details (source_id, source_detail_id, item_id, warehouse_id, accepted_quantity, rejected_quantity, lost_quantity, note, created_by, expected_quantity) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        body.source_id,
        body.source_detail_id,
        body.item_id,
        body.warehouse_id,
        body.accepted_quantity,
        body.rejected_quantity,
        body.lost_quantity,
        body.note,
        body.created_by,
        body.expected_quantity,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// BULK POST create item warehouse details
router.post("/bulk", async (req, res) => {
  try {
    const items = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ error: "Request body must be a non-empty array." });
    }
    const values = [];
    const placeholders = [];
    items.forEach((body, idx) => {
      placeholders.push(
        `($${idx * 12 + 1},$${idx * 12 + 2},$${idx * 12 + 3},$${
          idx * 12 + 4
        },$${idx * 12 + 5},$${idx * 12 + 6},$${idx * 12 + 7},$${
          idx * 12 + 8
        },$${idx * 12 + 9},$${idx * 12 + 10},$${idx * 12 + 11},$${
          idx * 12 + 12
        })`
      );
      values.push(
        body.source_id,
        body.source_detail_id,
        body.item_id,
        body.warehouse_id || null,
        body.accepted_quantity || null,
        body.rejected_quantity || null,
        body.lost_quantity || null,
        body.note || null,
        body.created_by || null,
        body.expected_quantity || null,
        body.is_deleted === undefined ? false : body.is_deleted,
        body.is_active === undefined ? true : body.is_active
      );
    });
    const query = `INSERT INTO ims.t_source_item_warehouse_details (
      source_id, source_detail_id, item_id, warehouse_id, accepted_quantity, rejected_quantity, lost_quantity, note, created_by, expected_quantity, is_deleted, is_active
    ) VALUES ${placeholders.join(", ")} RETURNING *`;
    const result = await db.query(query, values);
    res.status(201).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update item warehouse detail
router.put("/:id", async (req, res) => {
  try {
    // Expect source_id, source_detail_id, warehouse_id in body
    const { source_id, source_detail_id, warehouse_id } = req.body;
    if (!source_id || !source_detail_id || !warehouse_id) {
      return res
        .status(400)
        .json({
          error: "source_id, source_detail_id, and warehouse_id are required",
        });
    }
    const result = await db.query(
      `UPDATE ims.t_source_item_warehouse_details SET accepted_quantity=$1, rejected_quantity=$2, lost_quantity=$3, note=$4, updated_by=$5, updated_at=now()
       WHERE source_id=$6 AND source_detail_id=$7 AND warehouse_id=$8 RETURNING *`,
      [
        req.body.accepted_quantity,
        req.body.rejected_quantity,
        req.body.lost_quantity,
        req.body.note,
        req.body.updated_by,
        source_id,
        source_detail_id,
        warehouse_id,
      ]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Not found" });
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH approve item warehouse detail
router.patch("/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `UPDATE ims.t_source_item_warehouse_details SET is_active=true, updated_at=now() WHERE id=$1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE item warehouse detail (soft delete)
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `UPDATE ims.t_source_item_warehouse_details SET is_deleted=true, updated_at=now() WHERE id=$1 RETURNING *`,
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
