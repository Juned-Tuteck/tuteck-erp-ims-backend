const db = require("../../config/database");

const CREATED_BY = "00000000-0000-0000-0000-000000000000";

const materialIssueController = {
  // Get all material issue items
  async getAll(req, res) {
    try {
      const result = await db.query(
        `SELECT 
                mi.*, 
                w.warehouse_name, 
                w.address,
                project.name AS project_name
            FROM ims.t_material_issues mi
            LEFT JOIN pms.t_project project ON mi.sender_reference_id = project.id
            LEFT JOIN ims.t_warehouse w 
            ON mi.sender_reference_id = w.id
            WHERE mi.is_active = true AND mi.is_deleted = false 
            ORDER BY mi.created_at DESC`
      );
      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows,
        clientMessage: "Data fetched successfully",
        devMessage: "Material issue items retrieved successfully",
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: [],
        clientMessage: "Something went wrong, please try again later",
        devMessage: error.message,
      });
    }
  },

  // Get material issue item by ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const result = await db.query(
        "SELECT * FROM ims.t_material_issue_items WHERE id = $1 AND is_active = true AND is_deleted = false",
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: "Material issue item not found",
          devMessage: "No material issue item found with the provided ID",
        });
      }
      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows[0],
        clientMessage: "Data fetched successfully",
        devMessage: "Material issue item retrieved successfully",
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: null,
        clientMessage: "Something went wrong, please try again later",
        devMessage: error.message,
      });
    }
  },

  // Create material issue item
  async create(req, res) {
    try {
      const {
        issue_number,
        issue_date,
        issue_expected_date,
        sender_type,
        issuance_type,
        sender_reference_id,
        status,
      } = req.body;
      console.log("Received data:", req.body);

      const result = await db.query(
        `INSERT INTO ims.t_material_issues (
                    issue_number,
                    issue_date, 
                    issue_expected_date, 
                    sender_type, 
                    issuance_type,
                    sender_reference_id, 
                    status, 
                    created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          issue_number,
          issue_date,
          issue_expected_date,
          sender_type || "warehouse",
          issuance_type || "warehouse",
          sender_reference_id,
          status || "pending",
          CREATED_BY,
        ]
      );

      return res.status(201).json({
        success: true,
        statusCode: 201,
        data: result.rows[0],
        clientMessage: "Material issue item created successfully",
        devMessage: "Material issue item inserted successfully",
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: null,
        clientMessage: "Something went wrong, please try again later",
        devMessage: error.message,
      });
    }
  },

  // Update material issue item (partial updates supported)
  async update(req, res) {
    try {
      const { id } = req.params;
      const updateFields = req.body;
      const validFields = {};
      Object.keys(updateFields).forEach((key) => {
        if (updateFields[key] !== null && updateFields[key] !== undefined) {
          validFields[key] = updateFields[key];
        }
      });
      if (Object.keys(validFields).length === 0) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          data: null,
          clientMessage: "No valid fields to update",
          devMessage: "Request body contains no valid update fields",
        });
      }
      validFields.updated_at = new Date();
      validFields.updated_by = CREATED_BY;
      const setClause = Object.keys(validFields)
        .map((key, index) => `${key} = $${index + 2}`)
        .join(", ");
      const values = [id, ...Object.values(validFields)];
      const result = await db.query(
        `UPDATE ims.t_material_issues SET ${setClause} WHERE id = $1 AND is_active = true AND is_deleted = false RETURNING *`,
        values
      );
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: "Material issue item not found",
          devMessage: "No material issue item found with the provided ID",
        });
      }
      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows[0],
        clientMessage: "Data updated successfully",
        devMessage: "Material issue item updated successfully",
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: null,
        clientMessage: "Something went wrong, please try again later",
        devMessage: error.message,
      });
    }
  },

  // Delete material issue item (soft delete)
  async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await db.query(
        `UPDATE ims.t_material_issue_items SET is_deleted = true, updated_at = now(), updated_by = $2 
				 WHERE id = $1 AND is_active = true AND is_deleted = false RETURNING *`,
        [id, CREATED_BY]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: "Material issue item not found",
          devMessage: "No material issue item found with the provided ID",
        });
      }
      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows[0],
        clientMessage: "Data deleted successfully",
        devMessage: "Material issue item deleted successfully",
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: null,
        clientMessage: "Something went wrong, please try again later",
        devMessage: error.message,
      });
    }
  },

  // Bulk insert or update material issue items
  async bulkInsertOrUpdate(req, res) {
    const client = await db.getClient();
    try {
      await client.query("BEGIN");
      const items = req.body;
      const processedData = [];
      for (const item of items) {
        const {
          issue_id,
          inventory_id,
          item_id,
          issued_quantity,
          crm_bom_id,
          receiving_reference_id,
          rate,
        } = item;
        // Check if the item already exists
        const existingItem = await client.query(
          `SELECT id FROM ims.t_material_issue_items WHERE inventory_id = $1 AND item_id = $2 AND is_active = true AND is_deleted = false`,
          [inventory_id, item_id]
        );
        if (existingItem.rows.length > 0) {
          // Update the existing item
          const updateResult = await client.query(
            `UPDATE ims.t_material_issue_items 
						 SET issue_id = $1, issued_quantity = $2, crm_bom_id = $3, receiving_reference_id = $4, rate = $5, updated_at = now(), updated_by = $6 
						 WHERE inventory_id = $7 AND item_id = $8 AND is_active = true AND is_deleted = false RETURNING *`,
            [
              issue_id,
              issued_quantity,
              crm_bom_id,
              receiving_reference_id,
              rate,
              CREATED_BY,
              inventory_id,
              item_id,
            ]
          );
          processedData.push(updateResult.rows[0]);
        } else {
          // Insert a new item
          const insertResult = await client.query(
            `INSERT INTO ims.t_material_issue_items (issue_id, inventory_id, item_id, issued_quantity, crm_bom_id, receiving_reference_id, rate, created_by) 
						 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [
              issue_id,
              inventory_id,
              item_id,
              issued_quantity,
              crm_bom_id,
              receiving_reference_id,
              rate,
              CREATED_BY,
            ]
          );
          processedData.push(insertResult.rows[0]);
        }
      }
      await client.query("COMMIT");
      return res.status(201).json({
        success: true,
        statusCode: 201,
        data: processedData,
        clientMessage: "Bulk data processed successfully",
        devMessage: `${processedData.length} material issue items processed successfully`,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: [],
        clientMessage: "Something went wrong, please try again later",
        devMessage: error.message,
      });
    } finally {
      client.release();
    }
  },

  // Get BOM details by BOM ID
  async getBomDetailsById(req, res) {
    try {
      const { bomId } = req.params;
      console.log("Fetching BOM details for ID:", bomId);
      
      const query = `
        SELECT 
          bom.*, 
          lead.lead_number, lead.business_name, lead.project_name, lead.project_value, lead.lead_type, lead.work_type, 
          project.name AS project_name,
          json_agg(
            json_build_object(
              'item', item,
              'required_quantity', aggregated_details.total_required_quantity,
              'supply_rate', aggregated_details.supply_rate,
              'installation_rate', aggregated_details.installation_rate,
              'net_rate', aggregated_details.net_rate,
              'material_type', aggregated_details.material_type
            )
          ) AS items
        FROM crm.t_bom bom
        LEFT JOIN crm.t_lead lead ON bom.lead_id = lead.lead_id
        LEFT JOIN pms.t_project project ON bom.project_id = project.id
        LEFT JOIN (
          SELECT 
            bom_detail.bom_id,
            bom_detail.item_id,
            SUM(bom_detail.required_quantity) AS total_required_quantity,
            MAX(bom_detail.supply_rate) AS supply_rate,
            MAX(bom_detail.installation_rate) AS installation_rate,
            MAX(bom_detail.net_rate) AS net_rate,
            MAX(bom_detail.material_type) AS material_type
          FROM crm.t_bom_detail bom_detail
          GROUP BY bom_detail.bom_id, bom_detail.item_id
        ) AS aggregated_details ON bom.id = aggregated_details.bom_id
        LEFT JOIN ims.t_item item ON aggregated_details.item_id = item.id
        WHERE bom.is_active = TRUE AND bom.is_deleted = FALSE AND bom.id = $1
        GROUP BY bom.id, lead.lead_number, lead.business_name, lead.project_name, lead.project_value, lead.lead_type, lead.work_type, project.name
        ORDER BY bom.created_at DESC;
      `;

      const result = await db.query(query, [bomId]);
      
      res.json({
        success: true,
        statusCode: 200,
        data: result.rows[0],
        clientMessage: "BOM detail fetched successfully",
        devMessage:
          "Fetched BOM detail with aggregated required_quantity for items and project name from pms.t_project",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        statusCode: 500,
        data: null,
        clientMessage: "Something went wrong, please try again later",
        devMessage: error.message,
      });
    }
  },

  // Reject material issue item
  async reject(req, res) {
    const client = await db.getClient();
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          data: null,
          clientMessage: "Status is required",
          devMessage: "Status field is missing in the request body",
        });
      }

      await client.query("BEGIN");

      // Fetch all inventory_ids for the given MI id
      const itemsResult = await client.query(
        `SELECT inventory_id FROM ims.t_material_issue_items WHERE issue_id = $1 AND is_active = true AND is_deleted = false`,
        [id]
      );

      for (const allocation of itemsResult.rows) {
        const allocationJson = JSON.parse(allocation.inventory_id);

      // Update inventory quantities
      for (const inventory of allocationJson) {
        await client.query(
          `UPDATE ims.t_inventory SET quantity = quantity + $1, updated_at = now(), updated_by = $2 WHERE id = $3`,
          [inventory.allocated_qty, CREATED_BY, inventory.inventory_id]
        );
      }
    }
      // Update the status of the material issue
      const result = await client.query(
        `UPDATE ims.t_material_issues SET status = $1, updated_at = now(), updated_by = $2 
         WHERE id = $3 AND is_active = true AND is_deleted = false RETURNING *`,
        [status, CREATED_BY, id]
      );

      if (result.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: "Material issue item not found",
          devMessage: "No material issue item found with the provided ID",
        });
      }

      await client.query("COMMIT");

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows[0],
        clientMessage: "Status updated successfully",
        devMessage: "Material issue item status updated successfully",
      });
    } catch (error) {
      await client.query("ROLLBACK");
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: null,
        clientMessage: "Something went wrong, please try again later",
        devMessage: error.message,
      });
    } finally {
      client.release();
    }
  },

  // Get material issue details (basic + items + transfers)
  async getP2PDetails(req, res) {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          data: null,
          clientMessage: "Material issue id is required",
          devMessage: "Missing id param",
        });
      }

      // 1) Fetch basic material issue row
      const issueResult = await db.query(
        `SELECT mi.*,p.name as project_name FROM ims.t_material_issues mi
        LEFT JOIN pms.t_project p on p.id = mi.sender_reference_id
        WHERE mi.id = $1 AND mi.is_active = true AND mi.is_deleted = false`,
        [id]
      );

      if (issueResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: "Material issue not found",
          devMessage: "No material issue found with the provided ID",
        });
      }

      const issue = issueResult.rows[0];

      // 2) Fetch all issuance items for this issue
      const itemsResult = await db.query(
        `SELECT i.*
        FROM ims.t_material_issuance_items_p2p i
        WHERE i.issuance_id = $1`,
        [id]
      );

      const items = itemsResult.rows;

      // If no items, return object with empty item_details array
      if (items.length === 0) {
        const response = {
          "basic_detail": issue,
          "item_details": [],
        };
        return res.status(200).json({
          success: true,
          statusCode: 200,
          data: response,
          clientMessage: "Material issue details fetched successfully",
          devMessage: "No issuance items found for this material issue",
        });
      }

      // 3) Fetch transfers for all items in a single query to avoid N+1
      const itemIds = items.map((it) => it.id);
      const transfersResult = await db.query(
        `SELECT * FROM ims.t_material_issuance_item_transfers_p2p
        WHERE issuance_item_id = ANY($1::uuid[])`,
        [itemIds]
      );

      const transfers = transfersResult.rows;

      // 4) Group transfers by issuance_item_id
      const transfersByItem = transfers.reduce((acc, t) => {
        const key = t.issuance_item_id;
        if (!acc[key]) acc[key] = [];
        // parse numeric fields
        acc[key].push({
          ...t,
          transfer_qty:
            t.transfer_qty !== null ? parseFloat(t.transfer_qty) : null,
        });
        return acc;
      }, {});

      // 5) Attach transfers into items and convert numeric fields
      const itemsWithTransfers = items.map((it) => {
        return {
          ...it,
          allocated_qty:
            it.allocated_qty !== null ? parseFloat(it.allocated_qty) : null,
          total_transferred_qty:
            it.total_transferred_qty !== null
              ? parseFloat(it.total_transferred_qty)
              : null,
          "item_transfer_details":
            transfersByItem[it.id] || [],
        };
      });

      // 6) Build final response shape
      const response = {
        "basic_detail": issue,
        "item_details": itemsWithTransfers,
      };

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: response,
        clientMessage: "Material issue details fetched successfully",
        devMessage:
          "Fetched material issue, its issuance items (p2p) and their transfers (p2p)",
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: null,
        clientMessage: "Something went wrong, please try again later",
        devMessage: error.message,
      });
    }
  },
};

module.exports = materialIssueController;
