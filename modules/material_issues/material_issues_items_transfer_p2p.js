const db = require("../../config/database");

const CREATED_BY = "00000000-0000-0000-0000-000000000000";

const materialIssuanceItemTransfersP2PController = {
  // ============================
  // 1. Get all P2P transfer items
  // ============================
  async getAll(req, res) {
    try {
      const result = await db.query(
        `SELECT * FROM ims.t_material_issuance_item_transfers_p2p 
         ORDER BY created_at DESC`
      );

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows,
        clientMessage: "Data fetched successfully",
        devMessage: "P2P material issuance item transfers retrieved successfully",
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

  // ==========================================
  // 2. Bulk Insert P2P Transfer Items
  // ==========================================
  async bulkInsert(req, res) {
    const client = await db.getClient();
    try {
      const items = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          clientMessage: "Invalid payload",
          devMessage: "Expected an array of items",
        });
      }

      await client.query("BEGIN");
      const insertedData = [];

      for (const item of items) {
        const {
          issuance_item_id,
          receiving_bom_id,
          receiving_spec_id,
          transfer_qty,
          receiving_project_id,
        } = item;

        const resultInsert = await client.query(
          `INSERT INTO ims.t_material_issuance_item_transfers_p2p
          (issuance_item_id, receiving_bom_id, receiving_spec_id, transfer_qty, receiving_project_id, created_by)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *`,
          [
            issuance_item_id,
            receiving_bom_id,
            receiving_spec_id,
            transfer_qty,
            receiving_project_id || null,
            CREATED_BY,
          ]
        );

        insertedData.push(resultInsert.rows[0]);
      }

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,
        statusCode: 201,
        data: insertedData,
        clientMessage: "Bulk insert successful",
        devMessage: `${insertedData.length} P2P transfer records inserted successfully`,
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

  // ==========================================
  // 3. Bulk Update – Partial update logic
  // ==========================================
  async bulkUpdate(req, res) {
    const client = await db.getClient();

    try {
      const items = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          clientMessage: "Invalid payload",
          devMessage: "Expected an array of items",
        });
      }

      await client.query("BEGIN");
      const updatedData = [];

      for (const item of items) {
        const { id, ...fields } = item;

        if (!id) {
          return res.status(400).json({
            success: false,
            statusCode: 400,
            clientMessage: "ID is required for update",
            devMessage: "Missing ID in update payload",
          });
        }

        const validFields = {};

        Object.keys(fields).forEach((key) => {
          if (fields[key] !== null && fields[key] !== undefined) {
            validFields[key] = fields[key];
          }
        });

        if (Object.keys(validFields).length === 0) continue;

        validFields.updated_at = new Date();
        validFields.updated_by = CREATED_BY;

        const setClause = Object.keys(validFields)
          .map((key, index) => `${key} = $${index + 2}`)
          .join(", ");

        const values = [id, ...Object.values(validFields)];

        const updateResult = await client.query(
          `UPDATE ims.t_material_issuance_item_transfers_p2p
           SET ${setClause}
           WHERE id = $1
           RETURNING *`,
          values
        );

        if (updateResult.rows.length > 0) {
          updatedData.push(updateResult.rows[0]);
        }
      }

      await client.query("COMMIT");

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: updatedData,
        clientMessage: "Bulk update successful",
        devMessage: `${updatedData.length} P2P transfer records updated successfully`,
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

module.exports = materialIssuanceItemTransfersP2PController;
