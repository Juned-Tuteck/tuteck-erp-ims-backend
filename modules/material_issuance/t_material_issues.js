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

// Get material issue by ID, including items (supports multiple issuance types)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // First, get the basic material issue to check issuance_type
    const basicIssueResult = await db.query(
      `SELECT * FROM ims.t_material_issues 
       WHERE id = $1 AND is_deleted = false`,
      [id]
    );

    if (basicIssueResult.rows.length === 0) {
      return res.status(404).json({ error: "Material issue not found" });
    }

    const basicIssue = basicIssueResult.rows[0];
    const issuanceType = basicIssue.issuance_type;

    // Handle different issuance types
    if (issuanceType === 'project-project') {
      // ========== PROJECT-TO-PROJECT ISSUANCE ==========

      // Get material issue with sender project name
      const issueResult = await db.query(
        `SELECT mi.*, sp.name AS sender_name
         FROM ims.t_material_issues mi
         LEFT JOIN pms.t_project sp ON mi.sender_reference_id = sp.id
         WHERE mi.id = $1 AND mi.is_deleted = false`,
        [id]
      );
      const issue = issueResult.rows[0];

      // Get P2P issuance items
      const p2pItemsResult = await db.query(
        `SELECT p2p.*, 
                i.item_name, i.item_code, i.hsn_code, u.uom_name,
                sb.name as sending_bom_name,
                ss.spec_description as sending_spec_name
         FROM ims.t_material_issuance_items_p2p p2p
         LEFT JOIN ims.t_item i ON p2p.item_id = CAST(i.id AS TEXT)
         LEFT JOIN ims.t_uom u ON i.uom_id = u.id
         LEFT JOIN crm.t_bom sb ON p2p.sending_bom_id = CAST(sb.id AS TEXT)
         LEFT JOIN crm.t_bom_spec ss ON p2p.sending_spec_id = CAST(ss.id AS TEXT)
         WHERE p2p.issuance_id = $1`,
        [id]
      );

      // For each P2P item, get its transfer details
      const itemsWithTransfers = await Promise.all(
        p2pItemsResult.rows.map(async (item) => {
          const transfersResult = await db.query(
            `SELECT t.*, 
                    rb.name as receiving_bom_name,
                    rp.name as receiver_name,
                    rs.spec_description as receiving_spec_name
             FROM ims.t_material_issuance_item_transfers_p2p t
             LEFT JOIN crm.t_bom rb ON t.receiving_bom_id = CAST(rb.id AS TEXT)
             LEFT JOIN pms.t_project rp ON t.receiving_project_id = rp.id 
             LEFT JOIN crm.t_bom_spec rs ON t.receiving_spec_id = CAST(rs.id AS TEXT)
             WHERE t.issuance_item_id = $1`,
            [item.id]
          );

          return {
            ...item,
            allocated_qty: parseFloat(item.allocated_qty),
            total_transferred_qty: parseFloat(item.total_transferred_qty || 0),
            transfers: transfersResult.rows.map(t => ({
              ...t,
              transfer_qty: parseFloat(t.transfer_qty),
              receiver_type: 'project',
              receiver_name: t.receiver_name,
              receiving_project_id: t.receiving_project_id,
              receiving_bom_id: t.receiving_bom_id,
              receiving_bom_name: t.receiving_bom_name,
              receiving_spec_id: t.receiving_spec_id,
              receiving_spec_name: t.receiving_spec_name
            }))
          };
        })
      );

      issue.items = itemsWithTransfers;
      res.json(issue);

    } else if (issuanceType === 'project-warehouse') {
      // ========== PROJECT-TO-WAREHOUSE ISSUANCE ==========

      const issueResult = await db.query(
        `SELECT mi.*, sp.name AS sender_name
         FROM ims.t_material_issues mi
         LEFT JOIN pms.t_project sp ON mi.sender_reference_id = sp.id
         WHERE mi.id = $1 AND mi.is_deleted = false`,
        [id]
      );
      const issue = issueResult.rows[0];

      // Get related items with receiver warehouse name, item details, BOM name, and spec name
      const itemsResult = await db.query(
        `SELECT mii.*, 
                rw.warehouse_name AS receiver_name, 
                i.item_name, i.item_code, i.hsn_code, u.uom_name, 
                b.name as bom_name,
                bs.spec_description as spec_name
         FROM ims.t_material_issue_items mii
         LEFT JOIN ims.t_warehouse rw ON mii.receiving_reference_id = rw.id
         LEFT JOIN ims.t_item i ON mii.item_id = i.id
         LEFT JOIN ims.t_uom u ON i.uom_id = u.id
         LEFT JOIN crm.t_bom b ON mii.bom_id = b.id
         LEFT JOIN crm.t_bom_spec bs ON mii.spec_id = bs.id
         WHERE mii.issue_id = $1 AND mii.is_deleted = false`,
        [id]
      );

      issue.items = itemsResult.rows.map(item => ({
        ...item,
        issued_quantity: parseFloat(item.issued_quantity || 0),
        rate: parseFloat(item.rate || 0)
      }));
      res.json(issue);

    } else {
      // ========== WAREHOUSE ISSUANCE (default) ==========

      // Get material issue with sender warehouse name
      const issueResult = await db.query(
        `SELECT mi.*, sw.warehouse_name AS sender_name
         FROM ims.t_material_issues mi
         LEFT JOIN ims.t_warehouse sw ON mi.sender_reference_id = sw.id
         WHERE mi.id = $1 AND mi.is_deleted = false`,
        [id]
      );
      const issue = issueResult.rows[0];

      // Get related items with receiver name, item details, and bom name
      const itemsResult = await db.query(
        `SELECT mii.*, rw.warehouse_name AS receiver_name, 
                i.item_name, i.item_code, i.hsn_code, u.uom_name, b.name as bom_name
         FROM ims.t_material_issue_items mii
         LEFT JOIN ims.t_warehouse rw ON mii.receiving_reference_id = rw.id
         LEFT JOIN ims.t_item i ON mii.item_id = i.id
         LEFT JOIN ims.t_uom u ON i.uom_id = u.id
         LEFT JOIN crm.t_bom b ON mii.bom_id = b.id
         WHERE mii.issue_id = $1 AND mii.is_deleted = false`,
        [id]
      );
      issue.items = itemsResult.rows;
      res.json(issue);
    }

  } catch (err) {
    console.error('Error in GET /api/material_issues/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all approved material issues where is_dc_generated is false
router.get("/get/approved", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT mi.*, 
              CASE 
                WHEN mi.sender_type = 'project' THEN p.name
                WHEN mi.sender_type = 'warehouse' THEN w.warehouse_name
                ELSE NULL
              END AS sender_name,
              w.address
       FROM ims.t_material_issues mi
       LEFT JOIN ims.t_warehouse w ON mi.sender_type = 'warehouse' AND mi.sender_reference_id = w.id
       LEFT JOIN pms.t_project p ON mi.sender_type = 'project' AND mi.sender_reference_id = p.id
       WHERE mi.status = 'approved' AND mi.is_dc_generated = false AND mi.is_active = true AND mi.is_deleted = false
       ORDER BY mi.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
