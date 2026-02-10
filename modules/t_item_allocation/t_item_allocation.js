const express = require("express");
const router = express.Router();
// Replace with your DB client
const db = require("../../config/database");

// Get item allocation details by item_id, grouped by bom_id with bom name
router.get("/by-item/:item_id", async (req, res) => {
  try {
    const { item_id } = req.params;
    const result = await db.query(
      `SELECT ia.*, b.name as bom_name, p.name as project_name
			 FROM ims.t_item_allocation ia
			 LEFT JOIN crm.t_bom b ON ia.bom_id = b.id
			 LEFT JOIN pms.t_project p ON ia.project_id = p.id
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
          project_name: row.project_name || null,
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

// PUT update allocated quantity (subtract)
// router.put("/update-quantity", async (req, res) => {
//   try {
//     const { item_id, bom_id, project_id, quantity } = req.body;

//     if (!item_id || !bom_id || !project_id || quantity === undefined) {
//       return res.status(400).json({
//         error: "item_id, bom_id, project_id, and quantity are required",
//       });
//     }

//     const result = await db.query(
//       `UPDATE ims.t_item_allocation 
//        SET allocated_qty = allocated_qty - $1, updated_at = now()
//        WHERE item_id = $2 AND bom_id = $3 AND project_id = $4
//        RETURNING *`,
//       [quantity, item_id, bom_id, project_id]
//     );

//     if (result.rows.length === 0) {
//       return res.status(404).json({ error: "Allocation record not found" });
//     }

//     res.json(result.rows[0]);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });
router.put("/update-quantity", async (req, res) => {
  try {
    const { item_id, bom_id, project_id, quantity } = req.body;

    // Basic validation
    if (!item_id || quantity === undefined) {
      return res.status(400).json({
        error: "item_id and quantity are required",
      });
    }

    // Either bom_id or project_id must be present (but not mandatory both)
    if (!bom_id && !project_id) {
      return res.status(400).json({
        error: "Either bom_id or project_id is required",
      });
    }

    let query = `
      UPDATE ims.t_item_allocation
      SET allocated_qty = allocated_qty - $1,
          updated_at = now()
      WHERE item_id = $2
    `;

    const values = [quantity, item_id];

    // Dynamic condition
    if (bom_id) {
      query += " AND bom_id = $3";
      values.push(bom_id);
    } else if (project_id) {
      query += " AND project_id = $3";
      values.push(project_id);
    }

    query += " RETURNING *";

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Allocation record not found",
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
