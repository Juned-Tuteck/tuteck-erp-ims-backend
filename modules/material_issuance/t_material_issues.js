const db = require("../../config/database");
const express = require("express");
const router = express.Router();

// Get all material issues
// router.get("/", async (req, res) => {
//   try {
//     const result = await db.query(
//       "SELECT * FROM ims.t_material_issues WHERE is_deleted = false"
//     );
//     res.json(result.rows);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// Get material issue by ID, including items
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    // Get material issue with sender name
    const issueResult = await db.query(
      `SELECT mi.*, sw.warehouse_name AS sender_name
       FROM ims.t_material_issues mi
       LEFT JOIN ims.t_warehouse sw ON mi.sender_reference_id = sw.id
       WHERE mi.id = $1 AND mi.is_deleted = false`,
      [id]
    );
    if (issueResult.rows.length === 0)
      return res.status(404).json({ error: "Not found" });
    const issue = issueResult.rows[0];

    // Get related items with receiver name, item details, and bom name
    const itemsResult = await db.query(
      `SELECT mii.*, rw.warehouse_name AS receiver_name, 
              i.item_name, i.item_code, i.hsn_code, u.uom_name, b.name
       FROM ims.t_material_issue_items mii
       LEFT JOIN ims.t_warehouse rw ON mii.receiving_reference_id = rw.id
       LEFT JOIN ims.t_item i ON mii.item_id = i.id
       LEFT JOIN ims.t_uom u ON i.uom_id = u.id
       LEFT JOIN crm.t_bom b ON mii.bom_id = b.id
       WHERE mii.issue_id = $1 AND mii.is_deleted = false`,
      [id]
    );
    issue.items = itemsResult.rows;

    // Set receiver name from first item if available
    // if (itemsResult.rows.length > 0) {
    //   issue.receiver_name = itemsResult.rows[0].receiver_name;
    // }
    res.json(issue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
