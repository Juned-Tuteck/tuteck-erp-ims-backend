const express = require("express");
const router = express.Router();
// Replace with your DB client
const db = require("../../config/database");

// GET all sources
router.get("/", async (req, res) => {
  try {
    const { source_type } = req.query;
    let query = `
      SELECT s.*, 
        COALESCE(json_agg(json_build_object('warehouse_id', iw.warehouse_id, 'warehouse_name', w.warehouse_name)) FILTER (WHERE iw.warehouse_id IS NOT NULL), '[]') AS warehouses,
        sw.warehouse_code AS sender_warehouse_code,
        sw.warehouse_name AS sender_warehouse_name,
        sw.address AS sender_warehouse_address
      FROM ims.t_source s
      LEFT JOIN ims.t_source_item_warehouse_details iw ON s.id = iw.source_id AND iw.is_deleted = false
      LEFT JOIN ims.t_warehouse w ON iw.warehouse_id = w.id
      LEFT JOIN ims.t_warehouse sw ON s.sender_warehouse_id = sw.id
      WHERE s.is_deleted = false`;
    const params = [];
    if (source_type) {
      query += ` AND s.source_type = $1`;
      params.push(source_type);
    }
    query += ` GROUP BY s.id, sw.warehouse_code, sw.warehouse_name, sw.address`;
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET source by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      "SELECT * FROM ims.t_source WHERE id = $1 AND is_deleted = false",
      [id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create source
router.post("/", async (req, res) => {
  try {
    const body = req.body;
    // Validate required fields
    if (!body.source_number || !body.source_date) {
      return res
        .status(400)
        .json({ error: "source_number and source_date are required." });
    }
    const result = await db.query(
      `INSERT INTO ims.t_source (
        source_type, source_number, inbound_trigger_issue_id, inbound_trigger_issue_type, receiver_project_id, sender_project_id, source_date, sender_warehouse_id, receiver_warehouse_id, vendor_id, invoice_number, invoice_amount, generate_qr, status, created_by, updated_by, is_deleted, is_active, po_number
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      ) RETURNING *`,
      [
        body.source_type || "GRN",
        body.source_number,
        body.inbound_trigger_issue_id || null,
        body.inbound_trigger_issue_type || "PO",
        body.receiver_project_id || null,
        body.sender_project_id || null,
        body.source_date,
        body.sender_warehouse_id || null,
        body.receiver_warehouse_id || null,
        body.vendor_id || null,
        body.invoice_number || null,
        body.invoice_amount || null,
        body.generate_qr === undefined ? false : body.generate_qr,
        body.status || "draft",
        body.created_by || null,
        body.updated_by || null,
        body.is_deleted === undefined ? false : body.is_deleted,
        body.is_active === undefined ? true : body.is_active,
        body.po_number || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update source
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;
    // Add required fields validation here
    const result = await db.query(
      `UPDATE ims.t_source SET source_type=$1, source_number=$2, source_date=$3, status=$4, updated_by=$5, updated_at=now() WHERE id=$6 RETURNING *`,
      [
        body.source_type,
        body.source_number,
        body.source_date,
        body.status,
        body.updated_by,
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

// PATCH approve source
router.patch("/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `UPDATE ims.t_source SET status='completed', updated_at=now() WHERE id=$1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE source (soft delete)
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `UPDATE ims.t_source SET is_deleted=true, updated_at=now() WHERE id=$1 RETURNING *`,
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
