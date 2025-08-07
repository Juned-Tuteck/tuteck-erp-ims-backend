const db = require('../../config/database');

const CREATED_BY = '00000000-0000-0000-0000-000000000000';

const categoryController = {
  // Get all categories
  async getAll(req, res) {
    try {
      const result = await db.query(
        'SELECT * FROM ims.t_category WHERE is_active = true AND is_deleted = false ORDER BY created_at DESC'
      );
      
      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows,
        clientMessage: 'Data fetched successfully',
        devMessage: 'Categories retrieved successfully'
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

  // Get category by ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const result = await db.query(
        'SELECT * FROM ims.t_category WHERE id = $1 AND is_active = true AND is_deleted = false',
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: 'Category not found',
          devMessage: 'No category found with the provided ID'
        });
      }

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows[0],
        clientMessage: 'Data fetched successfully',
        devMessage: 'Category retrieved successfully'
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

  // Create category
  async create(req, res) {
    try {
      const { category_code, category_name, parent_category_id, brand_id, description } = req.body;
      
      const result = await db.query(
        `INSERT INTO ims.t_category (category_code, category_name, parent_category_id, brand_id, description, created_by) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [category_code, category_name, parent_category_id, brand_id, description, CREATED_BY]
      );

      return res.status(201).json({
        success: true,
        statusCode: 201,
        data: result.rows[0],
        clientMessage: 'Data inserted successfully',
        devMessage: 'Category created successfully'
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

  // Update category (partial updates supported)
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
        `UPDATE ims.t_category SET ${setClause} WHERE id = $1 AND is_active = true AND is_deleted = false RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: 'Category not found',
          devMessage: 'No category found with the provided ID'
        });
      }

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows[0],
        clientMessage: 'Data updated successfully',
        devMessage: 'Category updated successfully'
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

  // Delete category (soft delete)
  async delete(req, res) {
    try {
      const { id } = req.params;
      
      const result = await db.query(
        `UPDATE ims.t_category SET is_deleted = true, updated_at = now(), updated_by = $2 
         WHERE id = $1 AND is_active = true AND is_deleted = false RETURNING *`,
        [id, CREATED_BY]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          data: null,
          clientMessage: 'Category not found',
          devMessage: 'No category found with the provided ID'
        });
      }

      return res.status(200).json({
        success: true,
        statusCode: 200,
        data: result.rows[0],
        clientMessage: 'Data deleted successfully',
        devMessage: 'Category deleted successfully'
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

  // Bulk insert categories
  async bulkInsert(req, res) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      
      const categories = req.body;
      const insertedCategories = [];

      for (const category of categories) {
        const { category_code, category_name, parent_category_id, brand_id, description } = category;
        const result = await client.query(
          `INSERT INTO ims.t_category (category_code, category_name, parent_category_id, brand_id, description, created_by) 
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [category_code, category_name, parent_category_id, brand_id, description, CREATED_BY]
        );
        insertedCategories.push(result.rows[0]);
      }

      await client.query('COMMIT');

      return res.status(201).json({
        success: true,
        statusCode: 201,
        data: insertedCategories,
        clientMessage: 'Bulk data inserted successfully',
        devMessage: `${insertedCategories.length} categories inserted successfully`
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

module.exports = categoryController;