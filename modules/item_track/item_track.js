const express = require("express");
const router = express.Router();
const db = require("../../config/database");

/**
 * Item Track Module
 * Tracks where inventory items came from and their movement history
 */

// GET tracking history for a specific item
router.get("/item/:item_id", async (req, res) => {
  try {
    const { item_id } = req.params;
    const { start_date, end_date, source_type, store_type } = req.query;

    // Query 1: Get inventory-based tracking (warehouse transfers, vendor receipts, etc.)
    let inventoryQuery = `
      SELECT 
        inv.id as inventory_id,
        inv.item_id,
        inv.quantity,
        inv.rate,
        inv.created_at as received_date,
        inv.source_type as inventory_source_type,
        inv.store_type,
        inv.status,
        'inventory' as record_type,
        
        -- Item details
        i.item_code,
        i.item_name,
        i.description,
        i.hsn_code,
        
        -- Source details
        s.id as source_id,
        s.source_number,
        s.source_date,
        s.source_type,
        s.invoice_number,
        s.po_number,
        s.dc_number,
        s.status as source_status,
        
        -- Current location
        CASE 
          WHEN inv.store_type = 'WAREHOUSE' THEN w.warehouse_name
          WHEN inv.store_type = 'PROJECT' THEN p.name
          ELSE 'Unknown'
        END as current_location,
        
        CASE 
          WHEN inv.store_type = 'WAREHOUSE' THEN w.warehouse_code
          WHEN inv.store_type = 'PROJECT' THEN p.project_number
          ELSE NULL
        END as current_location_code,
        
        CASE 
          WHEN inv.store_type = 'WAREHOUSE' THEN w.address
          WHEN inv.store_type = 'PROJECT' THEN p.project_address
          ELSE NULL
        END as current_location_address,
        
        -- Sender details (where it came from)
        CASE 
          WHEN s.sender_warehouse_id IS NOT NULL THEN sw.warehouse_name
          WHEN s.sender_project_id IS NOT NULL THEN sp.name
          WHEN s.vendor_id IS NOT NULL THEN v.business_name
          ELSE 'External'
        END as sender_name,
        
        CASE 
          WHEN s.sender_warehouse_id IS NOT NULL THEN 'warehouse'
          WHEN s.sender_project_id IS NOT NULL THEN 'project'
          WHEN s.vendor_id IS NOT NULL THEN 'vendor'
          ELSE 'external'
        END as sender_type,
        
        -- Receiver details (where it was sent to)
        CASE 
          WHEN s.receiver_warehouse_id IS NOT NULL THEN rw.warehouse_name
          WHEN s.receiver_project_id IS NOT NULL THEN rp.name
          ELSE NULL
        END as receiver_name,
        
        CASE 
          WHEN s.receiver_warehouse_id IS NOT NULL THEN 'warehouse'
          WHEN s.receiver_project_id IS NOT NULL THEN 'project'
          ELSE NULL
        END as receiver_type,
        
        -- Vendor details (if applicable)
        v.business_name,
        v.vendor_number,
        
        -- Project-to-Project transfer details from source_item_warehouse_details
        siwd.sender_bom_id,
        siwd.receiver_bom_id,
        siwd.spec_id,
        sender_spec.spec_description as sender_spec_name,
        receiver_spec.spec_description as receiver_spec_name,
        
        -- Allocation fields (null for inventory records)
        NULL::uuid as allocation_id,
        NULL::uuid as bom_id,
        NULL::numeric as required_qty,
        NULL::numeric as allocated_qty

      FROM ims.t_inventory inv
      LEFT JOIN ims.t_item i ON inv.item_id = i.id
      LEFT JOIN ims.t_source s ON inv.source_id = s.id
      LEFT JOIN ims.t_warehouse w ON inv.store_id = w.id AND inv.store_type = 'WAREHOUSE'
      LEFT JOIN pms.t_project p ON inv.store_id = p.id AND inv.store_type = 'PROJECT'
      LEFT JOIN ims.t_warehouse sw ON s.sender_warehouse_id = sw.id
      LEFT JOIN pms.t_project sp ON s.sender_project_id = sp.id
      LEFT JOIN ims.t_warehouse rw ON s.receiver_warehouse_id = rw.id
      LEFT JOIN pms.t_project rp ON s.receiver_project_id = rp.id
      LEFT JOIN crm.t_vendor v ON s.vendor_id = v.vendor_id
      LEFT JOIN ims.t_source_item_warehouse_details siwd ON s.id = siwd.source_id AND inv.item_id = siwd.item_id
      LEFT JOIN crm.t_bom_spec sender_spec ON siwd.sender_bom_id = sender_spec.id
      LEFT JOIN crm.t_bom_spec receiver_spec ON siwd.receiver_bom_id = receiver_spec.id
      
      WHERE inv.is_deleted = false
        AND inv.item_id = $1
    `;

    // Query 2: Get allocation-based tracking (project-to-project transfers)
    let allocationQuery = `
      SELECT 
        NULL::uuid as inventory_id,
        alloc.item_id,
        alloc.allocated_qty as quantity,
        alloc.rate,
        alloc.created_at as received_date,
        NULL as inventory_source_type,
        'PROJECT' as store_type,
        NULL as status,
        'allocation' as record_type,
        
        -- Item details
        i.item_code,
        alloc.item_name,
        i.description,
        i.hsn_code,
        
        -- Source details from allocation_details
        NULL::uuid as source_id,
        s.source_number,
        s.source_date,
        s.source_type,
        s.invoice_number,
        s.po_number,
        s.dc_number,
        s.status as source_status,
        
        -- Current location (receiver project)
        rp.name as current_location,
        rp.project_number as current_location_code,
        rp.project_address as current_location_address,
        
        -- Sender details (sender project)
        sp.name as sender_name,
        'project' as sender_type,
        
        -- Receiver details
        rp.name as receiver_name,
        'project' as receiver_type,
        
        -- Vendor details (null for P2P)
        NULL as business_name,
        NULL as vendor_number,
        
        -- Project-to-Project transfer details
        siwd.sender_bom_id,
        siwd.receiver_bom_id,
        siwd.spec_id,
        sender_spec.spec_description as sender_spec_name,
        receiver_spec.spec_description as receiver_spec_name,
        
        -- Allocation fields
        alloc.id as allocation_id,
        alloc.bom_id,
        alloc.required_qty,
        alloc.allocated_qty

      FROM ims.t_item_allocation alloc
      LEFT JOIN ims.t_item i ON alloc.item_id = i.id
      LEFT JOIN ims.t_item_allocation_details alloc_det ON alloc.id = alloc_det.item_allocation_id
      LEFT JOIN ims.t_source s ON alloc_det.source_id = s.receiver_project_id
      LEFT JOIN pms.t_project sp ON s.sender_project_id = sp.id
      LEFT JOIN pms.t_project rp ON s.receiver_project_id = rp.id
      LEFT JOIN ims.t_source_item_warehouse_details siwd ON s.id = siwd.source_id AND alloc.item_id = siwd.item_id
      LEFT JOIN crm.t_bom_spec sender_spec ON siwd.sender_bom_id = sender_spec.id
      LEFT JOIN crm.t_bom_spec receiver_spec ON siwd.receiver_bom_id = receiver_spec.id
      
      WHERE alloc.is_deleted = false
        AND alloc.item_id = $1
    `;

    const params = [item_id];
    let paramIndex = 2;

    // Add date filters to both queries
    if (start_date) {
      inventoryQuery += ` AND inv.created_at >= $${paramIndex}`;
      allocationQuery += ` AND alloc.created_at >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      inventoryQuery += ` AND inv.created_at <= $${paramIndex}`;
      allocationQuery += ` AND alloc.created_at <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    // Add source type filter
    if (source_type) {
      inventoryQuery += ` AND s.source_type = $${paramIndex}`;
      allocationQuery += ` AND s.source_type = $${paramIndex}`;
      params.push(source_type);
      paramIndex++;
    }

    // Add store type filter
    if (store_type) {
      inventoryQuery += ` AND inv.store_type = $${paramIndex}`;
      allocationQuery += ` AND 'PROJECT' = $${paramIndex}`;
      params.push(store_type);
      paramIndex++;
    }

    // Combine both queries with UNION ALL
    const combinedQuery = `
      ${inventoryQuery}
      UNION ALL
      ${allocationQuery}
      ORDER BY received_date DESC
    `;

    const result = await db.query(combinedQuery, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "No tracking data found for this item"
      });
    }

    // Calculate total quantity across all locations
    const totalQuantity = result.rows.reduce((sum, row) => sum + parseFloat(row.quantity || 0), 0);

    res.json({
      item_id,
      item_code: result.rows[0].item_code,
      item_name: result.rows[0].item_name,
      description: result.rows[0].description,
      total_quantity: totalQuantity,
      total_records: result.rows.length,
      tracking_history: result.rows
    });
  } catch (err) {
    console.error("Error in item tracking:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET all tracked items in a warehouse
router.get("/warehouse/:warehouse_id", async (req, res) => {
  try {
    const { warehouse_id } = req.params;
    const { source_type } = req.query;

    let query = `
      SELECT 
        inv.id as inventory_id,
        inv.item_id,
        inv.quantity,
        inv.rate,
        inv.created_at as received_date,
        inv.status,
        
        i.item_code,
        i.item_name,
        i.description,
        
        s.source_number,
        s.source_date,
        s.source_type,
        s.invoice_number,
        
        w.warehouse_name as current_warehouse,
        w.warehouse_code

      FROM ims.t_inventory inv
      LEFT JOIN ims.t_item i ON inv.item_id = i.id
      LEFT JOIN ims.t_source s ON inv.source_id = s.id
      LEFT JOIN ims.t_warehouse w ON inv.store_id = w.id
      
      WHERE inv.is_deleted = false
        AND inv.store_id = $1
        AND inv.store_type = 'WAREHOUSE'
    `;

    const params = [warehouse_id];

    if (source_type) {
      query += ` AND s.source_type = $2`;
      params.push(source_type);
    }

    query += ` ORDER BY inv.created_at DESC`;

    const result = await db.query(query, params);

    // Group by item_id to show summary
    const itemSummary = {};
    result.rows.forEach(row => {
      if (!itemSummary[row.item_id]) {
        itemSummary[row.item_id] = {
          item_id: row.item_id,
          item_code: row.item_code,
          item_name: row.item_name,
          total_quantity: 0,
          sources: []
        };
      }
      itemSummary[row.item_id].total_quantity += parseFloat(row.quantity || 0);
      itemSummary[row.item_id].sources.push({
        inventory_id: row.inventory_id,
        quantity: row.quantity,
        rate: row.rate,
        source_number: row.source_number,
        source_type: row.source_type,
        received_date: row.received_date
      });
    });

    res.json({
      warehouse_id,
      warehouse_name: result.rows[0]?.current_warehouse || 'Unknown',
      warehouse_code: result.rows[0]?.warehouse_code || null,
      total_items: Object.keys(itemSummary).length,
      total_records: result.rows.length,
      items: Object.values(itemSummary),
      detailed_records: result.rows
    });
  } catch (err) {
    console.error("Error in warehouse tracking:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET all tracked items in a project
router.get("/project/:project_id", async (req, res) => {
  try {
    const { project_id } = req.params;
    const { source_type } = req.query;

    let query = `
      SELECT 
        inv.id as inventory_id,
        inv.item_id,
        inv.quantity,
        inv.rate,
        inv.created_at as received_date,
        inv.status,
        
        i.item_code,
        i.item_name,
        i.description,
        
        s.source_number,
        s.source_date,
        s.source_type,
        
        p.name as current_project,
        p.project_number

      FROM ims.t_inventory inv
      LEFT JOIN ims.t_item i ON inv.item_id = i.id
      LEFT JOIN ims.t_source s ON inv.source_id = s.id
      LEFT JOIN pms.t_project p ON inv.store_id = p.id
      
      WHERE inv.is_deleted = false
        AND inv.store_id = $1
        AND inv.store_type = 'PROJECT'
    `;

    const params = [project_id];

    if (source_type) {
      query += ` AND s.source_type = $2`;
      params.push(source_type);
    }

    query += ` ORDER BY inv.created_at DESC`;

    const result = await db.query(query, params);

    // Group by item_id
    const itemSummary = {};
    result.rows.forEach(row => {
      if (!itemSummary[row.item_id]) {
        itemSummary[row.item_id] = {
          item_id: row.item_id,
          item_code: row.item_code,
          item_name: row.item_name,
          total_quantity: 0,
          sources: []
        };
      }
      itemSummary[row.item_id].total_quantity += parseFloat(row.quantity || 0);
      itemSummary[row.item_id].sources.push({
        inventory_id: row.inventory_id,
        quantity: row.quantity,
        rate: row.rate,
        source_number: row.source_number,
        source_type: row.source_type,
        received_date: row.received_date
      });
    });

    res.json({
      project_id,
      project_name: result.rows[0]?.current_project || 'Unknown',
      project_number: result.rows[0]?.project_number || null,
      total_items: Object.keys(itemSummary).length,
      total_records: result.rows.length,
      items: Object.values(itemSummary),
      detailed_records: result.rows
    });
  } catch (err) {
    console.error("Error in project tracking:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET all items from a specific source
router.get("/source/:source_id", async (req, res) => {
  try {
    const { source_id } = req.params;

    const query = `
      SELECT 
        inv.id as inventory_id,
        inv.item_id,
        inv.quantity,
        inv.rate,
        inv.created_at as received_date,
        inv.store_type,
        
        i.item_code,
        i.item_name,
        i.description,
        
        s.source_number,
        s.source_date,
        s.source_type,
        s.invoice_number,
        s.po_number,
        
        CASE 
          WHEN inv.store_type = 'WAREHOUSE' THEN w.warehouse_name
          WHEN inv.store_type = 'PROJECT' THEN p.name
        END as current_location

      FROM ims.t_inventory inv
      LEFT JOIN ims.t_item i ON inv.item_id = i.id
      LEFT JOIN ims.t_source s ON inv.source_id = s.id
      LEFT JOIN ims.t_warehouse w ON inv.store_id = w.id AND inv.store_type = 'WAREHOUSE'
      LEFT JOIN pms.t_project p ON inv.store_id = p.id AND inv.store_type = 'PROJECT'
      
      WHERE inv.is_deleted = false
        AND inv.source_id = $1
      ORDER BY inv.created_at DESC
    `;

    const result = await db.query(query, [source_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "No items found for this source"
      });
    }

    res.json({
      source_id,
      source_number: result.rows[0].source_number,
      source_type: result.rows[0].source_type,
      source_date: result.rows[0].source_date,
      total_items: result.rows.length,
      items: result.rows
    });
  } catch (err) {
    console.error("Error in source tracking:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET timeline for an item (chronological movement)
router.get("/item/:item_id/timeline", async (req, res) => {
  try {
    const { item_id } = req.params;

    // Query 1: Inventory-based timeline (warehouse transfers, vendor receipts)
    const inventoryQuery = `
      SELECT 
        inv.created_at as event_date,
        'Received' as event_type,
        inv.quantity,
        inv.rate,
        s.source_number as reference_number,
        s.source_type,
        s.invoice_number,
        'inventory' as record_type,
        
        CASE 
          WHEN inv.store_type = 'WAREHOUSE' THEN w.warehouse_name
          WHEN inv.store_type = 'PROJECT' THEN p.name
        END as location,
        
        inv.store_type as location_type,
        
        CASE 
          WHEN s.sender_warehouse_id IS NOT NULL THEN sw.warehouse_name
          WHEN s.sender_project_id IS NOT NULL THEN sp.name
          WHEN s.vendor_id IS NOT NULL THEN v.business_name
          ELSE 'External Source'
        END as from_location,
        
        CASE 
          WHEN s.sender_warehouse_id IS NOT NULL THEN 'warehouse'
          WHEN s.sender_project_id IS NOT NULL THEN 'project'
          WHEN s.vendor_id IS NOT NULL THEN 'vendor'
          ELSE 'external'
        END as from_location_type,
        
        -- Project-to-Project transfer details
        siwd.sender_bom_id,
        siwd.receiver_bom_id,
        siwd.spec_id,
        sender_spec.spec_description as sender_spec_name,
        receiver_spec.spec_description as receiver_spec_name,
        
        -- Allocation fields (null for inventory)
        NULL::uuid as allocation_id,
        NULL::uuid as bom_id,
        NULL::numeric as required_qty,
        NULL::numeric as allocated_qty

      FROM ims.t_inventory inv
      LEFT JOIN ims.t_source s ON inv.source_id = s.id
      LEFT JOIN ims.t_warehouse w ON inv.store_id = w.id AND inv.store_type = 'WAREHOUSE'
      LEFT JOIN pms.t_project p ON inv.store_id = p.id AND inv.store_type = 'PROJECT'
      LEFT JOIN ims.t_warehouse sw ON s.sender_warehouse_id = sw.id
      LEFT JOIN pms.t_project sp ON s.sender_project_id = sp.id
      LEFT JOIN crm.t_vendor v ON s.vendor_id = v.vendor_id
      LEFT JOIN ims.t_source_item_warehouse_details siwd ON s.id = siwd.source_id AND inv.item_id = siwd.item_id
      LEFT JOIN crm.t_bom_spec sender_spec ON siwd.sender_bom_id = sender_spec.id
      LEFT JOIN crm.t_bom_spec receiver_spec ON siwd.receiver_bom_id = receiver_spec.id
      
      WHERE inv.is_deleted = false
        AND inv.item_id = $1
    `;

    // Query 2: Allocation-based timeline (project-to-project transfers)
    const allocationQuery = `
      SELECT 
        alloc.created_at as event_date,
        'Allocated' as event_type,
        alloc.allocated_qty as quantity,
        alloc.rate,
        s.source_number as reference_number,
        s.source_type,
        s.invoice_number,
        'allocation' as record_type,
        
        rp.name as location,
        'PROJECT' as location_type,
        
        sp.name as from_location,
        'project' as from_location_type,
        
        -- Project-to-Project transfer details
        siwd.sender_bom_id,
        siwd.receiver_bom_id,
        siwd.spec_id,
        sender_spec.spec_description as sender_spec_name,
        receiver_spec.spec_description as receiver_spec_name,
        
        -- Allocation fields
        alloc.id as allocation_id,
        alloc.bom_id,
        alloc.required_qty,
        alloc.allocated_qty

      FROM ims.t_item_allocation alloc
      LEFT JOIN ims.t_item_allocation_details alloc_det ON alloc.id = alloc_det.item_allocation_id
      LEFT JOIN ims.t_source s ON alloc_det.source_id = s.receiver_project_id
      LEFT JOIN pms.t_project sp ON s.sender_project_id = sp.id
      LEFT JOIN pms.t_project rp ON s.receiver_project_id = rp.id
      LEFT JOIN ims.t_source_item_warehouse_details siwd ON s.id = siwd.source_id AND alloc.item_id = siwd.item_id
      LEFT JOIN crm.t_bom_spec sender_spec ON siwd.sender_bom_id = sender_spec.id
      LEFT JOIN crm.t_bom_spec receiver_spec ON siwd.receiver_bom_id = receiver_spec.id
      
      WHERE alloc.is_deleted = false
        AND alloc.item_id = $1
    `;

    // Combine both queries
    const combinedQuery = `
      ${inventoryQuery}
      UNION ALL
      ${allocationQuery}
      ORDER BY event_date DESC
    `;

    const result = await db.query(combinedQuery, [item_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "No timeline data found for this item"
      });
    }

    res.json({
      item_id,
      total_events: result.rows.length,
      timeline: result.rows
    });
  } catch (err) {
    console.error("Error in timeline tracking:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET detailed tracking for a specific inventory record
router.get("/detailed/:inventory_id", async (req, res) => {
  try {
    const { inventory_id } = req.params;

    const query = `
      SELECT 
        inv.*,
        
        -- Item details
        i.item_code,
        i.item_name,
        i.description,
        i.hsn_code,
        i.insurance_status,
        
        -- Source details
        s.source_number,
        s.source_date,
        s.source_type,
        s.invoice_number,
        s.invoice_amount,
        s.po_number,
        s.dc_number,
        s.status as source_status,
        
        -- Current location
        w.warehouse_name,
        w.warehouse_code,
        w.address as warehouse_address,
        p.name as project_name,
        p.project_number,
        p.project_address,
        
        -- Sender details
        sw.warehouse_name as sender_warehouse_name,
        sw.warehouse_code as sender_warehouse_code,
        sp.name as sender_project_name,
        sp.project_number as sender_project_number,
        v.business_name,
        v.vendor_number,
        
        -- Receiver details
        rw.warehouse_name as receiver_warehouse_name,
        rw.warehouse_code as receiver_warehouse_code,
        rp.name as receiver_project_name,
        rp.project_number as receiver_project_number

      FROM ims.t_inventory inv
      LEFT JOIN ims.t_item i ON inv.item_id = i.id
      LEFT JOIN ims.t_source s ON inv.source_id = s.id
      LEFT JOIN ims.t_warehouse w ON inv.store_id = w.id AND inv.store_type = 'WAREHOUSE'
      LEFT JOIN pms.t_project p ON inv.store_id = p.id AND inv.store_type = 'PROJECT'
      LEFT JOIN ims.t_warehouse sw ON s.sender_warehouse_id = sw.id
      LEFT JOIN pms.t_project sp ON s.sender_project_id = sp.id
      LEFT JOIN ims.t_warehouse rw ON s.receiver_warehouse_id = rw.id
      LEFT JOIN pms.t_project rp ON s.receiver_project_id = rp.id
      LEFT JOIN crm.t_vendor v ON s.vendor_id = v.vendor_id
      
      WHERE inv.id = $1 AND inv.is_deleted = false
    `;

    const result = await db.query(query, [inventory_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Inventory record not found"
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error in detailed tracking:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
