const db = require("../../config/database");

const CREATED_BY = "00000000-0000-0000-0000-000000000000";

const allocationController = {
  // Get all allocations
  async getAll(req, res) {
    try {
      const result = await db.query(
        "SELECT * FROM ims.t_item_allocation WHERE is_active = true AND is_deleted = false ORDER BY created_at DESC"
      );

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows,
        clientMessage: "Data fetched successfully",
        devMessage: "Allocations retrieved successfully",
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

  // Get allocation by ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const result = await db.query(
        "SELECT * FROM ims.t_item_allocation WHERE id = $1 AND is_active = true AND is_deleted = false",
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: "Allocation not found",
          devMessage: "No allocation found with the provided ID",
        });
      }

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows[0],
        clientMessage: "Data fetched successfully",
        devMessage: "Allocation retrieved successfully",
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

  // Create allocation
  async create(req, res) {
    try {
      const { item_id, bom_id, item_name, required_qty, allocated_qty, rate } =
        req.body;

      const result = await db.query(
        `INSERT INTO ims.t_item_allocation (item_id, bom_id, item_name, required_qty, allocated_qty, rate, created_by) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          item_id,
          bom_id,
          item_name,
          required_qty,
          allocated_qty,
          rate,
          CREATED_BY,
        ]
      );

      return res.status(201).json({
        success: true,
        statusCode: 201,
        data: result.rows[0],
        clientMessage: "Data inserted successfully",
        devMessage: "Allocation created successfully",
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

  // Update allocation (partial updates supported)
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
        `UPDATE ims.t_item_allocation SET ${setClause} WHERE id = $1 AND is_active = true AND is_deleted = false RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: "Allocation not found",
          devMessage: "No allocation found with the provided ID",
        });
      }

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows[0],
        clientMessage: "Data updated successfully",
        devMessage: "Allocation updated successfully",
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

  // Delete allocation (soft delete)
  async delete(req, res) {
    try {
      const { id } = req.params;

      const result = await db.query(
        `UPDATE ims.t_item_allocation SET is_deleted = true, updated_at = now(), updated_by = $2 
         WHERE id = $1 AND is_active = true AND is_deleted = false RETURNING *`,
        [id, CREATED_BY]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: "Allocation not found",
          devMessage: "No allocation found with the provided ID",
        });
      }

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows[0],
        clientMessage: "Data deleted successfully",
        devMessage: "Allocation deleted successfully",
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

  // Bulk insert or update allocations
  async bulkInsertOrUpdate(req, res) {
    console.log("Bulk Insert/Update Allocations:");
    const client = await db.getClient();
    try {
      await client.query("BEGIN");

      const allocations = req.body;
      const processedData = [];

      for (const allocation of allocations) {
        const {
          item_id,
          bom_id,
          item_name,
          required_qty,
          allocated_qty,
          rate,
        } = allocation;

        // Check if the allocation already exists
        const existingAllocation = await client.query(
          `SELECT id FROM ims.t_item_allocation WHERE item_id = $1 AND bom_id = $2 AND is_active = true AND is_deleted = false`,
          [item_id, bom_id]
        );
        console.log("Existing Allocation:", existingAllocation.rows);

        if (existingAllocation.rows.length > 0) {
          // Update the existing allocation
          const updateResult = await client.query(
            `UPDATE ims.t_item_allocation 
             SET item_name = $1, required_qty = $2, allocated_qty = $3, rate = $4, updated_at = now(), updated_by = $5 
             WHERE item_id = $6 AND bom_id = $7 AND is_active = true AND is_deleted = false RETURNING *`,
            [
              item_name,
              required_qty,
              allocated_qty,
              rate,
              CREATED_BY,
              item_id,
              bom_id,
            ]
          );
          processedData.push(updateResult.rows[0]);
        } else {
          // Insert a new allocation
          const insertResult = await client.query(
            `INSERT INTO ims.t_item_allocation (item_id, bom_id, item_name, required_qty, allocated_qty, rate, created_by) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [
              item_id,
              bom_id,
              item_name,
              required_qty,
              allocated_qty,
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
        devMessage: `${processedData.length} allocations processed successfully`,
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

module.exports = allocationController;
