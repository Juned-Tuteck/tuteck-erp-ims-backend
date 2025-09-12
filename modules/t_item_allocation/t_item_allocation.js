const express = require("express");
const router = express.Router();
// Replace with your DB client
const db = require("../../config/database");

// Get item allocation details by item_id, grouped by bom_id with bom name
router.get("/by-item/:item_id", async (req, res) => {
  try {
    const { item_id } = req.params;
    const result = await db.query(
      `SELECT ia.*, b.name
			 FROM ims.t_item_allocation ia
			 LEFT JOIN crm.t_bom b ON ia.bom_id = b.id
			 WHERE ia.item_id = $1 AND ia.is_deleted = false AND ia.is_active = true`,
      [item_id]
    );
    // Group by bom_id
    const grouped = {};
    for (const row of result.rows) {
      if (!grouped[row.bom_id]) {
        grouped[row.bom_id] = {
          bom_id: row.bom_id,
          bom_name: row.bom_name,
          allocations: [],
        };
      }
      grouped[row.bom_id].allocations.push(row);
    }
    res.json(Object.values(grouped));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;
