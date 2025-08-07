const db = require('../../config/database');

const CREATED_BY = '00000000-0000-0000-0000-000000000000';

const brandController = {
  // Get all brands
  async getAll(req, res) {
    try {
      const result = await db.query(
        'SELECT * FROM ims.t_brand WHERE is_active = true AND is_deleted = false ORDER BY created_at DESC'
      );
      
      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows,
        clientMessage: 'Data fetched successfully',
        devMessage: 'Brands retrieved successfully'
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

  // Get brand by ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const result = await db.query(
        'SELECT * FROM ims.t_brand WHERE id = $1 AND is_active = true AND is_deleted = false',
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: 'Brand not found',
          devMessage: 'No brand found with the provided ID'
        });
      }

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows[0],
        clientMessage: 'Data fetched successfully',
        devMessage: 'Brand retrieved successfully'
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

  // Create brand
  async create(req, res) {
    try {
      const { brand_code, brand_name, description, logo_url } = req.body;
      
      const result = await db.query(
        `INSERT INTO ims.t_brand (brand_code, brand_name, description, logo_url, created_by) 
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [brand_code, brand_name, description, logo_url, CREATED_BY]
      );

      return res.status(201).json({
        success: true,
        statusCode: 201,
        data: result.rows[0],
        clientMessage: 'Data inserted successfully',
        devMessage: 'Brand created successfully'
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

  // Update brand (partial updates supported)
  async update(req, res) {
    try {
      const { id } = req.params;
      const updateFields = req.body;
      
      // Remove null/undefined values and build dynamic query
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

      // Add updated_at and updated_by
      validFields.updated_at = new Date();
      validFields.updated_by = CREATED_BY;

      const setClause = Object.keys(validFields).map((key, index) => `${key} = $${index + 2}`).join(', ');
      const values = [id, ...Object.values(validFields)];

      const result = await db.query(
        `UPDATE ims.t_brand SET ${setClause} WHERE id = $1 AND is_active = true AND is_deleted = false RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: 'Brand not found',
          devMessage: 'No brand found with the provided ID'
        });
      }

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows[0],
        clientMessage: 'Data updated successfully',
        devMessage: 'Brand updated successfully'
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

  // Delete brand (soft delete)
  async delete(req, res) {
    try {
      const { id } = req.params;
      
      const result = await db.query(
        `UPDATE ims.t_brand SET is_deleted = true, updated_at = now(), updated_by = $2 
         WHERE id = $1 AND is_active = true AND is_deleted = false RETURNING *`,
        [id, CREATED_BY]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: 'Brand not found',
          devMessage: 'No brand found with the provided ID'
        });
      }

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows[0],
        clientMessage: 'Data deleted successfully',
        devMessage: 'Brand deleted successfully'
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

  // Bulk insert brands
  async bulkInsert(req, res) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      
      const brands = req.body; // Expecting array of brand objects
      const insertedBrands = [];

      for (const brand of brands) {
        const { brand_code, brand_name, description, logo_url } = brand;
        const result = await client.query(
          `INSERT INTO ims.t_brand (brand_code, brand_name, description, logo_url, created_by) 
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [brand_code, brand_name, description, logo_url, CREATED_BY]
        );
        insertedBrands.push(result.rows[0]);
      }

      await client.query('COMMIT');

      return res.status(201).json({
        success: true,
        statusCode: 201,
        data: insertedBrands,
        clientMessage: 'Bulk data inserted successfully',
        devMessage: `${insertedBrands.length} brands inserted successfully`
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

module.exports = brandController;