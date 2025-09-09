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
                w.address 
            FROM ims.t_material_issues mi
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
        issue_date,
        issue_expected_date,
        sender_type,
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
                    sender_reference_id, 
                    status, 
                    created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          null,
          issue_date,
          issue_expected_date,
          sender_type || "warehouse",
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
};

module.exports = materialIssueController;
