const db = require("../../config/database");
const CREATED_BY = "00000000-0000-0000-0000-000000000000";

const allocationDetailsController = {
  // Get all allocation details
  async getAll(req, res) {
    try {
      const result = await db.query(
        "SELECT * FROM ims.t_item_allocation_details WHERE is_active = true AND is_deleted = false ORDER BY created_at DESC"
      );

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows,
        clientMessage: "Data fetched successfully",
        devMessage: "Allocation details retrieved successfully",
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

  // Get allocation detail by ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const result = await db.query(
        "SELECT * FROM ims.t_item_allocation_details WHERE id = $1 AND is_active = true AND is_deleted = false",
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: "Allocation detail not found",
          devMessage: "No allocation detail found with the provided ID",
        });
      }

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows[0],
        clientMessage: "Data fetched successfully",
        devMessage: "Allocation detail retrieved successfully",
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

  // Create allocation detail
  async create(req, res) {
    try {
      const { item_allocation_id, source_id, allocated_qty, rate } = req.body;

      const result = await db.query(
        `INSERT INTO ims.t_item_allocation_details (item_allocation_id, source_id, allocated_qty, rate, created_by) 
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [item_allocation_id, source_id, allocated_qty, rate, CREATED_BY]
      );

      return res.status(201).json({
        success: true,
        statusCode: 201,
        data: result.rows[0],
        clientMessage: "Data inserted successfully",
        devMessage: "Allocation detail created successfully",
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

  // Update allocation detail (partial updates supported)
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
        `UPDATE ims.t_item_allocation_details SET ${setClause} WHERE id = $1 AND is_active = true AND is_deleted = false RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: "Allocation detail not found",
          devMessage: "No allocation detail found with the provided ID",
        });
      }

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows[0],
        clientMessage: "Data updated successfully",
        devMessage: "Allocation detail updated successfully",
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

  // Delete allocation detail (soft delete)
  async delete(req, res) {
    try {
      const { id } = req.params;

      const result = await db.query(
        `UPDATE ims.t_item_allocation_details SET is_deleted = true, updated_at = now(), updated_by = $2 
         WHERE id = $1 AND is_active = true AND is_deleted = false RETURNING *`,
        [id, CREATED_BY]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: "Allocation detail not found",
          devMessage: "No allocation detail found with the provided ID",
        });
      }

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows[0],
        clientMessage: "Data deleted successfully",
        devMessage: "Allocation detail deleted successfully",
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

  // Bulk insert or update allocation details
  async bulkInsert(req, res) {
    const client = await db.getClient();
    try {
      await client.query("BEGIN");

      const allocationDetails = req.body;
      const processedData = [];

      for (const detail of allocationDetails) {
        const { item_allocation_id, source_id, allocated_qty, rate } = detail;

        // Check if the record exists
        const existingRecord = await client.query(
          `SELECT id FROM ims.t_item_allocation_details WHERE item_allocation_id = $1 AND source_id = $2 AND is_active = true AND is_deleted = false`,
          [item_allocation_id, source_id]
        );

        if (existingRecord.rows.length > 0) {
          // Record exists, perform an update
          const result = await client.query(
            `UPDATE ims.t_item_allocation_details 
             SET allocated_qty = $1, rate = $2, updated_at = now(), updated_by = $3 
             WHERE id = $4 RETURNING *`,
            [allocated_qty, rate, CREATED_BY, existingRecord.rows[0].id]
          );

          processedData.push(result.rows[0]);
        } else {
          // Record does not exist, perform an insert
          const result = await client.query(
            `INSERT INTO ims.t_item_allocation_details (item_allocation_id, source_id, allocated_qty, rate, created_by) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [item_allocation_id, source_id, allocated_qty, rate, CREATED_BY]
          );

          processedData.push(result.rows[0]);
        }
      }

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,
        statusCode: 201,
        data: processedData,
        clientMessage: "Bulk data processed successfully",
        devMessage: `${processedData.length} allocation details processed successfully`,
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

module.exports = allocationDetailsController;
