const db = require("../../config/database");
const express = require("express");
const router = express.Router();

// Get all delivery challans
router.get("/", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM ims.t_delivery_challan WHERE is_deleted = false"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get delivery challan by ID (supports all transfer types)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Get delivery challan
    const dcResult = await db.query(
      "SELECT * FROM ims.t_delivery_challan WHERE id = $1 AND is_deleted = false",
      [id]
    );
    if (dcResult.rows.length === 0) {
      return res.status(404).json({ error: "Not found" });
    }
    const dc = dcResult.rows[0];

    if (!dc.transfer_id) {
      return res.json({
        delivery_challan: dc,
        sender: null,
        items: [],
      });
    }

    // First, get the material issue to check issuance_type
    const materialIssueResult = await db.query(
      `SELECT * FROM ims.t_material_issues WHERE id = $1 AND is_deleted = false`,
      [dc.transfer_id]
    );

    if (materialIssueResult.rows.length === 0) {
      return res.json({
        delivery_challan: dc,
        sender: null,
        items: [],
      });
    }

    const materialIssue = materialIssueResult.rows[0];
    const issuanceType = materialIssue.issuance_type;

    // ========== HANDLE DIFFERENT ISSUANCE TYPES ==========

    if (issuanceType === 'project-project') {
      // ========== PROJECT-TO-PROJECT TRANSFER ==========

      // Get sender project details
      const senderResult = await db.query(
        `SELECT p.id, p.name as project_name, p.project_address
         FROM pms.t_project p
         WHERE p.id = $1`,
        [materialIssue.sender_reference_id]
      );

      const sender = senderResult.rows.length > 0 ? {
        id: senderResult.rows[0].id,
        name: senderResult.rows[0].project_name,
        address: senderResult.rows[0].project_address,
        type: 'project'
      } : null;

      // Get P2P items with transfer details and item rate
      const p2pItemsResult = await db.query(
        `SELECT p2p.*, 
                i.item_name, i.item_code, i.hsn_code, u.uom_name,
                sb.name as sending_bom_name,
                ss.spec_description as sending_spec_name,
                ia.rate as item_rate
         FROM ims.t_material_issuance_items_p2p p2p
         LEFT JOIN ims.t_item i ON CAST(p2p.item_id AS UUID) = i.id
         LEFT JOIN ims.t_uom u ON i.uom_id = u.id
         LEFT JOIN crm.t_bom sb ON CAST(p2p.sending_bom_id AS UUID) = sb.id
         LEFT JOIN crm.t_bom_spec ss ON CAST(p2p.sending_spec_id AS UUID) = ss.id
         LEFT JOIN ims.t_item_allocation ia ON CAST(p2p.item_id AS UUID) = ia.item_id 
                                            AND CAST(p2p.sending_bom_id AS UUID) = ia.bom_id
                                            AND ia.is_active = true 
                                            AND ia.is_deleted = false
         WHERE p2p.issuance_id = $1`,
        [dc.transfer_id]
      );

      // For each P2P item, get its transfer details (receivers)
      const itemsWithTransfers = await Promise.all(
        p2pItemsResult.rows.map(async (item) => {
          const transfersResult = await db.query(
            `SELECT t.*, 
                    rb.name as receiving_bom_name,
                    rp.name as receiver_project_name,
                    rs.spec_description as receiving_spec_name
             FROM ims.t_material_issuance_item_transfers_p2p t
             LEFT JOIN crm.t_bom rb ON CAST(t.receiving_bom_id AS UUID) = rb.id
             LEFT JOIN pms.t_project rp ON t.receiving_project_id = rp.id
             LEFT JOIN crm.t_bom_spec rs ON CAST(t.receiving_spec_id AS UUID) = rs.id
             WHERE t.issuance_item_id = $1`,
            [item.id]
          );

          return {
            id: item.id,
            issue_id: item.issuance_id,
            item_id: item.item_id,
            allocated_qty: parseFloat(item.allocated_qty || 0),
            total_transferred_qty: parseFloat(item.total_transferred_qty || 0),
            rate: parseFloat(item.item_rate || 0),
            sending_bom_id: item.sending_bom_id,
            sending_bom_name: item.sending_bom_name,
            sending_spec_id: item.sending_spec_id,
            sending_spec_name: item.sending_spec_name,
            created_at: item.created_at,
            created_by: item.created_by,
            updated_at: item.updated_at,
            updated_by: item.updated_by,
            is_deleted: item.is_deleted,
            is_active: item.is_active,
            item_details: {
              id: item.item_id,
              item_code: item.item_code,
              item_name: item.item_name,
              hsn_code: item.hsn_code,
              uom_name: item.uom_name,
            },
            transfers: transfersResult.rows.map(t => ({
              id: t.id,
              transfer_qty: parseFloat(t.transfer_qty || 0),
              receiver_type: 'project',
              receiver_project_name: t.receiver_project_name,
              receiving_project_id: t.receiving_project_id,
              receiving_bom_id: t.receiving_bom_id,
              receiving_bom_name: t.receiving_bom_name,
              receiving_spec_id: t.receiving_spec_id,
              receiving_spec_name: t.receiving_spec_name,
            }))
          };
        })
      );

      res.json({
        delivery_challan: dc,
        sender: sender,
        items: itemsWithTransfers,
      });

    } else if (issuanceType === 'project-warehouse') {
      // ========== PROJECT-TO-WAREHOUSE TRANSFER ==========

      // Get sender project details
      const senderResult = await db.query(
        `SELECT p.id, p.name as project_name, p.project_address as address
         FROM pms.t_project p
         WHERE p.id = $1`,
        [materialIssue.sender_reference_id]
      );

      const sender = senderResult.rows.length > 0 ? {
        id: senderResult.rows[0].id,
        name: senderResult.rows[0].project_name,
        address: senderResult.rows[0].address,
        type: 'project'
      } : null;

      // Get items with receiver warehouse details
      const itemsResult = await db.query(
        `SELECT mii.*, 
                rw.id as receiver_warehouse_id,
                rw.warehouse_code as receiver_warehouse_code,
                rw.warehouse_name as receiver_warehouse_name, 
                rw.address as receiver_warehouse_address,
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
        [dc.transfer_id]
      );

      const items = itemsResult.rows.map(row => ({
        id: row.id,
        issue_id: row.issue_id,
        item_id: row.item_id,
        issued_quantity: parseFloat(row.issued_quantity || 0),
        rate: parseFloat(row.rate || 0),
        bom_id: row.bom_id,
        bom_name: row.bom_name,
        spec_id: row.spec_id,
        spec_name: row.spec_name,
        created_at: row.created_at,
        created_by: row.created_by,
        updated_at: row.updated_at,
        updated_by: row.updated_by,
        is_deleted: row.is_deleted,
        is_active: row.is_active,
        receiver_warehouse: {
          warehouse_id: row.receiver_warehouse_id,
          warehouse_code: row.receiver_warehouse_code,
          warehouse_name: row.receiver_warehouse_name,
          address: row.receiver_warehouse_address,
        },
        item_details: {
          id: row.item_id,
          item_code: row.item_code,
          item_name: row.item_name,
          hsn_code: row.hsn_code,
          uom_name: row.uom_name,
        },
      }));

      res.json({
        delivery_challan: dc,
        sender: sender,
        items: items,
      });

    } else {
      // ========== WAREHOUSE-TO-WAREHOUSE TRANSFER (default) ==========

      // Get sender warehouse details
      const senderResult = await db.query(
        `SELECT w.id, w.warehouse_code, w.warehouse_name, w.address
         FROM ims.t_warehouse w
         WHERE w.id = $1`,
        [materialIssue.sender_reference_id]
      );

      const sender = senderResult.rows.length > 0 ? {
        warehouse_id: senderResult.rows[0].id,
        warehouse_code: senderResult.rows[0].warehouse_code,
        warehouse_name: senderResult.rows[0].warehouse_name,
        address: senderResult.rows[0].address,
        type: 'warehouse'
      } : null;

      // Get items with receiver warehouse details
      const itemsResult = await db.query(
        `SELECT mii.*, 
                rw.id as receiver_warehouse_id,
                rw.warehouse_code as receiver_warehouse_code,
                rw.warehouse_name as receiver_warehouse_name,
                rw.address as receiver_warehouse_address,
                i.item_code, i.item_name, i.hsn_code, u.uom_name,
                b.name as bom_name
         FROM ims.t_material_issue_items mii
         LEFT JOIN ims.t_warehouse rw ON mii.receiving_reference_id = rw.id
         LEFT JOIN ims.t_item i ON mii.item_id = i.id
         LEFT JOIN ims.t_uom u ON i.uom_id = u.id
         LEFT JOIN crm.t_bom b ON mii.bom_id = b.id
         WHERE mii.issue_id = $1 AND mii.is_deleted = false`,
        [dc.transfer_id]
      );

      const items = itemsResult.rows.map(row => ({
        id: row.id,
        issue_id: row.issue_id,
        inventory_id: row.inventory_id,
        item_id: row.item_id,
        issued_quantity: parseFloat(row.issued_quantity || 0),
        rate: parseFloat(row.rate || 0),
        created_at: row.created_at,
        created_by: row.created_by,
        updated_at: row.updated_at,
        updated_by: row.updated_by,
        is_deleted: row.is_deleted,
        is_active: row.is_active,
        receiving_reference_id: row.receiving_reference_id,
        receiver_warehouse: {
          warehouse_id: row.receiver_warehouse_id,
          warehouse_code: row.receiver_warehouse_code,
          warehouse_name: row.receiver_warehouse_name,
          address: row.receiver_warehouse_address,
        },
        item_details: {
          id: row.item_id,
          item_code: row.item_code,
          item_name: row.item_name,
          hsn_code: row.hsn_code,
          uom_name: row.uom_name,
        },
      }));

      res.json({
        delivery_challan: dc,
        sender_warehouse: sender,
        items: items,
      });
    }

  } catch (err) {
    console.error('Error in GET /delivery-challan/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create delivery challan
router.post("/", async (req, res) => {
  try {
    const {
      dc_number,
      sender_type,
      sender_id,
      receiver_type,
      receiver_id,
      dc_date,
      dc_note,
      received_date,
      status,
      vehicle_no,
      driver_name,
      driver_phone_number,
      eway_bill_no,
      eway_bill_expiry_date,
      transfer_cost,
      created_by,
      updated_by,
      is_active,
      transfer_id,
    } = req.body;
    const result = await db.query(
      `INSERT INTO ims.t_delivery_challan (dc_number, sender_type, sender_id, receiver_type, receiver_id, dc_date, dc_note, received_date, status, vehicle_no, driver_name, driver_phone_number, eway_bill_no, eway_bill_expiry_date, transfer_cost, created_by, updated_by, is_active, transfer_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
      [
        dc_number,
        sender_type,
        sender_id,
        receiver_type,
        receiver_id,
        dc_date,
        dc_note,
        received_date,
        status,
        vehicle_no,
        driver_name,
        driver_phone_number,
        eway_bill_no,
        eway_bill_expiry_date,
        transfer_cost,
        created_by,
        updated_by,
        is_active,
        transfer_id,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update status of delivery challan
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, updated_by } = req.body;
    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }
    const result = await db.query(
      `UPDATE ims.t_delivery_challan SET status=$1, updated_by=$2, updated_at=now() WHERE id=$3 AND is_deleted=false RETURNING *`,
      [status, updated_by || null, id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all delivery challans where status is 'generated'
router.get("/get/generated", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM ims.t_delivery_challan WHERE status = 'generated' AND is_deleted = false"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
