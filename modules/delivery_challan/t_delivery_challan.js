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

// Get delivery challan by ID
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

    // Get sender warehouse details from t_material_issues using transfer_id
    let senderWarehouse = null;
    let senderMaterialIssue = null;
    if (dc.transfer_id) {
      const senderMIResult = await db.query(
        `SELECT mi.*, w.*
         FROM ims.t_material_issues mi
         LEFT JOIN ims.t_warehouse w ON mi.sender_reference_id = w.id
         WHERE mi.id = $1 AND mi.is_deleted = false`,
        [dc.transfer_id]
      );
      if (senderMIResult.rows.length > 0) {
        senderMaterialIssue = senderMIResult.rows[0];
        senderWarehouse = {
          warehouse_id: senderMaterialIssue.sender_reference_id,
          warehouse_code: senderMaterialIssue.warehouse_code,
          warehouse_name: senderMaterialIssue.warehouse_name,
          address: senderMaterialIssue.address,
        };
      }
    }

    // Get receiver warehouse details from t_material_issue_items using transfer_id
    let receiverWarehouse = null;
    let receiverMaterialIssueItem = null;
    let itemDetails = [];
    if (dc.transfer_id) {
      const receiverMIItemResult = await db.query(
        `SELECT mii.*, w.*, i.item_code, i.item_name
         FROM ims.t_material_issue_items mii
         LEFT JOIN ims.t_warehouse w ON mii.receiving_reference_id = w.id
         LEFT JOIN ims.t_item i ON mii.item_id = i.id
         WHERE mii.issue_id = $1 AND mii.is_deleted = false`,
        [dc.transfer_id]
      );
      console.log("receiverMIItemResult:", receiverMIItemResult.rows);
      if (receiverMIItemResult.rows.length > 0) {
        receiverMaterialIssueItem = receiverMIItemResult.rows[0];
        receiverWarehouse = {
          warehouse_id: receiverMaterialIssueItem.receiving_reference_id,
          warehouse_code: receiverMaterialIssueItem.warehouse_code,
          warehouse_name: receiverMaterialIssueItem.warehouse_name,
          address: receiverMaterialIssueItem.address,
        };
        itemDetails = receiverMIItemResult.rows.map((row) => ({
          id: row.id,
          issue_id: row.issue_id,
          inventory_id: row.inventory_id,
          item_id: row.item_id,
          issued_quantity: row.issued_quantity,
          rate: row.rate,
          created_at: row.created_at,
          created_by: row.created_by,
          updated_at: row.updated_at,
          updated_by: row.updated_by,
          is_deleted: row.is_deleted,
          is_active: row.is_active,
          crm_bom_id: row.crm_bom_id,
          receiving_reference_id: row.receiving_reference_id,
          sender_warehouse: {
            warehouse_id: row.sender_reference_id,
            warehouse_code: row.sender_warehouse_code,
            warehouse_name: row.sender_warehouse_name,
            address: row.sender_warehouse_address,
          },
          receiver_warehouse: {
            warehouse_id: row.receiving_reference_id,
            warehouse_code: row.warehouse_code,
            warehouse_name: row.warehouse_name,
            address: row.address,
          },
          item_details: {
            id: row.item_id,
            item_code: row.item_code,
            item_name: row.item_name,
            rate: row.rate,
            hsn_code: row.hsn_code,
            description: row.description,
            safety_stock: row.safety_stock,
            reorder_quantity: row.reorder_quantity,
            latest_lowest_basic_supply_rate:
              row.latest_lowest_basic_supply_rate,
            latest_lowest_basic_installation_rate:
              row.latest_lowest_basic_installation_rate,
            latest_lowest_net_rate: row.latest_lowest_net_rate,
            dimensions: row.dimensions,
            parent_item_id: row.parent_item_id,
            material_type: row.material_type,
            category_id: row.category_id,
            brand_id: row.brand_id,
            uom_id: row.uom_id,
            installation_rate: row.installation_rate,
            unit_price: row.unit_price,
            uom_value: row.uom_value,
            is_capital_item: row.is_capital_item,
            is_scrap_item: row.is_scrap_item,
            insurance_number: row.insurance_number,
            insurance_provider: row.insurance_provider,
            insurance_type: row.insurance_type,
            insurance_renewal_frequency: row.insurance_renewal_frequency,
            insurance_start_date: row.insurance_start_date,
            insurance_end_date: row.insurance_end_date,
            insurance_premium_amount: row.insurance_premium_amount,
            insurance_claim_amount: row.insurance_claim_amount,
            insurance_status: row.insurance_status,
            created_at: row.created_at,
            created_by: row.created_by,
            updated_at: row.updated_at,
            updated_by: row.updated_by,
            is_deleted: row.is_deleted,
            is_active: row.is_active,
            uom_name: row.uom_name,
          },
        }));
      }
    }

    res.json({
      delivery_challan: dc,
      sender_warehouse: senderWarehouse,
      //   receiver_warehouse: receiverWarehouse,
      items: itemDetails,
    });
  } catch (err) {
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
