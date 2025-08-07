const db = require('../../config/database');

const CREATED_BY = '00000000-0000-0000-0000-000000000000';

const uomController = {
  // Get all UOMs
  async getAll(req, res) {
    try {
      const result = await db.query(
        'SELECT * FROM ims.t_uom WHERE is_active = true AND is_deleted = false ORDER BY created_at DESC'
      );
      
      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows,
        clientMessage: 'Data fetched successfully',
        devMessage: 'UOMs retrieved successfully'
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: [],
        clientMessage: 'Something went wrong, please try again later',
        devMessage: error.message
      });
    }
  },

  // Get UOM by ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const result = await db.query(
        'SELECT * FROM ims.t_uom WHERE id = $1 AND is_active = true AND is_deleted = false',
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: 'UOM not found',
          devMessage: 'No UOM found with the provided ID'
        });
      }

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows[0],
        clientMessage: 'Data fetched successfully',
        devMessage: 'UOM retrieved successfully'
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: null,
        clientMessage: 'Something went wrong, please try again later',
        devMessage: error.message
      });
    }
  },

  // Create UOM
  async create(req, res) {
    try {
      const { uom_code, uom_name, description } = req.body;
      
      const result = await db.query(
        `INSERT INTO ims.t_uom (uom_code, uom_name, description, created_by) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [uom_code, uom_name, description, CREATED_BY]
      );

      return res.status(201).json({
        success: true,
        statusCode: 201,
        data: result.rows[0],
        clientMessage: 'Data inserted successfully',
        devMessage: 'UOM created successfully'
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: null,
        clientMessage: 'Something went wrong, please try again later',
        devMessage: error.message
      });
    }
  },

  // Update UOM (partial updates supported)
  async update(req, res) {
    try {
      const { id } = req.params;
      const updateFields = req.body;
      
      const validFields = {};
      Object.keys(updateFields).forEach(key => {
        if (updateFields[key] !== null && updateFields[key] !== undefined) {
          validFields[key] = updateFields[key];
        }
      });

      if (Object.keys(validFields).length === 0) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          data: null,
          clientMessage: 'No valid fields to update',
          devMessage: 'Request body contains no valid update fields'
        });
      }

      validFields.updated_at = new Date();
      validFields.updated_by = CREATED_BY;

      const setClause = Object.keys(validFields).map((key, index) => `${key} = $${index + 2}`).join(', ');
      const values = [id, ...Object.values(validFields)];

      const result = await db.query(
        `UPDATE ims.t_uom SET ${setClause} WHERE id = $1 AND is_active = true AND is_deleted = false RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: 'UOM not found',
          devMessage: 'No UOM found with the provided ID'
        });
      }

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows[0],
        clientMessage: 'Data updated successfully',
        devMessage: 'UOM updated successfully'
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: null,
        clientMessage: 'Something went wrong, please try again later',
        devMessage: error.message
      });
    }
  },

  // Delete UOM (soft delete)
  async delete(req, res) {
    try {
      const { id } = req.params;
      
      const result = await db.query(
        `UPDATE ims.t_uom SET is_deleted = true, updated_at = now(), updated_by = $2 
         WHERE id = $1 AND is_active = true AND is_deleted = false RETURNING *`,
        [id, CREATED_BY]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: 'UOM not found',
          devMessage: 'No UOM found with the provided ID'
        });
      }

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows[0],
        clientMessage: 'Data deleted successfully',
        devMessage: 'UOM deleted successfully'
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: null,
        clientMessage: 'Something went wrong, please try again later',
        devMessage: error.message
      });
    }
  },

  // Bulk insert UOMs
  async bulkInsert(req, res) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      
      const uoms = req.body;
      const insertedUoms = [];

      for (const uom of uoms) {
        const { uom_code, uom_name, description } = uom;
        const result = await client.query(
          `INSERT INTO ims.t_uom (uom_code, uom_name, description, created_by) 
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [uom_code, uom_name, description, CREATED_BY]
        );
        insertedUoms.push(result.rows[0]);
      }

      await client.query('COMMIT');

      return res.status(201).json({
        success: true,
        statusCode: 201,
        data: insertedUoms,
        clientMessage: 'Bulk data inserted successfully',
        devMessage: `${insertedUoms.length} UOMs inserted successfully`
      });
    } catch (error) {
      await client.query('ROLLBACK');
      return res.status(500).json({
        success: false,
        statusCode: 500,
        data: [],
        clientMessage: 'Something went wrong, please try again later',
        devMessage: error.message
      });
    } finally {
      client.release();
    }
  }
};

module.exports = uomController;